module.exports = function (settings) {
    let source = 'rtsp://' + settings.camIP + ':' + settings.camPort + '/' + settings.camProfile

    return ffmpeg(source)
        .videoCodec('copy')
        .audioBitrate('128k')
        .audioChannels(1)
        .audioFrequency(11025)
        .audioCodec('libmp3lame')
        .on('start', function (commandLine) {
            settings.running = true
            wLog('Spawned Ffmpeg with command: ' + commandLine, 4);
            socket.emit('startStop', true)
        })
        .on('end', function (o, e) {
            imDead('Normal Stop.', e);
        })
        .on('error', function (err, o, e) {
            console.log(err);
            if (err.message.indexOf(source + ': No route to host') > -1 || err.message.indexOf(source + ': Connection refused') > -1)
                criticalProblem('Camera Disconnected', handleDisc, settings.camIP, settings.camPort)
            else
            if (err.message.indexOf(source + 'Input/output error') > -1)
                criticalProblem('YoutTube Disconnected', handleDisc, 'rtmp://a.rtmp.youtube.com/live2/')
            else
                imDead(err.message, e);
        })
        .outputFormat('flv')
        .outputOptions(['-bufsize 10000k', '-tune film'])
    cmd.output('rtmp://a.rtmp.youtube.com/live2/' + settings.key);
}
