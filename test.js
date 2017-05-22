x = require('node-ipc');
//x.config.silent = true;
x.connectTo('sshManager', function(){
x.of['sshManager'].on('connect',function(){
let id = (new Date()).getTime();
x.of['sshManager'].on('success'+id, (data) => {console.log(data);});
x.of['sshManager'].emit('create_tunnel', {
 host: 'cams.doc.govt.nz',
 id: id,
 username: 'ssh',
 sshPort: 54533,
 localPort: 8080,
 reverse: true,
 privateKey: '~/.ssh/test',
 serverAliveInterval: 5,
 remotePort: 9999,
 reverse: true
}, () => {console.log("here")});
});
});
