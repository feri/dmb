/**
 * DMB parameters
 */
var dmb_params = {
  // id of this backend instance
  // connection is allowed if this bkid is allowed at DMB
  bkid: 'demo_backend',
  // client id for demo purposes
  // the client can only connect if the id is added to the allowed array below
  clid: 'backend_client',
  // allowed client ids that can talk to this backend instance
  allowed: [
    'browser_client',
    'backend_client',
  ],
};
