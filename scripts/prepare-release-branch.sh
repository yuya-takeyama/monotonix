#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/prepare-release-branch.sh <version>
# Example: ./scripts/prepare-release-branch.sh 1.0.0

VERSION="${1:-}"

# Validate version argument
if [[ -z "$VERSION" ]]; then
  echo "Error: Version number required"
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.3"
  exit 1
fi

# Validate version format (semantic versioning)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
  echo "Error: Invalid version format"
  echo "Expected format: MAJOR.MINOR.PATCH (e.g., 1.2.3, 2.0.0-beta.1)"
  echo "Got: $VERSION"
  exit 1
fi

RELEASE_BRANCH="release/v${VERSION}"

echo "=== Preparing release v${VERSION} ==="

# Check if we have uncommitted changes
if ! git diff --quiet || ! git diff --staged --quiet; then
  echo "Error: You have uncommitted changes"
  echo "Please commit or stash your changes before creating a release"
  git status --short
  exit 1
fi

# Install dependencies and run build/test
echo "→ Installing dependencies..."
npm install

echo "→ Building project..."
npm run build

echo "→ Running tests..."
npm run test

# Fetch latest main
echo "→ Fetching latest main branch..."
git fetch origin main

# Checkout and update main
echo "→ Checking out main branch..."
git checkout main
git pull origin main

# Create release branch
echo "→ Creating release branch: ${RELEASE_BRANCH}"
git checkout -B "${RELEASE_BRANCH}"

# Get latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2> /dev/null || echo "")
if [[ -z "$LATEST_TAG" ]]; then
  echo "→ No previous tags found, using first commit"
  COMMIT_RANGE="$(git rev-list --max-parents=0 HEAD)..HEAD"
else
  echo "→ Latest tag: ${LATEST_TAG}"
  COMMIT_RANGE="${LATEST_TAG}..HEAD"
fi

# Output commit history for changelog generation
echo ""
echo "=== Commits since ${LATEST_TAG:-beginning} ==="
git log --oneline ${COMMIT_RANGE}

echo ""
echo "=== Release branch ready ==="
echo "Branch: ${RELEASE_BRANCH}"
echo "Version: v${VERSION}"
echo "Commit range: ${COMMIT_RANGE}"
