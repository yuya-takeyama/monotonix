# Change Log

## [0.0.8] - 2026-02-01

### Added

- Path resolution with `$repoRoot/` prefix support for `context` and `dockerfile` fields [#214](https://github.com/yuya-takeyama/monotonix/pull/214)
- Path validation for `depends_on` with `$root/` prefix support [#216](https://github.com/yuya-takeyama/monotonix/pull/216)

### Changed

- Migrate bundler from ncc to Rollup for ESM support [#212](https://github.com/yuya-takeyama/monotonix/pull/212)
- Migrate from npm to pnpm [#207](https://github.com/yuya-takeyama/monotonix/pull/207)
- Rename `$root/` prefix to `$repoRoot/` for clarity [#220](https://github.com/yuya-takeyama/monotonix/pull/220)
- Update npm to pnpm references in CLAUDE.md and scripts [#208](https://github.com/yuya-takeyama/monotonix/pull/208)
- Update and rename renovate.json to renovate.json5 [#217](https://github.com/yuya-takeyama/monotonix/pull/217)
- Add aqua-renovate-config preset [#203](https://github.com/yuya-takeyama/monotonix/pull/203)
- Update Node.js to v24.13.0 [#191](https://github.com/yuya-takeyama/monotonix/pull/191), [#188](https://github.com/yuya-takeyama/monotonix/pull/188)
- Update dependency turbo to v2.8.1 [#195](https://github.com/yuya-takeyama/monotonix/pull/195)
- Update dependency prettier to v3.8.1 [#198](https://github.com/yuya-takeyama/monotonix/pull/198), v3.7.4 [#186](https://github.com/yuya-takeyama/monotonix/pull/186)
- Update dependency @biomejs/biome to v2.3.13 [#193](https://github.com/yuya-takeyama/monotonix/pull/193)
- Update actions/checkout action to v6.0.2 [#209](https://github.com/yuya-takeyama/monotonix/pull/209), v6 [#187](https://github.com/yuya-takeyama/monotonix/pull/187)
- Update actions/setup-node action to v6.2.0 [#199](https://github.com/yuya-takeyama/monotonix/pull/199), v6.1.0 [#185](https://github.com/yuya-takeyama/monotonix/pull/185)
- Update npm to v11.8.0 [#201](https://github.com/yuya-takeyama/monotonix/pull/201), v11.7.0 [#183](https://github.com/yuya-takeyama/monotonix/pull/183)
- Pin dependencies [#219](https://github.com/yuya-takeyama/monotonix/pull/219)
- Update aquaproj/aqua-installer digest [#210](https://github.com/yuya-takeyama/monotonix/pull/210)
- Update dependency suzuki-shunsuke/pinact to v3.8.0 [#206](https://github.com/yuya-takeyama/monotonix/pull/206)
- Update dependency cli/cli to v2.86.0 [#205](https://github.com/yuya-takeyama/monotonix/pull/205)
- Update dependency aquaproj/aqua-registry to v4.464.0 [#204](https://github.com/yuya-takeyama/monotonix/pull/204)

### Fixed

- Use resolved paths for job.app.depends_on [#221](https://github.com/yuya-takeyama/monotonix/pull/221)
- Suppress external library warnings and fix TypeScript errors [#218](https://github.com/yuya-takeyama/monotonix/pull/218)
- Update dependency @actions/github to v9 [#213](https://github.com/yuya-takeyama/monotonix/pull/213)
- Update dependency @actions/core to v2.0.3 [#196](https://github.com/yuya-takeyama/monotonix/pull/196), v2 [#190](https://github.com/yuya-takeyama/monotonix/pull/190)
- Update aws-sdk-js-v3 monorepo to v3.980.0 [#194](https://github.com/yuya-takeyama/monotonix/pull/194), v3.948.0 [#189](https://github.com/yuya-takeyama/monotonix/pull/189)
- Update dependency zod to v4.3.6 [#192](https://github.com/yuya-takeyama/monotonix/pull/192), v4.1.13 [#184](https://github.com/yuya-takeyama/monotonix/pull/184)

## [0.0.7] - 2025-12-07

### Added

- load-apps action for scanning monorepo structure [#177](https://github.com/yuya-takeyama/monotonix/pull/177)

### Fixed

- Resolve lint errors in load-apps test [#178](https://github.com/yuya-takeyama/monotonix/pull/178)
- Update dependency glob to v13 [#176](https://github.com/yuya-takeyama/monotonix/pull/176)
- Update dependency minimatch to v10.1.1 [#171](https://github.com/yuya-takeyama/monotonix/pull/171)
- Update aws-sdk-js-v3 monorepo to v3.946.0 [#168](https://github.com/yuya-takeyama/monotonix/pull/168)
- Update dependency ajv-formats to v3 [#159](https://github.com/yuya-takeyama/monotonix/pull/159)

### Changed

- Upgrade GitHub Actions runtime to node24 [#181](https://github.com/yuya-takeyama/monotonix/pull/181)
- Update dependency @biomejs/biome to v2.3.8 [#167](https://github.com/yuya-takeyama/monotonix/pull/167)
- Update Node.js to v24 [#169](https://github.com/yuya-takeyama/monotonix/pull/169)
- Update dependency turbo to v2.6.3 [#172](https://github.com/yuya-takeyama/monotonix/pull/172)
- Update dependency ts-jest to v29.4.6 [#179](https://github.com/yuya-takeyama/monotonix/pull/179)
- Update actions/checkout action to v5.0.1 [#173](https://github.com/yuya-takeyama/monotonix/pull/173)

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
