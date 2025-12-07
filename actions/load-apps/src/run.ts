import { loadAppsFromLocalConfigFiles } from './loadAppsFromLocalConfigs';

type runParams = {
  rootDir: string;
  localConfigFileName: string;
};

export const run = async ({ rootDir, localConfigFileName }: runParams) => {
  return await loadAppsFromLocalConfigFiles({
    rootDir,
    localConfigFileName,
  });
};
