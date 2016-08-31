let sock = require('socket.io-client');
let ffmpeg = require('fluent-ffmpeg');
let request = require('request');
let http = require('http');
let path = require('path');
let fs = require('fs');
let WMStrm = require('./lib/memWrite.js');
var ss = require('socket.io-stream');
let mustBe = false;
let restart = false;
let config, source, snapSource;
let exec = require('child_process').exec;
let execSync = require('child_process').execSync;
let spawnP = require('child_process').spawn;

let dir = '/home';
let status = {
    status: 0,
    error: -1
}

let errors = ['Camera Disconnected', 'YoutTube Disconnected', 'Wrong ffmpeg executable.'];
let cmd, sshpid;

let spawn = function() {
    source = 'rtsp://' + config.camIP + ':' + config.camPort + '/' + config.camProfile;
    ffmpeg.setFfmpegPath(config.ffmpegPath)
    delete cmd;
    cmd = ffmpeg({
            source: source,
            niceness: -20,
            stdoutLines: 20
        })
        .videoCodec('copy')
        .audioBitrate('128k')
        .audioChannels(1)
        .audioFrequency(11025)
        .audioCodec('libmp3lame')
        .on('start', function(commandLine) {
            status.running = 0;
            wLog('Spawned Ffmpeg with command: ' + commandLine, 4);
        })
        .on('end', function(o, e) {
            imDead('Normal Stop.', e);
        })
        .on('error', function(err, o, e) {
            console.log(err);
            if (err.message.indexOf(source) > -1)
                criticalProblem(0, handleDisc, config.camIP, config.camPort)
            else if (err.message.indexOf(source + 'Input/output error') > -1 || err.message.indexOf('rtmp://a.rtmp.youtube.com/live2/' + config.key) > -1)
                criticalProblem(1, handleDisc, 'a.rtmp.youtube.com/live2/', 1935);
            else if (err.message.indexOf('spawn') > -1 || err.message.indexOf('niceness') > -1)
                criticalProblem(2, function() {});
            else if (err.message.indexOf('SIGKILL') > -1)
                imDead('Normal Stop.', e);
            else
                imDead(err.message, e);
        })
        .outputFormat('flv')
        .outputOptions(['-bufsize 50000k', '-tune film'])
        .output('rtmp://a.rtmp.youtube.com/live2/' + config.key);
    status.error = -1;
    socket.emit('change', {
        type: 'startStop',
        change: {
            running: 0,
            error: -1
        }
    });
    cmd.run();
}

let getSnap = function(cb) {
    snapSource = 'rtsp://' + config.camIP + ':' + config.camPort + '/' + config.snapProfile;
    let picBuff = new WMStrm();
    recCmd = ffmpeg(snapSource)
        .on('start', function(commandLine) {
            wLog('Snapshot ' + commandLine, 4);
        })
        .on('error', function(err, o, e) {})
        .outputFormat('mjpeg')
        .frames(1)
        .stream(picBuff, {
            end: true
        });
    picBuff.on('finish', function() {
        try {
            cb(picBuff.memStore.toString('base64'));
            delete pickBuff;
        } catch (e) {
            cb(false);
        }
    });
}

function imDead(why, e = '') {
    status.running = 1;
    socket.emit('change', {
        type: 'startStop',
        change: {
            running: 1,
        }
    });
    if (restart) {
        spawn();
        restart = false;
    }
    if (!mustBe) {
        wLog('Crash! ' + why + ' ' + e, 2);
        setTimeout(function() {
            spawn();
        }, 1000);
    }
    mustBe = false;
}

function criticalProblem(err, handler, ...args) {
    setTimeout(function() {
        status.running = 2
        status.error = err
        wLog('Critical Problem: ' + errors[err], 3);
        socket.emit('change', {
            type: 'error',
            change: {
                running: 2,
                error: err
            }
        });
        handler(args)
    }, 1000);
}

function handleDisc(info) {
    let [host, port] = info
    isReachable(host, port, is => {
        if (is) {
            spawn();
        } else {
            setTimeout(function() {
                handleDisc(info)
            }, 10000);
        }
    });
}

function isReachable(host, port, callback) {
    http.get({
        host: host.split('/')[0],
        port: port
    }, function(res) {
        callback(true);
    }).on("error", function(e) {
        if (e.message == "socket hang up")
            callback(true)
        else
            callback(false);
    });
}

