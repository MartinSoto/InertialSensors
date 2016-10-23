var fs = require("fs");

var express = require('express');
var bodyParser = require('body-parser');

var app = express();


app
  .use(bodyParser.json());

app.get('/api', function (req, res) {
  res.send('Welcome to the API');
});

var eventData = [];

app.put('/api/data', function (req, res) {
  console.log("Data received for position", req.body.position);

  var events = req.body.events, position = req.body.position;
  for (var i = 0; i < events.length; i += 1) {
    eventData[position + i] = events[i];
  }
  res.status(200).send({
    position: req.body.position,
    count: req.body.events.length
  });
});

app.put('/api/close', function (req, res) {
  console.log("Data finished. Total items:", req.body.totalCount);

  fs.writeFile("./inertial-events.json", JSON.stringify(eventData));
  eventData = [];

  res.status(204).send('');
});

app.listen(3000, function () {
  console.log('Capture server running on port 3000');
});
