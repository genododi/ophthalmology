/**
 * Integration tests for server.js — run with `npm test` (Node 18+, no extra deps).
 * Starts the real server on a random port and exercises static serving, security and the library API.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');

const ROOT = path.join(__dirname, '..');
const LIBRARY_DIR = path.join(ROOT, 'library');
const TEST_ID = `test${Date.now()}`;
let base;
let child;

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

before(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port), FTP_PASS: 'test-pass' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('server did not start')), 5000);
        child.stdout.on('data', (d) => {
            if (String(d).includes('HTTP Server')) { clearTimeout(timer); resolve(); }
        });
        child.on('exit', (code) => reject(new Error(`server exited with ${code}`)));
    });
});

after(() => {
    for (const f of fs.readdirSync(LIBRARY_DIR)) {
        if (f.startsWith(`${TEST_ID}_`)) fs.unlinkSync(path.join(LIBRARY_DIR, f));
    }
    child?.kill('SIGTERM');
});

test('serves the app shell', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
});

test('serves cache-busted assets (query string ignored)', async () => {
    for (const asset of ['/style.css?v=123', '/script.js?v=abc']) {
        const res = await fetch(`${base}${asset}`);
        assert.equal(res.status, 200, asset);
    }
});

test('blocks secrets, server code and path traversal', async () => {
    const blocked = [
        '/server.key', '/server.js', '/server.py', '/package.json',
        '/config/gemini-api-key.local.example', '/scripts/setup-gemini-key.sh',
        '/.git/config', '/%2e%2e/%2e%2e/etc/passwd', '/..%2fserver.js', '/node_modules/ftp-srv/package.json'
    ];
    for (const p of blocked) {
        const res = await fetch(`${base}${p}`);
        assert.equal(res.status, 404, p);
    }
});

test('rejects mutating API calls from foreign origins', async () => {
    const res = await fetch(`${base}/api/library/delete`, {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['anything'] })
    });
    assert.equal(res.status, 403);
});

test('library upload → list → delete round-trip, with id sanitising', async () => {
    const item = { id: `${TEST_ID}/../../escape`, title: 'Test Item', sections: [] };
    const up = await fetch(`${base}/api/library/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([item])
    });
    assert.equal(up.status, 200);
    assert.equal((await up.json()).count, 1);

    const written = fs.readdirSync(LIBRARY_DIR).filter(f => f.startsWith(`${TEST_ID}`));
    assert.equal(written.length, 1);
    assert.ok(!written[0].includes('/') && !written[0].includes('..'));

    const list = await (await fetch(`${base}/api/library/list`)).json();
    assert.ok(list.some(i => i.title === 'Test Item'));

    const del = await fetch(`${base}/api/library/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [`${TEST_ID}escape`] })
    });
    assert.equal((await del.json()).count, 1);
});

test('malformed JSON returns 400, not a crash', async () => {
    const res = await fetch(`${base}/api/library/upload`, { method: 'POST', body: '{not json' });
    assert.equal(res.status, 400);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
});

test('FTP status reveals credentials only to this machine', async () => {
    const status = await (await fetch(`${base}/api/ftp/status`)).json();
    assert.equal(status.running, false);
    assert.equal(status.password, 'test-pass'); // loopback request
});

test('daily infographic upload rejects other websites and invalid payloads', async () => {
    const foreign = await fetch(`${base}/api/daily-infographic`, {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'daily_x' })
    });
    assert.equal(foreign.status, 401);

    const invalid = await fetch(`${base}/api/daily-infographic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'not-daily' })
    });
    assert.equal(invalid.status, 400);
});

test('Europe PMC proxy validates its parameters', async () => {
    const res = await fetch(`${base}/api/europe-pmc?resource=fullTextXML&pmcid=../../etc`);
    assert.equal(res.status, 400);
});
