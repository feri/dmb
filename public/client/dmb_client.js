/**
 *
 * Simple client script for Duplex Message Broker (DMB)
 *
 *
 * {bkid}: DMB will assign a unique id from bacends
 * {token}: can be used to identify this client
 */
var dmb_params = dmb_params || { 'bkid': 'testserver', 'token': 'hello' };

jQuery(document).ready(function()
{
  // load socket.io
  jQuery.getScript("/socket.io/socket.io.js")
    .done(function( script, textStatus ) {
      // initiate the DMB connection
      jQuery(document).trigger('startdmb', dmb_params);
      console.log( textStatus + ' startdmb triggered');
    })
    .fail(function( jqxhr, settings, exception ) {
      jQuery("dmb message").text("Triggered ajaxError handler.");
  });
});

// dmb magic; connect to web socket; parse messages etc.
jQuery(document).on('startdmb', function(event, dmb_params)
{
  if (typeof(dmb_params['bkid']) !== 'undefined')
  {
    // dangerous?
    window.socket = io(window.location.protocol + '//' + window.location.host);
    var socket = window.socket;

    if (typeof dmb_params['token'] == 'undefined' || dmb_params['token'] == '')
    {
      dmb_params['token'] = 'hello'; // TODO: generate some random string
    }

    // say hello to DMB
    socket.emit('dmb:connect', dmb_params);

    // want to hook into this one?
    socket.on('disconnect', function(msg)
    {});

    // want to hook into this one?
    socket.on('dmb:connected', function(msg)
    {
      jQuery('.dmb .status').addClass('active');
    });

    // received a broadcast from GNB
    socket.on('dmb:broadcast', function(message)
    {
      jQuery('.dmb .status').addClass('unread');
      jQuery('.dmb .message').text(message);
    });

    // received a direct message from GNB
    socket.on('dmb:message', function(msg)
    {
      jQuery('.dmb .status').addClass('unread');
      jQuery('.dmb .message').text(msg);
    });

    // received data from GNB
    socket.on('dmb:data', function(msg) {
      var splits = msg.split(':');
      var response = JSON.parse(window.atob(splits[1]));

      switch (splits[0]) {
        case "user":
          jQuery.cookie('magic', response.key + response.user.trackingtoken.token + response.user.glomeid);
          window.location.href = '/';
          break;
        case "unpair":
          window.location.href = '/';
          break;
      }
    });
  }
});
