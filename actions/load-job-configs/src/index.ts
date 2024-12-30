import { getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { run } from './run';

try {
  const rootDir = getInput('root-dir');
  const localConfigFileName =
    getInput('local-config-file-name') || 'monotonix.yaml';

  const jobConfigs = run({ rootDir, localConfigFileName, context });

  setOutput('result', JSON.stringify(jobConfigs));
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
