const net = require('net');
const messageType = require('./messages-type.js');
const Messages = require('./messages.js');
const {
  REQUEST_LATEST_BLOCK,
  RECEIVE_LATEST_BLOCK,
  REQUEST_LATEST_BLOCKCHAIN,
  RECEIVE_LATEST_BLOCKCHAIN,
  HANDSHAKE,
} = messageType;

class PeerToPeer {
    // 构造函数，初始化P2p网络
    constructor(blockchain) {
        this.peers = [];
        this.blockchain = blockchain;
        this.serverPort = null;
    }
    // 启动服务器监听指定端口
    startServer(port) {
        this.serverPort = port;
        const server = net.createServer((socket) => {
            this.initConnection(socket);
        });
        server.listen(port);
    }
    // 连接到指定的对等节点
    connectToPeer(host, port) {
        const socket = net.connect(port, host, () => {
            socket.targetHost = host;
            socket.targetPort = port;
            this.initConnection(socket);
        });
        socket.on('error', (err) => {
            console.log(`error++ ${host}:${port}`, err.message);
        });
    }
    // 关闭所有连接
    closeConnection() {
        this.peers.forEach((peer) => {
            peer.end(); // 关闭连接
        });
        this.peers = [];
        console.log('close all connection');
    }
    // 广播最新区块
    broadcastLatest() {
        this.broadcast(Messages.sendLatestBlock(this.blockchain.latestBlock));
    }
    // 向所有连接的节点广播消息
    broadcast(message) {
        this.peers.forEach((peer) => {
            this.write(peer, message);
        });
    }
    // 向指定节点发送消息
    write(peer, message) {
        peer.write(JSON.stringify(message));
    }
    // 初始化新连接
    initConnection(connection) {
        const existingPeer = this.peers.find((peer) => {
            return peer.remoteAddress === connection.remoteAddress && peer.remotePort === connection.remotePort;
        });
        if(!existingPeer) {
            connection.peerInfo = {
                host: connection.remoteAddress || connection.targetHost,
                port: connection.remotePort || connection.targetPort,
                connectedAt: new Date()
            };
            this.peers.push(connection);
            this.initMessageHandler(connection);
            this.initErrorHandler(connection);
            if(this.serverPort) {
                this.write(connection, Messages.sendHandshake(this.serverPort));
            }
            this.write(connection, Messages.getLatestBlock());
        }
    }
    // 初始化消息处理器
    initMessageHandler(connection) {
        let buffer = "";
        connection.on('data', data => {
            buffer += data.toString("utf8");
            let boundary = buffer.indexOf("}{");
            while(boundary !== -1) {
                const messageStr = buffer.substring(0, boundary + 1);
               buffer = buffer.substring(boundary + 1);
               try {
                const message = JSON.parse(messageStr);
                this.handleMessage(connection, message);
               }catch(err) {
                    console.log('error++', err.message);
               }
               boundary = buffer.indexOf("}{");
            }
            if(buffer.length > 0) {
                try {
                    const message = JSON.parse(buffer);
                    this.handleMessage(connection, message);
                    buffer = "";
                }catch(err) {
                    console.log('error++', err.message);
                }
            }
        })
    }
    // 初始化错误处理器
    // 初始化错误处理器
    initErrorHandler(connection) {
        connection.on("error", err => {
            console.error(`Connection error: ${err.message}`);
            // 从peers数组中移除断开的连接
            this.peers = this.peers.filter(peer => peer !== connection);
        });
        
        // 添加连接关闭处理器
        connection.on("close", () => {
            console.log(`Connection closed: ${connection.peerInfo?.host || connection.remoteAddress}:${connection.peerInfo?.port || connection.remotePort}`);
            // 从peers数组中移除关闭的连接
            this.peers = this.peers.filter(peer => peer !== connection);
        });
    }
    // 处理接收到的消息
    handleMessage(peer, message) {
        switch (message.type) {
            case HANDSHAKE:
                // 收到握手消息，更新对等节点的真实监听端口
                if (message.data && message.data.port) {
                    peer.peerInfo.port = message.data.port;
                    console.log(`Received handshake from peer, updated port to ${message.data.port}`);
                }
                break;
            case REQUEST_LATEST_BLOCK:
                // 当收到请求最新区块的消息时，发送最新区块
                this.write(peer, Messages.sendLatestBlock(this.blockchain.latestBlock));
                break;
            case REQUEST_LATEST_BLOCKCHAIN:
                // 当收到请求整个区块链的消息时，发送整个区块链
                this.write(peer, Messages.sendBlockchain(this.blockchain.get()));
                break;
            case RECEIVE_LATEST_BLOCK:
                // 当收到最新区块时，处理该区块
                this.handleReceivedLatestBlock(message, peer);
                break;
            case RECEIVE_LATEST_BLOCKCHAIN:
                // 当收到整个区块链时，处理该区块链
                this.handleReceivedBlockchain(message);
                break;
            default:
                throw "Received invalid message.";
        }
    }
    // 处理接收到的最新区块
    handleReceivedLatestBlock(message, peer) {
        const receivedBlock = message.data; // 获取接收到的区块
        const latestBlock = this.blockchain.latestBlock; // 获取本地最新区块

        // 如果接收到的区块可以连接到当前链
        if (latestBlock.hash === receivedBlock.previousHash) {
            try {
                this.blockchain.addBlock(receivedBlock); // 添加新区块
            } catch (err) {
                throw err;
            }
        } else if (receivedBlock.index > latestBlock.index) {
            // 如果接收到的区块索引更大，说明可能有更长的链，请求整个区块链
            this.write(peer, Messages.getBlockchain());
        } else {
            // 其他情况不做处理
        }
    }
    // 处理接收到的整个区块链
    handleReceivedBlockchain(message) {
        const receivedChain = message.data; // 获取接收到的区块链

        try {
            this.blockchain.replaceChain(receivedChain); // 替换本地区块链
        } catch (err) {
            throw err;
        }
    }
}

module.exports = PeerToPeer;
