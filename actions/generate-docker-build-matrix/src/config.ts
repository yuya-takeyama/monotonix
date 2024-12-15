import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { GlobalConfigSchema, LocalConfigSchema } from './schemas';
import glob from 'glob';

export function loadGlobalConfig(
  rootDir: string,
  globalConfigFilePath: string,
) {
  const globalConfigPath = join(rootDir, globalConfigFilePath);
  const globalConfigContent = readFileSync(globalConfigPath, 'utf-8');
  return GlobalConfigSchema.parse(load(globalConfigContent));
}

export function loadLocalConfigs(rootDir: string, localConfigFileName: string) {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = glob.sync(pattern);
  return localConfigPaths.map(localConfigPath => {
    const localConfigContent = readFileSync(localConfigPath, 'utf-8');
    return {
      path: localConfigPath,
      config: LocalConfigSchema.parse(load(localConfigContent)),
    };
  });
}
