#!/usr/bin/env node
const child = require('child_process');
const { promises: fs } = require('fs');
const os = require('os');
const path = require('path');
const Listr = require('listr');

async function lernaList() {
  return new Promise((ok, ko) => {
    const lerna = child.spawn(
      'yarn', ['--silent', 'lerna', 'list', '--json'],
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: ['inherit', 'pipe', 'ignore'],
      },
    );

    const stdout = [];
    lerna.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));

    lerna.once('error', ko);
    lerna.once('close', (code, signal) => {
      if (code === 0) {
        try {
          ok(JSON.parse(Buffer.concat(stdout).toString('utf-8')));
        } catch (err) {
          ko(err);
        }
      } else {
        const condition = code != null ? `code ${code}` : `signal ${signal}`;
        ko(new Error(`Lerna execution failed with ${condition}`));
      }
    });
  });
}

function strictRosettaBuildSucceeds(location) {
  return new Promise((ok, ko) => {
    const rosetta = child.spawn(
      'yarn', ['--silent', 'jsii-rosetta', '--compile', '--fail'],
      {
        cwd: location,
        stdio: ['inherit', 'ignore', 'ignore'],
      }
    );

    rosetta.once('error', ko);
    rosetta.once('exit', (code) => {
      ok(code === 0);
    });
  });
}

function isStrictModeEnabled(packageJson) {
  return deepGet(packageJson, ['jsii', 'metadata', 'jsii', 'rosetta', 'strict'], false);

  function deepGet(obj, path, defaultValue) {
    const [head, ...rest] = path;
    if (!(head in obj)) {
      return defaultValue;
    }
    const value = obj[head];
    if (rest.length > 0) {
      return deepGet(value, rest, defaultValue);
    }
    return value;
  }
}

function enableStrictMode(location) {
  return new Promise((ok, ko) => {
    const rosetta = child.spawn(
      'yarn', ['--silent', 'jsii-rosetta', 'configure-strict'],
      {
        cwd: location,
        stdio: ['inherit', 'ignore', 'ignore'],
      }
    );

    rosetta.once('error', ko);
    rosetta.once('exit', (code, signal) => {
      if (code === 0) {
        ok();
      } else {
        const condition = code != null ? `code ${code}` : `signal ${signal}`;
        ko(new Error(`Lerna execution failed with ${condition}`));
      }
    });
  });
}

const Status = {
  ALREADY_STRICT: '✅ Strict mode already enabled',
  CAN_BE_MADE_STRICT: '🥳 All examples pass compilation',
  FAILING: '💥 Some examples fail compilation',
};

const concurrent = process.env.JOBS
  ? Number.parseInt(process.env.JOBS, 10)
  : 4;

const tasks = new Listr([
  {
    title: 'Find all packages',
    task: async (ctx) => ctx.packages = await lernaList(),
  },
  {
    title: 'Read all package.json files',
    task: async (ctx) => ctx.packages = await Promise.all(ctx.packages.map(async ({ name, location }) => ({
      name, location,
      metadata: JSON.parse(await fs.readFile(path.join(location, 'package.json'), { encoding: 'utf-8' })),
    }))),
  },
  {
    title: 'Filtering non-jsii packages',
    task: (ctx) => ctx.packages = ctx.packages.filter(({ metadata }) => metadata.jsii != null),
  },
  {
    title: 'Evaluating packages',
    task: (ctx) => new Listr(ctx.packages.map((package) => ({
      title: package.name,
      task: async () => {
        if (isStrictModeEnabled(package.metadata)) {
          package.status = Status.ALREADY_STRICT;
        }
      },
    })), { concurrent })
  }, {
    title: 'Test strict mode',
    task: (ctx) => new Listr(ctx.packages.filter((pkg) => pkg.status == null).map((package) => ({
      title: package.name,
      task: async () => {
        if (await strictRosettaBuildSucceeds(package.location)) {
          package.status = Status.CAN_BE_MADE_STRICT;
        } else {
          package.status = Status.FAILING;
        }
      },
    })), { concurrent })
  }, {
    title: 'Enable strict mode where possible',
    task: (ctx) => new Listr(ctx.packages.filter((pkg) => pkg.status === Status.CAN_BE_MADE_STRICT).map((package) => ({
      title: package.name,
      task: () => enableStrictMode(package.location),
    })), { concurrent })
  },
]);

tasks.run({ packages: [] })
  .then((ctx) => {
    const maxNameLen = Math.max(0, ...ctx.packages.map(({ name }) => name.length));

    for (const { name, status } of ctx.packages.sort(({ name: lname }, { name: rname }) => lname.localeCompare(rname))) {
      console.log(`${name.padEnd(maxNameLen)} ${status}`);
    }
  });
