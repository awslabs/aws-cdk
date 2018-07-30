import childProcess = require('child_process');
import colors = require('colors/safe');
import process = require('process');
import yargs = require('yargs');
import { debug,  warning } from '../../lib/logging';

export const command = 'docs';
export const describe = 'Opens the documentation in a browser';
export const aliases = ['doc'];
export const builder = {
    browser: {
        alias: 'b',
        desc: 'the command to use to open the browser, using %u as a placeholder for the path of the file to open',
        type: 'string',
        default: process.platform === 'win32' ? 'start %u' : 'open %u'
    }
};

export interface Arguments extends yargs.Arguments {
    browser: string
}

export async function handler(argv: Arguments): Promise<number> {
    const docVersion = require('../../package.json').version;
    const browserCommand = argv.browser.replace(/%u/g, `https://awslabs.github.io/aws-cdk/versions/${docVersion}/`);
    debug(`Opening documentation ${colors.green(browserCommand)}`);
    return await new Promise<number>((resolve, reject) => {
        childProcess.exec(browserCommand, (err, stdout, stderr) => {
            if (err) { return reject(err); }
            if (stdout) { debug(stdout); }
            if (stderr) { warning(stderr); }
            resolve(0);
        });
    });
}
