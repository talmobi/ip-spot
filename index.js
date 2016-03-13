var http = require('http');
var app = require('express')();

var ipaddr = require('ipaddr.js');

var port = 3060;

app.get('/', function (req, res) {
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var _ip = ipaddr.parse(ip).toNormalizedString();
  return res.send("ip: " + _ip).end();
});


var server = http.createServer(app);
server.listen(port);
console.log("ip-spot listening on port: %s", port);
