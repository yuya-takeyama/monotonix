# Monotonix Dependency Feature Design Plan

## Overview

This document outlines the design and implementation plan for adding dependency support to Monotonix. The goal is to enable apps to declare dependencies on other parts of the monorepo, such that changes in dependencies trigger builds for dependent apps.

## Problem Statement

Currently, Monotonix uses directory-based change detection. If files in `apps/foo/cmd/server` change, only the `server` job runs. However, real-world applications have more complex dependency requirements:

1. **Directory dependencies**: `server` depends on `apps/foo/pkg/logger`
2. **File dependencies**: `server` depends on `apps/foo/go.mod` and `apps/foo/go.sum`

### Example Scenario

```
apps/foo/
├── cmd/
│   ├── server/     # depends on pkg/logger and go.mod/go.sum
│   └── worker/     # depends on pkg/logger and go.mod/go.sum
├── pkg/logger/     # shared package
├── go.mod          # dependency definitions
└── go.sum          # dependency lock file
```

#### Current Limitations:

- ✅ Changes in `pkg/logger/` can trigger builds if `depends_on: [foo]`
- ❌ But this also triggers unnecessary builds when `worker` changes
- ❌ Cannot depend on specific files like `go.mod` or `go.sum`
- ❌ Ambiguous whether `depends_on` refers to app names or file paths

## Current Architecture Analysis

### Workflow Step Analysis

1. **load-jobs**:
   - Scans for `monotonix.yaml` files using globSync
   - Calls `getLastCommit(appPath)` to get timestamp for each app
   - Creates Job objects with `context.last_commit.timestamp`

2. **filter-jobs-by-changed-files** (PR events only):
   - Filters jobs where `files.some(file => file.startsWith(job.context.app_path))`
   - Currently only considers direct path matches

3. **filter-jobs-by-dynamodb-state**:
   - Compares `job.context.last_commit.timestamp` with DynamoDB stored timestamps
   - Skips jobs if `storedTimestamp >= job.timestamp`

4. **load-docker-build-job-params**: No changes needed
5. **set-dynamodb-state-to-running**: No changes needed

### Key Insight: Timestamp-Based Solution

The proposed solution of using `max(appTimestamp, ...dependencyTimestamps)` as the effective timestamp will work because:

- `filter-jobs-by-dynamodb-state` compares this effective timestamp against stored state
- If any dependency has a newer commit than the last successful run, the job will be included
- This leverages the existing timestamp comparison logic without major architectural changes

## Design Solution

### Core Principle: File Path Based Dependencies

`depends_on` specifies file paths (both directories and individual files) that the app depends on. This provides maximum flexibility and clarity.

**Key Design Decision**: `depends_on` values are always treated as file system paths, not app names or other identifiers. This removes ambiguity and makes the behavior predictable.

### Schema Changes

Add `depends_on` field to the app configuration:

```yaml
# monotonix.yaml
app:
  name: foo/cmd/server
  depends_on:
    # Directory dependencies (no trailing slash required)
    - foo/pkg # depends on apps/foo/pkg/ directory
    - shared/utils # depends on apps/shared/utils/ directory

    # File dependencies
    - foo/go.mod # depends on apps/foo/go.mod file
    - foo/go.sum # depends on apps/foo/go.sum file

    # Glob patterns (future enhancement)
    # - foo/*.{mod,sum}  # all .mod and .sum files in foo/
jobs:
  build:
    on:
      push:
        branches: [main]
    configs:
      docker_build: {}
```

**Dependency Resolution Rules:**

- Dependencies are relative to the root directory (`apps/`)
- Both directories and files can be specified
- **Automatic detection**: The system automatically determines if a dependency is a file or directory
- Self-dependencies are ignored (app cannot depend on itself)
- Circular dependencies are detected and rejected
- Non-existent paths cause validation errors

**Automatic File/Directory Detection:**

- No need to add trailing `/` for directories
- The system uses `fs.stat()` to determine the type at runtime
- If a path doesn't exist, it's treated as a file dependency
- Results are cached to minimize file system access

### Common Use Cases

#### Go Applications

```yaml
app:
  name: web-app/cmd/api-server
  depends_on:
    - web-app/pkg # Shared Go packages (directory)
    - web-app/go.mod # Module dependencies (file)
    - web-app/go.sum # Dependency lock file (file)
```

#### Node.js Applications

```yaml
app:
  name: frontend/apps/dashboard
  depends_on:
    - frontend/packages/ui # Shared UI components (directory)
    - frontend/package.json # Root package.json (file)
    - frontend/yarn.lock # Yarn lock file (file)
```

#### Python Applications

```yaml
app:
  name: services/ml-worker
  depends_on:
    - services/common # Shared Python modules (directory)
    - services/requirements.txt # Pip dependencies (file)
    - services/pyproject.toml # Poetry config (file)
```

