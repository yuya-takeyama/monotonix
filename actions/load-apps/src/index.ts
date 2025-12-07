import { getInput, setFailed, setOutput } from '@actions/core';
import { loadGlobalConfig } from './config';
import { run } from './run';
import { MetadataValidator } from './validateMetadata';

(async () => {
  try {
    const rootDir = getInput('root-dir');
    const localConfigFileName =
      getInput('local-config-file-name') || 'monotonix.yaml';

    // Load global config for metadata schema validation
    const globalConfigFilePath =
      getInput('global-config-file-path') || 'monotonix-global.yaml';
    const globalConfig = loadGlobalConfig(globalConfigFilePath);

    const result = await run({
      rootDir,
      localConfigFileName,
    });

    // Validate metadata if schemas are defined
    if (globalConfig.metadata_schemas) {
      const validator = new MetadataValidator(globalConfig);
      validator.validate(result);
    }

    setOutput('result', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
