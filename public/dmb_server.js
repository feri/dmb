/**
 *
 * Simple server script for Duplex Message Broker (DMB)
 *
 */
jQuery(document).ready(function()
{
  // load config
  jQuery.getScript("./params.js")
    .done(function(script, textStatus ) {
      initDmb(dmb_params);
    })
    .fail(function(jqxhr, settings, exception ) {
      console.log("Missing params.js; aborting");
      jQuery(".dmb .message").text("Missing parameters; aborting.");
      return;
    });

  /**
   * Load socket.io and trigger startdmb
   */
  function initDmb(dmb_params) {
    // load socket.io
    jQuery.getScript("/socket.io/socket.io.js")
      .done(function(script, textStatus ) {
        // initiate the DMB connection
        jQuery(document).trigger('startdmb', dmb_params);
        console.log(textStatus + ' startdmb triggered');
      })
      .fail(function(jqxhr, settings, exception ) {
        jQuery(".dmb .message").text("Triggered ajaxError handler.");
      });
  }
});

// dmb magic; connect to web socket; parse messages etc.
jQuery(document).on('startdmb', function(event, dmb_params)
{
  var socket = io();
  // say hello to DMB
  socket.emit('dmb:connect', dmb_params);

  jQuery('form').submit(function()
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
    jQuery('#messages').append($('<li class="broadcast">').text(msg));
  });
  socket.on('dmb:message', function(msg){
    jQuery('#messages').append($('<li class="private">').text(msg));
  });
});
