import { exportVariable, getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { run } from './run';
import { EventSchema } from './schema';

(async () => {
  try {
    const rootDir = getInput('root-dir');
    const localConfigFileName =
      getInput('local-config-file-name') || 'monotonix.yaml';
    const dedupeKey = getInput('dedupe-key');
    const requiredConfigKeys = getInput('required-config-keys')
      .split(/\s*,\s*/)
      .filter(Boolean);
    const event = EventSchema.parse(context);

    const result = await run({
      rootDir,
      dedupeKey,
      requiredConfigKeys,
      localConfigFileName,
      event,
    });

    setOutput('result', result);
    exportVariable('MONOTONIX_JOBS', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
