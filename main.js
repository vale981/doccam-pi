let config = require('./config.js')
let ffmpeg = require('fluent-ffmpeg');
let http = require('http');
let fs = require('fs');
let socket = require('socket.io-client')(config.master + '/pi');
let WMStrm = require('./lib/memWrite.js');
let mustBe = false;
let restart = false;

let source = 'rtsp://' + config.camIP + ':' + config.camPort + '/' + config.camProfile;
let snapSource = 'rtsp://' + config.camIP + ':' + config.camPort + '/' + config.snapProfile;
let status = {
    config: config,
    name: config.name
}

//no dupes
delete status.config.name;

//custom compiled
ffmpeg.setFfmpegPath(config.ffmpegPath)
const cmd = ffmpeg({
        source: source,
        niceness: -20,
        stdoutLines: 20
    })
    .videoCodec('copy')
    .audioBitrate('128k')
    .audioChannels(1)
    .audioFrequency(11025)
    .audioCodec('libmp3lame')
    .on('start', function (commandLine) {
        status.running = true
        wLog('Spawned Ffmpeg with command: ' + commandLine, 4);
    })
    .on('end', function (o, e) {
        imDead('Normal Stop.', e);
    })
    .on('error', function (err, o, e) {
        console.log(err);
        if (err.message.indexOf(source + ': No route to host') > -1 || err.message.indexOf(source + ': Connection refused') > -1)
            criticalProblem('Camera Disconnected', handleDisc, config.camIP, config.camPort)
        else if (err.message.indexOf(source + 'Input/output error') > -1 || err.message.indexOf('rtmp://a.rtmp.youtube.com/live2/' + config.key + ': Network is unreachable') > -1)
            criticalProblem('YoutTube Disconnected', handleDisc, 'rtmp://a.rtmp.youtube.com/live2/', 1935);
        else
            imDead(err.message, e);
    })
    .outputFormat('flv')
    .outputOptions(['-bufsize 50000k', '-tune film'])
    .output('rtmp://a.rtmp.youtube.com/live2/' + config.key);

let spawn = function () {
    socket.emit('change', {
        type: 'startStop',
        change: {
            running: true,
        }
    });
    cmd.run();
}

let getSnap = function (cb) {
    let picBuff = new WMStrm();
    recCmd = ffmpeg(snapSource)
        .on('start', function (commandLine) {
            wLog('Snapshot ' + commandLine, 4);
        })
        .on('error', function (err, o, e) {})
        .outputFormat('mjpeg')
        .frames(1)
        .stream(picBuff, {
            end: true
        });
    picBuff.on('finish', function () {
        try {
            cb(picBuff.memStore.toString('base64'));
            delete pickBuff;
        } catch (e) {
            cb(false);
        }
    });
}

function imDead(why, e = '') {
    status.running = false
    socket.emit('change', {
        type: 'startStop',
        change: {
            running: false,
        }
    });
    if (restart) {
        spawn();
        restart = false;
    }
    if (!mustBe) {
        wLog('Crash! ' + why + ' ' + e, 2);
        setTimeout(function () {
            spawn();
        }, 1000);
    }
    mustBe = false;
}

function criticalProblem(err, handler, ...args) {
    status.running = false
    status.error = err
    wLog('Critical Problem: ' + err, 3);
    socket.emit('change', {
        type: 'error',
        change: {
            running: false,
            error: err
        }
    });
    handler(args)
}

function handleDisc(info) {
    let [host, port] = info
    isReachable(host, port, is => {
        if (is) {
            spawn()
        } else {
            setTimeout(function () {
                handleDisc(info)
            }, 10000);
        }
    });
}

function isReachable(host, port, callback) {
    http.get({
        host: host,
        port: port
    }, function (res) {
        callback(true);
    }).on("error", function (e) {
        if (e.message == "socket hang up")
            callback(true)
        else
            callback(false);
    });
}


socket.on('connect', function () {
    wLog('Connected to Master: ' + config.master + '.');
    socket.emit('meta', status);
});

socket.on('command', (command) => {
    commandHandlers(command);
});

var commandHandlers = function commandHandlers(command) {
    var handlers = {
        startStop: function () {
            if (status.running) {
                wLog("Stop Command!", 1);
                mustBe = true
                cmd.kill();
            } else {
                wLog("Start Command!", 1);
                spawn();
            }
        },

        snap: function () {
            getSnap(snap => {
                socket.emit('data', {
                    type: 'snap',
                    data: snap,
                }, command.sender);
            });
        },
        restart: function () {
            if (status.running) {
                wLog("Restart Command!", 1);
                mustBe = true;
                restart = true;
                cmd.kill();
            } else {
                wLog("Start Command!", 1);
                spawn();
            }
        },
        getLogs: function () {
            fs.readFile(config.logPath, 'utf-8', function (err, data) {
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
    fs.appendFile(config.logPath, Date() + '$$$(i' + l + ')' + msg + '$end$\n', function (err) {
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

process.on('SIGTERM', function () {
    handleKill();
});
// process.on('SIGKILL', function () {
//     handleKill();
// });

//let's go
spawn()
