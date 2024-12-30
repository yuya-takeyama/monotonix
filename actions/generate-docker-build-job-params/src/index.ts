import { getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { loadGlobalConfig } from './config';
import { run } from './run';

try {
  const jobConfigs = getInput('job-configs');
  const globalConfigFilePath =
    getInput('global-config-file-path') || 'monotonix-global.yaml';
  const globalConfig = loadGlobalConfig(globalConfigFilePath);

  const jobParams = run({ globalConfig, jobConfigs, context });

  setOutput('result', JSON.stringify(jobParams));
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
