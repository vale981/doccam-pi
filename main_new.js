/**
 * @module Main
 * @description The main module and entry point.
 */

const redux = require('redux');
const ReduxThunk = require('redux-thunk').default;
const communicator =  require('./src/communicator.js');
const commander =  require('./src/commander.js');
const logger = require('./src/logger.js');

///////////////////////////////////////////////////////////////////////////////
//                                   Redux                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Inital State for the app.
 * @property { Object } stream Stream Status.
 * @property { bool } stream.running Indicates wether the stream is running.
 * @property { number | bool } stream.error Error code. Any number outside the range of the Error array in @see ffmpeg-command.js will be treated as non error. Most conveniently set: false.
 * @property { bool | string } stream.errorHandling Indicates wether the program tries to handle an error.
 * @property { bool } stream.restaring Indicades wether the stream is currently being restarted.
 * @property { Object } config Configuration of the camera.
 */
let initialState = {
    name: 'Unnamed',
    stream: {
	running: 'STOPPED',
	error: false,
	reconnecting: false,
	handleError: false,
	restaring: false
    },
    connected: false,
    config: false
};

// Reducer
const reducer = require('./src/reducers');

// Reference to the store of the application state.
const store = redux.createStore(reducer, initialState, redux.applyMiddleware(ReduxThunk, logger.middleware, communicator.middleware));

// The dispatch function for the state.
const dispatch = store.dispatch;

// The function to get the state.
const getState = store.getState;

// A helper to get the config.
const getConfig = () => store.getState().config;

// Simple Action creators
const creators = require('./src/actions.js').creators;

///////////////////////////////////////////////////////////////////////////////
//                                    Load                                   //
///////////////////////////////////////////////////////////////////////////////

// Code the Config
dispatch(creators.updateConfig());

const Commander = new commander(getState, getConfig, dispatch);

// The server Communication
const Communicator = new communicator(getState, dispatch);

dispatch(Commander.start());
