var http = require('http');
var express = require('express');
var app = express();

var RateLimit = require('express-rate-limit')
var ipaddr = require('ipaddr.js') // manipulate ipv4 and ipv6 addresses

var limiter = RateLimit({
  windowMs: 1000 * 60 * 5, // 5 min
  max: 100,
  delayMs: 0
})

app.use(limiter)

app.use(function (req, res) {
  var ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress
  var ipaddr_ = ipaddr.parse(ip)

  if (ipaddr_.isIPv4MappedAddress && ipaddr_.isIPv4MappedAddress()) {
    ipaddr_ = ipaddr_.toIPv4Address()
  }

  var ipstr = ipaddr_.toString()
  console.log('[%s] hit by [%s]', ipaddr_.kind(), ipstr)
  res.write( ipstr )
  res.end()
})

var port = 3060;

var server = http.createServer(app);
server.listen(port);
console.log("ip-spot listening on port: %s", port);
