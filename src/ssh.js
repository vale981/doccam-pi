/**
 * @module ssh
 * @description Manages the SSH Tunnels to the master-server. (Even works with muliple instances.)
 * @description The SSH Manager is commandet by the Communicator.
 */

// TODO: Disconnect event from SSH-Manager itself!

const ipc = require('node-ipc');
const {
    setSSHError,
    setSSHConnecting,
    setSSHConnected,
    setSSHDisconnecting,
    setSSHDisconnected,
    setSSHWillReconnect,
    setSSHRemotePorts
} = require('./actions').creators;

const {
    UPDATE_CONFIG
} = require('./actions').actions;

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Object oriented `this`.
let self;

// Get state for the SSH State.
let getState, getConfig;

// The redux dispatch function to alter the state.
let dispatch;

// PIDs of the ssh-tunnel and the camera tunnel.
let sshPID, camPID;

// IPC Setup
ipc.config.silent = true;

// Connected to the ipc // TODO: May be redundand (see socket.destroyed...) // FIXME: RENAME!
let connected = false;

/**
 * @function getPorts
 * A function to get the Ports for the SSH-Tunnel. Given as parameter for the @see SSHMan.
 * This module doesn't care where it comes from, as long as it WORKS!
 * @returns {Promise} Resolves to ports {camForwardPort: integer, sshForwardport: integer}.
 */
let getPorts;

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

// TODO: Check if autossh installed
/**
 * A Class to abstract the communication with the SSH-Manager.
 * @param {} _getState
 * @param {} _getConfig
 * @param {} _dispatch
 * @param {} _getPorts @see `let getPorts`
 * @throws {}
 */
class SSHMan {
    constructor(_getState, _getConfig, _dispatch, _getPorts) {
        // Signleton
        if (self)
            return;

        if ((typeof _getState) !== 'function') {
            throw new Error('Invalid getState() function.');
        }

        if ((typeof _getConfig) !== 'function' || !_getConfig()) {
            throw new Error('Please load a valid config.');
        }

        if ((typeof _dispatch) !== 'function') {
            throw new Error('Invalid dispatch function.');
        }

        if ((typeof _getPorts) !== 'function' && typeof _getConfig() !== 'object') {
            throw new Error('Invalid getPorts function.');
        }


        getState = _getState;
        getConfig = _getConfig;
        getPorts = _getPorts;
        dispatch = _dispatch;

        self = this;

        connectIpc();
    }
};

/**
 * Action Creators.
 */

/**
 * Action Creator to connect the SSH Tunnels via the SSH-Manager.
 * @returns {Promise}
 */
SSHMan.prototype.connect = function() {
    return (dispatch, getState) => {
        if (!getConfig().ssh)
            return Promise.reject("SSH is disabled."); // TODO: CD

        if (getState().ssh.status == 'CONNECTED')
            return Promise.resolve();

        if (getState().ssh.status == 'CONNECTING')
            return Promise.reject('A command which is currently being executed is in conflict with the current one.');

        // Let's go ahead.
        dispatch(setSSHConnecting());

        let config = getState().config;
        let newPorts = {},
            ports = {};
        return isIpcConnected()
            .then(() => getPorts())
            .then((_ports) => {
                if (typeof _ports.sshForwardPort !== 'number' || typeof _ports.camForwardPort !== 'number') {
                    return Promise.reject("Invalid Ports!");
                } else {
                    ports = _ports;
                    return isIpcConnected();
                }
            })
            .then(() => createTunnel(config.sshPort, ports.sshForwardPort))
            .then(port => newPorts.sshForwardPort = port)
            .then(() => createTunnel(config.camPort, ports.camForwardPort))
            .then(port => newPorts.camForwardPort = port)
            .then(() => isIpcConnected)
            .then(() => {
                dispatch(setSSHRemotePorts(newPorts));
                dispatch(setSSHConnected());
                return Promise.resolve('SSH Tunnels successfully connected.'); // TODO: CD
            })
            .catch(error => {
                dispatch(setSSHError(error));
                return Promise.reject(error);
            });
    };
};

/**
 * An action creator for disconnecting the SSH Tunnels.
 * Resolves on successfull disconnect. Rejects if the request couldn't be made. In both cases the tunnel is disconnected.
 * It also sets the willReconnect flag to false.
 * @returns { Promise }
 */
SSHMan.prototype.disconnect = function() {
    return (dispatch, getState) => {
        // Nothing todo
        if (getState().ssh.status !== 'CONNECTED') {
            return Promise.reject("Can't disconnect the SSH-Tunnels right now, please try later."); // TODO: CD
        }

        // Let's go ahead.
        dispatch(setSSHDisconnecting());

        let config = getState().config;
        return isIpcConnected()
            .then(() => closeTunnel(config.sshPort))
            .then(() => closeTunnel(config.camPort))
            .then(() => {
                dispatch(setSSHDisconnected());
                return Promise.resolve();
            })
            .catch((error) => {
                // This means that the tunnel is not connected anymore.
                dispatch(setSSHDisconnected());
                return Promise.reject(error);
            });
    };
};

