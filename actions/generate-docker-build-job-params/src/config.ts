import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import {
  DockerBuildGlobalConfigSchema,
  DockerBuildJobConfigSchema,
} from './schema';
import { globSync } from 'glob';
import { info } from '@actions/core';

export function loadGlobalConfig(globalConfigFilePath: string) {
  const globalConfigContent = readFileSync(globalConfigFilePath, 'utf-8');
  return DockerBuildGlobalConfigSchema.parse(load(globalConfigContent));
}
