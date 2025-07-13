---
allowed-tools:
  - Bash(./scripts/prepare-release-branch.sh:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Bash(gh pr create:*)
  - Read
  - Edit
  - MultiEdit
description: Create release branch, update CHANGELOG, and open a pull request
---

## Context

- Script output: !`./scripts/prepare-release-branch.sh $ARGUMENTS`

## Your task

Create a release PR for version $ARGUMENTS with these steps:

1. **Prepare release branch**
   - The script has already:
     - Fetched and checked out latest main
     - Created release/v$ARGUMENTS branch
     - Shown commits since last tag

2. **Update CHANGELOG.md**
   - Read the current CHANGELOG.md file
   - Add a new section `## [v$ARGUMENTS] - YYYY-MM-DD` at the top (after the main heading)
   - Organize the commits shown by the script into appropriate sections following Keep a Changelog format:
     - Added
     - Changed
     - Fixed
     - Removed
   - Use the commit messages to categorize changes appropriately
   - Preserve the existing changelog format and style

3. **Commit changes**
   - `git add CHANGELOG.md`
   - `git commit -m "chore: prepare release v$ARGUMENTS"`

4. **Push branch and create PR**
   - `git push -u origin release/v$ARGUMENTS`
   - Create PR using: `gh pr create --title "Release v$ARGUMENTS" --body "## Release v$ARGUMENTS\n\nThis PR prepares the release for version $ARGUMENTS.\n\n### Checklist\n- [ ] CHANGELOG.md updated\n- [ ] Version bumped (if applicable)\n- [ ] All tests passing\n\n🤖 Generated with Claude Code" --draft`

5. **Output**
   - Show the PR URL
   - Remind to review the CHANGELOG and merge when ready
