/**
 * Action Creators
 *
 * The action creators create actions to alter the state. In this implementation they have no side effects.
 */

const actions = require('./actions');
let creators = {};


/**
 * Creates a start action.
 * @returns { Oject } Action
 */
creators.start = function() {
    return {
        type: actions.START
    };
};

/**
 * Creates a stop action.
 * @returns { Oject } Action
 */
creators.stop = function() {
    return {
        type: actions.STOP
    };
};

/**
 * Creates a restart action.
 * @returns { Oject } Action
 */
creators.restart = function() {
    return {
	type: actions.RESTART
    };
};


/**
 * Creates an action to set the Error.
 * @param { Number } error The error code. @see ffmpegCommand.js
 * @returns { Object } Action
 */
creators.setError = function(error) {
    return {
        type: actions.SET_ERROR,
        data: error
    };
};

/**
 * Creates an action to update the config.
 * @param { Object } configUpdate The changes to the config.
 * @returns { Object } Action
 */
creators.updateConfig = function(configUpdate) {
    return {
        type: actions.UPDATE_CONFIG,
        data: configUpdate
    };
};

module.exports = creators;
