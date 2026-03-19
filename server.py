#!/usr/bin/env python3
"""
Simple HTTP server for serving the FRCS simulator locally.
This avoids CORS issues when loading local JavaScript files.

Usage:
    python3 server.py

Then open your browser to: http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import time
import datetime
from pathlib import Path

# Configuration
DEFAULT_PORT = 8000
HOST = 'localhost'

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with CORS headers to prevent any cross-origin issues."""
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight."""
        try:
            # Send successful response for all OPTIONS requests
            self.send_response(200, 'OK')
            
            # Set content type based on path
            if self.path == '/health':
                self.send_header('Content-type', 'application/json')
            elif self.path.startswith('/api/'):
                self.send_header('Content-type', 'application/json')
            else:
                self.send_header('Content-type', 'text/plain')
            
            # Enhanced CORS headers for preflight
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name')
            self.send_header('Access-Control-Max-Age', '86400')  # Cache preflight for 24 hours
            self.send_header('Access-Control-Allow-Credentials', 'false')
            self.send_header('Content-Length', '0')
            
            # Complete the headers
            self.end_headers()
            
            # Log the preflight request for debugging
            origin = self.headers.get('Origin', 'None')
            requested_method = self.headers.get('Access-Control-Request-Method', 'None')
            requested_headers = self.headers.get('Access-Control-Request-Headers', 'None')
            
            print(f"[PREFLIGHT] {self.path} from {origin} - Method: {requested_method}, Headers: {requested_headers}")
            
        except Exception as e:
            print(f"[ERROR] OPTIONS request failed: {e}")
            self.send_error(500, f"Internal server error: {e}")
    
    def do_GET(self):
        """Handle GET requests with special cases for common 404s."""
        # Handle health check endpoint
        if self.path == '/health':
            # Log health check requests with headers for debugging
            user_agent: str = str(self.headers.get('User-Agent', 'Unknown'))
            origin: str = str(self.headers.get('Origin', 'None'))
            print(f"[HEALTH] Request from User-Agent: {user_agent[:50]}... Origin: {origin}") # type: ignore
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = '{"status": "ok", "service": "FRCS Simulator", "timestamp": "' + str(int(time.time())) + '"}'
            self.wfile.write(response.encode())
            return
        
        # Handle Apple touch icons (redirect to favicon.ico if it exists, otherwise return 204)
        if self.path in ['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png']:
            if os.path.exists('favicon.ico'):
                self.send_response(302)
                self.send_header('Location', '/favicon.ico')
                self.end_headers()
            else:
                # Return 204 No Content instead of 404
                self.send_response(204)
                self.end_headers()
            return
        
        # Handle robots.txt
        if self.path == '/robots.txt':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            robots_content = """User-agent: *
Disallow: /
# This is a local development server
"""
            self.wfile.write(robots_content.encode())
            return
        
        # Handle status page
        if self.path == '/status':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            # Get the current port from the server
            current_port = int(self.server.server_address[1]) # type: ignore
            status_html = f"""<!DOCTYPE html>
