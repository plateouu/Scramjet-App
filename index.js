const express = require('express');
const httpProxy = require('http-proxy');
const http = require('http');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const path = require('path');

const app = express();
app.use(cookieParser());

const proxy = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
    xfwd: true,
});

proxy.on('error', (err, req, res) => {
    if (res.writeHead) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Proxy Error');
    }
});

proxy.on('proxyRes', (proxyRes, req, res) => {
    // Strip security headers so it can be iframed
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['content-security-policy-report-only'];

    // Rewrite set-cookie domains and samesite so the proxy doesn't lose cookies in an iframe
    if (proxyRes.headers['set-cookie']) {
        proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookieStr => {
            let rewritten = cookieStr;
            // Strip any explicit Domain restricting it to getscreen.me
            rewritten = rewritten.replace(/;\s*Domain=[^;]+/ig, '');
            // Strip any existing SameSite or Secure to avoid duplicates
            rewritten = rewritten.replace(/;\s*SameSite=[^;]+/ig, '');
            rewritten = rewritten.replace(/;\s*Secure/ig, '');
            // Force compatibility for iframe
            return rewritten + '; SameSite=None; Secure';
        });
    }
});

// Helper to determine active target
function getActiveTarget(req) {
    const encodedTarget = req.cookies.proxy_target;
    if (encodedTarget) {
        try {
            return Buffer.from(encodedTarget, 'base64').toString('utf-8');
        } catch {
            return null;
        }
    }
    return null;
}

// Intercept specific UI requests
app.get('/_proxy/set', (req, res) => {
    const target = req.query.url;
    if (target) {
        res.cookie('proxy_target', Buffer.from(target).toString('base64'), { 
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        });
        // The study-portal uses popup, so just redirect to / to start the proxying
        res.redirect('/');
    } else {
        res.status(400).send('Missing target URL');
    }
});

// Proxy all other HTTP requests
app.use((req, res, next) => {
    const target = getActiveTarget(req);
    if (!target) {
        // Fallback or setup screen
        return res.status(404).send('No active proxy session.');
    }
    
    try {
        const tUrl = new URL(target);
        if (req.headers.origin) req.headers.origin = tUrl.origin;
        if (req.headers.referer) req.headers.referer = tUrl.href;
    } catch {}

    proxy.web(req, res, { target });
});

const server = http.createServer(app);

// Proxy WebSockets
server.on('upgrade', (req, socket, head) => {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = cookie.parse(cookieHeader);
        if (cookies.proxy_target) {
            try {
                const target = Buffer.from(cookies.proxy_target, 'base64').toString('utf-8');
                const tUrl = new URL(target);
                if (req.headers.origin) req.headers.origin = tUrl.origin;
                if (req.headers.referer) req.headers.referer = tUrl.href;

                proxy.ws(req, socket, head, { target });
                return;
            } catch {}
        }
    }
    socket.destroy();
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Custom Secure Proxy active on port ${PORT}`);
});
