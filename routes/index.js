var express = require('express');
var router = express.Router();

const fs = require("fs");
const awsconfig = JSON.parse(fs.readFileSync("aws.json"));

const AWS = require("aws-sdk");

AWS.config.update(awsconfig);

const ddc = new AWS.DynamoDB.DocumentClient();



router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/main', function(req, res, next) {
  if (req.session?.username)
    res.render('main', {username: req.session.username,
                           songs: JSON.stringify(req.session.subscribed)});
  else
    res.redirect('/user/login');
});


router.post('/search', async function(req, res, next) {

  var names  = {};
  var values = {};
  var filter = [];
  
  ['artist', 'title', 'year'].forEach(condition => {
        if (req.body[condition].length)
        {              
              if (condition == 'year')
              {
                    names['#yyyy'] = condition;
                    values[':year'] = Number(req.body.year);
                    filter.push('#yyyy = :year');
              }
              else
              {
                    names['#' + condition] = condition;
                    values[':' + condition] = req.body[condition];
                    filter.push('contains (#' + condition + ', :' + condition + ')');
              }
        }
  });

  var query = {
    TableName: "music",
    ExpressionAttributeNames:  names,
    ExpressionAttributeValues: values,
    FilterExpression:          filter.join(' AND ')
  };

  function onScan(err, data) {
    if (err) {
        console.error("Unable to scan the table. Error:", err);
    } else {

        console.log("Scan succeeded.");
    }
}

  var result = await ddc.scan(query, onScan).promise();

  res.send({'items': result.Items});
});

module.exports = router;
