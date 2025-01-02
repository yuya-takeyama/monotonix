import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { DockerBuildGlobalConfigSchema } from './schema';

export function loadGlobalConfig(globalConfigFilePath: string) {
  const globalConfigContent = readFileSync(globalConfigFilePath, 'utf-8');
  return DockerBuildGlobalConfigSchema.parse(load(globalConfigContent));
}
