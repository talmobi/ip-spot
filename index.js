var http = require('http');
var express = require('express');
var app = express();

var r = require('rethinkdb');

var assert = require('assert');
var extend = require('extend');

var dns = require('dns');
var URL = require('url');

// used to parse for ip lookup to iplocation.net
var request = require('request');
var cheerio = require('cheerio');

var jade = require('jade');
var locals = {
  title: 'ip-spot.com - your public ip',
};

function iplocationLookup (hostname, done) {
  var url = "https://www.iplocation.net";
  var formData = {
    query: hostname,
    submit: "IP Lookup"
  };

  request({
    method: 'POST',
    url: url,
    formData: formData
  }, function (error, response, body) {
    if (error) {
      return done(error);
    }

    var $ = cheerio.load(body);
    var tds = $("tbody tr td");

    var spans = $('span');
    var text = spans.text();

    var results = /(\d+\.{1}\d+\.{1}\d+\.{1}\d+)/.exec( text );
    var ip = results[0] || results[1];

    var data = {
      ip: ip,
      hostname: $(tds[0]).text(),
      country: $(tds[1]).text(),
      region: $(tds[2]).text(),
      city: $(tds[3]).text()
    };

    return done(null, data);
  });
};

function dnsLookup (hostname, done) {
  dns.lookup(hostname, { all: true }, function (err, addresses) {
    if (err) {
      return done(err);
    };

    var data = {
      ip: addresses[0].address,
      addresses: addresses
    };

    return done(null, data);
  });
};

app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/assets', express.static(__dirname + '/assets'));

var connection = null;
r.connect({host: 'localhost', port: 28015 }, function (err, conn) {
  if (err) throw err;
  connection = conn;
  console.log("connected to rethinkdb");

  // create table, ignore error if it already exists
  r.tableCreate('ip_spot').run(connection, function (err, result) {
    if (err) {
      // ignore, probably because the table already exists...
    }
  });

  app.get('/', function (req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    ip = ip.split(/,*\s+/)[0];

    console.log(ip);

    var doc = {
      type: 'pageview',
      created_at: Date.now(),
      ip: ip,
      remoteAddress: req.connection.remoteAddress,
      'x-forwarded-for': req.headers['x-forwarded-for']
    };

    r.table('ip_spot').insert( doc ).run(connection, function (err, result) {
      if (err) throw err;
      console.log("saved ip [%s] to rethinkdb", ip);
    })

    r.table('ip_spot').filter({type: 'search'}).orderBy(r.desc('created_at')).limit(10).run(connection, function (err, cursor) {
      if (err) throw err;
      cursor.toArray(function (err, docs) {
        if (err) throw err;

        var data = {
          ip: ip, // your ip
          recent_lookups: docs
        };
        var html = jade.renderFile('./jade/index.jade', extend(locals, data));
        return res.send(html).end();
      });
    });
  });

  app.get('/api/:url', function (req, res) {

    console.log("url: %s", req.params.url);
    var url = req.params.url;
    if (url.indexOf('http') == -1) {
      url = 'http://' + url;
    }

    var hostname = URL.parse( url ).hostname;
    console.log("hostname: %s", hostname);

    iplocationLookup (hostname, function (err, data) {
      if (err) {
        res.status(500).json(err).end();
        return console.error(err);
      };

      var doc = Object.assign({}, data);
      doc.type = "search";
      doc.created_at = Date.now();

      var finish = function (doc) {
        res.json(doc).end();

        r.table('ip_spot').insert(doc).run(connection, function (err, result) {
          if (err) throw err;
          console.log("saved ip-data [%s] to rethinkdb", doc.hostname);
        });
      };

      doc.ip = null;
      if (!doc.ip || typeof doc.ip !== 'string' || doc.ip.length < 5) {
        console.log("using dns lookup as backup");
        // grab ip from dns lookup
        dnsLookup(hostname, function (err, data) {
          if (err) {
            res.status(500).json(err).end();
            return console.error(err);
          }
          Object.assign(doc, data);
          console.log(doc);
          finish(doc);
        });
      } else {
        console.log("used only iplocationLookup");
        finish(doc);
      }
    });
  });

});

var port = 3060;

var server = http.createServer(app);
server.listen(port);
console.log("ip-spot listening on port: %s", port);