var commandHandlers = function commandHandlers(command, cb) {
    var handlers = {
        startStop: function() {
            if (status.running !== 2)
                if (status.running === 0) {
                    wLog("Stop Command!", 1);
                    mustBe = true
                    cmd.kill();
                } else {
                    wLog("Start Command!", 1);
                    spawn();
                }
        },
        snap: function() {
            getSnap(snap => {
                socket.emit('data', {
                    type: 'snap',
                    data: snap,
                }, command.sender);
            });
        },
        config: function() {
            socket.emit('data', {
                type: 'config',
                data: config,
            }, command.sender);
        },
        changeSettings: function() {
            for (let set in command.data) {
                if (config[set])
                    config[set] = command.data[set];
            }
            let oldConfigured;
            if (config.configured === true)
                oldConfigured = true;
            config.configured = true;
            fs.writeFile('./config.js', JSON.stringify(config, undefined, 2), function(err) {
                if (err) {
                    socket.emit('data', {
                        type: 'message',
                        data: {
                            title: 'Error',
                            type: 'error',
                            text: 'Can\'t save the Settings!\n' + err.message
                        }
                    }, command.sender);
                } else {
                    socket.emit('data', {
                        type: 'message',
                        data: {
                            title: 'Success',
                            type: 'success',
                            text: 'Settings Saved!'
                        }
                    }, command.sender);
                    if (oldConfigured) {
                        socket.emit('change', {
                            type: 'settings',
                            change: {
                                config: command.data
                            }
                        });
                        cmd.kill();
                        spawn();
                    } else {
                        socket.disconnect();
                        init();
                    }
                }
            });
        },
        restart: function() {
            if (status.running === 0) {
                wLog("Restart Command!", 1);
                mustBe = true;
                restart = true;
                cmd.kill();
            } else {
                wLog("Start Command!", 1);
                spawn();
            }
        },
        getLogs: function() {
            fs.readFile(config.logPath, 'utf-8', function(err, data) {
                if (err) throw err;

                let lines = data.trim().split('$end$').slice(-100);
                lines.shift();
                lines.pop();

                socket.emit('data', {
                    type: 'logs',
                    data: lines
                }, command.sender);
            });
        }
    }

    //call the handler
    var call = handlers[command.command];
    if (call)
        call();
}

function wLog(msg, l = 0) {
    fs.appendFile(config.logPath, Date() + '$$$(i' + l + ')' + msg + '$end$\n', function(err) {
        if (err)
            throw new Error('Can\'t write Log! ', err);
    });
}

function handleKill() {
    process.stdin.resume();
    wLog("Received Shutdown Command").
    mustBe = true;
    cmd.kill();
    process.exit();
}

process.on('SIGTERM', function() {
    handleKill();
});
// process.on('SIGKILL', function () {
//     handleKill();
// });

//let's go
function init() {
    config = readConfig('./config.js');
    if (config.configured) {
        socket = sock(config.master + '/pi');
        initSocket();
        status.name = config.name;
        if (!cmd)
            spawn();
    } else {
        socket = sock(config.master + '/pi', {
            query: "unconfigured=true"
        });
        status.running = 2;
        initSocket();
    }
}


let d = false;

function initSSH(cb) {
    status.ssh = {
        user: config['ssh-user'],
        localUser: config['ssh-local-user'],
        masterPort: config['ssh-port']
    };

    checkSSH((err) => {
        if (err)
            throw err;
        connectSSH(cb);
    });
}

function connectSSH(cb = function() {
    socket.emit('change', {
        change: {
            ssh: {
                port: status.ssh.port,
                camForwardPort: status.ssh.camForwardPort
            }
        }
    });
}) {
    socket.emit('getSSHPort', ports => {
        [status.ssh.port, status.ssh.camForwardPort] = ports;
        let ssh = exec(`ssh -p ${config['ssh-port']} -f -N -R ${status.ssh.port}:localhost:22 -f -N -R 0.0.0.0:${status.ssh.camForwardPort}:${config.camIP}:80 ${config['ssh-user']}@${config.master.replace(/(http\:\/{2}|\:[0-9]+)/g, '')} && pidof ssh`, {
            detached: false,
            env: '/usr/local/sbin:/usr/local/bin:/usr/bin:/bin',
            shell: false
        });
        ssh.stdout.on('data', (out) => {
            sshPid = parseInt(out.split(' ')[0]);
            fs.writeFile('./ssh.pid', sshPid);
        });
        ssh.on('error', (err) => {
            throw err;
        });
        ssh.on('close', () => {
            initSSH();
        });
        cb();
    });
}

function checkSSH(cb) {
    exec('ps -ax | grep ssh', (error, stdout, stderr) => {
        let m, pid, alive;
        let re = /([0-9]+).*-p\s[0-9]+\s-f\s-N\s-R\s[0-9]+:.*?:[0-9]+\s-f\s-N\s-R\s\*:[0-9]+:.*?:[0-9]+\s/g;
        pid = [];
        while ((m = re.exec(stdout)) !== null) {
            if (m.index === re.lastIndex) {
                re.lastIndex++;
            }
            pid.push(m[1]);
        }
        if (pid.length > 0) {
            exec(`kill ${pid.join(' ')}`, err => {
                if (error)
                    cb(true);
            });
        }
        if (!alive) {
            cb(false);
        }
    });
}

function initSocket() {
    socket.on('connect', function() {
        wLog('Connected to Master: ' + config.master + '.');
        if (config['ssh-user'])
            initSSH(err => {
                if (err)
                    throw err;
                socket.emit('meta', status);
            });
        else {
            socket.emit('meta', status);
        }
    });

    socket.on('disconnect', function() {
        d = true;
        socket.disconnect();
        init();
    });

    socket.on('command', (command, cb) => {
        commandHandlers(command, cb);
    });
}

function readConfig() {
    return JSON.parse(fs.readFileSync('./config.js'));
}

init();
