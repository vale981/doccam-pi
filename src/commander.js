/**
 * @module Commander
 * @description A Wrapper for Fluent-FFMPEG with a custom command.
 */

const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const logger = require('./logger');
const errorHandling = require('./errorHandler.js');

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
let _stopHandle = false;

// Error Texts //TODO put them into separate module
let errorDescriptions = ['Camera Disconnected',
    'YoutTube Disconnected',
    'Wrong ffmpeg executable.',
    'Unknown Error - Restarting'
];

// The stream source url. Yet to be set.
let source = "";

// The function to get the State.
let getState;

// The dispatch function for the store
let dispatch;

// The function to get the config().
let config;

// Action Creators
const {
    requestStart,
    requestStop,
    requestRestart,
    setStarted,
    setStopped,
    setError
} = require('./actions').creators;

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Interface to the ffmpeg process. Uses fluent-ffmpeg.
 * @constructor
 */
class Commander {
    constructor(_getState, _getConfig, _dispatch) {
        // singleton
        if (self)
            return self;

        // Make `new` optional.
        if (!(this instanceof Commander))
            return new Commander();

        if ((typeof _getState) !== 'function') {
            throw new Error('Invalid getState() function.');
        }

	if ((typeof _getConfig) !== 'function' || !_getConfig()) {
            throw new Error('Please load a valid config().');
        }

        if ((typeof _dispatch) !== 'function') {
            throw new Error('Invalid dispatch function.');
        }

        self = this;

        getState = _getState;
        config = _getConfig;
        dispatch = _dispatch;

        // Create the FFMPEG-Command initially.
        this.createCommand();

        // Register events.
        cmd.on('error', crashed);

        return this;
    }
}

module.exports = Commander;

/**
 * Action creators.
 */

// NOTE: Maybe better error resolving strategy. 
// Start streaming.
/**
 * Starts the streaming process if possible.
 * @returns {function} Thunk for the dispatch function. This function returns a promise, that resolves with a message. If it resolves without, then the command was irrelevant.
 */
Commander.prototype.start = function() {
    return (dispatch, getState) => {
        // Some Checks
        if (config().unconfigured)
            return Promise.reject("Please configurate the camera before you start it!");

        if (getState().stream.handleError)
            return Promise.reject("Please resolve the error, or restart!"); // TODO: central definition!

        if (getState().stream.running == 'STARTING' ||
            getState().stream.running == 'STOPPING' ||
            getState().stream.running == 'RUNNING') // TODO: Central Definition!
            return Promise.resolve();

        return new Promise((resolve, reject) => {
            // Set the Status to starting.
            dispatch(requestStart());

            new Promise((resolve, reject) => {
                cmd.once('start', resolve);
                cmd.prependOnceListener('error', reject);
                cmd.run();
            }).then(() => {
                dispatch(setStarted());
                resolve("Successfully Started."); // TODO: CD
            }).catch((error) => {
                reject("An error has occured. Could not start!", error); // TODO: Central Definition!
            });
        });
    };
};

/**
 * Restarts the streaming process if possible. Error handling is being canceled stopped.
 * @returns {function} Thunk for the dispatch function. This function returns a promise, that resolves with a message. If it resolves without, then the command was irrelevant.
 */
Commander.prototype.restart = function() {
    return (dispatch, getStatus) => {
        dispatch(requestRestart());

        // Stop Error Handling
        return new Promise((resolve, reject) => {
            dispatch(errorHandling.stopHandling()).then(() => {
                dispatch(self.stop()).then(() => {
                    dispatch(self.start()).then(() => {
                        resolve("Successfully restarted.");
                    }).catch((message) => reject("Could not start!", message)); // TODO: CD
                });
            });
        });
    };
};

/**
 * Stops the streaming process if possible
 * @returns {function} Thunk for the dispatch function. This function returns a promise, that resolves with a message. If it resolves without, then the command was irrelevant.
 */
