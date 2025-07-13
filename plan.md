# Monotonix Dependency Feature Design Plan

## Overview

This document outlines the design and implementation plan for adding dependency support to Monotonix. The goal is to enable apps to declare dependencies on other parts of the monorepo, such that changes in dependencies trigger builds for dependent apps.

## Problem Statement

Currently, Monotonix uses directory-based change detection. If files in `apps/foo/cmd/server` change, only the `server` job runs. However, if `server` depends on `apps/foo/pkg/logger`, changes to `logger` should also trigger the `server` job.

### Example Scenario
```
apps/foo/
├── cmd/server/     # depends on logger
├── pkg/logger/     # shared package
└── go.mod         # single module
```

When `logger` changes, `server` should be rebuilt even though no files directly in `cmd/server` were modified.

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

### Schema Changes

Add `depends_on` field to the app configuration:

```yaml
# monotonix.yaml
app:
  name: foo/cmd/server
  depends_on:
    - foo          # depends on apps/foo (includes pkg/logger)
    - shared/utils # depends on apps/shared/utils
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
- `foo` resolves to `apps/foo/`
- Self-dependencies are ignored (app cannot depend on itself)
- Circular dependencies are detected and rejected

### Core Algorithm: Effective Timestamp Calculation

```typescript
const calculateEffectiveTimestamp = async (
  appPath: string, 
  dependencies: string[], 
  rootDir: string
): Promise<CommitInfo> => {
  const appCommit = await getLastCommit(appPath);
  const timestamps = [appCommit.timestamp];
  
  for (const dep of dependencies) {
    const depPath = path.join(rootDir, dep);
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
```

## Implementation Plan

### 1. Schema Updates

**File**: `node_modules/@monotonix/schema/src/index.ts`

```typescript
const AppSchema = z.object({
  name: z.string(),
  depends_on: z.array(z.string()).optional().default([]),
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
  rootDir
);
```

#### New Functions to Add:

```typescript
const validateDependencies = (
  appPath: string, 
  dependencies: string[], 
  rootDir: string
): void => {
  // Circular dependency detection
  // Path existence validation
  // Self-dependency prevention
};

const calculateEffectiveTimestamp = async (
  appPath: string, 
  dependencies: string[], 
  rootDir: string
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
        return file.startsWith(depPath);
      });
    });
});
```

**Note**: This action will need access to `rootDir` parameter, which should be passed from the workflow.

### 4. Error Handling and Validation

#### Circular Dependency Detection:
```typescript
const detectCircularDependencies = (
  configs: Map<string, LocalConfig>
): void => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  for (const [appName, config] of configs) {
    if (hasCircularDependency(appName, config, configs, visited, recursionStack)) {
      throw new Error(`Circular dependency detected involving: ${appName}`);
    }
  }
};
```

#### Dependency Path Validation:
```typescript
const validateDependencyPaths = (
  dependencies: string[], 
  rootDir: string
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
    root-dir: apps  # Add this parameter
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

2. **Circular Dependency Detection**:
   - Test simple cycles (A → B → A)
   - Test complex cycles (A → B → C → A)
   - Test self-dependencies

3. **File Change Detection**:
   - Test direct app changes
   - Test dependency changes
   - Test changes in non-dependent paths

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

Current `getLastCommit` makes one git call per app. With dependencies, this could become `O(apps × dependencies)`. 

**Optimization Strategy**:
```typescript
// Batch git operations
const getAllLastCommits = async (paths: string[]): Promise<Map<string, CommitInfo>> => {
  // Single git command to get timestamps for all paths
  const results = new Map();
  
  for (const path of paths) {
    const commit = await getLastCommit(path);
    results.set(path, commit);
  }
  
  return results;
};
```

### Caching Strategy

Cache commit info within a single workflow run to avoid redundant git calls for shared dependencies.

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

The implementation focuses on:
- Minimal breaking changes to existing workflows
- Robust validation and error handling
- Performance optimization through caching and batching
- Comprehensive testing strategy

This approach provides a clean, maintainable solution that integrates naturally with Monotonix's existing design patterns.