var http = require('http');
var app = require('express')();

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var extend = require('extend');

var jade = require('jade');
var locals = {
  title: 'ip-spot.com - your public ip',
};

var url = "mongodb://localhost:27017/ip-spot";
MongoClient.connect(url, function (err, db) {
	assert.equal(null, err);
	console.log("Connected to mongodb server");

  var collection = db.collection('ips');

  app.get('/', function (req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

	ip = ip.split(/,*\s+/)[0];

	console.log(ip);

    var doc = {
      ip: ip,
      remoteAddress: req.connection.remoteAddress,
      'x-forwarded-for': req.headers['x-forwarded-for']
    };
    collection.insert(doc, function (err, result) {
      if (err) {
        return console.error(err);
      }
      console.log("saved ip [%s] to mongodb", ip);
    });

    collection.find().sort({_id: -1}).limit(10).toArray(function (err, docs) {
      if (err) {
        return console.error(err);
      }

      var data = {
        ip: ip,
        recent_ips: docs
      };

      var html = jade.renderFile('./jade/index.jade', extend(locals, data));

      return res.send(html).end();
    });

  });
});


var port = 3060;

var server = http.createServer(app);
server.listen(port);
console.log("ip-spot listening on port: %s", port);
