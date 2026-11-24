import { getState, saveState } from '@actions/core';

export const ACQUIRED_STATE = 'MONOTONIX_DYNAMODB_STATE_ACQUIRED';

// Save AWS credentials into the state
// If aws-actions/configure-aws-credentials is used again after this action,
// the credentials will be overwritten by the new ones and post action will fail
export const saveAwsCredentialsIntoState = () => {
  saveState(
    'MONOTONIX_DYNAMODB_STATE_AWS_ACCESS_KEY_ID',
    process.env.AWS_ACCESS_KEY_ID,
  );
  saveState(
    'MONOTONIX_DYNAMODB_STATE_AWS_SECRET_ACCESS_KEY',
    process.env.AWS_SECRET_ACCESS_KEY,
  );
  saveState(
    'MONOTONIX_DYNAMODB_STATE_AWS_SESSION_TOKEN',
    process.env.AWS_SESSION_TOKEN,
  );
};

// Credentials that did not come from env vars (instance profile, AWS_PROFILE)
// are not saved; leave them to the SDK's default provider chain.
export const getAwsCredentialsFromState = () => {
  const accessKeyId = getState('MONOTONIX_DYNAMODB_STATE_AWS_ACCESS_KEY_ID');
  if (!accessKeyId) {
    return undefined;
  }
  return {
    accessKeyId,
    secretAccessKey: getState('MONOTONIX_DYNAMODB_STATE_AWS_SECRET_ACCESS_KEY'),
    sessionToken:
      getState('MONOTONIX_DYNAMODB_STATE_AWS_SESSION_TOKEN') || undefined,
  };
};
