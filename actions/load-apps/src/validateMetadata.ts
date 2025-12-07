import { GlobalConfig } from '@monotonix/schema';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Apps } from './loadAppsFromLocalConfigs';

export class MetadataValidator {
  private ajv: Ajv;
  private appValidator?: ValidateFunction;

  constructor(globalConfig: GlobalConfig) {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    if (globalConfig.metadata_schemas?.app) {
      this.appValidator = this.ajv.compile(globalConfig.metadata_schemas.app);
    }
  }

  validate(apps: Apps): void {
    const errors: string[] = [];

    for (const app of apps) {
      // Validate app metadata
      if (this.appValidator && app.metadata) {
        if (!this.appValidator(app.metadata)) {
          errors.push(
            `Invalid app metadata for ${app.app_path}: ${this.ajv.errorsText(this.appValidator.errors)}`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Metadata validation failed:\n${errors.join('\n')}`);
    }
  }
}
