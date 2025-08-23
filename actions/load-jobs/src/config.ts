import { GlobalConfigSchema } from '@monotonix/schema';
import { existsSync, readFileSync } from 'fs';
import { load } from 'js-yaml';

export function loadGlobalConfig(globalConfigFilePath: string) {
  // If global config file doesn't exist, return minimal config for backward compatibility
  if (!existsSync(globalConfigFilePath)) {
    return { job_types: {} };
  }

  // If file exists, parse it and let errors propagate properly
  // This ensures YAML syntax errors and schema validation errors are reported
  const globalConfigContent = readFileSync(globalConfigFilePath, 'utf-8');
  return GlobalConfigSchema.parse(load(globalConfigContent));
}