### Core Algorithm: Effective Timestamp Calculation

```typescript
const calculateEffectiveTimestamp = async (
  appPath: string,
  dependencies: string[],
  rootDir: string,
): Promise<CommitInfo> => {
  const appCommit = await getLastCommit(appPath);
  const timestamps = [appCommit.timestamp];

  for (const dep of dependencies) {
    const depPath = path.join(rootDir, dep);

    // Check if dependency exists
    if (!(await pathExists(depPath))) {
      throw new Error(`Dependency path does not exist: ${depPath}`);
    }

    // Get last commit for both files and directories
    const depCommit = await getLastCommit(depPath);
    timestamps.push(depCommit.timestamp);
  }

  const maxTimestamp = Math.max(...timestamps);

  // Return the commit info corresponding to the max timestamp
  // If max is from dependency, we need to get that commit's hash
  return maxTimestamp === appCommit.timestamp
    ? appCommit
    : await getCommitInfoByTimestamp(maxTimestamp, dependencies);
};

// Helper to check if path exists (file or directory)
const pathExists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
};
```

## Implementation Plan

### 1. Schema Updates

**File**: `packages/schema/src/index.ts`

```typescript
const AppSchema = z.object({
  name: z.string(),
  depends_on: z.array(z.string()).optional().default([]),
  // Future: support structured format
  // depends_on: z.union([
  //   z.array(z.string()),  // Simple format
  //   z.object({            // Structured format
  //     directories: z.array(z.string()).optional(),
  //     files: z.array(z.string()).optional(),
  //     patterns: z.array(z.string()).optional(),  // glob patterns
  //   })
  // ]).optional().default([]),
});
```

### 2. Load Jobs Action Updates

**File**: `actions/load-jobs/src/loadJobsFromLocalConfigs.ts`

#### Changes Required:

1. **Parse dependencies from config**:

```typescript
const dependencies = localConfig.app.depends_on || [];
```

2. **Validate dependencies**:
   - Check for circular dependencies
   - Ensure dependency paths exist
   - Prevent self-dependencies

3. **Replace getLastCommit call**:

```typescript
// Old:
const lastCommit = await getLastCommit(appPath);

// New:
const lastCommit = await calculateEffectiveTimestamp(
  appPath,
  dependencies,
  rootDir,
);
```

#### New Functions to Add:

```typescript
const validateDependencies = (
  appPath: string,
  dependencies: string[],
  rootDir: string,
): void => {
  // Circular dependency detection
  // Path existence validation
  // Self-dependency prevention
};

const calculateEffectiveTimestamp = async (
  appPath: string,
  dependencies: string[],
  rootDir: string,
): Promise<CommitInfo> => {
  // Implementation as described above
};
```

### 3. Filter by Changed Files Action Updates

**File**: `actions/filter-jobs-by-changed-files/src/run.ts`

#### Changes Required:

Update the filtering logic to include jobs whose dependencies have changed:

```typescript
// Old:
return jobs.filter(job => {
  return files
    .map(file => file.filename)
    .some(file => file.startsWith(job.context.app_path));
});

// New:
return jobs.filter(job => {
  const appPath = job.context.app_path;
  const dependencies = job.app.depends_on || [];

  return files
    .map(file => file.filename)
    .some(file => {
      // Check if file is in app path
      if (file.startsWith(appPath)) return true;

      // Check if file is in any dependency path
      return dependencies.some(dep => {
        const depPath = path.join(rootDir, dep);
        const isDirectory = fs.statSync(depPath).isDirectory();

        if (isDirectory) {
          // For directories, check if file is within
          return file.startsWith(depPath);
        } else {
          // For files, check exact match
          return file === depPath;
        }
      });
    });
});
```

**Note**: This action will need access to `rootDir` parameter, which should be passed from the workflow.

### 4. Error Handling and Validation

#### Circular Dependency Detection:

```typescript
const detectCircularDependencies = (
  configs: Map<string, LocalConfig>,
): void => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const [appName, config] of configs) {
    if (
      hasCircularDependency(appName, config, configs, visited, recursionStack)
    ) {
      throw new Error(`Circular dependency detected involving: ${appName}`);
    }
  }
};
```

#### Dependency Path Validation:

```typescript
const validateDependencyPaths = (
  dependencies: string[],
  rootDir: string,
): void => {
  for (const dep of dependencies) {
    const depPath = path.join(rootDir, dep);
    if (!fs.existsSync(depPath)) {
      throw new Error(`Dependency path does not exist: ${depPath}`);
    }
  }
};
```

## Workflow Integration

### Input Parameter Changes

The `filter-jobs-by-changed-files` action will need a new parameter:

```yaml
# In workflow
- uses: yuya-takeyama/monotonix/actions/filter-jobs-by-changed-files@add-depends-on
  with:
    root-dir: apps # Add this parameter
```

