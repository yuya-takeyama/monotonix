# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monotonix is a composable set of GitHub Actions for building efficient CI/CD pipelines in monorepos. The core concept is "monotonic deployment" - ensuring that only changed applications are built and deployed, with state tracking to prevent duplicate work.

## Architecture

### Monorepo Structure

- **actions/**: GitHub Actions as pnpm workspaces (TypeScript)
- **packages/**: Shared packages (e.g., `@monotonix/utils`, `@monotonix/schema`)
- Uses Turbo for build orchestration across workspaces

### Core Action Pipeline

The actions work together in a specific sequence:

1. `load-jobs`: Scans for `monotonix.yaml` files and loads job configurations
2. `filter-jobs-by-changed-files`: Filters jobs based on changed files in commit/PR
3. `filter-jobs-by-dynamodb-state`: Filters out already running/completed jobs using DynamoDB
4. `load-docker-build-job-params`: Enriches Docker jobs with registry configs from global config
5. `set-dynamodb-state-to-running`: Marks jobs as running and handles post-completion state updates

### Key Concepts

- **Job**: A unit of work (build, test, deploy) defined in `monotonix.yaml`
- **Dedupe Key**: Unique identifier for job instances (PR number for PRs, git ref for pushes)
- **State Tracking**: DynamoDB stores job execution state with TTL for cleanup
- **Global Config**: Shared configuration for registries, IAM roles, etc. in `monotonix-global.yaml`

## Development Commands

**Important**: Always run build and test commands from the root directory to ensure all dependencies are properly built and tested. Turbo handles caching and parallel execution efficiently, so full builds are fast.

### Building

```bash
pnpm run build          # Build all actions using Turbo
```

### Testing

```bash
pnpm run test           # Run tests for all actions (automatically runs build first)
```

**Note**: Running `pnpm run test` automatically executes `pnpm run build` first due to Turbo's task dependency configuration in `turbo.json`.

### Development Workflow

1. Make your changes to any action or package
2. Run `pnpm run build` from the root directory
3. Run `pnpm run test` from the root directory
4. Commit your changes including the built `dist/` files

Do not filter or skip any packages during build/test - the full suite ensures everything works together correctly.

## Configuration Files

### App Configuration (`monotonix.yaml`)

Defines jobs for a specific application:

```yaml
app:
  depends_on: [] # Optional: specify dependencies
  # Example with dependencies:
  # depends_on:
  #   - $root/apps/shared/lib  # $root/ prefix = from repository root
  #   - ../common              # Relative path = from app directory
jobs:
  job_name:
    on: # GitHub event triggers
      push:
        branches: [main]
    configs: # Job-specific configuration
      docker_build:
        registry: { ... }
        tagging: semver_datetime
        context: ../.. # Optional: relative to app directory
        dockerfile: Dockerfile # Optional: relative to app directory
        # Or use $root/ prefix for repository root paths:
        # context: $root/apps/mono
        # dockerfile: $root/apps/mono/apps/web/Dockerfile
```

### Path Resolution

All path fields (`depends_on`, `context`, `dockerfile`) use the following resolution rules:

- **`$root/` prefix**: Resolved from repository root (e.g., `$root/apps/shared` → `apps/shared`)
- **Relative paths**: Resolved from the app directory where `monotonix.yaml` is located (e.g., `../..`, `./Dockerfile`)

### Global Configuration (`monotonix-global.yaml`)

Shared configuration for job types:

```yaml
job_types:
  docker_build:
    registries:
      aws:
        iams: # IAM role mappings
        repositories: # ECR repository configs
```

## Action Implementation Patterns

### TypeScript Structure

Each action follows this pattern:

- `src/index.ts`: GitHub Actions entry point
- `src/run.ts`: Main logic implementation
- `src/schema.ts`: Zod schemas for validation (where applicable)
- `dist/`: Compiled JavaScript (committed to repo)

### Testing

- Uses Jest with `ts-jest`
- Test files: `*.test.ts`
- Focus on unit testing core logic in `run.ts`

### Key Dependencies

- `@actions/core`: GitHub Actions SDK
- `@actions/github`: GitHub API client
- `zod`: Schema validation
- `aws-sdk`: DynamoDB operations

## State Management (DynamoDB)

### Schema

- Partition Key: `STATE#{dedupe_key}` (e.g., `STATE#pr/123`, `STATE#refs/heads/main`)
- Sort Key: `{app_path}#{job_key}` (e.g., `apps/echo#build_prd`)
- TTL: Automatic cleanup of old states

### State Values

- `running`: Job is currently executing
- `success`: Job completed successfully
- Records include commit SHA for version comparison
