import { warning } from '@actions/core';
import { exec, ExecOptions } from '@actions/exec';

export type CommitInfo = {
  hash: string;
  timestamp: number;
};
export const getLastCommit = async (appPath: string): Promise<CommitInfo> => {
  let output = '';
  let errorOutput = '';

  const options: ExecOptions = {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
      stderr: (data: Buffer) => {
        errorOutput += data.toString();
      },
    },
  };

  try {
    await exec('git', ['log', '-1', '--format=%H/%ct', '--', appPath], options);

    console.log(`OUTPUT: ${JSON.stringify(output)}`);
    console.log(`ERROR: ${JSON.stringify(errorOutput)}`);
    const [hash, timestamp] = output.split('/').map(s => s.trim());

    if (!hash || !timestamp) {
      throw new Error(
        `Failed to get last commit info for ${appPath}: ${errorOutput}`,
      );
    }

    return {
      hash,
      timestamp: Number(timestamp),
    };
  } catch (err) {
    console.error(err);
    warning(`Failed to get last commit info for ${appPath}: ${errorOutput}`);

    return {
      hash: '0000000000000000000000000000000000000000',
      timestamp: 0,
    };
  }
};
