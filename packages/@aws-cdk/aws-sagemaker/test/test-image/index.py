#!/usr/bin/python

"""
This script stands up a lightweight HTTP server listening at the port specified in the
SAGEMAKER_BIND_TO_PORT environment variable. It loads an optional artifact from the path
/opt/ml/model/artifact.txt and returns information about the artifact in response to every
invocation request. Ping requests will always succeed.
"""

import http.server
import os
import socketserver

class SimpleSageMakerServer(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/ping':
            self.respond(200, 'Healthy')
        else:
            self.respond(404, 'Not Found')

    def do_POST(self):
        if self.path == '/invocations':
            self.respond(200, 'Artifact info: {}'.format(ARTIFACT))
        else:
            self.respond(404, 'Not Found')

    def respond(self, status, response):
        self.send_response(status)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(bytes('{}\n'.format(response), 'utf-8'))


PORT = int(os.environ['SAGEMAKER_BIND_TO_PORT'])
ARTIFACT_PATH = '/opt/ml/model/artifact.txt'

print('Looking for model artifacts')
if (os.path.isfile(ARTIFACT_PATH)):
    print('Loading model artifact from {}'.format(ARTIFACT_PATH))
    with open(ARTIFACT_PATH, 'r') as artifact_file:
        ARTIFACT = artifact_file.read().splitlines()
else:
    print('No model artifact present at {}'.format(ARTIFACT_PATH))
    ARTIFACT = 'No artifacts are present'

with socketserver.TCPServer(('', PORT), SimpleSageMakerServer) as httpd:
    print('Serving requests at port {}'.format(PORT))
    httpd.serve_forever()
