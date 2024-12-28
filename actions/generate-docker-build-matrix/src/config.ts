import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { GlobalConfigSchema, LocalConfigSchema } from './schemas';
import { globSync } from 'glob';
import { info } from '@actions/core';

export function loadGlobalConfig(globalConfigFilePath: string) {
  const globalConfigContent = readFileSync(globalConfigFilePath, 'utf-8');
  return GlobalConfigSchema.parse(load(globalConfigContent));
}

export function loadLocalConfigs(rootDir: string, localConfigFileName: string) {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);
  return localConfigPaths
    .map(localConfigPath => {
      try {
        const localConfigContent = readFileSync(localConfigPath, 'utf-8');
        const config = LocalConfigSchema.parse(load(localConfigContent));
        return {
          path: localConfigPath,
          config: LocalConfigSchema.parse(load(localConfigContent)),
        };
      } catch (err) {
        info(`Failed to load local config ${localConfigPath}: ${err}`);
        return false;
      }
    })
    .filter(r => r !== false);
}
