import { getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { run } from './run';

try {
  const rootDir = getInput('root-dir');
  const localConfigFileName =
    getInput('local-config-file-name') || 'monotonix.yaml';

  const jobs = run({ rootDir, localConfigFileName, context });

  setOutput('jobs', JSON.stringify(jobs));
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
