import { GlobalConfig, Jobs } from '@monotonix/schema';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export class MetadataValidator {
  private ajv: Ajv;
  private appValidator?: ValidateFunction;
  private jobValidator?: ValidateFunction;
  private appSchema?: any;
  private jobSchema?: any;

  constructor(globalConfig: GlobalConfig) {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    if (globalConfig.metadata_schemas?.app) {
      this.appSchema = globalConfig.metadata_schemas.app;
      this.appValidator = this.ajv.compile(this.appSchema);
    }

    if (globalConfig.metadata_schemas?.job) {
      this.jobSchema = globalConfig.metadata_schemas.job;
      this.jobValidator = this.ajv.compile(this.jobSchema);
    }
  }

  validate(jobs: Jobs): void {
    const errors: string[] = [];

    for (const job of jobs) {
      // Validate app metadata
      if (this.appValidator && job.app.metadata) {
        const isValid = this.appValidator(job.app.metadata);

        // Debug log in NDJSON format
        console.log(
          JSON.stringify({
            type: 'app',
            input: job.app.metadata,
            schema: this.appSchema,
            result: {
              valid: isValid,
              errors: isValid ? null : this.appValidator.errors,
              path: job.context.app_path,
            },
          }),
        );

        if (!isValid) {
          errors.push(
            `Invalid app metadata for ${job.context.app_path}: ${this.ajv.errorsText(this.appValidator.errors)}`,
          );
        }
      }

      // Validate job metadata
      if (this.jobValidator && job.metadata) {
        const isValid = this.jobValidator(job.metadata);

        // Debug log in NDJSON format
        console.log(
          JSON.stringify({
            type: 'job',
            input: job.metadata,
            schema: this.jobSchema,
            result: {
              valid: isValid,
              errors: isValid ? null : this.jobValidator.errors,
              label: job.context.label,
            },
          }),
        );

        if (!isValid) {
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
