const express = require('express');
const http = require('http');
const { createBareServer } = require('@tomphttp/bare-server-node');
const path = require('path');

const app = express();
const server = http.createServer();
const bare = createBareServer('/bare/');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

server.on('request', (req, res) => {
    if (bare.shouldRoute(req)) {
        bare.route(req, res);
    } else {
        app(req, res);
    }
});

server.on('upgrade', (req, socket, head) => {
    if (bare.shouldRoute(req)) {
        bare.route(req, socket, head);
    } else {
        socket.end();
    }
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Stealth Proxy active on port ${PORT}`);
});
