"""Dev server tĩnh cho Web-ERP (chỉ dùng khi phát triển).

- Phục vụ thư mục web/ làm gốc.
- Giả lập backend mock: POST tới một file trong /mock/ trả về chính file đó (như GET), và in dữ liệu form ra console
  để kiểm tra FE gửi đúng chuẩn ERP-HTML (mục 11.6, 13.2).
- Không cache, để sửa file là thấy ngay.

Chạy:  python -I tools/dev-server.py [--port 5180]
"""
import argparse
import http.server
import os
import sys
import urllib.parse

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'web')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
                      '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
                      '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-ERP-Contract', '1.0')
        super().end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length) if length else b''
        ctype = self.headers.get('Content-Type', '')
        path = urllib.parse.urlsplit(self.path).path
        print(f'\n[POST] {path}  ({ctype.split(";")[0]}, {len(body)} byte)')
        if 'urlencoded' in ctype:
            for k, v in urllib.parse.parse_qsl(body.decode('utf-8', 'replace'), keep_blank_values=True):
                if k == '__RequestVerificationToken':
                    continue
                print(f'   {k} = {v[:80]}')
        if not path.startswith('/mock/'):
            self.send_error(405, 'POST chỉ hỗ trợ cho /mock/*')
            return
        self.do_GET()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            html = ('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Không tìm thấy</title></head><body>'
                    '<div data-erp="messages"><p data-erp="message" data-msg-type="error">'
                    'Không tìm thấy trang này trong mock (bản demo chỉ có một số bản ghi mẫu).</p></div></body></html>').encode('utf-8')
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        super().send_error(code, message, explain)

    def log_message(self, fmt, *args):
        if self.command == 'GET' and ('/vendor/' in self.path or self.path.endswith(('.css', '.js', '.svg'))):
            return
        sys.stdout.write('%s %s\n' % (self.command, fmt % args))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=5180)
    a = ap.parse_args()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', a.port), Handler)
    print(f'Web-ERP dev server: http://127.0.0.1:{a.port}/  (gốc: {WEB})', flush=True)
    srv.serve_forever()


if __name__ == '__main__':
    main()
