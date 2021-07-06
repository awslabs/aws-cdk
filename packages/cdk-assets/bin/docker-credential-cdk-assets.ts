/**
 * Docker Credential Helper to retrieve credentials based on an external configuration file.
 * Supports loading credentials from ECR repositories and from Secrets Manager,
 * optionally via an assumed role.
 *
 * The only operation currently supported by this credential helper at this time is the `get`
 * command, which receives a domain name as input on stdin and returns a Username/Secret in
 * JSON format on stdout.
 *
 * IMPORTANT - The credential helper must not output anything else besides the final credentials
 * in any success case; doing so breaks docker's parsing of the output and causes the login to fail.
 */

import * as fs from 'fs';
import { DefaultAwsClient } from '../lib';

import { cdkCredentialsConfig, cdkCredentialsConfigFile, fetchDockerLoginCredentials } from '../lib/private/docker-credentials';

async function main() {
  // Expected invocation is [node, docker-credential-cdk-assets, get] with input fed via STDIN
  // For other valid docker commands (store, list, erase), we no-op.
  if (process.argv.length !== 3 || process.argv[2] !== 'get') {
    process.exit(0);
  }

  const config = cdkCredentialsConfig();
  if (!config) {
    throw new Error(`unable to find CDK Docker credentials at: ${cdkCredentialsConfigFile()}`);
  }

  // Read the domain to fetch from stdin
  let rawDomain = fs.readFileSync(0, { encoding: 'utf-8' }).trim();
  // Paranoid handling to ensure new URL() doesn't throw if the schema is missing.
  // Not convinced docker will ever pass in a url like 'index.docker.io/v1', but just in case...
  rawDomain = rawDomain.includes('://') ? rawDomain : `https://${rawDomain}`;
  const domain = new URL(rawDomain).hostname;

  const credentials = await fetchDockerLoginCredentials(new DefaultAwsClient(), config, domain);

  // Write the credentials back to stdout
  fs.writeFileSync(1, JSON.stringify(credentials));
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error(e.stack);
  process.exitCode = 1;
});
