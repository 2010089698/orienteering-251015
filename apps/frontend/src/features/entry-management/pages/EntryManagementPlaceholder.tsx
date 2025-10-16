import { useEffect, useState } from 'react';
import { useEntryManagementApi } from '../api/useEntryManagementApi';

type EntrySummary = {
  id: string;
  name: string;
  club?: string;
};

const EntryManagementPlaceholder = (): JSX.Element => {
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const api = useEntryManagementApi();

  useEffect(() => {
    api
      .fetchEntries()
      .then((data) => setEntries(data))
      .catch((error) => {
        console.error('Failed to fetch entries from mocked API.', error);
        setEntries([]);
      });
  }, [api]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>エントリー管理 (準備中)</h1>
          <p className="muted">バックエンド連携が整い次第、本画面からエントリー一覧を確認できるようになります。</p>
        </div>
      </header>
      <main className="content">
        <div className="card">
          <p>現在はモック API を通じて {entries.length} 件のエントリーを読み込んでいます。</p>
          <pre>{JSON.stringify(entries, null, 2)}</pre>
        </div>
      </main>
    </div>
  );
};

export default EntryManagementPlaceholder;
