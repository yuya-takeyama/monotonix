# Design: Google Cloud Artifact Registry Support for Docker Build

Date: 2026-08-21
Status: Approved

## Overview

The `load-docker-build-job-params` action currently supports only AWS ECR as a
container registry. This design adds Google Cloud Artifact Registry as a second
registry provider, with keyless authentication via Workload Identity
Federation, while keeping the existing AWS interface fully backward compatible.

## Goals

- Allow `docker_build` jobs to target Google Cloud Artifact Registry.
- Resolve Google Cloud IAM parameters (Workload Identity Federation provider
  and service account) from `monotonix-global.yaml`, symmetric with the
  existing AWS IAM role mapping.
- Reuse the existing tagging strategies (`always_latest`, `semver_datetime`,
  `pull_request`) unchanged.
- Document the required Google Cloud setup (Artifact Registry repository,
  Workload Identity Federation, IAM bindings) and a complete example workflow.

## Non-Goals

- State management backends other than DynamoDB. The state-tracking actions
  (`filter-jobs-by-dynamodb-state`, `set-dynamodb-state-to-running`) remain
  AWS-only; mixing a Google Cloud registry with DynamoDB state is a supported
  and documented configuration.
- Service account key (JSON) authentication. Only Workload Identity Federation
  is supported.
- Registries other than Artifact Registry (e.g. Container Registry, which is
  deprecated).
- Live end-to-end tests against a real Google Cloud project. Verification is
  unit tests plus documentation.

## Configuration Interface

### Global config (`monotonix-global.yaml`)

A `gcp` entry is added beside `aws` under
`job_types.docker_build.registries`. Both providers become optional so that a
repository can configure either or both; a job referencing an unconfigured
provider fails with a clear error at parameter-loading time.

```yaml
job_types:
  docker_build:
    registries:
      aws: # existing, unchanged
        iams:
          dev_main:
            role: arn:aws:iam::123456789012:role/monotonix-dev
            region: ap-northeast-1
        repositories:
          dev_main:
            base_url: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/myrepo
      gcp:
        iams:
          dev_main:
            workload_identity_provider: projects/123456789/locations/global/workloadIdentityPools/github/providers/my-provider
            service_account: monotonix-builder@my-project.iam.gserviceaccount.com
        repositories:
          dev_main:
            base_url: asia-northeast1-docker.pkg.dev/my-project/my-repository
```

### Job config (`monotonix.yaml`)

The `registry` object becomes a discriminated union on `type`:

```yaml
configs:
  docker_build:
    registry:
      type: gcp
      gcp:
        iam: dev_main
        repository: dev_main
    tagging: semver_datetime
    platforms:
      - linux/amd64
```

`type: aws` requires the `aws` key (existing shape, unchanged); `type: gcp`
requires the `gcp` key. `iam` and `repository` are lookup keys into the global
config maps above.

## Output Parameters

For `type: gcp`, the enriched job carries:

```yaml
params:
  docker_build:
    registry:
      type: gcp
      gcp:
        iam:
          workload_identity_provider: projects/123456789/locations/global/workloadIdentityPools/github/providers/my-provider
          service_account: monotonix-builder@my-project.iam.gserviceaccount.com
        repository:
          host: asia-northeast1-docker.pkg.dev
    context: apps/my-app
    tags: asia-northeast1-docker.pkg.dev/my-project/my-repository/my-app:0.0.20260821123456
    platforms: linux/amd64
```

`repository.host` is the first path segment of `base_url`, emitted so that
workflows can pass it directly to `docker/login-action` without hardcoding
registry hosts. AWS output is unchanged.

An example workflow consumes it as:

