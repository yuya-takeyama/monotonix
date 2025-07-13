---
allowed-tools:
  - Bash(./scripts/publish-release.sh:*)
description: Publish a GitHub release after merging a release PR
---

## Command Usage

This command creates a GitHub release from the current main branch.

**Format**: `/publish-release <MAJOR.MINOR.PATCH>`
**Example**: `/publish-release 1.2.3`

## Prerequisites

- Must be run after merging a release PR
- CHANGELOG.md must contain a section for the specified version in origin/main
- Version tag must not already exist

## Context

- Current branch: !`git branch --show-current`
- Latest tags: !`git tag -l | tail -5`

## Your task

Execute the publish-release script with the provided version:

```bash
./scripts/publish-release.sh $ARGUMENTS
```

The script will:

1. Fetch latest origin/main
2. Extract release notes from CHANGELOG.md in origin/main
3. Create and push a git tag from origin/main commit
4. Create a GitHub release with the extracted notes

Show the output and confirm when the release is successfully published.
