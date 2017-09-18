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
 *   where {bkid} is the identifier of the backend service
 *
 * Backend service to specific client (direct)
 *
 *   {bkid}:{clid}:{payload}
 *   where {bkid} is the identifier of the backend service
 *   where {clid} is the identifier of the recipient client
 *
 * Client to backend service
 *
 *   {clid}:{bkid}:{payload}
 *   where {clid} is the identifier of the client
 *   where {bkid} is the identifier of the recipient backend service
 *
 * Client to client
 *
 *   {clid}:{clid_rec}:{payload}
 *   where {clid_rec} is a identifier of the recipient
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
      var clid = splits[1];
      var payload = splits[2];

      if (clid == config.broadcast_label) {
        io.sockets.in(bkid).emit("dmb:broadcast", payload);
      } else {
        send("dmb:message", bkid, clid, payload);
      }

      console.log('bkid: ' + bkid);
      console.log('clid: ' + clid);
      console.log('payload: ' + payload);
    }
  }
});

/**
 * Register callbacks
 */
io.on('connection', function (socket) {
  // DMB assigns a unique ID {bkid} for backend service
  // Regular clients must specify a unique {clid}
  socket.on('dmb:broadcast', function (params) {
    io.sockets.in(params.bkid).emit("dmb:broadcast", params);
    console.log('socket broadcast:');
    console.log(params);
  });

  // DMB assigns a unique ID {bkid} for backend service
  // Regular clients must specify a unique {clid}
  socket.on('dmb:connect', function (params) {
    // the client joins to uid room automatically
    console.log("\r\ndmb:connect params: ");
    console.log(params);

    if (typeof allowed[params.bkid] === 'undefined') {
      console.log('bkid is not allowed: ' + params.bkid);
      return;
    }

    socket.join(params.bkid, function() {
      var ok = true;
      if (typeof params.clid != 'undefined')
      {
        socket.appid = params.bkid;
        socket.username = params.clid;

        // lame check if this is a backend type or client type connection
        if (socket.appid == socket.username) {
          // backend
          if (allowed[socket.appid].length == 0) {
            if (params.allowed.length > 0) {
              // populate which clids are allowed
              allowed[socket.appid] = params.allowed;
            }
          }
        } else {

          if (typeof params.allowed !== "undefined" && params.allowed.length > 0) {
            // populate which clids are allowed
            allowed[socket.appid] = params.allowed;
          }

          if (typeof allowed[socket.appid].length === "undefined" || allowed[socket.appid].length == 0) {
            // don't specify exact reason of denial, clients might be fishing
            console.log('all connections disabled to this backend: ' + socket.appid);
            ok = false;
          } else {
            if (typeof allowed[socket.appid]['all'] !== 'undefined') {
              // all connections allowed
              console.log('all connections are allowed');
              ok = true;
            } else {
              console.log('can client: ' + socket.username + ' connect to backend: ' + socket.appid + ' ?');
              console.log(allowed[socket.appid]);
              if (allowed[socket.appid].indexOf(socket.username) == -1) {
                console.log('access denied for client: ' + socket.username);
                ok = false;
              } else {
                console.log('access allowed');
              }
            }
          }
        }

        if (ok == false) {
          // do not provide more info
          socket.emit("dmb:message", "access denied for " + socket.username);
          // disconnect
          socket.disconnect(true);
          return;
        }

        if (typeof sockets[params.clid] == 'undefined')
        {
          sockets[params.clid] = [];
         }

        sockets[params.clid].push(socket.id);

        var lastsid = sockets[params.clid][sockets[params.clid].length - 1];
        socket.emit('dmb:connected', {clid: params.clid});

        // push info to DMB about the connected client
        var data = {
          action: 'connect',
          params: {
            socket: socket.id,
            clid: params.clid,
            bkid: params.bkid,
            sessions: sockets[socket.username].length
          },
        }
        var enc = new Buffer(JSON.stringify(data)).toString(); //('base64');
        redis_uplink.publish(dmb_upstream, enc);
        data = null;

        console.log('new client of ' + socket.username + ', sid: ' + lastsid);

        // a broadcast
        var broadcast = {
          sender: params.bkid,
          payload: 'new client joined as ' + params.clid,
        }
        io.sockets.in(params.bkid).emit("dmb:broadcast", broadcast);
        broadcast = null;

        // a private greeting
        var message = {
          payload: "Hello from backend service: " + params.bkid + '!',
        }
        send('dmb:message', params.bkid, params.clid, JSON.stringify(message));

        ++numUsers;
      }
      else
      {
        console.log('invalid typeof clid: ' + typeof params.clid + ': ' + params.clid);
      }
    });
  });

  // messages back and forth between backends and clients
  socket.on('dmb:message', function (params) {
    console.log('dmb:message params:');
    console.log(params);
    if (params.bkid == params.clid) {
      // if the backend wants to reach a client send a private msg
      send("dmb:message", params.bkid, params.to, JSON.stringify(params));
    } else {
      io.sockets.in(params.to).emit("dmb:message", JSON.stringify(params));
    }
  });

  // when client sends an alert
  socket.on('dmb:alert', function (params) {
    console.log('dmb:alert params:');
    console.log(params);

    io.sockets.in(params.bkid).emit("dmb:alert", JSON.stringify(params));
  });

  // when client sends a log
  socket.on('dmb:log', function (params) {
    console.log('dmb:log params:');
    console.log(params);

    io.sockets.in(params.bkid).emit("dmb:log", JSON.stringify(params));
  });

  // when client soft-disconnects
  socket.on('dmb:disconnect', function (params) {
    console.log("\r\ndmb:disconnect params:");
    console.log(params);
    send("dmb:message", socket.appid, socket.username, socket.username + " disconnected from " + socket.appid);
    socket.disconnect(false);
  });

  // when the client disconnects
  socket.on('disconnect', function(params) {
    // remove the connection from the global list
    if (typeof sockets[socket.username] !== 'undefined') {
      var index = sockets[socket.username].lastIndexOf(socket.id)
      if (index > -1)
      {
        console.log('disconnect all sockets of ' + socket.username + ':');
        console.log(sockets[socket.username]);

        // push info to DMB about the disconnected client
        var data = {
          action: 'disconnect',
          params: {
            socket: socket.id,
            clid: socket.username,
            bkid: socket.appid,
            sessions: sockets[socket.username].length
          }
        }

        sockets[socket.username].splice(index, 1);
        var enc = new Buffer(JSON.stringify(data)).toString();//('base64');
        redis_uplink.publish(dmb_upstream, enc);

        console.log('client left: ' + socket.username + ', sid: ' + socket.id + "\r\n");

        // a broadcast
        var broadcast = {
          sender: socket.appid,
          payload: 'client ' + socket.username + ' left'
        }

        io.sockets.in(socket.appid).emit("dmb:broadcast", broadcast);
        broadcast = null;

        data = null;
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
function send(event, bkid, clid, payload)
{
  if (typeof sockets[clid] !== 'undefined' && sockets[clid].length > 0)
  {
    console.log('send to all sockets of ' + clid);
    console.log('>> ' + event);
    console.log('>> ' + payload);
    console.log('sockets: ' + sockets[clid]);

    // send to each and every socket
    sockets[clid].forEach(function(socket, index, array) {
      io.sockets.to(socket).emit(event, payload);
      console.log('sent to ' + socket);
    });
  }
  else
  {
    console.log('No sockets available for ' + clid);
  }
}