```yaml
- id: auth
  uses: google-github-actions/auth@v2 # verify latest major at implementation time
  with:
    workload_identity_provider: ${{ matrix.job.params.docker_build.registry.gcp.iam.workload_identity_provider }}
    service_account: ${{ matrix.job.params.docker_build.registry.gcp.iam.service_account }}
    token_format: access_token
- uses: docker/login-action@v3
  with:
    registry: ${{ matrix.job.params.docker_build.registry.gcp.repository.host }}
    username: oauth2accesstoken
    password: ${{ steps.auth.outputs.access_token }}
- uses: docker/setup-buildx-action@v3
- uses: docker/build-push-action@v6
  with:
    context: ${{ matrix.job.params.docker_build.context }}
    push: true
    tags: ${{ matrix.job.params.docker_build.tags }}
    platforms: ${{ matrix.job.params.docker_build.platforms }}
```

## Code Changes

All changes are contained in `actions/load-docker-build-job-params`:

- **`src/schema.ts`**
  - `DockerBuildGlobalConfigSchema`: `registries.aws` becomes optional; add
    optional `registries.gcp` with `iams` (`workload_identity_provider`,
    `service_account`) and `repositories` (`base_url`).
  - `InputJobSchema`: `registry` becomes
    `z.discriminatedUnion('type', [aws, gcp])`.
  - `OutputJobSchema`: `params.docker_build.registry` becomes the matching
    output union; the `gcp` branch carries resolved `iam` values and
    `repository.host`.
- **`src/run.ts`**: branch on `registry.type` to resolve IAM and repository
  entries from the corresponding provider section, with "not found" errors
  naming the missing key and provider.
- **`src/generateImageReferences.ts`**: resolve `base_url` per provider first,
  then run the tagging `switch` once for all providers (the switch currently
  lives inside the AWS branch). Tag formats are unchanged.
- **`packages/schema`**: no changes (`job_types` is a passthrough record).

### Bug fix included

`src/run.ts` currently looks up the IAM entry using the job's **repository**
key instead of its **iam** key
(`iams[localDockerBuildConfig.registry.aws.repository]`), which only works
when both keys happen to be identical. This line is being generalized anyway,
so the fix (use the `iam` key) is included with a regression test where the
two keys differ.

## Error Handling

- Job references `type: gcp` but global config has no `registries.gcp`:
  throw `Registry provider not configured in Global Config: gcp`.
- IAM or repository key not found in the provider's map: throw an error naming
  the key and provider (same pattern as today's messages).
- Schema violations (e.g. `type: gcp` without a `gcp` object) are rejected by
  Zod at parse time.

## Documentation (README)

- Add a `gcp` variant to the `monotonix.yaml` and `monotonix-global.yaml`
  examples.
- Add a Google Cloud build job to the example workflow (auth → login →
  build-push as above).
- New "Google Cloud Setup" section covering:
  - Creating an Artifact Registry Docker repository.
  - Creating a Workload Identity Pool/Provider for GitHub Actions OIDC.
  - Granting `roles/artifactregistry.writer` to the service account on the
    repository, and `roles/iam.workloadIdentityUser` to the GitHub principal
    on the service account.
- Note that state tracking remains DynamoDB-based regardless of registry
  provider.

## Testing

- `src/run.test.ts`: gcp output shape; unknown iam/repository keys; missing
  `registries.gcp` section; mixed aws + gcp job lists; regression test for the
  iam-key lookup bug (iam key ≠ repository key).
- `src/generateImageReferences.test.ts`: all three tagging strategies against
  a gcp `base_url`.
- Full-repo `pnpm run build` and `pnpm run test` from the root; commit the
  rebuilt `dist/` per repository convention.

## Backward Compatibility

- Existing AWS configs parse and resolve identically (`registries.aws`
  required → optional is a relaxation; the input/output `aws` shapes are
  unchanged).
- The iam-lookup bug fix is a behavior change: because the old code read
  `iams[<repository key>]`, the `iam` value was never read at all. Configs
  whose `iam` value does not match any `iams` key worked before (as long as
  `repository` matched an `iams` key) and will now throw. This is an
  intentional breaking fix, announced in the CHANGELOG.
