/**
 * An SSH Manager to control the SSH tunnels to the master server.
 * The manager communicates over an IPC socket with the name 'sshManager'.
 */

// TODO: RESTART

const ipc = require('node-ipc');
const autossh = require('autossh');

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

/**
 * SSH Tunnels in the format: [port] : [autossh instance].
 */
const tunnels = {};

// IPC Setup
ipc.config.id = 'sshMan';
ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.serve();
const server = ipc.server;

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

// Start the IPC Server
server.start();

console.log('SSH-Manager is up and running.');
console.log(`The Server is listening on socket: "${ipc.server.path}"`);

/**
 * The request handler to create a tunnel. Replies with an error and the remote port of the tunnel.
 */
server.on('create_tunnel', (data, socket) => {
    let id = data.id;
    let replySuccess = generateRelyFunction('success', socket, id);
    let replyError = generateRelyFunction('error', socket, id);
    let tunnel;

    tunnel = tunnels[data.localPort];

    // If the tunnel already runs:
    if (tunnel && (tunnel.info.localHost === 'localhost' || tunnel.info.localHost === data.localHost)){
        return replySuccess(tunnel.info.remotePort);
    }

    // Dummy for other request
    tunnels[data.localPort] = {
	info: {
	    localHost: data.localHost || 'localhost'
	}
    };

    // Let's create a tunnel!
    return createNewTunnel(data).then((tunnel) => {
        tunnels[tunnel.info.localPort] = tunnel;
	replySuccess(tunnel.info.remotePort);
	      console.log("Created Tunnel:\n", JSON.stringify(tunnel));
    }, (error) => {
	console.error("Tunnel Creation Failed:\n", error);
	replyError(error);
	delete tunnels[data.localPort];
    });
});

/**
 * The request handler to close a tunnel. The reply is {error: [message]} in case of an error, otherwise {success: true}.
 */
server.on('close_tunnel', ({port, id}, socket) => {
    let replySuccess = generateRelyFunction('success', socket, id);
    let replyError = generateRelyFunction('error', socket, id);
    let error, tunnel;
    
    tunnel = tunnels[port];
    error = !tunnel;

    if (error)
        return replyError("No tunnel with this port.");

    // Kill the tunnel and clean up.
    tunnel.kill();
    console.log("Tunnel Closed:\n", tunnel);

    delete tunnels[port];
    return replySuccess();
});

/**
 * Utility
 */

function createNewTunnel(options) {
    return new Promise((resolve, reject) => {
        try {
            let tunnel = autossh(options);
	    // TODO: BETTER ERROR HANDLING
            tunnel.on('connect', connection => {
		// Wait for Exit // TODO: Nicer
		setTimeout(() => resolve(tunnel), 1000);
            });
	    
	    tunnel.on('error', error => {
		// If auto SSH or SSH itself issue an error. // TODO: Investigate
		if(typeof error === 'string' || error.message && (error.message.indexOf("failed for listen port") > -1 || error.message.indexOf("refused") > -1)){
		    tunnel.kill();
		    reject(error.message || error);
		}

		return;
	    });
        } catch (error) {
            reject(error);
        }
    });
}

function generateRelyFunction(message, socket, id) {
    return (data) => server.emit(socket, message + id, data);
}
