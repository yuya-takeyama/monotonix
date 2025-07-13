# Monotonix

**Monotonix makes deploy monotonic.**

Monotonix is an extensible, composable set of building blocks for CI/CD pipelines on GitHub Actions. It empowers developers to create streamlined, efficient workflows for building, testing, and deploying applications in multi-app repository with flexibility and ease.

## Key Features

- **Monotonic Deployment**: Only build and deploy changed applications, preventing duplicate work
- **State Tracking**: Uses DynamoDB to track job execution state with automatic cleanup
- **Multi-Environment Support**: Configure different environments (production, staging, PR) with separate AWS accounts and IAM roles
- **Docker Build Integration**: Seamless AWS ECR integration with multi-platform builds
- **Extensible Job Types**: Define custom job types for any workflow (testing, linting, deployment, etc.)
- **Flexible Configuration**: YAML-based configuration with global and per-app settings

## Quick Start

### 1. Repository Setup

Create the following directory structure in your monorepo:

```
your-repo/
├── apps/
│   ├── monotonix-global.yaml
│   ├── app1/
│   │   ├── Dockerfile
│   │   ├── go.mod
│   │   ├── main.go
│   │   └── monotonix.yaml
│   └── app2/
│       ├── Dockerfile
│       ├── go.mod
│       ├── main.go
│       └── monotonix.yaml
└── .github/
    └── workflows/
        └── docker-build.yml
```

### 2. Global Configuration

Create `monotonix-global.yaml` in the `apps/` directory:

```yaml
job_types:
  docker_build:
    registries:
      aws:
        iams:
          prd:
            role: arn:aws:iam::YOUR-PROD-ACCOUNT:role/monotonix-builder
            region: ap-northeast-1
          dev_main:
            role: arn:aws:iam::YOUR-DEV-ACCOUNT:role/monotonix-builder-main
            region: ap-northeast-1
          dev_pr:
            role: arn:aws:iam::YOUR-DEV-ACCOUNT:role/monotonix-builder-pr
            region: ap-northeast-1
        repositories:
          prd:
            type: private
            base_url: YOUR-PROD-ACCOUNT.dkr.ecr.ap-northeast-1.amazonaws.com/your-repo
          dev_main:
            type: private
            base_url: YOUR-DEV-ACCOUNT.dkr.ecr.ap-northeast-1.amazonaws.com/your-repo
          dev_pr:
            type: private
            base_url: YOUR-DEV-ACCOUNT.dkr.ecr.ap-northeast-1.amazonaws.com/your-repo-pr
```

### 3. Application Configuration

Create `monotonix.yaml` in each app directory:

```yaml
app:
  depends_on: [] # Optional: specify dependencies

jobs:
  # Production build on main branch
  build_prd:
    on:
      push:
        branches: [main]
    configs:
      docker_build:
        registry:
          type: aws
          aws:
            iam: prd
            repository: prd
        tagging: semver_datetime
        platforms:
          - linux/amd64

  # Development build on main branch
  build_dev_main:
    on:
      push:
        branches: [main]
    configs:
      docker_build:
        registry:
          type: aws
          aws:
            iam: dev_main
            repository: dev_main
        tagging: always_latest
        platforms:
          - linux/amd64

  # PR builds
  build_dev_pr:
    on:
      pull_request:
    configs:
      docker_build:
        registry:
          type: aws
          aws:
            iam: dev_pr
            repository: dev_pr
        tagging: pull_request
        platforms:
          - linux/amd64

  # Go testing (custom job type)
  go_test:
    on:
      pull_request:
      push:
        branches: [main]
    configs:
      go_test:
```

### 4. GitHub Actions Workflow

Create `.github/workflows/docker-build.yml`:

```yaml
name: Docker Build

on:
  push:
    branches:
      - main
    paths:
      - .github/workflows/docker-build.yml
      - apps/**
  pull_request:
    paths:
      - .github/workflows/docker-build.yml
      - apps/**

jobs:
  setup:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    outputs:
      jobs: ${{ env.MONOTONIX_JOBS }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: yuya-takeyama/monotonix/actions/load-jobs@main
        with:
          root-dir: apps
          required-config-keys: 'docker_build'
      - if: ${{ github.event_name == 'pull_request' }}
        uses: yuya-takeyama/monotonix/actions/filter-jobs-by-changed-files@main
        with:
          root-dir: apps
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR-ACCOUNT:role/monotonix-state-manager
          aws-region: YOUR-REGION
      - uses: yuya-takeyama/monotonix/actions/filter-jobs-by-dynamodb-state@main
        with:
          dynamodb-table: monotonix-state
          dynamodb-region: YOUR-REGION
      - uses: yuya-takeyama/monotonix/actions/load-docker-build-job-params@main
        with:
          global-config-file-path: apps/monotonix-global.yaml
          timezone: Asia/Tokyo # Timezone for semver_datetime tagging

  build:
    name: ${{ matrix.job.context.label }}
    needs: setup
    if: ${{ needs.setup.outputs.jobs != '[]' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      actions: read
    strategy:
      matrix:
        job: ${{ fromJSON(needs.setup.outputs.jobs) }}
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR-ACCOUNT:role/monotonix-state-manager
          aws-region: YOUR-REGION
      - uses: yuya-takeyama/monotonix/actions/set-dynamodb-state-to-running@main
        with:
          dynamodb-table: monotonix-state
          dynamodb-region: YOUR-REGION
          job: ${{ toJSON(matrix.job) }}
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ matrix.job.params.docker_build.registry.aws.iam.role }}
          aws-region: ${{ matrix.job.params.docker_build.registry.aws.iam.region }}
      - uses: aws-actions/amazon-ecr-login@v2
        with:
          registry-type: ${{ matrix.job.params.docker_build.registry.aws.repository.type }}
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.job.params.docker_build.context }}
          push: true
          tags: ${{ matrix.job.params.docker_build.tags }}
          platforms: ${{ matrix.job.params.docker_build.platforms }}
```

