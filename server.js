/**
 * Ophthalmic Infographic Creator - Backend Server
 *
 * - Serves the static app (index.html, script.js, style.css, library JSON, ...)
 * - Library sync API (upload / list / delete) backed by ./library/*.json
 * - Optional read-only FTP server exposing ./library for remote download
 *
 * Environment overrides:
 *   PORT / OPHTHALMIC_HTTP_PORT   HTTP port (default 3000)
 *   HOST      HTTP bind address      (default 127.0.0.1 — local only; 0.0.0.0 when
 *             OPHTHALMIC_UPLOAD_TOKEN is set, i.e. running as a remote daily-upload server)
 *   OPHTHALMIC_UPLOAD_TOKEN  bearer token required for remote POST /api/daily-infographic
 *   FTP_PORT  FTP port               (default 2121)
 *   FTP_USER  FTP username           (default "ophthalmics")
 *   FTP_PASS  FTP password           (default: random per run, printed on start)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const ROOT_DIR = __dirname;
const HTTP_PORT = Math.max(1, Math.min(65535, Number(process.env.PORT || process.env.OPHTHALMIC_HTTP_PORT) || 3000));
const HTTP_HOST = process.env.HOST || (String(process.env.OPHTHALMIC_UPLOAD_TOKEN || '').trim() ? '0.0.0.0' : '127.0.0.1');
const FTP_PORT = Number(process.env.FTP_PORT) || 2121;
const FTP_USER = process.env.FTP_USER || 'ophthalmics';
const FTP_PASS = process.env.FTP_PASS || crypto.randomBytes(6).toString('base64url');
const MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MB — generous for large library syncs

const LIBRARY_DIR = path.join(ROOT_DIR, 'library');
if (!fs.existsSync(LIBRARY_DIR)) {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

// Files and folders that must never be served over HTTP.
const BLOCKED_SEGMENTS = new Set([
    '.git', '.github', '.claude', 'node_modules', 'config', 'scripts', '__pycache__'
]);
const BLOCKED_FILES = new Set([
    'server.js', 'server.py', 'server.key', 'server.crt', 'package.json', 'package-lock.json',
    'configure_router.py', 'sync_to_github.py', 'ophthalmics.py', 'push_to_github.sh', '.env', '.gitignore'
]);
const BLOCKED_EXTENSIONS = new Set(['.key', '.pem', '.local', '.py', '.sh', '.env']);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function getPublicIP() {
    return new Promise((resolve) => {
        const req = https.get('https://api.ipify.org', { timeout: 4000 }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(data.trim() || getLocalIP()));
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', (err) => {
            console.error('Failed to fetch public IP:', err.message);
            resolve(getLocalIP());
        });
    });
}

function sendJSON(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('Request body too large'), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function isLoopbackAddress(address) {
    const normalized = String(address || '').split('%')[0];
    return normalized === '127.0.0.1' || normalized === '::1' || normalized === '::ffff:127.0.0.1';
}

/** Only pages served from this machine may call the mutating API (blocks drive-by CSRF from other sites). */
function isTrustedOrigin(origin) {
    if (!origin) return true; // same-origin GETs, curl, etc.
    try {
        const u = new URL(origin);
        return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    } catch (_) {
        return false;
    }
}

