import { GlobalConfig, Jobs } from '@monotonix/schema';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export class MetadataValidator {
  private ajv: Ajv;
  private appValidator?: ValidateFunction;
  private jobValidator?: ValidateFunction;

  constructor(globalConfig: GlobalConfig) {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    if (globalConfig.metadata_schemas?.app) {
      this.appValidator = this.ajv.compile(globalConfig.metadata_schemas.app);
    }

    if (globalConfig.metadata_schemas?.job) {
      this.jobValidator = this.ajv.compile(globalConfig.metadata_schemas.job);
    }
  }

  validate(jobs: Jobs): void {
    const errors: string[] = [];

    for (const job of jobs) {
      // Validate app metadata
      if (this.appValidator && job.app.metadata) {
        if (!this.appValidator(job.app.metadata)) {
          errors.push(
            `Invalid app metadata for ${job.context.app_path}: ${this.ajv.errorsText(this.appValidator.errors)}`,
          );
        }
      }

      // Validate job metadata
      if (this.jobValidator && job.metadata) {
        if (!this.jobValidator(job.metadata)) {
          errors.push(
            `Invalid job metadata for ${job.context.label}: ${this.ajv.errorsText(this.jobValidator.errors)}`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Metadata validation failed:\n${errors.join('\n')}`);
    }
  }
}
