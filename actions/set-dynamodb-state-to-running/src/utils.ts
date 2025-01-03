import { saveState } from '@actions/core';

export const parseDuration = (duration: string): number => {
  const regex = /(\d+)(\D+)/g;
  let matches;
  let totalSeconds = 0;
  let lastIndex = 0;

  while ((matches = regex.exec(duration)) !== null) {
    if (matches[1] && matches[2]) {
      const value = Number(matches[1]);
      const unit = matches[2];

      switch (unit) {
        case 'd':
          totalSeconds += value * 60 * 60 * 24;
          break;
        case 'h':
          totalSeconds += value * 60 * 60;
          break;
        case 'm':
          totalSeconds += value * 60;
          break;
        case 's':
          totalSeconds += value;
          break;
        default:
          throw new Error(`Invalid unit: ${unit}`);
      }
      lastIndex = regex.lastIndex;
    }
  }

  if (lastIndex !== duration.length) {
    throw new Error(`Invalid format: ${duration}`);
  }

  return totalSeconds;
};

// Save AWS credentials into the state
// If aws-actions/configure-aws-credentials is used again after this action,
// the credentials will be overwritten by the new ones and post action will fail
export const saveAwsCredentialsIntoState = () => {
  saveState(
    'MONOTONIX_DYNAMODB_STATE_AWS_DEFAULT_REGION',
    process.env.AWS_DEFAULT_REGION,
  );
  saveState('MONOTONIX_DYNAMODB_STATE_AWS_REGION', process.env.AWS_REGION);
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
