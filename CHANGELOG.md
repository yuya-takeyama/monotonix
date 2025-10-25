# Change Log

## [0.0.6] - 2025-10-25

### Fixed

- Ensure validation runs when app field is missing in schema [#165](https://github.com/yuya-takeyama/monotonix/pull/165)

## [0.0.5] - 2025-10-25

### Added

- Metadata support for apps and jobs with JSON Schema validation [#151](https://github.com/yuya-takeyama/monotonix/pull/151)

### Changed

- Allow scripts for release [#163](https://github.com/yuya-takeyama/monotonix/pull/163)
- Update biome schema version and ignore patterns [#162](https://github.com/yuya-takeyama/monotonix/pull/162)
- Skip claude-code-action for Renovate PRs [#161](https://github.com/yuya-takeyama/monotonix/pull/161)
- Build project [#160](https://github.com/yuya-takeyama/monotonix/pull/160)
- Update actions/setup-node action to v6 [#157](https://github.com/yuya-takeyama/monotonix/pull/157)
- Update actions/checkout action to v5 [#156](https://github.com/yuya-takeyama/monotonix/pull/156)
- Update Node.js to v20.19.5 [#154](https://github.com/yuya-takeyama/monotonix/pull/154)
- Update turbo to v2.5.8 [#153](https://github.com/yuya-takeyama/monotonix/pull/153)
- Update @vercel/ncc to v0.38.4 [#152](https://github.com/yuya-takeyama/monotonix/pull/152)
- Update prettier to v3.6.2 [#150](https://github.com/yuya-takeyama/monotonix/pull/150)
- Update ts-jest to v29.4.5 [#149](https://github.com/yuya-takeyama/monotonix/pull/149)
- Update typescript to v5.9.3 [#148](https://github.com/yuya-takeyama/monotonix/pull/148)
- Update @biomejs/biome to v2.3.0 [#147](https://github.com/yuya-takeyama/monotonix/pull/147)
- Update luxon to v3.7.2 [#146](https://github.com/yuya-takeyama/monotonix/pull/146)
- Update aws-sdk-js-v3 monorepo to v3.917.0 [#145](https://github.com/yuya-takeyama/monotonix/pull/145)
- Update npm to v11.6.2 [#144](https://github.com/yuya-takeyama/monotonix/pull/144)
- Update zod to v4.1.12 [#143](https://github.com/yuya-takeyama/monotonix/pull/143)
- Update jest to v30.2.0 [#142](https://github.com/yuya-takeyama/monotonix/pull/142)
- Update anthropics/claude-code-action action to v0.0.63 [#141](https://github.com/yuya-takeyama/monotonix/pull/141)
- Update @aws-sdk/lib-dynamodb to v3.850.0 [#140](https://github.com/yuya-takeyama/monotonix/pull/140)
- Update @biomejs/biome to v2.1.2 [#139](https://github.com/yuya-takeyama/monotonix/pull/139)
- Update turbo to v2.5.5 [#138](https://github.com/yuya-takeyama/monotonix/pull/138)
- Update aws-sdk-js-v3 monorepo to v3.848.0 [#137](https://github.com/yuya-takeyama/monotonix/pull/137)
- Update Node.js to v20.19.4 [#136](https://github.com/yuya-takeyama/monotonix/pull/136)
- Update anthropics/claude-code-action action to v0.0.40 [#135](https://github.com/yuya-takeyama/monotonix/pull/135)

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
