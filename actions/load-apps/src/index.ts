import { getInput, setFailed, setOutput } from '@actions/core';
import { run } from './run';

(async () => {
  try {
    const rootDir = getInput('root-dir');
    const localConfigFileName =
      getInput('local-config-file-name') || 'monotonix.yaml';

    const result = await run({
      rootDir,
      localConfigFileName,
    });

    setOutput('result', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
