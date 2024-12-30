import { getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { loadGlobalConfig, loadLocalConfigs } from './config';
import { run } from './run';

try {
  const rootDir = getInput('root-dir');
  const jobs = getInput('jobs');
  const globalConfigFilePath =
    getInput('global-config-file-path') || 'monotonix-global.yaml';

  const globalConfig = loadGlobalConfig(globalConfigFilePath);

  const buildParams = run({ globalConfig, jobConfigs: jobs, context });
  setOutput('build-params', JSON.stringify(buildParams));
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
