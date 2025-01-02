"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const run_1 = require("./run");
const schema_1 = require("@monotonix/schema");
try {
    const table = (0, core_1.getInput)('dynamodb-table');
    const region = (0, core_1.getInput)('dynamodb-region');
    const jobsJson = (0, core_1.getInput)('jobs') || process.env.MONOTONIX_JOBS;
    if (!jobsJson) {
        throw new Error('Input job or env $MONOTONIX_JOBS is required');
    }
    const jobs = parseJobs(jobsJson);
    const status = (0, core_1.getInput)('status');
    if (!(status === 'running' || status === 'success' || status === 'failure')) {
        throw new Error(`Invalid status: ${status}: must be one of 'running', 'success', 'failure'`);
    }
    const now = Math.floor(Date.now() / 1000);
    let ttl = null;
    if ((0, core_1.getInput)('ttl-in-days')) {
        ttl = now + Number((0, core_1.getInput)('ttl-in-days')) * 24 * 60 * 60;
    }
    else if ((0, core_1.getInput)('ttl-in-hours')) {
        ttl = now + Number((0, core_1.getInput)('ttl-in-hours')) * 60 * 60;
    }
    else if ((0, core_1.getInput)('ttl-in-minutes')) {
        ttl = now + Number((0, core_1.getInput)('ttl-in-minutes')) * 60;
    }
    (0, run_1.run)({
        jobs,
        table,
        region,
        status,
        ttl,
    });
}
catch (error) {
    console.error(error);
    (0, core_1.setFailed)(`Action failed with error: ${error}`);
}
function parseJobs(jobsJson) {
    if (isArrayJson(jobsJson)) {
        return schema_1.JobsSchema.parse(JSON.parse(jobsJson));
    }
    else {
        return [schema_1.JobSchema.parse(JSON.parse(jobsJson))];
    }
}
function isArrayJson(value) {
    return value.trim().startsWith('[');
}
