import { getInput, setFailed, setOutput, exportVariable } from '@actions/core';
import { context } from '@actions/github';
import { run } from './run';

(async () => {
  try {
    const workflowId = getInput('workflow-id');
    const rootDir = getInput('root-dir');
    const localConfigFileName =
      getInput('local-config-file-name') || 'monotonix.yaml';

    const result = await run({
      workflowId,
      rootDir,
      localConfigFileName,
      context,
    });

    setOutput('result', result);
    exportVariable('MONOTONIX_JOBS', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
