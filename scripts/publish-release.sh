#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/publish-release.sh <version>
# Example: ./scripts/publish-release.sh 1.0.0

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

echo "=== Publishing release v${VERSION} ==="

# Fetch latest main from remote
echo "→ Fetching latest main branch from remote..."
git fetch origin main

# Get the latest commit SHA from remote main
MAIN_SHA=$(git rev-parse origin/main)
echo "→ Using commit from origin/main: ${MAIN_SHA:0:7}"

# Check if tag already exists
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
  echo "Error: Tag v${VERSION} already exists"
  exit 1
fi

# Extract release notes from CHANGELOG.md on remote main
echo "→ Extracting release notes from CHANGELOG.md..."

# Get CHANGELOG.md content from origin/main
CHANGELOG_CONTENT=$(git show origin/main:CHANGELOG.md 2>/dev/null || echo "")

if [[ -z "$CHANGELOG_CONTENT" ]]; then
  echo "Error: CHANGELOG.md not found in origin/main"
  exit 1
fi

# Extract the section for this version
RELEASE_NOTES=$(echo "$CHANGELOG_CONTENT" | awk -v version="$VERSION" '
  /^## \[/ {
    if (found) exit
    if ($2 == "["version"]") found = 1
  }
  found && /^## \[/ && $2 != "["version"]" { exit }
  found && !/^## \[/ { print }
')

if [[ -z "$RELEASE_NOTES" ]]; then
  echo "Error: No release notes found for version $VERSION in CHANGELOG.md"
  echo "Make sure CHANGELOG.md contains a section: ## [$VERSION] - YYYY-MM-DD"
  exit 1
fi

# Create git tag from origin/main
echo "→ Creating tag v${VERSION} from origin/main..."
git tag -a "v${VERSION}" -m "Release v${VERSION}" "${MAIN_SHA}"

# Push tag
echo "→ Pushing tag to remote..."
git push origin "v${VERSION}"

# Create GitHub release
echo "→ Creating GitHub release..."
gh release create "v${VERSION}" \
  --title "v${VERSION}" \
  --notes "$RELEASE_NOTES" \
  --verify-tag

echo ""
echo "=== Release published successfully! ==="
echo "Version: v${VERSION}"
echo "URL: https://github.com/yuya-takeyama/monotonix/releases/tag/v${VERSION}"
