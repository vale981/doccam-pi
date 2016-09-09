const sock = require('socket.io-client');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WMStrm = require(__dirname + '/lib/memWrite.js');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const spawnP = require('child_process').spawn;

let mustBe = false;
let restart = false;
let config, source, snapSource;

const importance = ['normal', 'info', 'warning', 'danger', 'success'];
var customLevels = {
    levels: {
        normal: 0,
        info: 1,
        warning: 2,
        danger: 3,
        success: 4
    },
    colors: {
        normal: 'white',
        info: 'blue',
        warning: 'orange',
        danger: 'red',
        success: 'green'
    }
};

let winston = require('winston');
let logger = new(winston.Logger)({
    levels: customLevels.levels,
    transports: [
        new(winston.transports.Console)({
            level: 'success'
        }),
        new(winston.transports.File)({
            filename: __dirname + '/process.log',
            maxsize: 20048,
            maxFiles: 10,
            level: 'success'
        })
    ]
});
winston.addColors(customLevels.colors);

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
            stdoutLines: 20
        })
        .videoCodec('copy')
        .outputOptions(config.customOutputOptions.split(','))
        .on('start', function(commandLine) {
            status.running = 0;
            logger.log(importance[4], 'Spawned Ffmpeg with command: ' + commandLine);
        })
        .on('end', function(o, e) {
            imDead('Normal Stop.', e);
        })
        .on('error', function(err, o, e) {
            if (err.message.indexOf(source) > -1)
                criticalProblem(0, e, handleDisc, config.camIP, config.camPort)
            else if (err.message.indexOf(source + 'Input/output error') > -1 || err.message.indexOf('rtmp://a.rtmp.youtube.com/live2/' + config.key) > -1)
                criticalProblem(1, e, handleDisc, 'a.rtmp.youtube.com/live2/', 1935);
            else if (err.message.indexOf('spawn') > -1 || err.message.indexOf('niceness') > -1)
                criticalProblem(2, e, function() {});
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
            logger.log(importance[4], 'Snapshot ' + commandLine);
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
        logger.log(importance[2], 'Crash! ' + why + ' ' + e);
        setTimeout(function() {
            spawn();
        }, 1000);
    }
    mustBe = false;
}

function criticalProblem(err, e, handler, ...args) {
    setTimeout(function() {
        status.running = 2
        status.error = err
        logger.log(importance[3], 'Critical Problem: ' + errors[err] + '\n' + e);
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
        if (e.message == "socket hang up") {
          setTimeout(function () {
            callback(true);
          }, 1000);
        } else
            callback(false);
    });
}

var commandHandlers = function commandHandlers(command, cb) {
    var handlers = {
        startStop: function() {
            if (status.running !== 2)
                if (status.running === 0) {
                    logger.log(importance[1], "Stop Command!");
                    mustBe = true
                    cmd.kill();
                    socket.emit('data', {
                        type: 'message',
                        data: {
                            title: 'Success',
                            type: 'success',
                            text: 'Stopped!'
                        }
                    }, command.sender);
                } else {
                    logger.log(importance[1], "Start Command!");
                    spawn();
                    socket.emit('data', {
                        type: 'message',
                        data: {
                            title: 'Success',
                            type: 'success',
                            text: 'Started!'
                        }
                    }, command.sender);
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
                if (typeof config[set] !== 'undefined')
                    config[set] = command.data[set];
            }
            let oldConfigured;
            if (config.configured === true)
                oldConfigured = true;
            config.configured = true;
            fs.writeFile(__dirname + '/config.js',
                JSON.stringify(config,
                    undefined, 2),
                function(err) {
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
                        restartSSH(() => {
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
                        });
                    }
                });
        },
        restart: function() {
            if (status.running === 0) {
                logger.log(importance[1], "Restart Command!");
                mustBe = true;
                restart = true;
                cmd.kill();
            } else {
                logger.log(importance[1], "Start Command!");
                spawn();
            }
            socket.emit('data', {
                type: 'message',
                data: {
                    title: 'Success',
                    type: 'success',
                    text: 'Restarted!'
                }
            }, command.sender);
        },
        restartSSH: function() {
            restartSSH(() => {
                socket.emit('data', {
                    type: 'message',
                    data: {
                        title: 'Success',
                        type: 'success',
                        text: 'Restarted SSH Tunnels!'
                    }
                }, command.sender);
            });
        },
        getLogs: function() {
            fs.readFile(__dirname + '/process.log', 'utf-8', function(err, data) {
                let lines;
                if (err) {
                    lines = [];
                } else
                    lines = data.trim().split('\n').slice(-100);
                if (lines.length === 1)
                    lines = [];
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

function restartSSH(cb) {
    exec('forever stop SSH-Serv', () => {
        connectSSH(() => {
            socket.emit('change', {
                change: {
                    ssh: {
                        port: status.ssh.port,
                        camForwardPort: status.ssh.camForwardPort
                    }
                }
            });
            cb();
        });
    });
}

function handleKill() {
    process.stdin.resume();
    logger.log(importance[0], "Received Shutdown Command");
    mustBe = true;
    cmd.kill();
    process.exit(0);
}

process.on('SIGTERM', function() {
    handleKill();
});

//let's go
function init() {
    config = readConfig();

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

    checkSSH((alive) => {
        if (alive)
            cb();
        else
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
        let ssh = exec(`forever start -a --killSignal=SIGINT --uid SSH-Serv sshManager.js ${status.ssh.port} ${status.ssh.camForwardPort} ${config.camPanelPort}`, {
            detached: true,
            shell: true,
            cwd: __dirname
        });
        ssh.on('error', (err) => {
            throw err;
        });
        cb();
    });
}

function checkSSH(cb) {
    let m, pid, alive;
    let re = /SSH-Serv.*?sshManager\.js\s([0-9]+)\s([0-9]+).*log.*[^STOPPED]+/g;
    exec('forever list', (error, stdout, stderr) => {
        if (error)
            throw error;
        let alive = false;
        while ((m = re.exec(stdout)) !== null) {
            if (m.index === re.lastIndex) {
                re.lastIndex++;
            }
            if (alive) {
                exec('forever stop SSH-Serv');
                cb(false)
                return;
            } else {
                [, status.ssh.port, status.ssh.camForwardPort] = m;
                alive = true;
            }
        }
        cb(alive);
    });
}

function initSocket() {
    socket.on('connect', function() {
        logger.log(importance[0], 'Connected to Master: ' + config.master + '.');
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
    return JSON.parse(fs.readFileSync(__dirname + '/config.js'));
}

init();
