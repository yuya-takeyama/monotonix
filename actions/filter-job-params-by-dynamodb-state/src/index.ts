import { getInput, setFailed, setOutput } from '@actions/core';
import { run } from './run';

(async () => {
  try {
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobParams = getInput('job-params');

    const filteredJobParams = await run({
      jobParams,
      table,
      region,
    });

    setOutput('result', filteredJobParams);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
