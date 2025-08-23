# Monotonix Metadata Feature - PRD & Implementation Plan

## 💡 Executive Summary

アプリケーションとジョブに任意のメタデータを持たせることで、リポジトリ内でのアプリケーションのフィルタリング、自動化、管理を可能にする機能を実装する。

### Key Features

- アプリケーション単位のメタデータ（オーナーシップ、ドキュメント、チーム情報など）
- ジョブ単位のメタデータ（優先度、アラート設定、リトライ設定など）
- `monotonix-global.yaml`でのスキーマ定義による型安全性
- 完全な後方互換性

---

## 📋 Background & Motivation

### 現在の課題

1. **アプリケーション管理の困難さ**
   - チームオーナーシップが不明確
   - Design Docやドキュメントへのリンクが散在
   - アプリケーションの重要度・ティアが不明

2. **CI/CDパイプラインの最適化不足**
   - 全ジョブが同じ優先度で実行される
   - チーム別・用途別のフィルタリングができない
   - 失敗時のアラート設定が一律

3. **コンプライアンス・ガバナンスの欠如**
   - データ分類レベルが不明
   - コンプライアンス要件の管理が困難
   - コスト管理情報の欠如

### ユーザーの要求

- 特定の属性を持つアプリケーションをフィルタリングしたい
- チーム別・優先度別にデプロイメントを制御したい
- メタデータを元に自動化を構築したい

---

## 🔍 Current Implementation Analysis

### 調査結果

#### 1. 既存実装の確認

- **メタデータ機能は未実装**であることを確認
- `packages/schema/src/index.ts`を確認し、現在のスキーマ構造を把握
- `LocalConfigSchema`と`JobSchema`にメタデータフィールドは存在しない

#### 2. 関連ファイル構造

```
actions/
├── load-jobs/              # メタデータの読み込みと検証を追加
├── filter-jobs-by-*        # 既存のフィルター系action
└── (new) filter-jobs-by-metadata/  # 新規作成予定

packages/
└── schema/                 # スキーマ定義の拡張
```

#### 3. 既存のデータフロー

1. `load-jobs`: `monotonix.yaml`を読み込み、Jobオブジェクトを生成
2. `filter-jobs-by-changed-files`: 変更されたファイルでフィルタ
3. `filter-jobs-by-dynamodb-state`: 実行状態でフィルタ
4. `load-docker-build-job-params`: グローバル設定からパラメータを注入

---

## 🎯 Proposed Solution

### 設計方針

1. **完全な自由度**: 標準フィールドを定義せず、ユーザーが自由にメタデータを定義
2. **オプトイン型検証**: スキーマ定義は任意、必要に応じて厳格な検証を追加可能
3. **段階的導入**: 既存のワークフローを壊さない後方互換性
4. **中央集権的管理**: `monotonix-global.yaml`でスキーマを一元管理

### 設定例

#### monotonix-global.yaml

```yaml
# 既存の設定
job_types:
  docker_build:
    registries:
      # ... 既存の設定 ...

# 新機能：メタデータスキーマ定義（オプション）
metadata_schemas:
  app:
    type: object
    required: [team, owner]
    properties:
      team:
        type: string
        enum: [platform, backend, frontend, ml, data, devops]
      owner:
        type: string
        pattern: '^@[a-zA-Z0-9-]+$' # GitHub username format
      tier:
        type: integer
        minimum: 1
        maximum: 3
      cost_center:
        type: string
        pattern: "^[A-Z]{3}-\\d{4}$"
      slack_channel:
        type: string
        pattern: '^#[a-z0-9-]+$'
      design_doc:
        type: string
        format: uri
      compliance:
        type: array
        items:
          type: string
          enum: [pci-dss, sox, gdpr, hipaa]
    additionalProperties: true # 追加フィールドを許可

  job:
    type: object
    properties:
      priority:
        type: string
        enum: [critical, high, medium, low]
      alert_on_failure:
        type: boolean
      retry_count:
        type: integer
        minimum: 0
        maximum: 5
      timeout_minutes:
        type: integer
        minimum: 1
        maximum: 360
      notifications:
        type: array
        items:
          type: object
          required: [type, target]
          properties:
            type:
              type: string
              enum: [slack, email, pagerduty]
            target:
              type: string
    additionalProperties: true
```

