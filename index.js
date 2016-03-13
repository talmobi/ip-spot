var http = require('http');
var express = require('express');
var app = express();

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var extend = require('extend');

var dns = require('dns');
var URL = require('url');

var request = require('request');

var jade = require('jade');
var locals = {
  title: 'ip-spot.com - your public ip',
};

app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));

var url = "mongodb://localhost:27017/ip-spot";
MongoClient.connect(url, function (err, db) {
  assert.equal(null, err);
  console.log("Connected to mongodb server");

  app.get('/', function (req, res) {
    var collection = db.collection('ips');
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

    db.collection('dns-lookups').find().sort({_id: -1}).limit(10).toArray(function (err, docs) {
      if (err) {
        res.status(500).json(err).end();
        return console.error(err);
      }

      var filter = docs.filter(function (val, ind, arr) {
        return val && val.addresses && val.addresses[0];
      });

      var data = {
        ip: ip,
        recent_lookups: filter
      };

      var html = jade.renderFile('./jade/index.jade', extend(locals, data));

      return res.send(html).end();
    });

  });

  app.get('/:url', function (req, res) {
    var collection = db.collection('dns-lookups');

    console.log("url: %s", req.params.url);
    var url = req.params.url;
    if (url.indexOf('http') == -1) {
      url = 'http://' + url;
    }

    var hostname = URL.parse( url ).hostname;
    console.log("hostname: %s", hostname);

    dns.lookup(hostname, { all: true }, function (err, addresses) {
      if (err) {
        res.status(500).json(err).end();
        return console.error(err);
      };

      var doc = {
        hostname: hostname,
        addresses: addresses
      };

      res.json(doc).end();

      collection.insert(doc, function (err, result) {
        if (err) {
          return console.error(err);
        }
        console.log("saved dns-lookup [%s] to mongodb", doc.hostname);
      });
    });
  });
});

var port = 3060;

var server = http.createServer(app);
server.listen(port);
console.log("ip-spot listening on port: %s", port);