### Backward Compatibility

- Apps without `depends_on` field will work unchanged
- Empty `depends_on` array behaves like current behavior
- Existing workflows require minimal changes (just adding `root-dir` parameter)

## Testing Strategy

### Unit Tests

1. **Dependency Resolution**:
   - Test effective timestamp calculation with multiple dependencies
   - Test with dependencies having newer/older timestamps
   - Test with missing dependencies
   - Test with file dependencies (go.mod, package.json)
   - Test mixed file and directory dependencies

2. **Circular Dependency Detection**:
   - Test simple cycles (A → B → A)
   - Test complex cycles (A → B → C → A)
   - Test self-dependencies

3. **File Change Detection**:
   - Test direct app changes
   - Test directory dependency changes
   - Test file dependency changes (go.mod, go.sum)
   - Test changes in non-dependent paths
4. **Path Validation**:
   - Test with non-existent file paths
   - Test with non-existent directory paths
   - Test with relative vs absolute paths

### Integration Tests

1. **End-to-End Workflow**:
   - Create test monorepo with dependencies
   - Verify dependency changes trigger dependent jobs
   - Verify non-dependency changes don't trigger jobs

2. **DynamoDB State Integration**:
   - Verify state tracking works with effective timestamps
   - Test job skipping with dependency-based timestamps

## Performance Considerations

### Git Command Optimization

Current `getLastCommit` makes one git call per app. With file-level dependencies, this could become `O(apps × (directories + files))`.

**Optimization Strategies**:

1. **Batch Git Operations**:

```typescript
// Get all commits in a single git command
const getAllLastCommits = async (
  paths: string[],
): Promise<Map<string, CommitInfo>> => {
  // Use git log with multiple paths
  const cmd = `git log -1 --format=%H,%ct -- ${paths.join(' ')}`;
  // Parse and return results
};
```

2. **Intelligent Caching**:

```typescript
class CommitCache {
  private cache = new Map<string, CommitInfo>();

  async getLastCommit(path: string): Promise<CommitInfo> {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }
    const commit = await getLastCommit(path);
    this.cache.set(path, commit);
    return commit;
  }
}
```

3. **File vs Directory Optimization**:
   - For files: Direct git log on the file
   - For directories: Consider using git ls-tree for better performance
   - Cache file/directory type information to avoid repeated `fs.stat()` calls

### Scaling Considerations

- Limit number of dependencies per app (e.g., max 50)
- Warn when dependency count exceeds threshold
- Consider lazy evaluation for large dependency graphs

## Migration Path

### Phase 1: Schema and Core Logic

1. Update schema to support `depends_on`
2. Implement `calculateEffectiveTimestamp`
3. Add validation logic

### Phase 2: Action Updates

1. Update `load-jobs` action
2. Update `filter-jobs-by-changed-files` action
3. Add comprehensive error handling

### Phase 3: Testing and Documentation

1. Comprehensive unit and integration tests
2. Update documentation and examples
3. Create migration guide for existing projects

## Risk Analysis

### Potential Issues

1. **Performance Impact**: Multiple git calls for dependencies
   - **Mitigation**: Implement caching and batch operations

2. **Complex Dependency Graphs**: Large dependency trees could be hard to debug
   - **Mitigation**: Add logging for dependency resolution process

3. **Circular Dependencies**: Could cause infinite loops
   - **Mitigation**: Robust cycle detection before processing

4. **Timestamp Inconsistencies**: Git timestamp precision issues
   - **Mitigation**: Use commit hashes as tiebreakers

### Breaking Changes

- `filter-jobs-by-changed-files` action requires new `root-dir` parameter
- Minimal impact: workflows need one line addition

## Success Metrics

1. **Functional**: Dependencies correctly trigger dependent jobs
2. **Performance**: Workflow execution time increase < 20%
3. **Reliability**: No false positives/negatives in dependency detection
4. **Usability**: Clear error messages for misconfigurations

## Conclusion

The proposed dependency feature leverages Monotonix's existing timestamp-based architecture effectively. By calculating effective timestamps as the maximum across an app and its dependencies, we can trigger dependent jobs when dependencies change without major architectural changes.

The key improvements:

- **Clear semantics**: `depends_on` unambiguously refers to file system paths
- **Fine-grained control**: Support for both directory and file-level dependencies
- **Language agnostic**: Works with any monorepo structure (Go, Node.js, Python, etc.)
- **Minimal breaking changes**: Existing workflows need only minor updates

The implementation focuses on:

- Minimal breaking changes to existing workflows
- Robust validation and error handling
- Performance optimization through caching and batching
- Comprehensive testing strategy

This approach provides a clean, maintainable solution that integrates naturally with Monotonix's existing design patterns while solving real-world monorepo dependency challenges.
