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
└── filter-jobs-by-*        # 既存のフィルター系action

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

### Phase 3: External Tool Support (外部ツール連携)

1. メタデータを含むJobsのJSON出力
2. 外部ツール（Ruby, Bash + jq等）での処理を想定
3. 将来的な`monotonix-cli`への拡張性確保

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

#### Update: `actions/load-jobs/src/config.ts`

```typescript
import { GlobalConfigSchema } from '@monotonix/schema';
import { existsSync, readFileSync } from 'fs';
import { load } from 'js-yaml';

export function loadGlobalConfig(globalConfigFilePath: string) {
  // If global config file doesn't exist, return minimal config for backward compatibility
  if (!existsSync(globalConfigFilePath)) {
    return { job_types: {} };
  }

  // If file exists, parse it and let errors propagate properly
  // This ensures YAML syntax errors and schema validation errors are reported
  const globalConfigContent = readFileSync(globalConfigFilePath, 'utf-8');
  return GlobalConfigSchema.parse(load(globalConfigContent));
}
```

**Important**: Don't suppress errors! The schema already handles backward compatibility:

- `metadata_schemas` is optional - existing configs without it will validate fine
- Only suppress missing file (for backward compatibility)
- Report YAML syntax errors and schema validation errors properly

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

### Step 3: Update Existing Actions

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

2. **Integration Tests**
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
```

---

## 📊 Use Cases & Examples

### 1. External Tool Integration (Ruby)

```ruby
#!/usr/bin/env ruby
require 'json'

# Read jobs output from Monotonix
jobs = JSON.parse(STDIN.read)

# Filter by team
platform_jobs = jobs.select do |job|
  job.dig('app', 'metadata', 'team') == 'platform'
end

# Process filtered jobs
platform_jobs.each do |job|
  puts "Processing: #{job['context']['label']}"
  # Custom automation logic here
end
```

### 2. Bash + jq Integration

```bash
#!/bin/bash

# Get all jobs with high priority
echo "$JOBS_JSON" | jq '.[] | select(.metadata.priority == "critical")'

# Group by team
echo "$JOBS_JSON" | jq 'group_by(.app.metadata.team)'

# Extract specific metadata fields
echo "$JOBS_JSON" | jq -r '.[] | "\(.context.label): \(.app.metadata.owner)"'
```

### 3. Future monotonix-cli

```bash
# Potential future CLI tool
monotonix jobs list --filter-team platform
monotonix jobs list --filter-priority critical
monotonix jobs export --format csv --metadata team,owner,cost_center
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
3. Enable external tool integration via JSON output
4. Document and promote usage

---

## 📚 Dependencies

### New Dependencies

```json
{
  "ajv": "^8.12.0",
  "ajv-formats": "^2.1.1"
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
   - ✅ External tool integration via JSON output
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
   3. Testing and documentation

3. **Timeline Estimate**
   - Phase 1: 2-3 hours
   - Phase 2: 3-4 hours
   - Phase 3: 1-2 hours (documentation only)
   - Phase 4: 2-3 hours
   - **Total: ~8-12 hours**

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
   - 外部ツール連携はJSONそのまま出力

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
