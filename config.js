/**
 * DMB configuration
 */
var config = {
  // HTTP server port for incoming requests
  host: 'dmb.local',
  port: 8084,

  // Redis connection
  redis: {
    host: 'localhost',
    port: '6379',
    username: '',
    password: '',
  }
};

module.exports = config;
