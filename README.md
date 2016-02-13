#
# W O R K     I N     P R O G R E S S
#
# Please do not use the code yet!
#
########################################################################



## Duplex Message Broker (DMB)

DMB is a simple message broker forked from Glome Notification Broker. It
lets backend and frontend clients to register and exchange messages. The
underlying architecture uses Redis for message storing, and websockets
for client connection (both backend and frontend).

DMB establishes two connections to the Redis server for duplex
communication.

One of the connections is the __downlink__ that carries messages from
Redis towards the clients.

The other connection is the __uplink__ that transfers messages from the
clients towards Redis.

### Installation

```bash
  $ npm install
```

This command will download the dependcies into the node_modules directory.

### Start

```bash
  $ node index.js
```

This command will start the broker with default configuration, ie.
listening on port 8082.

### Configuration

The following envrironment variables can be used to configure the broker:

 * <i>DMB_PORT</i>

    The port where DMB is listening for incoming requests (default: 8082).

 * <i>REDIS_HOST</i>

    Host name of the Redis server to connect to (default: localhost).

 * <i>REDIS_PORT</i>

    Port of the Redis server (default: 6379).

### Redis channels

 * <i>dmb:register</i>

    Backend services uses this channel to register at DMB. They send a
    {bk_connect} message. DMB will assign a dedicated channel for the
    service. Following that DKM sends a {bkid} that can be used by the
    backend to address the dedicated channel.

    {bk_connect} message specification:

    TODO

    {bk_connect_ack} from DMB:

    TODO

 * <i>dmb:{bkid}</i>

    For downlink where {bkid} identifies a backend service that sends /
    receives messages to / from clients. The {bkid} is allocated
    automatically when a backend service registers at the {dmb:register}
    channel (see above).

    {bk_message} message specification:

    TODO

    {bk_message_ack} from DMB:

    TODO

 * <i>dmb:uplink</i>

    For uplink purposes (when the client sends messages to a backend
    service).

    TODO

### Backend client events

 The following events can be emitted by the clients:

 * <i>dmb:reconnect</i>

    A backend client wants to connect to DMB. Upon connection DMB will
    assign and send a {bid} that can be used as a dedicated channel for
    sending messages.

 * <i>dmb:disconnect</i>

    A backend service disconnects from DMB. DMB will free the {bid} and
    clear the corresponding Redis channel.

### Frontend client events


### DMB events

 These are the events that are emitted by GNB so that the clients can listen
 to them:

 * <i>dmb:connected</i>

    The client has succesfully connected to DMB.

 * <i>dmb:broadcast</i>

    The backend service sends a broadcast to all users of the service.

 * <i>dmb:direct</i>

    The backend service sends a direct message to a specific user of the
    service.

### Firewall and web server setup

 * Make sure the node app port is only available from localhost


```bash
    # iptables -A INPUT -i lo -p tcp --dport 8082 -j ACCEPT
    # iptables -A INPUT -p tcp --dport 8082 -j DROP
```

 * Proxy SSL requests with Apache 2.4

```config
    <VirtualHost some.site.name:443>

      ServerName some.site.name

      SSLEngine on
      SSLCertificateFile /etc/ssl/certs/some.site.name.crt
      SSLCertificateKeyFile /etc/ssl/private/some.site.name.pem

      <Proxy *>
        Require host localhost
      </Proxy>

      Define gnb localhost:8082/

      RewriteEngine On
      RewriteCond %{REQUEST_URI}  ^/socket.io                 [NC]
      RewriteCond %{QUERY_STRING} transport=websocket         [NC]
      RewriteRule /(.*)           ws://${gnb}/$1              [P,L]

      ProxyPreserveHost On
      ProxyPass / http://${gnb}
      ProxyPassReverse / http://${gnb}

      DocumentRoot {the_location_of_gnb}

      LogLevel info
      # cronolog is great!
      ErrorLog "||/usr/bin/cronolog -S /var/log/apache2/current_some.site.name_https_error /var/log/apache2/%Y/%m/%d/some.site.name_https_error.log"
      CustomLog "||/usr/bin/cronolog -S /var/log/apache2/current_some.site.name_https_transfer /var/log/apache2/%Y/%m/%d/some.site.name_https_access.log" common
    </VirtualHost>
```

  * Proxy request with Nginx 1.4+

    TODO

### Licensing

Author: ferenc at glome dot me

License: MIT

Copyright (c) 2014 Glome Inc
