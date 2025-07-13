import { Jobs } from '@monotonix/schema';
import { getOctokit, context } from '@actions/github';
import { 
  loadAllAppConfigs, 
  getAffectedAppsFromChangedFiles, 
  propagateAppDependencies 
} from './loadAllAppConfigs';

/**
 * ファイル変更に基づいてジョブをフィルタリング（依存関係考慮）
 */
const filterJobsByChangedFiles = (changedFiles: string[], jobs: Jobs): Jobs => {
  console.log('🔍 [DEBUG] filterJobsByChangedFiles starting');
  console.log('🔍 [DEBUG] changedFiles:', changedFiles);
  console.log('🔍 [DEBUG] available jobs:', jobs.map(j => ({ 
    name: j.app.name, 
    path: j.context.app_path, 
    job_key: j.context.job_key
  })));

  // 1. すべてのアプリ設定を独立して読み込み
  const allAppConfigs = loadAllAppConfigs('apps');

  // 2. ファイル変更からアプリを特定（完全なアプリ設定を使用）
  const directlyAffectedApps = getAffectedAppsFromChangedFiles(
    changedFiles,
    allAppConfigs,
  );
  console.log('🔍 [DEBUG] directlyAffectedApps:', directlyAffectedApps);

  // 3. 依存関係を考慮してアプリリストを拡張（完全な依存関係マップを使用）
  const allAffectedApps = propagateAppDependencies(directlyAffectedApps, allAppConfigs);
  console.log('🔍 [DEBUG] allAffectedApps after propagation:', allAffectedApps);

  // 4. 影響を受けるアプリのジョブのみフィルタ（提供されたジョブの中から）
  const filteredJobs = jobs.filter(job => allAffectedApps.includes(job.app.name));
  console.log('🔍 [DEBUG] filteredJobs:', filteredJobs.map(j => ({ 
    name: j.app.name, 
    job_key: j.context.job_key 
  })));

  return filteredJobs;
};

type runParams = {
  githubToken: string;
  jobs: Jobs;
};
export const run = async ({ githubToken, jobs }: runParams): Promise<Jobs> => {
  const octokit = getOctokit(githubToken);

  switch (context.eventName) {
    case 'pull_request':
    case 'pull_request_target':
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.issue.number,
      });

      const prChangedFiles = files.map(file => file.filename);
      return filterJobsByChangedFiles(prChangedFiles, jobs);

    default:
      const { data: commits } = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
      });

      const pushChangedFiles = (commits.files || []).map(file => file.filename);
      return filterJobsByChangedFiles(pushChangedFiles, jobs);
  }
};
