/**
 *
 * Simple client script for Duplex Message Broker (DMB)
 *
 *
 * {bkid}: DMB will assign a unique id from backends
 * {clid}: can be used to identify this client
 */
var connection = true;
var dmb_params = dmb_params || { bkid: 'demo_backend', clid: 'browser_client' };

function updateStatus(connected = false, message = '') {
  if (connected) {
    jQuery('.dmb .status').addClass('active');
  } else {
    jQuery('.dmb .status').removeClass('active');
    jQuery('.dmb .message').text(message);
  }
}

jQuery(document).ready(function()
{
  if (typeof dmb_params.clid !== "undefined") {
    jQuery('.info .clid').text(dmb_params.clid);
  }

  // load socket.io
  jQuery.getScript("/socket.io/socket.io.js")
    .done(function( script, textStatus ) {
      // initiate the DMB connection
      jQuery(document).trigger('startdmb', dmb_params);
    })
    .fail(function( jqxhr, settings, exception ) {
      updateStatus(false, "Connection failed");
  });
});

// dmb magic; connect to web socket; parse messages etc.
jQuery(document).on('startdmb', function(event, dmb_params)
{
  console.log('startdmb triggered');

  if (typeof(dmb_params['clid']) !== 'undefined')
  {
    window.socket = io();
    var socket = window.socket;

    if (typeof dmb_params['clid'] == 'undefined' || dmb_params['clid'] == '')
    {
      dmb_params['clid'] = 'browser_client';
    }

    // say hello to DMB
    socket.emit('dmb:connect', dmb_params);

    // want to hook to this one?
    socket.on('disconnect', function(msg)
    {
      updateStatus(false, "Connection failed");
    });
    socket.on('dmb:disconnect', function(msg)
    {
      updateStatus(false, "Connection failed");
    });

    // want to hook into this one?
    socket.on('connect', function(msg)
    {
      updateStatus(true);
    });
    socket.on('dmb:connected', function(msg)
    {
      updateStatus(true);
    });

    // received a broadcast from DMB
    socket.on('dmb:broadcast', function(broadcast)
    {
      jQuery('#messages').prepend($('<li class="broadcast">').text('broadcast from '+ broadcast.sender + ': ' + broadcast.payload));
    });

    // received a direct message from DMB
    socket.on('dmb:message', function(msg)
    {
      jQuery('#messages').prepend($('<li class="private">').text(msg));
    });

    // received data from DMB
    // TODO: finish
    socket.on('dmb:data', function(msg) {
      var splits = msg.split(':');
      var response = JSON.parse(window.atob(splits[1]));
    });
  }
});
