///////////////////////////////////////////////////////////////////////////////
//      Redux Wrapper to hold the state and communicate with the Server.     //
///////////////////////////////////////////////////////////////////////////////

/**
 * All actions are proxied via Socket.js
 *
 * The connection is managed by the main module.
 */

const redux = require('redux');

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Object oriented `this`.
let self = false;

// Reference to the store.
let store = false;

/**
 * Inital State for the app.
 * @property { bool } streaming Indicates if the streaming process is running.
 * @property { number } error Error code. Any number outside the range of the Error array in @see ffmpeg-command.js will be treated as non error. Most conveniently set: -1.
 * @property { bool } configured Indicates if the camera is configured or not.
 */
let initialState = {
    streaming: false,
    error: -1,
    config: {}
}; // NOTE: Maybe in main.js

// Reducer
let streaming, error, config;
const reducers = redux.combineReducers({
    streaming,
    error,
    config
});

// The socket.io connection from the main-module.
let _socket;

/**
 * Actions
 */

let SEND_MESSAGE = 'SEND_MESSAGE';
let UPDATE_CONFIG = 'UPDATE_CONFIG';
let START_STOP = 'START_STOP';
let SET_ERROR = 'SET_ERROR';

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Wrapper to expose action creators and the store.
 * @param { Object } socket Socket.io instance from the main module..
 */
module.exports = function state( socket ){
    // singleton
    if(self)
	return self;

    // Make `new` optional.
    if(!(this instanceof createStore))
	return new createStore(_socket);
    
    _socket = socket;
    self = this;
 
    return this;
};

/**
 * Reducers
 */

// TODO: share the code!

/**
 * Set the streaming/error state.
 */
streaming = error = function(state, action) {
    switch(action) {
    case SET_ERROR:
    case START_STOP:
	return action.data;
	break;
    default:
	return state;
    }
};

/**
 * Update the config.
 */
config = function(state, action) {
    switch(action) {
    case UPDATE_CONFIG:
	return Object.assign({}, state, action.data);
	break;
    default:
	return state;
    }
}
