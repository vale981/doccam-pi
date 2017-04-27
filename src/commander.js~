/**
 * @module Commander
 * @description A Wrapper for Fluent-FFMPEG with a custom command.
 */


const ffmpeg = require('fluent-ffmpeg');
const http   = require('http');
const logger = require('./logger');

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Reference to itself. (Object oriented this. Only used to call public methods.)
let self = false;

/**
 * The FFMPEG command.
 * @member 
 */
let cmd = ffmpeg({
    stdoutLines: 20
});

// The Config, Logger and a handle for the kill timeout.
let _config, _stopHandle = false, _connectHandle = false;

// Error Texts //TODO put them into separate module
let errorDescriptions = ['Camera Disconnected',
			 'YoutTube Disconnected',
			 'Wrong ffmpeg executable.',
			 'Unknown Error - Restarting'];

// The stream source url. Yet to be set.
let source = "";

// The function to get the State.
let getState;

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Interface to the ffmpeg process. Uses fluent-ffmpeg.
 * @constructor
 */
let Commander = function(_getState){
    // singleton
    if(self)
	return self;

    // Make `new` optional.
    if(!(this instanceof Commander))
	return new Commander();

    if (!_getState) {
	throw new Error('Invalid getState() function.');
    }

    getState = _getState;
    self = this;
           
	/**
	 * (Re)Create the ffmpeg command and configure it.
	 * @param { Object } config The configuration for the stream.
	 * @returns { Object } The fluent-ffmpeg command object. 
	 */
    let createCommand = function() {
	// Clear inputs
	cmd._inputs = [];

	// TODO: Multi Protocol
	source = 'rtsp://' + config.camIP + ':' + config.camPort + '/' + config.camProfile;
	cmd.input(source);

	// Custom config if any.
	if (config.customOutputOptions !== "")
            cmd.outputOptions(config.customOutputOptions.replace(/\s+\,\s+/g, ',').replace(/\s+\-/g, ',-').split(','));
	
	if (config.customAudioOptions !== "")
            cmd.outputOptions(config.customAudioOptions.replace(/\s+\,\s+/g, ',').replace(/\s+\-/g, ',-').split(','));
	else
            cmd.AudioCodec('copy');
	
	if (config.customVideoOptions !== "")
            cmd.outputOptions(config.customVideoOptions.replace(/\s+\,\s+/g, ',').replace(/\s+\-/g, ',-').split(','));
	else
            cmd.videoCodec('copy');

	// Output Options.
	cmd.outputFormat('flv')
            .outputOptions(['-bufsize 50000k', '-tune film'])
            .output('rtmp://a.rtmp.youtube.com/live2/' + config.key);
    
	// Register events.
	cmd.on('start', started);
	
	cmd.on('end', stopped);
	
        cmd.on('error', crashed);

	return cmd;
    };

    let ffmpegCommand = function() {
	return cmd;
    };

    // NOTE: Maybe better error resolving strategy. 
    // Start streaming.
    let start = function() {
	// Ignore if we try to reconnect.
	if(_connectHandle)
	    return;
	
	cmd.run();
    };

    // Restart the stream;
    let restart =  function() {
	if(status.streaming) {
	    restart = true; // NOTE: not very nice
	    this.stop();
	} else
	    this.start();
    };

    // Stop streaming.
    let stop = function() {
	cmd.kill('SIGINT');

	_stopHandle = setTimeout(() => {
            logger.log(logger.importance[3], "Force Stop!");
            cmd.kill();
	}, 3000);
    };
}

/**
 * Utilities 
 */

/**
 * Get the current config.
 * @returns {} 
 */
function config() {
    return getState().config;
}    

// Handle Stop and Restart
function stopped() {
    status.streaming = false;
    
    // Clear force kill Timeout
    if(stopTimeout) {
	clearTimeout(stopTimeout);
	stopTimeout = false;
    }

    // Restart the stream;
    if (restart) {
        self.start();
    }
    
    cmd.emit('stopped');
}

// TODO: Restart = false in stopped?
// Hande Stat
function started() {
    cmd.emit(restart ? 'restarted' : 'started');
    restart = false;
    status.error = false;
    status.streaming = true;
}

/**
 * Error Handling
 */

/**
 * Log and handle crashes. Notify the main module.
 * @param { Object } error - Error object from the crash.
 * @param { String } stdout
 * @param { String } stderr
 */
function crashed(error, stdout, stderr){
    // Can't connect to the 
    if (err.message.indexOf(source) > -1)
	status.error = 0;

    // Can't connect to the Internet / YouTube
    else if (err.message.indexOf(source + 'Input/output error') > -1 || err.message.indexOf('rtmp://a.rtmp.youtube.com/live2/' + _config.key) > -1)
	status.error = 1;

    // Wrong FFMPEG Executable
    else if (err.message.indexOf('spawn') > -1 || err.message.indexOf('niceness') > -1)
        status.error = 2;

    // Stopped by us - SIGINT Shouldn't lead to a crash.
    else if (err.message.indexOf('SIGINT') > -1 || err.message.indexOf('SIGKILL') > -1){
        stopped();
	return;
    }

    // Some unknown Problem, just try to restart.
    else {
	status.error = 3;
	
	// Just restart in a Second
	setTimeout(function(){
	    self.start();
	}, 1000);
    }

    logger.log(logger.importance[2], `Crashed: ${erro}\nSTDERR: ${stderr}`);
}

/**
 * Probe the connection to the host on the port and restart the stream afterwards.
 * @param { string } host
 * @param { number } port
 */
function tryReconnect( host, port ){
    if (!host || !port)
	return;

    http.get({
        host: host.split('/')[0],
        port: port
    }, function(res) {
	// We have a response! Connection works.
	setTimeout(function() {
	    // NOTE: Ugly!
	    
            // We have a response! Connection works.
	    _connectHandle = false;
	    self.start();
        }, 1000);
    }).on("error", function(e) {
	if (e.message == "socket hang up") {
            setTimeout(function() {
		// NOTE: Ugly!
		
                // We have a response! Connection works.
		_connectHandle = false;
		self.start();
            }, 1000);
        } else {
	    // try again
            _connectHandle = setTimeout(function(){
		tryReconnect(host, port);
	    }, 1000);
	}
    });
}