/** Library item ids become file names, so keep them to a strict charset. */
function safeId(id) {
    const s = String(id ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    return s.slice(0, 64);
}

const KEYCHAIN_ACCOUNT_LABEL = 'SMILE';
const LEGACY_GEMINI_KEY_FINGERPRINT = 'AQ.Ab8:IxR9Q';

/** Identify the retired bundled key without retaining it in source. */
function isLegacyGeminiKey(key) {
    const value = String(key || '').trim();
    return `${value.slice(0, 6)}:${value.slice(-5)}` === LEGACY_GEMINI_KEY_FINGERPRINT;
}

/** Same lookup order as server.py: macOS Keychain helper script, then config/gemini-api-key.local. */
function readLocalGeminiKey() {
    const script = path.join(ROOT_DIR, 'scripts', 'read-gemini-keychain.sh');
    if (fs.existsSync(script)) {
        try {
            const { execFileSync } = require('child_process');
            const out = execFileSync('/bin/bash', [script], { cwd: ROOT_DIR, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] })
                .toString().trim();
            if (out && out !== KEYCHAIN_ACCOUNT_LABEL && !isLegacyGeminiKey(out)) return out;
        } catch (_) { /* no keychain entry */ }
    }
    const keyPath = path.join(ROOT_DIR, 'config', 'gemini-api-key.local');
    try {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        if (key && key !== KEYCHAIN_ACCOUNT_LABEL && !isLegacyGeminiKey(key)) return key;
    } catch (_) { /* not configured */ }
    return '';
}