Commander.prototype.stop = function() {
    return (dispatch, getStatus) => {
        if (getState().stream.running == 'STARTING' ||
            getState().stream.running == 'STOPPING' ||
            getState().stream.running == 'STOPPED')
            return Promise.resolve();

        return new Promise((resolve, reject) => {
            // Set the Status to starting.
            dispatch(requestStop());

            new Promise((resolve, reject) => {
                cmd.once('stop', resolve);
                cmd.prependOnceListener('error', resolve);

                // Try it civilized for now.
                cmd.kill('SIGINT');

                _stopHandle = setTimeout(() => {
                    // Ok let's force it then...
                    logger.log(logger.importance[3], "Force Stop!");
                    cmd.kill();
                }, 3000);
            }).then(() => {
                clearTimeout(_stopHandle);

                dispatch(setStopped());
                resolve("Successfully Stopped!"); // TODO: CD
            });
        });
    };
};


/**
 * (Re)Create the ffmpeg command and configure it.
 * @param { Object } config The configuration for the stream.
 * @returns { Object } The fluent-ffmpeg command object. 
 */
Commander.prototype.createCommand = function() {
    // Clear inputs
    cmd._inputs = [];

    // TODO: Multi Protocol
    source = 'rtsp://' + config().camIP + ':' + config().camPort + '/' + config().camProfile;
    cmd.input(source);

    // Custom config if any.
    if (config().customOutputOptions !== "")
        cmd.outputOptions(config().customOutputOptions.replace(/\s+\,\s+/g, ',').replace(/\s+\-/g, ',-').split(','));

    if (config().customAudioOptions !== "")
        cmd.outputOptions(config().customAudioOptions.replace(/\s+\,\s+/g, ',').replace(/\s+\-/g, ',-').split(','));
    else
        cmd.AudioCodec('copy');

    if (config().customVideoOptions !== "")
        cmd.outputOptions(config().customVideoOptions.replace(/\s+\,\s+/g, ',').replace(/\s+\-/g, ',-').split(','));
    else
        cmd.videoCodec('copy');

    // Output Options.
    cmd.outputFormat('flv')
        .outputOptions(['-bufsize 50000k', '-tune film'])
        .output('rtmp://a.rtmp.youtube.com/live2/' + config().key);

    return cmd;
};

/**
 * Private
 */

/**
 * Utilities 
 */

// TODO: Restart = false in stopped?
/**
 * Error Handling
 */

/**
 * Log and handle crashes. Notify the main module.
 * @param { Object } error - Error object from the crash.
 * @param { String } stdout
 * @param { String } stderr
 */
function crashed(error, stdout, stderr) {
    let errorCode, handler;

    // Can't connect to the Camera
    if (error.message.indexOf(source) > -1) {
        errorCode = 0;
        handler = errorHandling.handlers.tryReconnect(config().camIP, config().camPort,
            () => dispatch(self.start()));
    }

    // Can't connect to the Internet / YouTube
    else if (error.message.indexOf(source + 'Input/output error') > -1 || error.message.indexOf('rtmp://a.rtmp.youtube.com/live2/' + config().key) > -1) {
        errorCode = 1;
        handler = errorHandling.handlers.tryReconnect('a.rtmp.youtube.com/live2/', 1935,
            () => dispatch(self.start()));
    }

    // Wrong FFMPEG Executable
    else if (error.message.indexOf('spawn') > -1 || error.message.indexOf('niceness') > -1)
        errorCode = 2;

    // Stopped by us - SIGINT Shouldn't lead to a crash.
    else if (error.message.indexOf('SIGINT') > -1 || error.message.indexOf('SIGKILL') > -1) {
        return;
    }

    // Some unknown Problem, just try to restart.
    else {
        errorCode = 3;

        // Just restart in a Second.
        setTimeout(function() {
            dispatch(self.start());
        }, 1000);
    }

    dispatch(setError(errorCode, stdout, stderr)); // NOTE: Maybe no STDOUT

    // Handle the error if possible.
    if (handler)
        dispatch(handler);
}
