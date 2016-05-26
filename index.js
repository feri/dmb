/**
 * Duplex Message Broker (DMB)
 *
 * Envrironment variables that can be used:
 *
 * o DMB_PORT: the port where DMB is listening (default: 8082)
 * o REDIS_HOST: Host name of the Redis server to connect to (default: localhost)
 * o REDIS_PORT: Port of the Redis server (default: 6379)
 *
 * See README.md for details.
 *
 * Author: ferenc at glome dot me
 * License: MIT
 *
 * Copyright (c) 2016 Ferenc Székely
 * Copyright (c) 2014-2015 Glome Oy
 *
 * Forked from glome/gnb
 *
 */
var sockets = {};
var numUsers = 0;

var config = require('./config');
var allowed = require('./allowed');

var debug = require('debug');
var path = require('path');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var host = process.env.DMB_HOST || config.host || "dmb.local";
var port = process.env.DMB_PORT || config.port || 8084;

// Glome Redis connection
var redis = require("redis");
var redis_host = process.env.REDIS_HOST || config.redis.host || "localhost";
var redis_port = process.env.REDIS_PORT || config.redis.port || 6379;
var redis_options = {};

var dmb_upstream = "dmb:upstream";
var dmb_downstream = "dmb:downstream";

var redis_uplink = redis.createClient(redis_port, redis_host, redis_options);
var redis_downlink = redis.createClient(redis_port, redis_host, redis_options);

// configuration that is received upon subscription
var config = {
  separator: ':',
  message_label: 'message',
  broadcast_label: 'broadcast'
};

server.listen(port, host, function () {
  console.log('Server listening on %s at port %d', host, port);
});

// Simple routing
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/welcome.html'));
});

// The dmb_downstream channel carries messages from backend clients
redis_downlink.subscribe(dmb_downstream);

/**
 * Messages carried by events
 *
 * DMB uses socket.io for websocket implementation, therefore messages
 * between the various players are embedded into events.
 *
 * DMS defines the following events:
 *
 *
 *
 * DMB messages are triplets. Each part of the triplet is separated
 * by a separator, which is configurable.
 *
 * Message format specification
 * ============================
 *
 * {header} <separator> {recipient} <separator> {payload}
 *
 * header: max. 12 bytes hexadecimal string with some reserved words
 * separator: 1 byte
 * recipient: max. 12 bytes hexadecimal string with some reserved words
 * payload: max. 1024 bytes
 *
 * Backend services and regular clients have different privileges for
 * addressing the recipient(s). The message specification below will
 * describe the differences.
 *
 * The payload of the message can be a simple, pure text message or a
 * JSON encoded data. There are no restrictions on that, except the
 * size which is 1024 bytes for now.
 *
 * Message types
 * =============
 *
 * Backend service to clients (broadcast)
 *
 *   {bkid}:broadcast:{payload}
 *
 * Backend service to specific client (direct)
 *
 *   {bkid}:{token}:{payload}
 *
 * Client to backend service
 *
 *   {token}:{bkid}:{payload}
 *
 * Client to client
 *
 *   {token}:{bkid}:{payload}
 *   where {bkid} is a token of the receiver
 *
 */
redis_downlink.on("message", function (channel, message) {
  console.log('redis_downlink received: channel: ' + channel);
  console.log(message);
  if (message == "config") {
    // TODO:
    // helps backend services and clients to set up connections
    // and gives the schema about the exact messaging protocol that is
    // is available
  } else {
    //console.log('channel: ' + channel + ', message: ' + message);
    if (config.separator) {
      // parse the message and decide what to do
      var splits = message.split(config.separator);

      var bkid = splits[0];
      var token = splits[1];
      var payload = splits[2];

      if (token == config.broadcast_label) {
        io.sockets.in(bkid).emit("dmb:broadcast", payload);
      } else {
        send("dmb:message", bkid, token, payload);
      }

      console.log('bkid: ' + bkid);
      console.log('token: ' + token);
      console.log('payload: ' + payload);
    }
  }
});

/**
 * Register callbacks
 */