#### monotonix.yaml (アプリケーション設定)

```yaml
app:
  depends_on: []
  metadata: # 新機能
    team: platform
    owner: '@yuya-takeyama'
    tier: 1
    cost_center: ENG-2024
    slack_channel: '#platform-alerts'
    design_doc: https://docs.example.com/design/payment-service
    compliance: [pci-dss, sox]
    custom_field: any_value # additionalPropertiesで許可

jobs:
  build_prd:
    on:
      push:
        branches: [main]
    configs:
      docker_build:
        registry:
          type: aws
          aws:
            iam: prd
            repository: prd
    metadata: # 新機能
      priority: critical
      alert_on_failure: true
      retry_count: 3
      timeout_minutes: 30
      notifications:
        - type: slack
          target: '#platform-alerts'
        - type: pagerduty
          target: platform-oncall
```

---

## 📐 Implementation Plan

### Phase 1: Schema Extension (基盤整備)

1. `packages/schema/src/index.ts`の拡張
2. メタデータフィールドの追加
3. グローバル設定スキーマの拡張

### Phase 2: Load & Validation (読み込みと検証)

1. `actions/load-jobs`での検証ロジック実装
2. JSON Schema (AJV)による検証機能
3. エラーハンドリングとメッセージ改善

### Phase 3: Filtering Action (フィルタリング機能)

1. `actions/filter-jobs-by-metadata`の新規作成
2. JSONPathまたはlodashベースのフィルタリング
3. 複雑なクエリのサポート

### Phase 4: Testing & Documentation

1. 各コンポーネントのユニットテスト
2. インテグレーションテスト
3. ドキュメント更新

---

## 🔧 Detailed Implementation Steps

### Step 1: Update Schema Package

#### File: `packages/schema/src/index.ts`

```typescript
import { z } from 'zod';

// 既存のスキーマ...

// 新規追加：メタデータスキーマ（完全に自由形式）
const MetadataSchema = z.record(z.any());

// グローバル設定スキーマの拡張
export const GlobalConfigSchema = z.object({
  job_types: z.record(z.string(), z.object({}).passthrough()),
  // 新規追加
  metadata_schemas: z
    .object({
      app: z.record(z.any()).optional(),
      job: z.record(z.any()).optional(),
    })
    .optional(),
});

// AppSchemaの更新
const AppSchema = z.object({
  depends_on: z.array(z.string()).optional().default([]),
  metadata: MetadataSchema.optional(), // 新規追加
});

// LocalConfigJobSchemaの更新
const LocalConfigJobSchema = z.object({
  on: JobEventSchema,
  configs: JobConfigsSchema,
  metadata: MetadataSchema.optional(), // 新規追加
});

// JobSchemaの更新（app内のmetadataも伝播）
export const JobSchema = z.object({
  app: AppSchema,
  context: ContextSchema,
  on: JobEventSchema,
  configs: JobConfigsSchema,
  params: JobParamsSchema,
  metadata: MetadataSchema.optional(), // ジョブ自体のメタデータ
});
```

### Step 2: Add Validation Logic

#### New File: `actions/load-jobs/src/validateMetadata.ts`

