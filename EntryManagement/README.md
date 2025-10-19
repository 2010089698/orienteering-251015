# EntryManagement

エントリー登録ワークフローを Fastify + TypeScript で提供するバックエンドサービスのパッケージ群です。`apps/backend` の HTTP サーバーから呼び出され、エントリーの登録・照会 API を構築します。

## レイヤ構成

### `packages/domain`
- `Entry` 集約が登録済みのエントリー情報とドメインイベントを管理します。`Entry.register` で登録時イベントを発行し、スナップショットの再生成も行います。
- `EntryFactory` がエントリー ID を生成し、現在時刻を利用して登録処理を組み立てます。

### `packages/application`
- `EntryCommandBase` がトランザクションマネージャとイベントパブリッシャーを協調させ、エントリー集約の永続化後にドメインイベントを取り出して送出します。将来的に追加されるコマンドサービスもこの基盤を継承することで、イベント発行のタイミングと失敗時のふるまいを統一できます。
- `RegisterEntryService` がユースケースとしてファクトリとリポジトリを協調させ、`EntryCommandBase` 経由で登録・イベント発行・DTO 変換を行います。
- `EntryQueryServiceImpl` がリポジトリから取得した集約を DTO に変換し、一覧・詳細の読み取りを提供します。

### `packages/infrastructure`
- `createEntryModule` がインメモリリポジトリ、シンプルトランザクションマネージャ、ドメインイベントバスを組み合わせ、ユースケースとクエリサービスを初期化します。
- `InMemoryEntryRepository` がエントリーのスナップショットを保持し、集約の保存・再構築・一覧を提供します。
- `DomainEventBus` がアプリケーションイベント発行の実装として購読者へドメインイベントを通知します。
- `SimpleTransactionManager` は非同期処理をそのまま実行する最小実装で、トランザクション境界の抽象化を担います。

### `packages/adapters-http`
- `createServer` が TypeBox 対応の Fastify インスタンスを生成し、エントリールートを登録します。
- `entryRoutes` が `/api/entries` 配下の GET/POST エンドポイントとバリデーション、エラーハンドリングを定義します。

## アプリケーション起動フロー

1. `apps/backend/src/start.ts` が `createEntryModule` を呼び出し、ユースケースとクエリサービスを組み合わせたモジュールを生成します。
2. 生成したモジュールを `createServer` に渡して Fastify サーバーを構築し、ログ出力の有無を設定します。
3. `PORT`・`HOST` 環境変数を解決した上で `server.listen` を実行し、HTTP API を起動します。失敗時はロガーにエラーを出力してプロセスを終了します。

詳細な利用手順や共通のセットアップについては、リポジトリ直下の [README](../README.md) を参照してください。
