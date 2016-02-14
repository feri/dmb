/**
 *
 * Simple server script for Duplex Message Broker (DMB)
 *
 */
jQuery(document).ready(function()
{
  // load socket.io
  jQuery.getScript("/socket.io/socket.io.js")
    .done(function( script, textStatus ) {
      var dmb_params = { 'bkid': 'testserver', 'token': 'none' };
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
  var socket = io();
  // say hello to DMB
  socket.emit('dmb:connect', dmb_params);

  $('form').submit(function()
  {
    socket.emit('dmb:broadcast', {
      bkid: dmb_params.bkid,
      payload: $('#m').val()
    });
    $('#m').val('');
    return false;
  });

  // want to hook into this one?
  socket.on('dmb:connected', function(msg)
  {
    jQuery('.dmb .status').addClass('active');
  });

  socket.on('dmb:broadcast', function(msg){
    $('#messages').append($('<li>').text(msg));
  });
});
