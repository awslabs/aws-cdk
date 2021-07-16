# SigV4 API Gateway generator

This is quick node script to generate the SigV4 headers needed to perform an HTTP request for an API Gateway that uses IAM route authorization.

## Setup

```bash
# Install dependencies
yarn

# Setup env
cp .env.example .env
```

After filling in the variables, start the script.

```bash
node index.js
```

The headers needed to make the http request are generated to `./headers.yaml`.
