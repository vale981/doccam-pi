/**
 * @module Error-Handler
 * @description Provides error Handlers
 */


const net = require('net');

const {
    TRY_RECONNECT,
    STOP_ERROR_HANDLING
} = require('./actions.js').actions;

const {
    setTryReconnect,
    stopErrorHandling,
    setErrorResolved
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

        dispatch(stopErrorHandling());

        if (!getState().stream.handleError)
            return Promise.resolve();

        if (!handler)
            return Promise.resolve();

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
                if (!getState().stream.handleError)
                    return;

                const socket = new net.Socket();

                const onError = () => {
                    connectHandle = setTimeout(function() {
                        reconnect();
                    }, 1000);
                };

                socket.setTimeout(1000);
		            socket.on('error', onError);
                socket.on('timeout', onError);

                socket.connect(port, host.split('/')[0], () => {
                    success();
                    socket.end();
                });
            }

            function success() {
                setTimeout(() => {
                    dispatch(stopErrorHandling());
                    dispatch(setErrorResolved());
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
