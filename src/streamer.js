/** The central interface to the streaming process.
 * @module Streamer
 */

const logger = require('./logger');

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Object oriented `this`.
let self = false;

/**
 * Inital State for the app.
 * @property { Object } stream Stream Status.
 * @property { bool } stream.running Indicates wether the stream is running.
 * @property { number } stream.error Error code. Any number outside the range of the Error array in @see ffmpeg-command.js will be treated as non error. Most conveniently set: -1.
 * @property { bool } stream.reconnecting Indicates wether the program tries to reconnect to the camera or the internet.
 * @property { Object } config Configuration of the camera.
 */
let initialState = {
    stream: {
	running: 'STOPPED',
	error: -1,
	reconnecting: false,
	restarting: false
    },
    config: {}
}; // NOTE: Maybe in main.js

/**
 * The socket.io connection from the main-module.
 */
let _communicator;
 
/**
 * Redux Actions
 */
// Reducer
const reducer = require('./reducers');

// Reference to the store of the application state.
const store = redux.createStore(reducer, initialState);

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

// TODO: Log state changes.

/**
 * @class Streamer
 * The central control Object (singleton for now) which has the permission to change state.
 * 
 * @constructor 
 * @param { Object } communicator A communicator object. @see communicator.js - Optional //TODO: Find proper tag.
 */
function Streamer(communicator = false) {
    // singleton
    if (self)
        return self;

    // Make `new` optional.
    if (!(this instanceof Streamer))
        return new Streamer(_communicator);

    _communicator = communicator;
    
    self = this;
    return this;
};

module.exports = Streamer;

/**
 * Set the communicator object and enable the state sync with the server.
 * @param {Object} communicator A communicator object. @see communicator.js
 */
Streamer.prototype.setCommunicator = function(communicator) {
    if (_communicator)
        _communicator = communicator;
    else
        logger.dbgmsdg("Invalid Communicator");
};

/**
 * Get the current config.
 * @returns { * } The current config.
 */
Streamer.prototype.getConfig = function(){
    return store.getStreamer().config;
};

/**
 * Utilities
 */



