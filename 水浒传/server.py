#!/usr/bin/env python3
"""静态服务器：禁用缓存（开发用）。用法 python3 server.py [端口]"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'http://localhost:{port}/  (no-cache)')
    ThreadingHTTPServer(('0.0.0.0', port), NoCacheHandler).serve_forever()
