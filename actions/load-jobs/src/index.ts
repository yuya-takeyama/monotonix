import { exportVariable, getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { loadGlobalConfig } from './config';
import { run } from './run';
import { EventSchema } from './schema';
import { MetadataValidator } from './validateMetadata';

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

    // Load global config for metadata schema validation
    const globalConfigFilePath =
      getInput('global-config-file-path') || 'monotonix-global.yaml';
    const globalConfig = loadGlobalConfig(globalConfigFilePath);

    const result = await run({
      rootDir,
      dedupeKey,
      requiredConfigKeys,
      localConfigFileName,
      event,
    });

    // Validate metadata if schemas are defined
    if (globalConfig.metadata_schemas) {
      const validator = new MetadataValidator(globalConfig);
      validator.validate(result);
    }

    setOutput('result', result);
    exportVariable('MONOTONIX_JOBS', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
