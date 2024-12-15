
# Monotonix: 設定ファイルの設計と例

---

## 設計概要

### **1. Config Loaders**

- **Global Config**: 環境全体に共通する設定。
  - Docker レジストリや IAM ロールなどを定義。
- **Local Config**: アプリケーションごとの設定。
  - 各アプリケーションに特化したトリガーやビルド構成を記述。

### **2. Build Matrix**

- GitHub Actions のイベント情報を基に Build Matrix を生成。
- Config Loader ごとに `generate-*-matrix` アクションを作成。
- DynamoDB などの永続化は別アクションとして分離。

---

## Global Config 例

```yaml
loaders:
  docker:
    identities:
      stg-pr:
        aws:
          iam-role: arn:aws:iam::615299752259:role/monotonix-builder-pr
          region: ap-northeast-1
      stg-main:
        aws:
          iam-role: arn:aws:iam::615299752259:role/monotonix-builder-main
          region: ap-northeast-1
      prd:
        aws:
          iam-role: arn:aws:iam::920373013500:role/monotonix-builder
          region: ap-northeast-1

    registries:
      stg-pr:
        aws:
          identity: stg-pr
          region: ap-northeast-1
          repository-base: 615299752259.dkr.ecr.ap-northeast-1.amazonaws.com/monotonix-pr
      stg-main:
        aws:
          identity: stg-main
          region: ap-northeast-1
          repository-base: 615299752259.dkr.ecr.ap-northeast-1.amazonaws.com/monotonix
      prd:
        aws:
          identity: prd
          region: ap-northeast-1
          repository-base: 920373013500.dkr.ecr.ap-northeast-1.amazonaws.com/monotonix
```

---

## Local Config 例

### **Docker Build 設定例**

```yaml
build:
  - on:
      pull_request:
    docker:
      registry: stg-pr
      tagging: pull_request
      platforms:
        - linux/amd64
  - on:
      push:
        branches:
          - main
    docker:
      registry: stg-main
      tagging: always_latest
      platforms:
        - linux/amd64
  - on:
      push:
        branches:
          - main
    docker:
      registry: prd
      tagging: semver_datetime
      platforms:
        - linux/amd64
```

---

## Build Matrix の生成例

### **出力例**

```json
[
  {
    "event": {
      "type": "push",
      "branch": "main"
    },
    "job": {
      "type": "docker",
      "config": {
        "environment_type": "aws",
        "identity": {
          "iam_role": "arn:aws:iam::920373013500:role/monotonix-builder",
          "region": "ap-northeast-1"
        },
        "registry": {
          "type": "private"
        },
        "tags": "semver_datetime"
      }
    },
    "keys": [
      ["job_type", "docker"],
      ["event_type", "push"],
      ["event_ref", "refs/heads/main"]
    ],
    "committed_at": 1731227345,
    "path": "apps/hello-world"
  }
]
```

---

## 結論

Monotonix の設定ファイル設計は、Config Loaders を活用した柔軟性と GitHub Actions の Build Matrix を最大限に活用するシンプルさを組み合わせています。この設計は、デプロイ対象が多様であっても効率的かつ再現性のあるデプロイパイプラインを実現します。