// ---------------------------------------------------------------------------
// Library storage
// ---------------------------------------------------------------------------
function exportLibraryToFiles(libraryData) {
    const library = JSON.parse(libraryData);
    const items = Array.isArray(library) ? library : [library];
    let written = 0;

    const existing = fs.readdirSync(LIBRARY_DIR);

    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const id = safeId(item.id) || String(Date.now());
        const safeTitle = (item.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const filename = `${id}_${safeTitle}.json`;

        // If the title changed, remove the stale file for the same id so we don't keep duplicates.
        for (const f of existing) {
            if (f.startsWith(`${id}_`) && f !== filename) {
                try { fs.unlinkSync(path.join(LIBRARY_DIR, f)); } catch (_) { /* ignore */ }
            }
        }

        const target = path.join(LIBRARY_DIR, filename);
        const tmp = `${target}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(item, null, 2));
        fs.renameSync(tmp, target); // atomic replace: never leaves a half-written file
        written++;
    }
    return written;
}

function getLibraryItems() {
    if (!fs.existsSync(LIBRARY_DIR)) return [];
    const items = [];
    for (const file of fs.readdirSync(LIBRARY_DIR)) {
        if (!file.endsWith('.json')) continue;
        try {
            items.push(JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, file), 'utf8')));
        } catch (e) {
            console.error('Error reading/parsing file:', file, e.message);
        }
    }
    return items;
}

function deleteLibraryItems(ids) {
    const files = fs.readdirSync(LIBRARY_DIR);
    let count = 0;
    for (const rawId of ids) {
        const id = safeId(rawId);
        if (!id) continue;
        for (const f of files.filter(name => name.startsWith(`${id}_`))) {
            fs.unlinkSync(path.join(LIBRARY_DIR, f));
            count++;
        }
    }
    return count;
}

// ---------------------------------------------------------------------------
// Europe PMC proxy & daily infographic publishing
// ---------------------------------------------------------------------------
const DAILY_DIR = path.join(ROOT_DIR, 'daily');
const DAILY_ARCHIVE_DIR = path.join(DAILY_DIR, 'archive');
const DAILY_LATEST_PATH = path.join(DAILY_DIR, 'latest.json');
const DAILY_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const EUROPE_PMC_API_ORIGIN = 'https://www.ebi.ac.uk';
const EUROPE_PMC_PROXY_TIMEOUT_MS = 12000;
const EUROPE_PMC_PROXY_MAX_BYTES = 48 * 1024 * 1024;
fs.mkdirSync(DAILY_ARCHIVE_DIR, { recursive: true });

function buildEuropePmcUpstreamUrl(requestUrl) {
    const resource = requestUrl.searchParams.get('resource');
    if (resource === 'search') {
        const query = String(requestUrl.searchParams.get('query') || '').trim();
        if (!query || query.length > 5000) return null;
        const upstream = new URL('/europepmc/webservices/rest/search', EUROPE_PMC_API_ORIGIN);
        upstream.searchParams.set('query', query);
        upstream.searchParams.set('format', 'json');
        upstream.searchParams.set('pageSize', String(Math.min(10, Math.max(1, Number(requestUrl.searchParams.get('pageSize')) || 6))));
        upstream.searchParams.set('resultType', 'core');
        return upstream;
    }

    const pmcid = String(requestUrl.searchParams.get('pmcid') || '').trim().toUpperCase();
    if (!/^PMC\d+$/.test(pmcid)) return null;
    if (resource === 'fullTextXML') {
        return new URL(`/europepmc/webservices/rest/${encodeURIComponent(pmcid)}/fullTextXML`, EUROPE_PMC_API_ORIGIN);
    }
    if (resource === 'supplementaryFiles') {
        return new URL(`/europepmc/webservices/rest/${encodeURIComponent(pmcid)}/supplementaryFiles`, EUROPE_PMC_API_ORIGIN);
    }
    return null;
}

function proxyEuropePmcResource(requestUrl, res) {
    const upstreamUrl = buildEuropePmcUpstreamUrl(requestUrl);
    if (!upstreamUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'Invalid Europe PMC proxy request' }));
        return Promise.resolve();
    }

    return new Promise(resolve => {
        let finished = false;
        let upstreamRequest = null;
        const unavailable = status => {
            if (finished) return;
            finished = true;
            // Translate upstream failures to a successful empty response. This
            // lets the browser use its other providers without logging a failed
            // same-origin resource for a temporary Europe PMC outage.
            if (!res.destroyed && !res.writableEnded) {
                res.writeHead(204, {
                    'Cache-Control': 'no-store',
                    'X-Europe-PMC-Status': String(status || 'unavailable')
                });
                res.end();
            }
            resolve();
        };

        upstreamRequest = https.get(upstreamUrl, {
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Ophthalmic-Infographic-Creator/2.0'
            }
        }, upstreamResponse => {
            const status = Number(upstreamResponse.statusCode) || 502;
            if (status < 200 || status >= 300) {
                upstreamResponse.resume();
                unavailable(status);
                return;
            }

            const chunks = [];
            let totalBytes = 0;
            upstreamResponse.on('data', chunk => {
                if (finished) return;
                totalBytes += chunk.length;
                if (totalBytes > EUROPE_PMC_PROXY_MAX_BYTES) {
                    upstreamResponse.destroy();
                    unavailable('response-too-large');
                    return;
                }
                chunks.push(chunk);
            });
            upstreamResponse.on('end', () => {
                if (finished) return;
                finished = true;
                if (!res.destroyed && !res.writableEnded) {
                    res.writeHead(200, {
                        'Content-Type': upstreamResponse.headers['content-type'] || 'application/octet-stream',
                        'Cache-Control': 'public, max-age=300'
                    });
                    res.end(Buffer.concat(chunks));
                }
                resolve();
            });
            upstreamResponse.on('error', () => unavailable('upstream-error'));
        });
        res.once('close', () => {
            if (finished) return;
            finished = true;
            upstreamRequest?.destroy();
            resolve();
        });
        upstreamRequest.setTimeout(EUROPE_PMC_PROXY_TIMEOUT_MS, () => upstreamRequest.destroy(new Error('Europe PMC timeout')));
        upstreamRequest.on('error', () => unavailable('network-error'));
    });
}

function constantTimeTokenMatches(candidate, expected) {
    const left = Buffer.from(String(candidate || ''), 'utf8');
    const right = Buffer.from(String(expected || ''), 'utf8');
    return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function isAuthorizedDailyUpload(req) {
    const configuredToken = String(process.env.OPHTHALMIC_UPLOAD_TOKEN || '').trim();
    if (!configuredToken) return isLoopbackAddress(req.socket?.remoteAddress);
    const header = String(req.headers.authorization || '');
    const suppliedToken = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
    return constantTimeTokenMatches(suppliedToken, configuredToken);
}

function readJsonRequest(req, maxBytes = DAILY_UPLOAD_MAX_BYTES) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let finished = false;
        const fail = error => {
            if (finished) return;
            finished = true;
            reject(error);
        };
        req.on('data', chunk => {
            if (finished) return;
            total += chunk.length;
            if (total > maxBytes) {
                fail(Object.assign(new Error('Request body is too large'), { statusCode: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (finished) return;
            finished = true;
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch { reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })); }
        });
        req.on('error', fail);
    });
}

function validateDailyInfographicItem(payload) {
    const item = payload?.data?.sections ? payload : null;
    if (!item || typeof item !== 'object') throw Object.assign(new Error('Expected a library item with infographic data'), { statusCode: 400 });
    if (!String(item.id || '').startsWith('daily_')) throw Object.assign(new Error('Daily infographic id must start with daily_'), { statusCode: 400 });
    if (!String(item.title || '').trim() || !String(item.data?.title || '').trim()) throw Object.assign(new Error('Daily infographic title is required'), { statusCode: 400 });
    if (!Array.isArray(item.data.sections) || item.data.sections.length < 3 || item.data.sections.length > 30) {
        throw Object.assign(new Error('Daily infographic must contain 3 to 30 sections'), { statusCode: 400 });
    }
    item.data.sections.forEach((section, index) => {
        if (!String(section?.title || '').trim() || section?.content == null) {
            throw Object.assign(new Error(`Daily infographic section ${index + 1} is incomplete`), { statusCode: 400 });
        }
        const references = Array.isArray(section.references) ? section.references : [];
        if (!references.length || references.some(reference => !String(reference?.citation || '').trim() || !/^https?:\/\//i.test(String(reference?.url || '')))) {
            throw Object.assign(new Error(`Daily infographic section ${index + 1} requires valid evidence links`), { statusCode: 400 });
        }
    });
    return item;
}

function writeJsonAtomic(targetPath, value) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
    fs.renameSync(tempPath, targetPath);
}

function publishDailyInfographic(item) {
    const date = new Date(item.date || item.data?.generatedAt || Date.now());
    if (Number.isNaN(date.getTime())) throw Object.assign(new Error('Daily infographic date is invalid'), { statusCode: 400 });
    const day = date.toISOString().slice(0, 10);
    writeJsonAtomic(DAILY_LATEST_PATH, item);
    writeJsonAtomic(path.join(DAILY_ARCHIVE_DIR, `${day}.json`), item);
    exportLibraryToFiles(JSON.stringify(item));
    return { id: item.id, day, latest: '/daily/latest.json' };
}

// ---------------------------------------------------------------------------
// FTP (read-only, library folder only)
// ---------------------------------------------------------------------------
let ftpServer = null;
let ftpRunning = false;
let ftpHost = null;

async function startFTPServer() {
    if (ftpRunning) {
        return { success: true, port: FTP_PORT, host: ftpHost };
    }

    let FtpSrv;
    try {
        ({ FtpSrv } = require('ftp-srv'));
    } catch (err) {
        return { success: false, error: 'ftp-srv is not installed. Run: npm install' };
    }

    try {
        ftpHost = await getPublicIP();
        ftpServer = new FtpSrv({
            url: `ftp://0.0.0.0:${FTP_PORT}`,
            pasv_url: ftpHost,
            pasv_min: 1024,
            pasv_max: 1048,
            anonymous: false,
            greeting: 'Welcome to Ophthalmic Infographic Knowledge Base',
            // Read-only: remote users can browse and download, never modify the library.
            blacklist: ['STOR', 'STOU', 'APPE', 'DELE', 'RMD', 'XRMD', 'MKD', 'XMKD', 'RNFR', 'RNTO', 'SITE']
        });

        ftpServer.on('login', ({ username, password }, resolve, reject) => {
            const userOk = username === FTP_USER;
            const passOk = typeof password === 'string' && password.length === FTP_PASS.length &&
                crypto.timingSafeEqual(Buffer.from(password), Buffer.from(FTP_PASS));
            if (userOk && passOk) {
                console.log(`FTP: User ${username} logged in`);
                resolve({ root: LIBRARY_DIR });
            } else {
                console.log(`FTP: Login failed for ${username}`);
                reject(new Error('Invalid credentials'));
            }
        });

        ftpServer.on('client-error', ({ error }) => {
            console.error('FTP Client Error:', error && error.message);
        });

        await ftpServer.listen();
        ftpRunning = true;
        console.log(`FTP Server started on ftp://${ftpHost}:${FTP_PORT} (read-only, library only)`);
        return { success: true, port: FTP_PORT, host: ftpHost };
    } catch (err) {
        console.error('Failed to start FTP server:', err);
        ftpServer = null;
        return { success: false, error: err.message };
    }
}

