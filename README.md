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
        └── monotonix.yml
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
  name: your-app

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
      pull_request_target:
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
        # Configuration specific to your Go test workflow
```

### 4. GitHub Actions Workflow

Create `.github/workflows/monotonix.yml`:

```yaml
name: Monotonix

on:
  pull_request:

jobs:
  load-jobs:
    runs-on: ubuntu-latest
    outputs:
      jobs: ${{ steps.load-jobs.outputs.jobs }}
    steps:
      - uses: actions/checkout@v4
      - id: load-jobs
        uses: yuya-takeyama/monotonix/actions/load-jobs@main

  filter-jobs-by-changed-files:
    needs: load-jobs
    runs-on: ubuntu-latest
    outputs:
      jobs: ${{ steps.filter-jobs.outputs.jobs }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: filter-jobs
        uses: yuya-takeyama/monotonix/actions/filter-jobs-by-changed-files@main
        with:
          jobs: ${{ needs.load-jobs.outputs.jobs }}

  filter-jobs-by-dynamodb-state:
    needs: filter-jobs-by-changed-files
    runs-on: ubuntu-latest
    outputs:
      jobs: ${{ steps.filter-jobs.outputs.jobs }}
    steps:
      - id: filter-jobs
        uses: yuya-takeyama/monotonix/actions/filter-jobs-by-dynamodb-state@main
        with:
          jobs: ${{ needs.filter-jobs-by-changed-files.outputs.jobs }}
          aws-region: ap-northeast-1
          dynamodb-table-name: monotonix-state

  load-docker-build-job-params:
    needs: filter-jobs-by-dynamodb-state
    runs-on: ubuntu-latest
    outputs:
      jobs: ${{ steps.load-params.outputs.jobs }}
    steps:
      - uses: actions/checkout@v4
      - id: load-params
        uses: yuya-takeyama/monotonix/actions/load-docker-build-job-params@main
        with:
          jobs: ${{ needs.filter-jobs-by-dynamodb-state.outputs.jobs }}

  docker-build:
    needs: load-docker-build-job-params
    if: fromJson(needs.load-docker-build-job-params.outputs.jobs).docker_build != null
    strategy:
      matrix:
        job: ${{ fromJson(needs.load-docker-build-job-params.outputs.jobs).docker_build }}
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: yuya-takeyama/monotonix/actions/set-dynamodb-state-to-running@main
        with:
          app-path: ${{ matrix.job.app_path }}
          job-key: ${{ matrix.job.job_key }}
          aws-region: ap-northeast-1
          dynamodb-table-name: monotonix-state

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ matrix.job.aws_iam_role }}
          aws-region: ${{ matrix.job.aws_region }}

      - uses: docker/setup-buildx-action@v3
      - uses: aws-actions/amazon-ecr-login@v2

      - uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.job.app_path }}
          platforms: ${{ join(matrix.job.platforms, ',') }}
          push: true
          tags: ${{ join(matrix.job.image_references, ',') }}

  # Example: Go testing job (you can define any custom job type)
  go-test:
    needs: filter-jobs-by-dynamodb-state
    if: fromJson(needs.filter-jobs-by-dynamodb-state.outputs.jobs).go_test != null
    strategy:
      matrix:
        job: ${{ fromJson(needs.filter-jobs-by-dynamodb-state.outputs.jobs).go_test }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: yuya-takeyama/monotonix/actions/set-dynamodb-state-to-running@main
        with:
          app-path: ${{ matrix.job.app_path }}
          job-key: ${{ matrix.job.job_key }}
          aws-region: ap-northeast-1
          dynamodb-table-name: monotonix-state

      - uses: actions/setup-go@v5
        with:
          go-version-file: ${{ matrix.job.app_path }}/go.mod

      - working-directory: ${{ matrix.job.app_path }}
        run: go test ./...
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

Create IAM roles for each environment with the following permissions:

#### For Docker Builds:

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

#### For State Management:

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
           # Your custom configuration
   ```

2. **Creating a corresponding GitHub Actions job** that processes the job type:
   ```yaml
   my-custom-workflow:
     needs: filter-jobs-by-dynamodb-state
     if: fromJson(needs.filter-jobs-by-dynamodb-state.outputs.jobs).my_job_type != null
     strategy:
       matrix:
         job: ${{ fromJson(needs.filter-jobs-by-dynamodb-state.outputs.jobs).my_job_type }}
     # ... your custom steps
   ```

### Examples of Custom Job Types

- **Go Testing**: `go_test` with Go setup and test execution
- **Linting**: `lint` with ESLint, Prettier, or language-specific linters
- **Security Scanning**: `security_scan` with vulnerability scanners
- **Database Migrations**: `migrate` with database migration scripts
- **Terraform**: `terraform` with infrastructure as code deployment

The framework automatically handles:

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
