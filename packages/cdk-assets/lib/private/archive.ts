import { createWriteStream, promises as fs } from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import * as glob from 'glob';

export function zipDirectory(directory: string, outputFile: string): Promise<void> {
  return new Promise(async (ok, fail) => {
    // The below options are needed to support following symlinks when building zip files:
    // - nodir: This will prevent symlinks themselves from being copied into the zip.
    // - follow: This will follow symlinks and copy the files within.
    const globOptions = {
      dot: true,
      nodir: true,
      follow: true,
      cwd: directory,
    };
    const files = glob.sync('**', globOptions); // The output here is already sorted

    const output = createWriteStream(outputFile);

    const archive = archiver('zip');
    archive.on('warning', fail);
    archive.on('error', fail);

    // archive has been finalized and the output file descriptor has closed, resolve promise
    // this has to be done before calling `finalize` since the events may fire immediately after.
    // see https://www.npmjs.com/package/archiver
    output.once('close', ok);

    archive.pipe(output);

    // Append files serially to ensure file order
    for (const file of files) {
      const fullPath = path.resolve(directory, file);
      const [data, stat] = await Promise.all([fs.readFile(fullPath), fs.stat(fullPath)]);
      archive.append(data, {
        name: file,
        date: new Date('1980-01-01T00:00:00.000Z'), // reset dates to get the same hash for the same content
        mode: stat.mode,
      });
    }

    await archive.finalize();
  });
}