async function stopFTPServer() {
    if (!ftpRunning || !ftpServer) {
        return { success: true };
    }
    try {
        await ftpServer.close();
        ftpServer = null;
        ftpRunning = false;
        console.log('FTP Server stopped');
        return { success: true };
    } catch (err) {
        console.error('Failed to stop FTP server:', err);
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
function resolveStaticPath(pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch (_) {
        return null;
    }
    if (decoded.includes('\0')) return null;
    if (decoded === '/' || decoded === '') decoded = '/index.html';

    const filePath = path.resolve(ROOT_DIR, '.' + path.posix.normalize(decoded));
    // Must stay inside the project folder.
    if (filePath !== ROOT_DIR && !filePath.startsWith(ROOT_DIR + path.sep)) return null;

    const rel = path.relative(ROOT_DIR, filePath);
    const segments = rel.split(path.sep);
    if (segments.some(seg => BLOCKED_SEGMENTS.has(seg) || (seg.startsWith('.') && seg !== '.well-known'))) return null;
    const base = path.basename(filePath);
    if (BLOCKED_FILES.has(base)) return null;
    if (BLOCKED_EXTENSIONS.has(path.extname(base).toLowerCase())) return null;
    return filePath;
}

function serveStatic(req, res, pathname) {
    const filePath = resolveStaticPath(pathname);
    if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File not found');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('File not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304, { ETag: etag });
            res.end();
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Content-Length': stat.size,
            'ETag': etag,
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        fs.createReadStream(filePath).pipe(res);
    });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && isTrustedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let pathname;
    try {
        pathname = new URL(req.url, 'http://localhost').pathname;
    } catch (_) {
        res.writeHead(400);
        res.end('Bad request');
        return;
    }

    if (pathname === '/api/europe-pmc') {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Cache-Control': 'no-store' });
            res.end('Method not allowed');
            return;
        }
        await proxyEuropePmcResource(new URL(req.url, 'http://localhost'), res);
        return;
    }

    if (pathname === '/api/daily-infographic') {
        if (req.method === 'GET') {
            try {
                const content = fs.readFileSync(DAILY_LATEST_PATH);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
                res.end(content);
            } catch (error) {
                sendJSON(res, error.code === 'ENOENT' ? 404 : 500, { success: false, error: error.code === 'ENOENT' ? 'No daily infographic has been published yet' : 'Could not read the daily infographic' });
            }
            return;
        }
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            return sendJSON(res, 405, { success: false, error: 'Method not allowed' });
        }
        if (!isTrustedOrigin(origin) || !isAuthorizedDailyUpload(req)) {
            return sendJSON(res, 401, { success: false, error: 'Daily upload authorization failed' });
        }
        try {
            const item = validateDailyInfographicItem(await readJsonRequest(req));
            return sendJSON(res, 201, { success: true, ...publishDailyInfographic(item) });
        } catch (error) {
            console.error('Daily infographic upload failed:', error.message);
            if (!res.destroyed && !res.writableEnded) {
                sendJSON(res, Number(error.statusCode) || 500, { success: false, error: error.message || 'Daily upload failed' });
            }
            return;
        }
    }

    // Normalise "/foo/api/library/list" style relative calls to the API root.
    const apiIndex = pathname.indexOf('/api/');
    const route = apiIndex >= 0 ? pathname.slice(apiIndex) : null;

    if (route) {
        if (req.method !== 'GET' && !isTrustedOrigin(origin)) {
            sendJSON(res, 403, { success: false, error: 'Forbidden origin' });
            return;
        }
        try {
            if (route === '/api/ftp/start' && req.method === 'POST') {
                return sendJSON(res, 200, await startFTPServer());
            }
            if (route === '/api/ftp/stop' && req.method === 'POST') {
                return sendJSON(res, 200, await stopFTPServer());
            }
            if (route === '/api/ftp/status' && req.method === 'GET') {
                const local = isLoopbackAddress(req.socket.remoteAddress);
                return sendJSON(res, 200, {
                    running: ftpRunning,
                    port: FTP_PORT,
                    host: ftpRunning ? ftpHost : getLocalIP(),
                    // Credentials are only revealed to the machine running the server.
                    ...(local ? { username: FTP_USER, password: FTP_PASS } : {})
                });
            }
            if (route === '/api/library/upload' && req.method === 'POST') {
                const body = await readBody(req);
                const count = exportLibraryToFiles(body);
                return sendJSON(res, 200, { success: true, count });
            }
            if (route === '/api/library/list' && req.method === 'GET') {
                return sendJSON(res, 200, getLibraryItems());
            }
            if (route === '/api/library/delete' && req.method === 'POST') {
                const { ids } = JSON.parse(await readBody(req));
                if (!Array.isArray(ids)) throw Object.assign(new Error('ids must be an array'), { status: 400 });
                return sendJSON(res, 200, { success: true, count: deleteLibraryItems(ids) });
            }
            if (route === '/api/health' && req.method === 'GET') {
                return sendJSON(res, 200, { status: 'ok', items: fs.readdirSync(LIBRARY_DIR).filter(f => f.endsWith('.json')).length });
            }
            return sendJSON(res, 404, { success: false, error: 'Unknown API route' });
        } catch (err) {
            const status = err.status || (err instanceof SyntaxError ? 400 : 500);
            console.error(`API error on ${route}:`, err.message);
            return sendJSON(res, status, { success: false, error: err.message });
        }
    }

    // Local dev only: hand the Gemini key (Keychain or config/gemini-api-key.local) to the page on this machine.
    if (pathname === '/local-dev/gemini-api-key' && req.method === 'GET') {
        const hostName = String(req.headers.host || '').replace(/:\d+$/, '');
        const sameSite = !req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']);
        if (!isLoopbackAddress(req.socket.remoteAddress) || !['localhost', '127.0.0.1', '[::1]'].includes(hostName) || !sameSite) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        const key = readLocalGeminiKey();
        res.writeHead(key ? 200 : 204, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(key || '');
        return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end('Method not allowed');
        return;
    }

    serveStatic(req, res, pathname);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${HTTP_PORT} is already in use. Try: PORT=${HTTP_PORT + 1} npm start`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});

server.listen(HTTP_PORT, HTTP_HOST, () => {
    const shownHost = HTTP_HOST === '0.0.0.0' ? 'localhost' : HTTP_HOST;
    console.log(`\n========================================`);
    console.log(`Ophthalmic Infographic Creator Server`);
    console.log(`========================================`);
    console.log(`HTTP Server: http://${shownHost}:${HTTP_PORT}`);
    console.log(`FTP Port:    ${FTP_PORT} (start via UI, read-only)`);
    console.log(`FTP Login:   ${FTP_USER} / ${FTP_PASS}${process.env.FTP_PASS ? '' : '  (random; set FTP_PASS to fix it)'}`);
    console.log(`========================================\n`);
});

async function shutdown() {
    console.log('\nShutting down...');
    await stopFTPServer();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
