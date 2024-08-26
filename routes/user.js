var express = require('express');
var router = express.Router();
var deepequal = require('deep-equal');

const AWS = require("aws-sdk");
const session = require('express-session');

const fs = require("fs");
const awsconfig = JSON.parse(fs.readFileSync("aws.json"));

AWS.config.update(awsconfig);


const ddc = new AWS.DynamoDB.DocumentClient();

router.get('/login', function(req, res, next) {
  res.render('login');
});

router.get('/logout', function(req, res, next) {
  req.session.destroy();
  res.redirect('/user/login');
});

router.get('/register', function(req, res, next) {
  res.render('register');
});

router.post('/remove', async function(req, res, next) {

      var song = {artist: req.body.artist,
                   title:  req.body.title,
                    year:   Number(req.body.year)}

      var songs = req.session.subscribed.filter(function(s) {
           return !deepequal(s, song); }); 

      var query = {
          TableName: 'login',
          Key: {email: req.session.email,
          user_name: req.session.username},
          UpdateExpression: "set #subscribed = :subscribed",
          ExpressionAttributeNames:  {"#subscribed": "subscribed"},
          ExpressionAttributeValues: {":subscribed": songs}
      };

      ddc.update(query, (err, data) => { });

  req.session.subscribed = songs;
  res.send({'removed' : true});

});

router.post('/subscribe', async function(req, res, next) {

  var song = {artist: req.body.artist,
              title:  req.body.title,
              year:   Number(req.body.year)}

  if (req.session.subscribed) req.session.subscribed.push(song);
  else req.session.subscribed = [song]

  var query = {
    TableName: 'login',
    Key: {email: req.session.email,
      user_name: req.session.username},
    UpdateExpression: "set #subscribed = :subscribed",
    ExpressionAttributeNames:  {"#subscribed": "subscribed"},
    ExpressionAttributeValues: {":subscribed": req.session.subscribed}
  };

  ddc.update(query, (err, data) => { });
  res.send({'subscribed' : true});

});


router.post('/register', async function(req, res, next) {

  var result = await ddc.query({
      TableName: "login",
      ExpressionAttributeNames:  {"#email" : "email"},
      ExpressionAttributeValues: {":email"    : req.body.email},
      KeyConditionExpression: "#email = :email",
  }).promise();

  if (result.Count == 0)
  {
      ddc.put({
          TableName: 'login',
          Item: {
            user_name: req.body.username,
            email: req.body.email,
            password: req.body.password
          }
        }, (err, data) => { });

      res.send({'registered' : true});
  }
  else
      res.send({'registered' : false});
});

router.post('/login', async function(req, res, next) {

    var result = await ddc.query({
      TableName: "login",
      ExpressionAttributeNames:  {"#password" : "password",
                                     "#email" : "email"},
      ExpressionAttributeValues: {":email"    : req.body.email,
                                  ":password" : req.body.password},
      FilterExpression:       "#password = :password",
      KeyConditionExpression: "#email = :email",
    }).promise();

    if (result.Count > 0)
    {
      let user = result.Items[0];
      req.session.username = user.user_name;
      req.session.email = user.email;
      if (user?.subscribed)
      {
          let songs = [];
          for (i = 0; i < user.subscribed.length; i++)
              songs.push({artist: user.subscribed[i].artist,
                          title:  user.subscribed[i].title,
                          year:   user.subscribed[i].year});
          req.session.subscribed = songs;
      }
    }

    res.send({'authenticated': (result.Count > 0)});
});


module.exports = router;

