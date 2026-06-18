/**
 * Ophthalmic Infographic Creator - Backend Server
 * Provides FTP server functionality for remote access to the knowledge base
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { FtpSrv } = require('ftp-srv');
const os = require('os');
const https = require('https');

// Configuration
const HTTP_PORT = 3000;
const FTP_PORT = 2121;
const FTP_USER = 'ophthalmics';
const FTP_PASS = '157108';

// State
let ftpServer = null;
let ftpRunning = false;

// Get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// Get public IP address
function getPublicIP() {
    return new Promise((resolve) => {
        https.get('https://api.ipify.org', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data.trim()));
        }).on('error', (err) => {
            console.error('Failed to fetch public IP:', err.message);
            resolve(getLocalIP()); // Fallback to local IP
        });
    });
}

// Library storage directory
const LIBRARY_DIR = path.join(__dirname, 'library');

// Ensure library directory exists
if (!fs.existsSync(LIBRARY_DIR)) {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

// Export library (save/upload) to files - UPSERT MODE (Does not delete existing)
function exportLibraryToFiles(libraryData) {
    try {
        const library = JSON.parse(libraryData);
        // Ensure array
        const items = Array.isArray(library) ? library : [library];

        // Write each item as a separate JSON file
        for (const item of items) {
            // Sanitize filename
            const safeTitle = (item.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            const filename = `${item.id}_${safeTitle}.json`;
            fs.writeFileSync(
                path.join(LIBRARY_DIR, filename),
                JSON.stringify(item, null, 2)
            );
        }
        return true;
    } catch (err) {
        console.error('Error exporting library:', err);
        return false;
    }
}

// Read all library items from disk
function getLibraryItems() {
    try {
        if (!fs.existsSync(LIBRARY_DIR)) return [];

        const items = [];
        const files = fs.readdirSync(LIBRARY_DIR);

        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(path.join(LIBRARY_DIR, file), 'utf8');
                    items.push(JSON.parse(content));
                } catch (e) {
                    console.error('Error reading/parsing file:', file, e);
                }
            }
        }
        return items;
    } catch (err) {
        console.error('Error listing library:', err);
        return [];
    }
}

// Start FTP Server
async function startFTPServer() {
    if (ftpRunning) {
        return { success: true, port: FTP_PORT, host: getLocalIP() };
    }

    try {
        const publicIP = await getPublicIP();
        const localIP = getLocalIP();
        const hostIP = publicIP || localIP;

        console.log(`FTP: Public IP detected: ${publicIP}`);

        ftpServer = new FtpSrv({
            url: `ftp://0.0.0.0:${FTP_PORT}`,
            pasv_url: hostIP,
            pasv_min: 1024,
            pasv_max: 1048,
            anonymous: false,
            greeting: 'Welcome to Ophthalmic Infographic Knowledge Base'
        });

        ftpServer.on('login', ({ connection, username, password }, resolve, reject) => {
            if (username === FTP_USER && password === FTP_PASS) {
                console.log(`FTP: User ${username} logged in`);
                resolve({ root: __dirname });
            } else {
                console.log(`FTP: Login failed for ${username}`);
                reject(new Error('Invalid credentials'));
            }
        });

        ftpServer.on('client-error', ({ context, error }) => {
            console.error('FTP Client Error:', error);
        });

        await ftpServer.listen();
        ftpRunning = true;
        console.log(`FTP Server started on ftp://${hostIP}:${FTP_PORT}`);

        return { success: true, port: FTP_PORT, host: hostIP };
    } catch (err) {
        console.error('Failed to start FTP server:', err);
        return { success: false, error: err.message };
    }
}

// Stop FTP Server
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

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// HTTP Server
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API Routes
    if (req.url.endsWith('/api/ftp/start') && req.method === 'POST') {
        const result = await startFTPServer();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
    }

    if (req.url.endsWith('/api/ftp/stop') && req.method === 'POST') {
        const result = await stopFTPServer();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
    }

    if (req.url.endsWith('/api/ftp/status') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            running: ftpRunning,
            port: FTP_PORT,
            host: ftpRunning && ftpServer ? ftpServer.options.pasv_url : getLocalIP()
        }));
        return;
    }

    // Library Upload (Sync/Export)
    if (req.url.endsWith('/api/library/upload') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            const success = exportLibraryToFiles(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success }));
        });
        return;
    }

    // Library List (Import)
    if (req.url.endsWith('/api/library/list') && req.method === 'GET') {
        const items = getLibraryItems();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(items));
        return;
    }

    // Library Delete
    if (req.url.endsWith('/api/library/delete') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { ids } = JSON.parse(body);
                if (!Array.isArray(ids)) {
                    throw new Error('Invalid input: ids must be an array');
                }

                let deletedCount = 0;
                const files = fs.readdirSync(LIBRARY_DIR);

                for (const id of ids) {
                    // Find file starting with id
                    const fileToDelete = files.find(f => f.startsWith(`${id}_`));
                    if (fileToDelete) {
                        fs.unlinkSync(path.join(LIBRARY_DIR, fileToDelete));
                        deletedCount++;
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: deletedCount }));
            } catch (err) {
                console.error('Delete error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // Static file serving
    const requestPath = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
    let filePath = requestPath === '/' ? '/index.html' : requestPath;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(500);
            res.end('Server error');
        }
    }
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`Ophthalmic Infographic Creator Server`);
    console.log(`========================================`);
    console.log(`HTTP Server: http://localhost:${HTTP_PORT}`);
    console.log(`FTP Port:    ${FTP_PORT} (start via UI)`);
    console.log(`========================================\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await stopFTPServer();
    server.close();
    process.exit(0);
});
