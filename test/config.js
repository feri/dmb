/**
 * Configuration for the 'simple_dmb_backend.js' DMB backend application
 *
 * Author: ferenc.szekely@gmail.com
 * License: MIT
 *
 * Copyright (c) 2017 Ferenc Székely
 */

var config = {
  // DMB server parameters
  dmb_server: {
    host: 'http://dmb.local'
  },

  // DMB parameters for connection to the right backend on the DMB server
  dmb_params: {
    bkid: 'demo_backend',
    clid: 'backend_client',
  },
};

module.exports = config;
