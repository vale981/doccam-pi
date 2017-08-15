/**
 * @module Commander
 * @description A Wrapper for Fluent-FFMPEG with a custom command.
 */

const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const logger = require('./logger');
const errorHandling = require('./errorHandler.js');
const WMStrm = require('../lib/memWrite.js');

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Reference to itself. (Object oriented this. Only used to call public methods.)
let self = false;

/**
 * The FFMPEG command.
 * @member
 */
let cmd;

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

const {
    UPDATE_CONFIG
} = require('./actions').actions;

// Action Creators
const {
    requestStart,
    requestStop,
    requestRestart,
    setStarted,
    setStopped,
    setError,
    takeSnapshot,
    setSnapshotTaken,
    setSnapshotFailed
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

            // Create the FFMPEG-Command initially.
            self.createCommands();

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
                    }).catch((message) => reject({
                        message: "Could not restart!",
                        details: message
                    })); // TODO: CD
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
            dispatch(errorHandling.stopHandling());
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
                    resolve();
                }, 3000);
            }).then(() => {
                clearTimeout(_stopHandle);
                dispatch(setStopped());
                resolve("Successfully Stopped!"); // TODO: CD
            });
        });
    };
};

Commander.prototype.takeSnapshot = function() {
    return (dispatch, getStatus) => {
        if (getState().stream.snapshot.taking)
            return Promise.reject('Another Snapshot is already being taken! Please wait.'); // TODO: CD

        return new Promise((resolve, reject) => {
            dispatch(takeSnapshot());
            // TODO: Alternative Logging
            // TODO: CD

            // Init memstream.
            let snapBuff;
            try {
                snapBuff = new WMStrm();
            } catch (e) {
                reject('An error occured while initializing the memeory stream.');
                return;
            }

            let snapCmd = ffmpeg({
                stdoutLines: 20
            });

            snapCmd.input(source + config().snapProfile)
                .outputFormat('mjpeg')
                .frames(1)
                .stream(snapBuff, {
                    end: true
                });

            // Reject on Error.
            snapCmd.once('error', () => reject('An error occured while taking the snapshot'));

            // Send data on Finish.
            snapCmd.once('end', () => {
                try {
                    resolve(snapBuff.memStore.toString('base64'));
                } catch (e) {
                    reject('An error occured while reading the snapshot memory stream.');
                }
            });

            snapCmd.run();
        }).then(snap => {
            {
                dispatch(setSnapshotTaken());
                return Promise.resolve(snap);
            }
        }, err => {
            dispatch(setSnapshotFailed(err));
            return Promise.reject(err);
        });
    };
};

/**
 * (Re)Create the ffmpeg command and configure it.
 * @param { Object } config The configuration for the stream.
 * @returns { Object } The fluent-ffmpeg command object. 
 */
Commander.prototype.createCommands = function() {
    cmd = ffmpeg({
        stdoutLines: 20
    });

    // TODO: Multi Protocol
    source = 'rtsp://' + config().camIP + ':' + config().camPort + '/';
    cmd.input(source + config().camProfile);

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
        .output('rtmp://' + config()['stream-server'] + '/' + config().key);

    // Register events.
    cmd.on('error', (error, stdout, stderr) => crashed({
        error,
        stdout,
        stderr
    }));

    // Can posibly be an error.
    cmd.on('end', (stdout, stderr) => crashed({
        stdout,
        stderr
    }));
    //snapCmd._outputs = [];
    // Snap Profile.
    /*snapCmd.input(source + config().snapProfile)
        .outputFormat('mjpeg')
        .frames(1)
        .stream(snapBuff, {
            end: true
	 });*/

    return cmd;
};

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
function crashed({
    error,
    stdout,
    stderr
}) {
    let errorCode, handler;

    // Finished
    if (!error) {
        dispatch(setStopped());
    } else {
        // We stopped...
        if (getState().stream.running === 'STOPPED' || getState().stream.running === 'STOPPING')
            return;

        // Can't connect to the Camera
        if (error.message.indexOf(source) > -1) {
            errorCode = 0;
            handler = errorHandling.handlers.tryReconnect(config().camIP, config().camPort,
                () => dispatch(self.start()).catch(() => {}));
        }

        // Invalid Stream Key etc...
        else if (error.message.indexOf('Operation not permitted') > -1 || (error.message.indexOf('Input/output') > -1 && error.message.indexOf('rtmp://' + config()['stream-server'] + '/' + config().key) > -1)) {
            errorCode = 4;
        }

        // Can't connect to the Internet / YouTube
        else if (error.message.indexOf(source + ' Input/output error') > -1 || error.message.indexOf('rtmp://' + config()['stream-server'] + '/' + config().key) > -1) {
            errorCode = 1;

            handler = errorHandling.handlers.tryReconnect(config()['stream-server'], 1935,
                () => dispatch(self.start()).catch(() => {})); // TODO: Better Solution
        }

        // Wrong FFMPEG Executable
        else if (error.message.indexOf('spawn') > -1 || error.message.indexOf('niceness') > -1)
            errorCode = 2;

        // Stopped by us - SIGINT Shouldn't lead to a crash.
        else if (error.message.indexOf('SIGINT') > -1 || error.message.indexOf('SIGKILL') > -1) {
            return;
        }
    }

    // Some unknown Problem, just try to restart.
    if (!errorCode && errorCode !== 0) {
        errorCode = 3;

        // Just restart in a Second.
        setTimeout(() => {
            dispatch(self.start());
        }, 1000);
    }

    dispatch(setError(errorCode, stdout, stderr)); // NOTE: Maybe no STDOUT


    // Handle the error if possible.
    if (handler)
        setTimeout(() => {
            dispatch(handler);
        }, 1000);
}


/**
 * Redux Middleware
 */

Commander.middleware = store => next => action => {
    let result = next(action);

    // If sth. has changed, we restart.
    if (self && (getState().stream.error !== false || getState().stream.running === 'RUNNING') &&
        action.type === UPDATE_CONFIG) {
        if (action.data.key ||
            action.data.ffmpegPath ||
            action.data.customOutputOptions ||
            action.data.customVideoOptions ||
            action.data.customAudioOptions ||
            action.data.camIP ||
            action.data.camPort ||
            action.data['stream-server'] ||
            action.key) {
            dispatch(self.restart()).catch(() => {}); //TODO: error Handling
        }
    }
    return result;
};
