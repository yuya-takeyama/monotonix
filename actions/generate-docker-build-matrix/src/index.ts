import { getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { loadGlobalConfig, loadLocalConfigs } from './config';
import { run } from './run';

try {
  const rootDir = getInput('root-dir');
  const globalConfigFilePath =
    getInput('global-config-file-path') || 'monotonix-global.yaml';
  const localConfigFileName =
    getInput('local-config-file-name') || 'monotonix.yaml';

  const globalConfig = loadGlobalConfig(globalConfigFilePath);
  const localConfigs = loadLocalConfigs(rootDir, localConfigFileName);

  const buildParams = run(globalConfig, localConfigs, context);
  setOutput('build-params', JSON.stringify(buildParams));
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
