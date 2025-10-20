# EventManagement

## コンテキスト概要
EventManagement は、オリエンテーリング大会全体のイベント情報（大会名、開催地、日程、競技種目など）を統合管理するための新しいバウンデッドコンテキストです。大会のライフサイクルに合わせた基本情報の登録・更新・公開準備を行うアプリケーション層を提供し、他コンテキスト（StartlistManagement や EntryManagement）から参照しやすい形でデータを共有することを目的としています。初期段階ではインメモリ実装とシンプルなユースケースのみを備え、今後の発展で外部システム連携や公式サイト向けエクスポートを担う想定です。

## レイヤ構成
- **Domain**: イベント定義の検証や不変条件（大会名・開始日時・会場名など）を表現します。
- **Application**: イベント登録ユースケースとイベント一覧クエリを提供します。レポジトリ経由でドメインを操作します。
- **Infrastructure**: アプリケーション層が利用するリポジトリ実装（インメモリ）とモジュール初期化を担います。
- **Adapters (HTTP)**: アプリケーション層を HTTP ハンドラへ橋渡しするための軽量なルーティングアダプタを定義します。Fastify などのサーバーフレームワークと組み合わせて利用できます。

各レイヤは TypeScript のプロジェクトリファレンスを利用して分離されており、`tsc -b` コマンドで依存関係順にビルドされます。共通の TypeScript 設定は `configs/tsconfig/base.json` で管理しています。

## 開発サーバーの起動

`EventManagement/apps/backend` には Fastify 製の HTTP エントリポイントが用意されています。ローカルで API を確認する場合はルートまたは EventManagement ディレクトリ直下で次のコマンドを実行してください。

```bash
npm run dev:event-backend
```

デフォルトでは `http://localhost:3002` で起動します。StartlistManagement とレーススケジュール同期を行いたい場合は、環境変数 `STARTLIST_SYNC_BASE_URL` に StartlistManagement API のベース URL を指定した上でコマンドを実行してください。
