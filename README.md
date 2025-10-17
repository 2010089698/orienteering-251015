# Orienteering Monorepo

このリポジトリは、オリエンテーリング大会運営に関する学習用サービス群を monorepo 形式で管理しています。`StartlistManagement` がスタートリスト関連のドメインモデルと API を提供し、`EntryManagement` がエントリー登録向けのバックエンドを構成しています。共通フロントエンドは `apps/frontend` 配下にまとめられています。

## ワークスペース構成

| パス | 役割 |
| ---- | ---- |
| `apps/backend` | EntryManagement の Fastify HTTP エントリポイント。`EntryManagement/packages/*` を組み合わせた API サーバーを起動します。 |
| `apps/frontend` | Vite + React 製のスタートリスト操作 UI。`StartlistManagement` のユースケースを呼び出すワークフローを提供します。 |
| `apps/shared-ui-components` | フロントエンド間で共有する UI コンポーネント群。 |
| `StartlistManagement` | スタートリストドメインの各レイヤ（domain/application/infrastructure/http 等）を収めたパッケージ群。詳細は [StartlistManagement/README.md](./StartlistManagement/README.md) を参照してください。 |
| `EntryManagement` | エントリー登録ドメインのレイヤ構造（domain/application/infrastructure/adapters-http）を提供します。レイヤ概要は [EntryManagement/README.md](./EntryManagement/README.md) にまとめています。 |

## 共通セットアップ

### 前提

- Node.js 20.x（LTS）
- npm 10 以上

### 依存関係のインストール

```bash
npm install
```

Monorepo のルートで実行すると、すべてのワークスペースの依存関係が解決されます。

### サービスの起動

- StartlistManagement のバックエンド API（Fastify）
  ```bash
  npm run dev:backend --workspace startlist-management
  ```
- StartlistManagement のフロントエンド（Vite）
  ```bash
  npm run dev --workspace @orienteering/startlist-frontend
  ```
  必要に応じて `apps/frontend/.env` などで `VITE_STARTLIST_API_BASE_URL` を設定し、バックエンドのベース URL を指定します。
- EntryManagement のバックエンド API
  ```bash
  npm run start --workspace @entry-management/backend
  ```

### テスト

- StartlistManagement のテスト
  ```bash
  npm test --workspace startlist-management
  ```
- Startlist フロントエンドのテスト
  ```bash
  npm run test --workspace @orienteering/startlist-frontend
  ```

## ドキュメント

- [StartlistManagement ドメイン詳細](./StartlistManagement/README.md#startlistmanagement-ドメイン詳細)
- [EntryManagement レイヤ概要と起動フロー](./EntryManagement/README.md)
