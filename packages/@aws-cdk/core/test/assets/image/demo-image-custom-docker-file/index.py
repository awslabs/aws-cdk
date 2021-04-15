#!/usr/bin/python
import sys
import textwrap
import http.server
import socketserver

PORT = 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(textwrap.dedent('''\
            <!doctype html>
            <html><head><title>It works</title></head>
            <body>
                <h1>Hello from the integ test container</h1>
                <p>This container got built and started as part of the integ test.</p>
                <img src="https://media.giphy.com/media/nFjDu1LjEADh6/giphy.gif">
            </body>
            ''').encode('utf-8'))


def main():
    httpd = http.server.HTTPServer(("", PORT), Handler)
    print("serving at port", PORT)
    httpd.serve_forever()


if __name__ == '__main__':
    main()
