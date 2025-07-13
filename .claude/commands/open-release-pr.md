---
allowed-tools:
  - Bash(git fetch origin main:*)
  - Bash(git checkout main:*)
  - Bash(git pull origin main:*)
  - Bash(git checkout -B release/v$ARGUMENTS:*)
  - Bash(git status:*)
  - Bash(git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD:*)
  - Bash(gh pr create:*)
  - Read
  - Edit
  - MultiEdit
description: Create release branch, update CHANGELOG, and open a pull request
---

## Context

- Current branch: !`git branch --show-current`
- Git status: !`git status -s`
- Latest tag: !`git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"`
- Changes since last tag:
  !`git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD`

## Your task

Create a release PR for version $ARGUMENTS with these steps:

1. **Fetch and checkout latest main**
   - `git fetch origin main`
   - `git checkout main`
   - `git pull origin main`

2. **Create release branch**
   - `git checkout -B release/v$ARGUMENTS`

3. **Update CHANGELOG.md**
   - Read the current CHANGELOG.md file
   - Add a new section `## [v$ARGUMENTS] - YYYY-MM-DD` at the top (after the main heading)
   - Organize the commits since the last tag into appropriate sections following Keep a Changelog format:
     - Added
     - Changed
     - Fixed
     - Removed
   - Use the commit messages to categorize changes appropriately
   - Preserve the existing changelog format and style

4. **Commit changes**
   - `git add CHANGELOG.md`
   - `git commit -m "chore: prepare release v$ARGUMENTS"`

5. **Push branch and create PR**
   - `git push -u origin release/v$ARGUMENTS`
   - Create PR using: `gh pr create --title "Release v$ARGUMENTS" --body "## Release v$ARGUMENTS\n\nThis PR prepares the release for version $ARGUMENTS.\n\n### Checklist\n- [ ] CHANGELOG.md updated\n- [ ] Version bumped (if applicable)\n- [ ] All tests passing\n\n🤖 Generated with Claude Code" --draft`

6. **Output**
   - Show the PR URL
   - Remind to review the CHANGELOG and merge when ready