io.on('connection', function (socket) {
  // DMB assigns a unique ID {bkid} for backend service
  // Regular clients must specify a unique {token}
  socket.on('dmb:broadcast', function (params) {
    io.sockets.in(params.bkid).emit("dmb:broadcast", params.payload);
    console.log('socket broadcast:');
    console.log(params);
  });

  // DMB assigns a unique ID {bkid} for backend service
  // Regular clients must specify a unique {token}
  socket.on('dmb:connect', function (params) {
    // the client joins to uid room automatically
    console.log('dmb:connect params: ');
    console.log(params);

    if (typeof allowed[params.bkid] === 'undefined') {
      console.log('bkid is disabled: ' + params.bkid);
      return;
    }

    socket.join(params.bkid, function() {
      var ok = true;
      if (typeof params.token != 'undefined')
      {
        socket.appid = params.bkid;
        socket.username = params.token;

        // lame check if this is a backend type or client type connection
        if (socket.appid == socket.username) {
          // backend
          if (allowed[socket.appid].length == 0) {
            if (params.allowed.length > 0) {
              // populate which tokens are allowed
              allowed[socket.appid] = params.allowed;
            }
          }
        } else {
          if (allowed[socket.appid].length == 0) {
            console.log('all connections disabled to this backend: ' + socket.appid);
            ok = false;
          } else {
            if (typeof allowed[socket.appid]['all'] !== 'undefined') {
              // all connections allowed
              ok = true;
            } else {
              console.log('is allowed ' + socket.appid + ' > ' + socket.username + ' ?');
              console.log(allowed[socket.appid][socket.username]);
              if (typeof allowed[socket.appid][socket.username] === 'undefined') {
                console.log('access disabled for this client: ' + socket.username);
                ok = false;
              }
            }
          }
        }

        if (ok == false) {
          // disconnect
          socket.disconnect();
          return;
        }

        if (typeof sockets[params.token] == 'undefined')
        {
          sockets[params.token] = [];
        }

        sockets[params.token].push(socket.id);

        var lastsid = sockets[params.token][sockets[params.token].length - 1];
        socket.emit('dmb:connected', {});

        // push info to DMB about the connected client
        var data = {
          action: 'connect',
          params: {
            socket: socket.id,
            token: params.token,
            bkid: params.bkid,
            sessions: sockets[socket.username].length
          },
        }
        var enc = new Buffer(JSON.stringify(data)).toString(); //('base64');
        redis_uplink.publish(dmb_upstream, enc);
        data = null;

        console.log('new client of ' + socket.username + ', sid: ' + lastsid);

        // a broadcast
        io.sockets.in(params.bkid).emit("dmb:broadcast", '> joined ' + params.token);
        // a private
        send('dmb:message', params.bkid, params.token, 'welcome');

        ++numUsers;
      }
      else
      {
        console.log('invalid typeof token: ' + typeof params.token + ': ' + params.token);
      }
    });
  });

  // when client sends a message
  socket.on('dmb:message', function (params) {
    console.log('dmb:message params: ');
    console.log(params);

    io.sockets.in(params.bkid).emit("dmb:broadcast", '> received from: ' + params.token + ' -> ' + params.payload + '@' + params.bkid);

    // a private ack
    send("dmb:message", params.bkid, params.token, 'sent');
  });

  // when the client disconnects
  socket.on('disconnect', function () {
    // remove the connection from the global list
    if (typeof sockets[socket.username] !== 'undefined') {
      var index = sockets[socket.username].lastIndexOf(socket.id)
      if (index > -1)
      {
        console.log('disconnect from sockets of ' + socket.username);
        console.log(sockets[socket.username]);

        sockets[socket.username].splice(index, 1);

        socket.emit('dmb:disconnected', {});

        // push info to DMB about the disconnected client
        var data = {
          action: 'disconnect',
          params: {
            socket: socket.id,
            token: socket.username,
            bkid: socket.appid,
            sessions: sockets[socket.username].length
          }
        }
        var enc = new Buffer(JSON.stringify(data)).toString();//('base64');
        redis_uplink.publish(dmb_upstream, enc);
        data = null;

        console.log('client gone: ' + socket.username + ', sid: ' + socket.id);

        // a broadcast
        io.sockets.in(socket.appid).emit("dmb:broadcast", '> left ' + socket.username);

        --numUsers;
      }
      else
      {
        console.log('No socket available for ' + socket.username + ' with id: ' + socket.id);
      }
    }
  });
});

/**
 * Message sending
 */
function send(event, bkid, token, payload)
{
  if (typeof sockets[token] != 'undefined' && sockets[token].length > 0)
  {
    console.log('common send to all sockets of ' + token);
    console.log(sockets[token]);

    // send to each and every socket
    sockets[token].forEach(function(socket, index, array) {
      io.sockets.to(socket).emit(event, payload);
      console.log('sent to ' + socket);
    });
  }
  else
  {
    console.log('No sockets available for ' + token);
  }
}
