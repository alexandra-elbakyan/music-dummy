var express = require('express');
var router = express.Router();

const fs = require("fs");
const fetch = require('node-fetch');
const stream = require('stream');

const AWS = require("aws-sdk");
const awsconfig = JSON.parse(fs.readFileSync("aws.json"));

AWS.config.update(awsconfig);


const s3 = new AWS.S3();
const ddb = new AWS.DynamoDB();
const ddc = new AWS.DynamoDB.DocumentClient();


router.get('/', function(req, res, next) {
  res.render('setup');
});


router.get('/login', async function(req, res, next) {

  var params = {
    AttributeDefinitions: [
      {AttributeName: "email", AttributeType: "S"},
      {AttributeName: "user_name", AttributeType: "S"},
    ],
    KeySchema: [
      {AttributeName: "email", KeyType: "HASH"},
      {AttributeName: "user_name", KeyType: "RANGE"},
    ],
    ProvisionedThroughput: {ReadCapacityUnits: 1, WriteCapacityUnits: 1},
    TableName: "login",
    StreamSpecification: {StreamEnabled: false},
  };

  await ddb.createTable(params).promise();

  do {
    await new Promise(resolve => setTimeout(resolve, 1000));
    var description = await ddb.describeTable({TableName: 'login'}).promise();
  } while (description.Table.TableStatus !== 'ACTIVE');

  var requests = [];
  for (i = 0; i < 10; i++)
    requests.push({
      PutRequest: {
        Item: {
          email: { S: "s3967944" + i + "@rmit.edu.vn" },
          user_name: { S: "Alexandra Elbakyan" + i },
          password: { S: Array.from({length: 6}, (_, j) => (i + j) % 10).join('') },
        },
      },
    });

  await ddb.batchWriteItem({RequestItems: {login: requests}}).promise();

  res.send({success: true});
});


router.get('/upload', async function(req, res, next) {

  fs.readFile("data/a2.json", "utf8", async (error, data) => {

    songs = JSON.parse(data).songs;

    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      var i = await ddb.describeTable({TableName: 'music'}).promise();
    } while (i.Table.TableStatus !== 'ACTIVE');

    var requests = [];
    for (i = 0; i < songs.length; i++)
    {
      song = songs[i];
      song.year = Number(song.year);
      requests.push({PutRequest: {Item: song}});
      if (requests.length == 25 || (i == songs.length - 1))
      {
          await ddc.batchWrite({RequestItems: {music: requests}}).promise();
          requests = [];
      }
    };
  });

  res.send({success: true});
});


router.get('/pictures', function(req, res, next) {

  const uploadStream = ({ Bucket, Key, ContentType }) => {
    const pass = new stream.PassThrough();
    return {
      writeStream: pass,
      promise: s3.upload({ Bucket, Key, ContentType, Body: pass }).promise(),
    };
  }

  fs.readFile("data/a2.json", "utf8", async (error, data) => {
    songs = JSON.parse(data).songs;

    await Promise.all(
      songs.map(async (song) => {
        var response = await fetch(song.img_url);
        const { writeStream, promise } = uploadStream (
          {Bucket:      'pictures-s3967944',
           ContentType: 'image/jpeg',
           Key: song.artist}
        );
        response.body.pipe(writeStream);
        result = await promise;
      }),
    );

  });

  res.send({success: true});
});

router.get('/music', async function(req, res, next) {

  var params = {
    AttributeDefinitions: [
      {AttributeName: "artist",AttributeType: "S"},
      {AttributeName: "title", AttributeType: "S"},
    ],
    KeySchema: [
      {AttributeName: "artist", KeyType: "HASH"},
      {AttributeName: "title", KeyType: "RANGE"}
    ],
    ProvisionedThroughput: {ReadCapacityUnits: 1, WriteCapacityUnits: 1},
    TableName: "music",
    StreamSpecification: {StreamEnabled: false},
  };

  await ddb.createTable(params).promise();

  res.send({success: true});
});


module.exports = router;
