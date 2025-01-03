import { getInput, setFailed } from '@actions/core';
import { run } from './run';
import { JobSchema } from '@monotonix/schema';
import { context, getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';

(async () => {
  try {
    const workflowId =
      getInput('workflow-id') || process.env.MONOTONIX_WORKFLOW_ID;
    if (!workflowId) {
      throw new Error(
        'Input workflow-id or env $MONOTONIX_WORKFLOW_ID is required',
      );
    }
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobJson = getInput('job');
    const job = JobSchema.parse(JSON.parse(jobJson));

    const now = Math.floor(Date.now() / 1000);
    let ttl: number | null = null;
    if (getInput('ttl-in-days')) {
      ttl = now + Number(getInput('ttl-in-days')) * 24 * 60 * 60;
    } else if (getInput('ttl-in-hours')) {
      ttl = now + Number(getInput('ttl-in-hours')) * 60 * 60;
    } else if (getInput('ttl-in-minutes')) {
      ttl = now + Number(getInput('ttl-in-minutes')) * 60;
    }
    const status = 'running';

    const octokit = getOctokit(process.env.GITHUB_TOKEN!);

    console.log(`JOB_ID: ${process.env.GITHUB_JOB}`);
    console.log(`context.job: ${context.job}`);
    console.log(`context.run_id: ${context.runId}`);
    console.log(`RUN_ATTEMPT: ${process.env.GITHUB_RUN_ATTEMPT}`);

    const jobs = await octokit.rest.actions.listJobsForWorkflowRunAttempt({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: context.runId,
      attempt_number: Number(process.env.GITHUB_RUN_ATTEMPT),
    });
    const jobId = jobs.data.jobs[1]!.id;
    const actionJob = await octokit.rest.actions.getJobForWorkflowRun({
      owner: context.repo.owner,
      repo: context.repo.repo,
      job_id: jobId,
    });

    /*
    const jobForWorkflowRun = await octokit.rest.actions.getJobForWorkflowRun({
      owner: context.repo.owner,
      repo: context.repo.repo,
      job_id: Number(process.env.GITHUB_JOB!),
    });
    */

    const githubJobContext = JSON.parse(
      process.env.MONOTONIX_GITHUB_JOB_CONTEXT!,
    );
    const githubStepContext = JSON.parse(
      process.env.MONOTONIX_GITHUB_STEP_CONTEXT!,
    );

    console.log('This is post.ts');
    console.log(
      JSON.stringify(
        {
          githubJobContext,
          githubStepContext,
          workflowId,
          jobId,
          githubRef: context.ref,
          jobs,
          actionJob,
          context,
          job,
          table,
          region,
          status,
          ttl,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
