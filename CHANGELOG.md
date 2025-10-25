# Change Log

## [0.0.5] - 2025-10-25

### Added

- Metadata support for apps and jobs with JSON Schema validation [#151](https://github.com/yuya-takeyama/monotonix/pull/151)

### Changed

- Allow scripts for release [#163](https://github.com/yuya-takeyama/monotonix/pull/163)
- Update biome schema version and ignore patterns [#162](https://github.com/yuya-takeyama/monotonix/pull/162)
- Skip claude-code-action for Renovate PRs [#161](https://github.com/yuya-takeyama/monotonix/pull/161)
- Update actions/setup-node action to v6 [#157](https://github.com/yuya-takeyama/monotonix/pull/157)

## [0.0.4] - 2025-07-14

### Added

- `/publish-release` command with remote branch support [#131](https://github.com/yuya-takeyama/monotonix/pull/131)
- shfmt for shell script formatting [#132](https://github.com/yuya-takeyama/monotonix/pull/132)

### Changed

- Remove `app.name` config requirement and `root-dir` input from `filter-jobs-by-changed-files` action [#133](https://github.com/yuya-takeyama/monotonix/pull/133)

## [0.0.3] - 2025-07-13

### Added

- `/open-release-pr` slash command for Claude Code [#129](https://github.com/yuya-takeyama/monotonix/pull/129)
- Biome and prettier for code quality and formatting [#128](https://github.com/yuya-takeyama/monotonix/pull/128)
- App dependency support for dependency-based job triggering [#123](https://github.com/yuya-takeyama/monotonix/pull/123)
- Claude Code GitHub Workflow [#124](https://github.com/yuya-takeyama/monotonix/pull/124)
- Claude PR Assistant workflow [#92](https://github.com/yuya-takeyama/monotonix/pull/92)
- CLAUDE.md [#91](https://github.com/yuya-takeyama/monotonix/pull/91)
- Aqua configuration and VS Code YAML formatter [#94](https://github.com/yuya-takeyama/monotonix/pull/94)
- Comprehensive usage guide to README [#95](https://github.com/yuya-takeyama/monotonix/pull/95)
- .claude directory to .gitignore [#96](https://github.com/yuya-takeyama/monotonix/pull/96)

### Fixed

- Schema: update test assertions for zod v4 error message format [#127](https://github.com/yuya-takeyama/monotonix/pull/127)

### Changed

- Restrict claude-code-action to yuya-takeyama only [#93](https://github.com/yuya-takeyama/monotonix/pull/93)
- Update GitHub Actions dependencies [#126](https://github.com/yuya-takeyama/monotonix/pull/126)
- Update various dependencies (Node.js, @types/node, aws-sdk, zod, jest, luxon, prettier, minimatch, ts-jest, glob, npm, turbo, typescript, etc.)

## [0.0.2] - 2025-03-09

- Fix required-config-keys to check key existence [#59](https://github.com/yuya-takeyama/monotonix/pull/59)
- Update some packages

## [0.0.1] - 2025-01-12

- Consider timezone for semver_datetime tag [#20](https://github.com/yuya-takeyama/monotonix/pull/20)
- Allow null config [#19](https://github.com/yuya-takeyama/monotonix/pull/19)
- Update some packages

## [0.0.0] - 2025-01-06

- Initial release
