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

    // Debug: Log global config status
    console.log(
      JSON.stringify({
        debug: 'global_config_loaded',
        path: globalConfigFilePath,
        hasMetadataSchemas: !!globalConfig.metadata_schemas,
        metadataSchemas: globalConfig.metadata_schemas || null,
      }),
    );

    const result = await run({
      rootDir,
      dedupeKey,
      requiredConfigKeys,
      localConfigFileName,
      event,
    });

    // Debug: Log validation status
    console.log(
      JSON.stringify({
        debug: 'validation_check',
        willValidate: !!globalConfig.metadata_schemas,
        jobCount: result.length,
      }),
    );

    // Validate metadata if schemas are defined
    if (globalConfig.metadata_schemas) {
      console.log(
        JSON.stringify({
          debug: 'validation_started',
          appSchema: globalConfig.metadata_schemas.app || null,
          jobSchema: globalConfig.metadata_schemas.job || null,
        }),
      );
      const validator = new MetadataValidator(globalConfig);
      validator.validate(result);
    } else {
      console.log(
        JSON.stringify({
          debug: 'validation_skipped',
          reason: 'No metadata_schemas defined in global config',
        }),
      );
    }

    setOutput('result', result);
    exportVariable('MONOTONIX_JOBS', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
