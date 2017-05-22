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
 * @property { Object } ssh The SSH tunnel status.
 * @property { bool }   ssh.enabled
 * @property { bool }   ssh.willReconnect Indicates if the SSH-Manager will try to reconnect as soon as the connection to the manager is regained.
 * @property { string } ssh.status Status of the SSH Connection. Can either be DISABLED | DISCONNECTED |DISCONNECTING | CONNECTING | CONNECTED
 * @property { number } ssh.sshForwardport SSH remote endpoint port for the ssh reverse tunnel.
 * @property { number } ssh.camForwardPort SSH remote endpoint port for the reverse tunnel to the control panel of the IP Camera.
 * @property { string } ssh.error The SSH Error, if there is any. You might check ssh.willReconnect as well, to see if a retry is sceduled as soon as the connection to the manager is regained. 
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
    ssh: {
	status: 'DISCONNECTED', // TODO: CD
	cameraForwardPort: false,
	sshForwardPort: false,
	willReconnect: false,
	error: false
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
const Communicator = new communicator(getState, getConfig, dispatch);

dispatch(Commander.start());


