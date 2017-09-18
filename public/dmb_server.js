/**
 *
 * Simple server script for Duplex Message Broker (DMB)
 *
 */
var socket;

jQuery(document).ready(function()
{
  // load config
  jQuery.getScript("./params.js")
    .done(function(script, textStatus ) {
      initDmb(dmb_params);
      initUi(dmb_params);
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
      .done(function(script, textStatus) {
        // initiate the DMB connection
        jQuery(document).trigger('startdmb', dmb_params);
      })
      .fail(function(jqxhr, settings, exception) {
        jQuery(".dmb .message").text("Triggered ajaxError handler.");
      });
  }

  /**
   * Sets default values of inputs and sets up callback in case those
   * values change
   */
  function initUi(dmb_params) {

    jQuery('form input, form button').removeAttr('disabled');

    jQuery('form').submit(function()
    {
      console.log('broadcast to ' + dmb_params.bkid);
      socket.emit('dmb:broadcast', {
        bkid: dmb_params.bkid,
        clid: dmb_params.clid,
        sender: dmb_params.clid,
        payload: jQuery('#m').val()
      });
      $('#m').val('');
      return false;
    });

    // populate bkid and clid to the inputs in the UI
    jQuery('div.params #bkid').val(dmb_params.bkid);
    jQuery('div.params #clid').val(dmb_params.clid);
    dmb_params.prev_bkid = dmb_params.bkid;
    dmb_params.prev_clid = dmb_params.clid;

    jQuery('div.params #bkid, div.params #clid').on("change", function(e) {
      dmb_params.reconnect = true;

      var targetId = e.target.id;
      var newVal = jQuery('div.params #' + targetId).val();

      dmb_params[targetId] = newVal;
      console.log(targetId + " changed to: " + newVal);

      jQuery(document).trigger('startdmb', dmb_params);
    });
  }
});

// dmb magic; connect to web socket; parse messages etc.
jQuery(document).on('startdmb', function(event, dmb_params)
{
  console.log('startdmb triggered');

  if (typeof socket !== "undefined" &&  dmb_params.reconnect == true) {
    socket.emit('dmb:disconnect', dmb_params);
    window.setTimeout(function() { dmb_params.reconnect == false; }, 1000);
  }

  socket = io();

  // say hello to DMB
  socket.emit('dmb:connect', dmb_params);

  // want to hook into this one?
  socket.on('connect', function() {
    console.log("connected");
    jQuery('.dmb .status').addClass('active');
    jQuery('form input, form button').removeAttr('disabled');
  });
  socket.on('disconnect', function(msg) {
    console.log("disconnected");
    jQuery('.dmb .status').removeClass('active');
    jQuery('form input, form button').attr('disabled', 'disabled');
  });

  socket.on('dmb:connected', function(msg)
  {
    jQuery('.dmb .status').addClass('active');
  });
  socket.on('dmb:disconnected', function(msg)
  {
    jQuery('.dmb .status').removeClass('active');
    console.log('dmb:disconnected');
  });

  socket.on('dmb:broadcast', function(broadcast){
    jQuery('#messages').prepend($('<li class="broadcast">').text('broadcast from '+ broadcast.sender + ': ' + broadcast.payload));
  });
  socket.on('dmb:message', function(msg){
    jQuery('#messages').prepend($('<li class="private">').text(msg));
  });
  socket.on('dmb:alert', function(msg){
    jQuery('#alerts').prepend($('<li class="private">').text(msg));
  });
  socket.on('dmb:log', function(msg){
    jQuery('#logs').prepend($('<li class="private">').text(msg));
  });
});