<html>
<head>
    <title>FRCS Simulator Server Status</title>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
        .container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c6fa5; }}
        .status {{ color: #10b981; font-weight: bold; }}
        .info {{ margin: 10px 0; }}
        .links {{ margin-top: 20px; }}
        .links a {{ display: inline-block; margin-right: 15px; padding: 8px 16px; background: #2c6fa5; color: white; text-decoration: none; border-radius: 4px; }}
        .links a:hover {{ background: #1e5a8a; }}
        .note {{ background: #f0f8ff; padding: 15px; border-left: 4px solid #2c6fa5; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🏥 FRCS Simulator Server</h1>
        <div class="info">Status: <span class="status">✅ Running</span></div>
        <div class="info">Port: <strong>{current_port}</strong></div>
        <div class="info">Host: {HOST}</div>
        <div class="info">Directory: {os.getcwd()}</div>
        <div class="info">Server Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
        
        <div class="links">
            <a href="/FRCS%20simulator.html">📄 Open FRCS Simulator</a>
            <a href="/health">🏥 Health Check (JSON)</a>
        </div>
        
        <h3>📁 Available Files:</h3>
        <ul>
            <li>📄 <a href="/FRCS%20simulator.html">FRCS simulator.html</a> - Main application</li>
            <li>📁 <a href="/js/">js/</a> - JavaScript modules</li>
            <li>📁 <a href="/css/">css/</a> - Stylesheets</li>
            <li>🔧 <a href="/server.py">server.py</a> - This server script</li>
        </ul>
        
        <div class="note">
            <strong>💡 Pro Tip:</strong> To start on a specific port, use: <code>python3 server.py 8001</code>
        </div>
    </div>
</body>
</html>"""
            self.wfile.write(status_html.encode())
            return
        
        # Default behavior for all other requests
        super().do_GET()
    
    def log_message(self, format, *args):
        """Override log_message to reduce noise from 204 responses."""
        # Don't log successful apple-touch-icon requests (they return 204)
        if len(args) >= 2 and '204' in str(args[1]):
            return
        # Log other requests normally but with cleaner formatting
        timestamp = self.log_date_time_string()
        print(f"[{timestamp}] {format % args}")
    
    def log_date_time_string(self):
        """Return formatted timestamp."""
        import time
        now = time.time()
        year, month, day, hh, mm, ss, x, y, z = time.localtime(now)
        return f"{day:02d}/{month:02d}/{year} {hh:02d}:{mm:02d}:{ss:02d}"

def find_available_port(start_port=DEFAULT_PORT, max_attempts=10):
    """Find an available port starting from start_port."""
    import socket
    
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((HOST, port))
                return port
        except OSError:
            continue
    return None

def kill_existing_server(port):
    """Try to kill existing server on the given port."""
    try:
        import signal
        import subprocess
        
        # Find process using the port
        result = subprocess.run(
            ['lsof', '-ti', f':{port}'], 
            capture_output=True, 
            text=True
        )
        
        if result.returncode == 0 and result.stdout.strip():
            pid = result.stdout.strip()
            print(f"🔍 Found existing server on port {port} (PID: {pid})")
            
            # Ask user if they want to kill it
            response = input(f"❓ Kill existing server? (y/N): ").lower()
            if response in ['y', 'yes']:
                os.kill(int(pid), signal.SIGTERM)
                print(f"✅ Killed existing server (PID: {pid})")
                import time
                time.sleep(1)  # Give it time to shut down
                return True
        
        return False
    except Exception as e:
        print(f"⚠️  Could not check/kill existing server: {e}")
        return False

def show_help():
    """Show help message."""
    print("""
🏥 FRCS Simulator Server

Usage:
    python3 server.py [PORT]

Arguments:
    PORT        Port number to use (default: 8000)

Options:
    -h, --help  Show this help message

Examples:
    python3 server.py           # Start on default port 8000
    python3 server.py 8001      # Start on port 8001
    python3 server.py --help    # Show this help

Features:
    • Automatic port detection if default port is busy
    • Option to kill existing server on same port
    • Health check endpoint (/health)
    • Status page (/status)
    • Proper CORS headers for local development
    """)

def main():
    """Start the HTTP server."""
    # Check for help flag
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help', 'help']:
        show_help()
        sys.exit(0)
    
    # Change to the directory where this script is located
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print(f"🚀 Starting FRCS Simulator Server...")
    print(f"📁 Serving files from: {script_dir}")
    
    # Check command line arguments for port
    port: int = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
            print(f"🔧 Using port from command line: {port}")
        except ValueError:
            print(f"⚠️  Invalid port '{sys.argv[1]}', using default: {DEFAULT_PORT}")
            print(f"💡 Use 'python3 server.py --help' for usage information")
            port = DEFAULT_PORT
    
    # Try to start on the requested port first
    port_val: int = port
    original_port: int = port_val
    server_started = False
    
    while not server_started:
        try:
            # Create server
            with socketserver.TCPServer((HOST, port_val), CORSHTTPRequestHandler) as httpd:
                print(f"🌐 Server URL: http://{HOST}:{port_val}")
                print(f"📄 Main App: http://{HOST}:{port_val}/FRCS%20simulator.html")
                print(f"📊 Status Page: http://{HOST}:{port_val}/status")
                print(f"🏥 Health Check: http://{HOST}:{port_val}/health")
                print(f"⏹️  Press Ctrl+C to stop the server")
                print("-" * 60)
                print(f"✅ Server started successfully on port {port_val}")
                
                # Try to open the browser automatically
                try:
                    url = f"http://{HOST}:{port_val}/FRCS%20simulator.html"
                    print(f"🔗 Opening browser to: {url}")
                    webbrowser.open(url)
                except Exception as e:
                    print(f"⚠️  Could not open browser automatically: {e}")
                    print(f"📝 Please manually open: http://{HOST}:{port_val}/FRCS%20simulator.html")
                
                print(f"🔄 Server running... (use Ctrl+C to stop)")
                server_started = True
                httpd.serve_forever()
                
        except KeyboardInterrupt:
            print(f"\n🛑 Server stopped by user")
            sys.exit(0)
            
        except OSError as e:
            if e.errno == 48:  # Address already in use
                print(f"❌ Port {port_val} is already in use")
                
                if port_val == original_port:
                    # First attempt failed, offer options
                    print(f"🔧 Options:")
                    print(f"   1. Kill existing server on port {port_val}")
                    print(f"   2. Find alternative port automatically")
                    print(f"   3. Exit")
                    
                    choice = input(f"❓ Choose option (1/2/3): ").strip()
                    
                    if choice == '1':
                        if kill_existing_server(port_val):
                            continue  # Try again with same port
                        else:
                            print(f"❌ Could not kill existing server")
                            choice = '2'  # Fall through to auto-find
                    
                    if choice == '2':
                        # Find alternative port
                        alt_port = find_available_port(port_val + 1) # type: ignore
                        if alt_port:
                            print(f"🔄 Trying alternative port: {alt_port}")
                            port_val = int(alt_port)
                            continue
                        else:
                            print(f"❌ No available ports found")
                            sys.exit(1)
                    
                    if choice == '3' or choice not in ['1', '2']:
                        print(f"👋 Exiting...")
                        sys.exit(0)
                else:
                    # We already tried an alternative port and it failed
                    alt_port = find_available_port(port_val + 1) # type: ignore
                    if alt_port:
                        print(f"🔄 Trying next available port: {alt_port}")
                        port_val = int(alt_port)
                        continue
                    else:
                        print(f"❌ No available ports found")
                        sys.exit(1)
            else:
                print(f"❌ Error starting server: {e}")
                sys.exit(1)
                
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main() 