// TODO: Maybe both tunnels handled completely independent.
/**
 * An action creator that restarts the SSH Tunnels.
 * @returns { Promise }
 */
SSHMan.prototype.restartTunnels = function() {
    return (dispatch, getState) => {
        // TODO: CD
        return dispatch(self.disconnect())
            .then(() => dispatch(self.connect()));
    };
};

module.exports = SSHMan;

/**
 * Private Utility
 */

function connectIpc(ports) {
    ipc.connectTo('sshMan'); // TODO: CD

    // Register Events
    ipc.of.sshMan.on('connect', ipcConnected);
    ipc.of.sshMan.on('disconnect', ipcDisconnected);
}

/**
 * Handler for the IPC Connection Event.
 * Currently just sets connected = true.
 */
function ipcConnected() {
    connected = true;
    if (getState().ssh.willReconnect) {
        dispatch(self.connect()).catch(() => {
            // We do nothing...
        });
    }
}

/**
 * Handler for the IPC Disconnect Event.
 */
function ipcDisconnected() {
    if (!connected)
        return;

    connected = false;

    // Automatically attempt to reconnect once connection is made.
    dispatch(setSSHWillReconnect());
    dispatch(setSSHError("Connection to SSH-Manager lost!")); // TODO: CD
}

// TODO/URGENT: BETTER ERROR HANDLING

/**
 * Creates a tunnel by reqesting it from the manager.
 * @param { number } localPort
 * @param { number } remotePort
 * @returns { function } Action / Promise
 */
function createTunnel(localPort, remotePort) {
    return new Promise((resolve, reject) => {
        let id = (new Date()).getTime();
        let config = getConfig();

        let connectTimeout = setTimeout(() => reject("IPC Timeout. Can't reach SSH-Manager."), 2000); // TODO: CD

        // TODO: Variable CD
        ipc.of.sshMan.once('success' + id, (port) => {
            resolve(port); // TODO: That's ok for now, but should be auto-determined by the SSH-Manager further down the road...
        });

        ipc.of.sshMan.once('error' + id, (error) => {
            reject(error);
        });

        // In case of an Error in the IPC Connection.
        ipc.of.sshMan.once('error', error => {
            clearTimeout(connectTimeout);
            reject(error);
        });

        ipc.of.sshMan.emit('create_tunnel', {
            id: id,
            host: config.sshMaster,
            username: config.sshUser,
            sshPort: config.sshPort,
            localPort: localPort,
            remotePort: remotePort,
            sshKey: config.sshKey,
            serverAliveInterval: 30,
            reverse: true
        });
    });
}


/**
 * Closes the SSH-Tunnel on the port.
 * @param {number} port
 * @returns {fuction} Action / Promise
 */
function closeTunnel(port) {
    return new Promise((resolve, reject) => {
        let id = (new Date()).getTime();

        let connectTimeout = setTimeout(() => reject("IPC Timeout. Can't reach SSH-Manager."), 2000); // TODO: CD

        ipc.of.sshMan.once('success' + id, (port) => {
            resolve(); // TODO: That's ok for now, but should be auto-determined by the SSH-Manager further down the road...
        });

        ipc.of.sshMan.once('error' + id, (error) => {
            reject();
        });

        // In case of an Error in the IPC Connection.
        ipc.of.sshMan.once('error', error => {
            clearTimeout(connectTimeout);
            reject();
        });

        ipc.of.sshMan.emit('close_tunnel', {
            id: id,
            port
        });
    });
}

/**
 * Helper to tell if the IPC connection works.
 * @returns {Promise}
 */
function isIpcConnected() {
    if (connected)
        return Promise.resolve();

    // Wait a bit and try again.
    return new Promise((resolve, reject) => {
        ipc.of.sshMan.on('connect', () => resolve());
        ipc.of.sshMan.once('error', () => {
            dispatch(setSSHWillReconnect());
            reject('Cannot connect to the SSH-Manager.');
        });
    });
}


/**
 * Redux Middleware
 * Try to reconnect upon config change.
 */
SSHMan.middleware = store => next => action => {
    let result = next(action); // Let it pass...

    if (!self)
        return true;

    // If sth. has changed, we restart.
    if (action.type === UPDATE_CONFIG) {
        if (action.data.ssh ||
            action.data.sshPort ||
            action.data.sshMaster ||
            action.data.sshLocalUser ||
            action.data.camIP ||
            action.data.camPanelPort) {
            dispatch(self.restartTunnels());
        }
    }
    return result;
}
