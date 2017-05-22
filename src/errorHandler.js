/**
 * @module Error-Handler
 * @description Provides error Handlers
 */

const http = require('http');

const {
    TRY_RECONNECT,
    STOP_ERROR_HANDLING
} = require('./actions.js').actions;

const {
    setTryReconnect,
    stopErrorHandling
} = require('./actions.js').creators;

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

module.exports = {};

/**
 * Error Handler Map. Each handler function returns an object, which has a handle function of it's own name and a (empty) stop function.
 */
const handlers = {
    tryReconnect: tryReconnect().handle // TODO: Nicer
};

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

module.exports.handlers = handlers;

/**
 * Utilities
 */

/**
 * Stops the error handler.
 * @returns {function} An action-creating thunk. (That returns a promise.)
 */
module.exports.stopHandling = function() {
    return (dispatch, getState) => {
        let stopper,
            handler = handlers[getState().stream.handleError];
		
        if (!getState().stream.handleError)
            return Promise.resolve();

        if (!handler)
            return Promise.resolve();

	dispatch(stopErrorHandling());
	stopper = handler.stop();

        if (!stopper.then)
            return Promise.resolve();

        // If it is a promise.
        return stopper;
    };
};

/**
 * Error Handlers
 */

/**
 * Reconnection handler.
 * @returns {Object} A handler object. @see handlers
 */
function tryReconnect() {
    let connectHandle;

    /**
     * Try to reconnect to the host.
     * @param {string} host
     * @param {number} port
     * @param {function} after A function to be executed upon resolution of the error.
     * @returns {function} An action-creating thunk.
     */
    this.handle = function(host, port, after) {
        return (dispatch, getState) => {
            if (!host || !port)
                throw new Error("Invalid Host or Port!");

            dispatch(setTryReconnect([host, port]));
            connectHandle = false;
            reconnect();

            function reconnect() {
		// Somebody has stopped it.
		if(!getState().stream.handleError)
		    return;

		http.get({
                    host: host.split('/')[0],
                    port: port
                }, function() {
                    success();
                }).on("error", function(error) {
                    if (error.message == "socket hang up") {
                        // Even if he doesn't like to talk to us, he's there.
                        success();
                    } else {
			// try again
                        connectHandle = setTimeout(function() {
                            reconnect();
                        }, 1000);
                    }
                });
            }

            function success() {
                setTimeout(() => {
                    dispatch(stopErrorHandling());
                    after();
                });
            };
        };
    };

    this.stop = function() {
        clearTimeout(connectHandle);
    };

    return this;
}