```typescript
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { GlobalConfig, Job, Jobs } from '@monotonix/schema';

export class MetadataValidator {
  private ajv: Ajv;
  private appValidator?: ValidateFunction;
  private jobValidator?: ValidateFunction;

  constructor(globalConfig: GlobalConfig) {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    if (globalConfig.metadata_schemas?.app) {
      this.appValidator = this.ajv.compile(globalConfig.metadata_schemas.app);
    }

    if (globalConfig.metadata_schemas?.job) {
      this.jobValidator = this.ajv.compile(globalConfig.metadata_schemas.job);
    }
  }

  validateJobs(jobs: Jobs): void {
    const errors: string[] = [];

    for (const job of jobs) {
      // Validate app metadata
      if (this.appValidator && job.app.metadata) {
        if (!this.appValidator(job.app.metadata)) {
          errors.push(
            `Invalid app metadata for ${job.context.app_path}: ${this.ajv.errorsText(this.appValidator.errors)}`,
          );
        }
      }

      // Validate job metadata
      if (this.jobValidator && job.metadata) {
        if (!this.jobValidator(job.metadata)) {
          errors.push(
            `Invalid job metadata for ${job.context.label}: ${this.ajv.errorsText(this.jobValidator.errors)}`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Metadata validation failed:\n${errors.join('\n')}`);
    }
  }
}
```

#### Update: `actions/load-jobs/src/index.ts`

```typescript
// 既存のインポート...
import { MetadataValidator } from './validateMetadata';

const main = async () => {
  // 既存のコード...

  // グローバル設定の読み込み
  const globalConfigPath =
    getInput('global-config-file-path') || 'monotonix-global.yaml';
  const globalConfig = await loadGlobalConfig(globalConfigPath);

  // ジョブの読み込み
  const jobs = await run({
    rootDir,
    dedupeKey,
    requiredConfigKeys,
    localConfigFileName,
    event,
  });

  // 新規追加：メタデータ検証
  if (globalConfig.metadata_schemas) {
    const validator = new MetadataValidator(globalConfig);
    validator.validateJobs(jobs);
  }

  // 既存のコード...
};
```

### Step 3: Create Filter Action

#### New Action: `actions/filter-jobs-by-metadata/`

##### `action.yml`

```yaml
name: 'Filter Jobs by Metadata'
description: 'Filter jobs based on metadata conditions'
inputs:
  jobs:
    description: 'JSON string of jobs array'
    required: true
  filter:
    description: 'JSON string of filter conditions'
    required: false
  query:
    description: 'JSONPath query string'
    required: false
outputs:
  jobs:
    description: 'Filtered jobs as JSON string'
runs:
  using: 'node20'
  main: 'dist/index.js'
```

##### `src/index.ts`

```typescript
import * as core from '@actions/core';
import { Jobs, JobsSchema } from '@monotonix/schema';
import { filterByMetadata } from './filterByMetadata';

