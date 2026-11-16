// server.js —— 非交互启动后端（开发联调用）
// 直接初始化 Blockchain + P2p + Express，不走 vorpal CLI
const express = require('express');
const cors = require('cors');
const Blockchain = require('./Blockchain');
const P2p = require('./P2p');

const P2P_PORT = process.env.P2P_PORT || 2727;
const HTTP_PORT = process.env.HTTP_PORT || 3000;

const blockchain = new Blockchain();
const p2p = new P2p(blockchain);

// 启动 P2P TCP 服务端
p2p.startServer(P2P_PORT);
console.log(`✓ P2P server listening on port ${P2P_PORT}`);

// Express API
const app = express();
app.use(cors());
app.use(express.json());

app.get('/blocks', (req, res) => {
  res.send(blockchain.blockchain);
});

app.post('/mineBlock', (req, res) => {
  const data = req.body.data;
  if (data == null) {
    res.status(400).send('data parameter is missing.');
    return;
  }
  blockchain.mine(data);
  const newBlock = blockchain.latestBlock;
  p2p.broadcastLatest();
  res.send(newBlock);
});

app.get('/peers', (req, res) => {
  res.send(
    p2p.peers.map((s) => {
      const host = s.peerInfo?.host || s.remoteAddress;
      const port = s.peerInfo?.port || s.remotePort;
      return `${host}:${port}`;
    }),
  );
});

app.get('/nodeInfo', (req, res) => {
  res.send({
    p2pPort: p2p.serverPort,
    apiPort: HTTP_PORT,
    blockCount: blockchain.blockchain.length,
  });
});

app.post('/addPeer', (req, res) => {
  const peer = req.body.peer;
  if (peer) {
    const [host, port] = peer.split(':');
    if (host && port) p2p.connectToPeer(host, Number(port));
  }
  res.send();
});

app.listen(HTTP_PORT, () => {
  console.log(`✓ HTTP API listening on port ${HTTP_PORT}`);
  console.log(`  → GET  /blocks`);
  console.log(`  → GET  /nodeInfo`);
  console.log(`  → GET  /peers`);
  console.log(`  → POST /mineBlock  { data: "..." }`);
  console.log(`  → POST /addPeer    { peer: "host:port" }`);
  console.log(`\n========================================`);
});