## AWS Setup

### 1. Create DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name monotonix-state \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --time-to-live-specification AttributeName=ttl,Enabled=true
```

### 2. Create IAM Roles

Create IAM roles with the following permissions:

#### State Manager Role

For DynamoDB state management operations:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:*:*:table/monotonix-state"
    }
  ]
}
```

#### Docker Build Roles

For each environment (prd, dev_main, dev_pr):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. Create ECR Repositories

```bash
# Production repository
aws ecr create-repository --repository-name your-repo/your-app --region ap-northeast-1

# Development repository
aws ecr create-repository --repository-name your-repo/your-app --region ap-northeast-1

# PR repository
aws ecr create-repository --repository-name your-repo-pr/your-app --region ap-northeast-1
```

## Extensible Job Types

Monotonix is designed to be extensible beyond Docker builds. You can define any custom job type by:

1. **Adding a config key** in your `monotonix.yaml`:

   ```yaml
   jobs:
     my_custom_job:
       on:
         pull_request:
       configs:
         my_job_type: # Any key you choose
           # Your custom configuration (can be empty)
   ```

2. **Creating a separate GitHub Actions workflow** that targets that job type:

   ```yaml
   name: My Custom Workflow

   on:
     push:
       branches:
         - main
        paths:
          - .github/workflows/my-custom.yml
          - apps/**
     pull_request:
       paths:
         - .github/workflows/my-custom.yml
         - apps/**

   jobs:
     setup:
       runs-on: ubuntu-latest
       outputs:
         jobs: ${{ env.MONOTONIX_JOBS }}
       steps:
         - uses: actions/checkout@v4
           with:
             fetch-depth: 0
         - uses: yuya-takeyama/monotonix/actions/load-jobs@main
           with:
             root-dir: apps
             required-config-keys: 'my_job_type' # Filter for your job type
         - if: ${{ github.event_name == 'pull_request' }}
           uses: yuya-takeyama/monotonix/actions/filter-jobs-by-changed-files@main
           with:
             root-dir: apps
         # ... state management steps (AWS credentials, DynamoDB filtering)

     execute:
       needs: setup
       if: ${{ needs.setup.outputs.jobs != '[]' }}
       strategy:
         matrix:
           job: ${{ fromJSON(needs.setup.outputs.jobs) }}
       steps:
         # ... your custom execution steps
   ```

### Examples of Custom Job Types

- **Go Testing**: `go_test` with separate go-test.yml workflow
- **Linting**: `lint` with lint.yml workflow for ESLint, Prettier, etc.
- **Security Scanning**: `security_scan` with security.yml workflow
- **Database Migrations**: `migrate` with migrate.yml workflow
- **Terraform**: `terraform` with terraform.yml workflow

Each job type gets its own workflow file, allowing for:

- Independent triggering and execution
- Job-specific configuration and steps
- Parallel execution of different job types
- Clear separation of concerns

The Monotonix actions automatically handle:

- Job filtering by changed files
- State tracking in DynamoDB
- Deduplication across environments

## Configuration Reference

### Tagging Strategies

- `semver_datetime`: Semantic version with datetime (e.g., `v1.0.0-20240101120000`)
- `always_latest`: Always tag as `latest`
- `pull_request`: Tag with PR number (e.g., `pr-123`)

### Docker Platforms

- `linux/amd64`: AMD64 architecture
- `linux/arm64`: ARM64 architecture

### Event Triggers

- `push.branches`: Trigger on push to specific branches
- `pull_request`: Trigger on pull request events
- `pull_request_target`: Trigger on pull request target events (for building from forks)

## Examples

See the [monotonix-playground](https://github.com/yuya-takeyama/monotonix-playground) repository for complete working examples.

## Development

For development setup and contribution guidelines, see [CLAUDE.md](CLAUDE.md).
