/** Redux Wrapper to hold the state and communicate with the Server
 * @module State
 */

const redux = require('redux');
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
	running: false,
	error: -1,
	reconnecting: false
    },
    config: {}
}; // NOTE: Maybe in main.js

// The socket.io connection from the main-module.
let _communicator;

// Actions
const actions = require('./actions');

// Action Creators
const creators = require('./actionCreators');
const dispatchers = redux.bindActionCreators(creators);

// Reducer
const reducer = require('./reducers');

// Reference to the store of the application state.
const store = redux.createStore(reducer, initialState);

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

// TODO: Log state changes.

/**
 * The central redux state manager. The module exposes central action dispatchers. Updates to the state get communicated to the server.
 *
 * @constructor 
 * @member [Action Dispatchers] The action creators (@see actionCreators.js) are bound to the dispatch function and made member of the State object.
 * @param { Object } communicator A communicator object. @see communicator.js - Optional //TODO: Find proper tag.
 */
function State(communicator = false) {
    // singleton
    if (self)
        return self;

    // Make `new` optional.
    if (!(this instanceof State))
        return new State(_communicator);

    _communicator = communicator;
    
    self = this;
    return this;
};

applyDispatchers(creators);

/**
 * Set the communicator object and enable the state sync with the server.
 * @param {Object} communicator A communicator object. @see communicator.js
 */
State.prototype.setCommunicator = function(communicator) {
    if (_communicator)
        _communicator = communicator;
    else
        logger.dbgmsdg("Invalid Communicator");
};

/**
 * Wrapper for redux.
 * @returns { Object } The current state.
 */
State.prototype.getState = function(){
    return store.getState();
};

/**
 * Get the current config.
 * @returns { * } The current config.
 */
State.prototype.getConfig = function(){
    return store.getState().config;
};

/**
 * Utilities
 */

/**
 * Adds prototypes for the action dispatchers to the State. 
 * @param { Object } creators
 * @throws { Error } If a method with the creators name already exists. @see actionCreators.js
 */
function applyDispatchers( creators ){
    for(let creator in creators){
	if(State.prototype[creator])
	    throw new Error(`State has already a meber '${creator}'.`);
	
	State.prototype[creator] = function(){
	    store.dispatch(creators[creator].apply(undefined, arguments));
	};
    }
}


module.exports = State;



