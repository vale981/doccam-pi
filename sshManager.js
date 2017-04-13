const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const fs = require('fs');
let pid;

let config = JSON.parse(fs.readFileSync('./config.js'));
let p = spawn(`ssh -oStrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -p ${config['ssh-port']} -f -N -R ${process.argv[2]}:localhost:22 -f -N -R 0.0.0.0:${process.argv[3]}:${config.camIP}:${process.argv[4]} ${config['ssh-user']}@${config.master.replace(/((http|https)\:\/{2}|\:[0-9]+)/g, '')} && pidof ssh`, {
    shell: true,
    detached: false
})
p.stdout.on('data', (p) => {
    pid = p.toString().split(' ')[0];
});
p.on('close', () => {
    process.exit(1);
});

process.once("SIGINT", function() {
    console.log('kill ');
    exec(`kill ${pid}`, () => {
        process.exit(0);
    });
});
