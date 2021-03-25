import { App, Stack, Arn } from '@aws-cdk/core';
import { Certificate, PolicyStatement, Policy, Thing } from '../lib';


const csr = `-----BEGIN CERTIFICATE REQUEST-----
MIICrTCCAZUCAQAwaDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAklMMRAwDgYDVQQH
DAdDaGljYWdvMRUwEwYDVQQDDAxkdW1teS1kZXZpY2UxIzAhBgkqhkiG9w0BCQEW
FG1lQGRhcnJlbmhvbGxhbmQuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAmjJYlBrXBg6fDZStT30J8j0iMaDSYc1+RUa12ECbKDVYtjVH2rvG4oDF
9Mz89C37wzvaNmKZZRNS/pVAspZr6EII68ZSuPe52USNo48rUGwtS9gvk61CP3Fo
IAhiWpbi0F2waP6g+XZ/qFxOdqTKkEAhJ087ozSGsf7ZoHqB63OaapK8SNOB5bMf
mf3o3rn0xLpBq50ujevaiJVIiJ9fR2ZBDb2O7VSZn6YQOHZhef7lLgQhrzuIXR/d
ieXyo/38nnFt+pLtfN7RUauZX0J1EDfBDcgicjP+Z5Fwz/PN7cwq1ZllNkVXSGb7
Mg82MSTCBiLd4O1MFWZGdkhblN8/RQIDAQABoAAwDQYJKoZIhvcNAQELBQADggEB
ADy/BLvx+twEsIO8izl5jkf3oNoCSs8FaU3Q9iy8zgVYMxLrNzcYlGxFLAZhfgMh
cbCm9l0XcZDig6MLxVdu04hcIfunDRNpfYpbQGbTGanivf4UYz0sokrXK12Vy5yS
3etMX8Eakd7fwiCLly8ulRGYvSKIcK/XQzv3Kz/AnK0JxCXyFhDuBHKwAsdH0ipv
xcoCaNawiGQs2vG1m9CE+NZZ9gcvMAFNTT5wC2D/RpqO0cBdDDBAOwec1nAub8Jb
TzX8iklDwVoWn16qSfOxzcCpHEytlZRwVBsmqNhlRDA8+Q/LByLC9/mDlOxwiF4V
//xfxL6/JkoTKIHNUP7Hl6E=
-----END CERTIFICATE REQUEST-----`;

const app = new App();
const stack = new Stack(app, 'aws-cdk-thing-policy-principal');

// Use CSR to register certifiate. This will surely break tests
const cert = new Certificate(stack, 'MyThingCertificate', {
  certificateSigningRequest: csr,
});

// Create thing
const thing = new Thing(stack, 'MyThing');

// Create policy and add thing dependeny for attachment
const policy = new Policy(stack, 'MyThingPolicy');
policy.node.addDependency(thing);

// Allow IoT Connect
const connect = new PolicyStatement({
  actions: ['iot:Connect'],
});
connect.addAllResources();

// Allow pub/sub to topics and topicfilters provided to resources
const pubsub = new PolicyStatement({
  actions: [
    'iot:Receive',
    'iot:Subscribe',
    'iot:Publish',
  ],
});

// Provide thing as resource
pubsub.addResources(Arn.format({
  resource: 'topic',
  service: 'iot',
  resourceName: thing.thingName,
}, stack));

// Add statements to policy
policy.addStatements(connect, pubsub);

// Add policy to certificate
cert.attachPolicy(policy);

// Attach certificate to thing
// thing.attachCertificate(cert);