const main = async () => {
  try {
    const jobsInput = core.getInput('jobs', { required: true });
    const filterInput = core.getInput('filter');
    const queryInput = core.getInput('query');

    const jobs = JobsSchema.parse(JSON.parse(jobsInput));

    let filteredJobs: Jobs = jobs;

    if (filterInput) {
      const filter = JSON.parse(filterInput);
      filteredJobs = filterByMetadata(jobs, filter);
    } else if (queryInput) {
      // JSONPath query support
      filteredJobs = filterByQuery(jobs, queryInput);
    }

    core.setOutput('jobs', JSON.stringify(filteredJobs));
  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
};

main();
```

##### `src/filterByMetadata.ts`

```typescript
import { Jobs } from '@monotonix/schema';
import { get, isMatch } from 'lodash';

export function filterByMetadata(
  jobs: Jobs,
  filter: Record<string, any>,
): Jobs {
  return jobs.filter(job => {
    // Check app metadata
    if (filter.app?.metadata) {
      if (!job.app.metadata) return false;
      if (!isMatch(job.app.metadata, filter.app.metadata)) return false;
    }

    // Check job metadata
    if (filter.job?.metadata) {
      if (!job.metadata) return false;
      if (!isMatch(job.metadata, filter.job.metadata)) return false;
    }

    // Direct metadata check (backward compatibility)
    if (filter.metadata) {
      const combinedMetadata = {
        ...job.app.metadata,
        ...job.metadata,
      };
      if (!isMatch(combinedMetadata, filter.metadata)) return false;
    }

    return true;
  });
}

export function filterByQuery(jobs: Jobs, query: string): Jobs {
  // JSONPath implementation
  // Example: $..[?(@.metadata.team == "platform")]
  // Implementation details...
}
```

### Step 4: Update Existing Actions

#### `actions/load-jobs/src/loadJobsFromLocalConfigs.ts`

```typescript
// createJob関数の更新
export const createJob = ({
  localConfig,
  dedupeKey,
  appPath,
  lastCommit,
  jobKey,
  job,
  event,
  rootDir,
}: CreateJobOptions): Job => ({
  ...job,
  app: localConfig.app || { depends_on: [] },
  context: {
    dedupe_key: dedupeKey,
    github_ref: event.ref,
    app_path: appPath,
    root_dir: rootDir,
    job_key: jobKey,
    last_commit: lastCommit,
    label: `${extractAppLabel(appPath, rootDir)} / ${jobKey}`,
  },
  params: {},
  metadata: job.metadata, // ジョブのメタデータを伝播
});
```

---

## 🧪 Test Cases

### Unit Tests

1. **Schema Validation Tests**
   - Valid metadata acceptance
   - Invalid metadata rejection
   - Missing required fields detection
   - Additional properties handling

2. **Filter Tests**
   - Single field filtering
   - Nested field filtering
   - Multiple condition filtering
   - JSONPath query tests

3. **Integration Tests**
   - Full pipeline with metadata
   - Backward compatibility
   - Global config loading
   - Error handling

### Example Test Cases

```typescript
// packages/schema/src/index.test.ts
describe('Metadata Schema', () => {
  it('should accept valid app metadata', () => {
    const config = {
      app: {
        depends_on: [],
        metadata: {
          team: 'platform',
          owner: '@yuya-takeyama',
          custom: 'value',
        },
      },
      jobs: {},
    };
    expect(() => LocalConfigSchema.parse(config)).not.toThrow();
  });

  it('should accept missing metadata', () => {
    const config = {
      app: { depends_on: [] },
      jobs: {},
    };
    expect(() => LocalConfigSchema.parse(config)).not.toThrow();
  });
});

// actions/filter-jobs-by-metadata/src/filterByMetadata.test.ts
describe('filterByMetadata', () => {
  it('should filter jobs by team', () => {
    const jobs = [
      { app: { metadata: { team: 'platform' } } },
      { app: { metadata: { team: 'backend' } } },
    ];
    const filter = { app: { metadata: { team: 'platform' } } };
    const result = filterByMetadata(jobs, filter);
    expect(result).toHaveLength(1);
    expect(result[0].app.metadata.team).toBe('platform');
  });
});
```

---

## 📊 Use Cases & Examples

### 1. Team-based Deployment

```yaml
# GitHub Actions workflow
- uses: ./actions/filter-jobs-by-metadata
  with:
    jobs: ${{ steps.load.outputs.jobs }}
    filter: |
      {
        "app": {
          "metadata": {
            "team": "platform"
          }
        }
      }
```

### 2. Priority-based Execution

```yaml
# High priority jobs only
- uses: ./actions/filter-jobs-by-metadata
  with:
    jobs: ${{ steps.load.outputs.jobs }}
    filter: |
      {
        "metadata": {
          "priority": "critical"
        }
      }
```

### 3. Compliance Filtering

```yaml
# PCI-DSS compliant apps
- uses: ./actions/filter-jobs-by-metadata
  with:
    jobs: ${{ steps.load.outputs.jobs }}
    query: '$..[?("pci-dss" in @.app.metadata.compliance)]'
```

### 4. Cost Center Reporting

```typescript
// Generate report by cost center
const costCenters = new Map();
for (const job of jobs) {
  const center = job.app.metadata?.cost_center;
  if (center) {
    costCenters.set(center, (costCenters.get(center) || 0) + 1);
  }
}
```

---

## ⚠️ Risks & Mitigations

### Risks

1. **Schema Breaking Changes**
   - Risk: Existing workflows might break
   - Mitigation: All metadata fields are optional, complete backward compatibility

2. **Performance Impact**
   - Risk: Validation overhead
   - Mitigation: Validation only runs when schemas are defined

3. **Complexity Increase**
   - Risk: Learning curve for users
   - Mitigation: Progressive enhancement, works without any configuration

### Migration Strategy

1. Deploy schema changes (no impact on existing users)
2. Add validation logic (skipped if no schema defined)
3. Create filter action (opt-in usage)
4. Document and promote usage

---

## 📚 Dependencies

### New Dependencies

```json
{
  "ajv": "^8.12.0",
  "ajv-formats": "^2.1.1",
  "lodash": "^4.17.21",
  "jsonpath-plus": "^7.2.0"
}
```

### Existing Dependencies

- All existing packages remain unchanged
- No breaking changes to existing APIs

---

## 🎯 Success Criteria

1. **Functional Requirements**
   - ✅ Apps and jobs can have arbitrary metadata
   - ✅ Optional schema validation via global config
   - ✅ Metadata-based filtering capability
   - ✅ Complete backward compatibility

2. **Non-Functional Requirements**
   - ✅ No performance degradation for existing workflows
   - ✅ Clear error messages for validation failures
   - ✅ Comprehensive test coverage (>80%)
   - ✅ Updated documentation

3. **User Experience**
   - ✅ Zero configuration to get started
   - ✅ Progressive enhancement path
   - ✅ Intuitive API design

---

## 🚀 Next Steps

1. **Immediate Actions**
   - Review and approve this PRD
   - Set up development environment
   - Begin Phase 1 implementation

2. **Implementation Order**
   1. Schema package updates
   2. Load-jobs validation
   3. Filter action creation
   4. Testing and documentation

3. **Timeline Estimate**
   - Phase 1: 2-3 hours
   - Phase 2: 3-4 hours
   - Phase 3: 2-3 hours
   - Phase 4: 2-3 hours
   - **Total: ~10-13 hours**

---

## 💬 Implementation Notes for Next Session

### 重要な実装ポイント

1. **必ずnpm run buildとnpm run testはルートディレクトリから実行**
   - Turboがキャッシュと依存関係を管理
   - 個別パッケージでのビルドは避ける

2. **コミット時の注意**
   - dist/ディレクトリも必ずコミットに含める
   - GitHub Actionsで直接実行されるため

3. **テストファースト開発**
   - 各機能追加前にテストケースを作成
   - 既存のテストが壊れないことを確認

4. **段階的実装**
   - まずスキーマ拡張から始める
   - 検証ロジックは後から追加可能
   - フィルター機能は独立して開発可能

5. **エラーハンドリング**
   - 明確なエラーメッセージ
   - スキーマ検証エラーは詳細を表示
   - デバッグしやすいログ出力

### ファイル変更チェックリスト

- [ ] `packages/schema/src/index.ts` - スキーマ拡張
- [ ] `packages/schema/src/index.test.ts` - スキーマテスト
- [ ] `actions/load-jobs/src/validateMetadata.ts` - 新規作成
- [ ] `actions/load-jobs/src/index.ts` - 検証呼び出し追加
- [ ] `actions/load-jobs/src/loadJobsFromLocalConfigs.ts` - メタデータ伝播
- [ ] `actions/filter-jobs-by-metadata/` - 新規Action作成
- [ ] 各actionのdist/ディレクトリ - ビルド結果

### 参考コマンド

```bash
# 開発時のコマンド
npm run build          # 全体ビルド
npm run test           # 全体テスト
npm run lint           # リント実行

# Git操作
git add .
git commit -m 'feat: add metadata support for apps and jobs'
git push -u origin yuya-takeyama/feat/metadata-support

# PR作成
gh pr create --draft --title "feat: Add metadata support for apps and jobs" --body "..."
```

---

これで次のセッションのきらりちゃんが完璧に実装できるはず！！ 💪✨
頑張ってね〜！！ 😍
