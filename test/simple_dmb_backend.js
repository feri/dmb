/**
 *
 * Simple Node.js backend app to connect to DMB server as a client
 *
 * Invoke: node simple_dmb_backend.js
 *
 * For verbose logging: DEBUG=* node simple_dmb_backend.js
 *
 * Author: ferenc.szekely@gmail.com
 * License: MIT
 *
 * Copyright (c) 2017 Ferenc Székely
 *
 */
const io = require('socket.io-client');
const express = require('express');
const app = express();

// private config; you may change it
const config = require('./config');

// connect to server
const socket = io(config.dmb_server.host);

// socket.io event handlers
// connect event; just debug
socket.on('connect', function() {
  console.log('We are connected via socket (id):', socket.id);
});
// reconnect event; just debug
socket.on('reconnect_attempt', () => {
  console.log('recconnect');
});

// DMB event handlers
socket.on('dmb:broadcast', function(broadcast){
  console.log('Broadcast from '+ broadcast.sender + ': ' + broadcast.payload);
});
socket.on('dmb:message', function(msg){
  console.log('Direct message:', msg.payload);
});
socket.on('dmb:alert', function(msg){
  console.log('Alert: ', msg.payload);
});

// connect
socket.emit('dmb:connect', config.dmb_params);
