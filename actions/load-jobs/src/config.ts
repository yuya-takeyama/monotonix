import { GlobalConfigSchema } from '@monotonix/schema';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';

export function loadGlobalConfig(globalConfigFilePath: string) {
  try {
    const globalConfigContent = readFileSync(globalConfigFilePath, 'utf-8');
    return GlobalConfigSchema.parse(load(globalConfigContent));
  } catch (_error) {
    // If global config doesn't exist or is invalid, return minimal config
    // This maintains backward compatibility
    return { job_types: {} };
  }
}
