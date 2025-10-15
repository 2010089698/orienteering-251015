import StepNavigation from './components/StepNavigation';
import SettingsForm from './components/SettingsForm';
import EntryForm from './components/EntryForm';
import EntryTable from './components/EntryTable';
import LaneAssignmentPanel from './components/LaneAssignmentPanel';
import ClassOrderPanel from './components/ClassOrderPanel';
import StartTimesPanel from './components/StartTimesPanel';
import SnapshotViewer from './components/SnapshotViewer';
import { useStartlistState } from './state/StartlistContext';
import type { StatusKey } from './state/types';

const steps: { id: StatusKey; title: string; description: string }[] = [
  { id: 'settings', title: '基本情報', description: 'イベント ID・開始時刻・インターバルを登録' },
  { id: 'entries', title: 'エントリー', description: '選手を追加し、一覧を管理' },
  { id: 'lanes', title: 'レーン割り当て', description: 'クラスをレーンに自動または手動で割り付け' },
  { id: 'classes', title: 'クラス順序', description: 'クラス内のスタート順を調整' },
  { id: 'startTimes', title: 'スタート時間', description: '積算で時間を算出し確定' },
  { id: 'snapshot', title: 'スナップショット', description: '現在のバックエンド状態' },
];

const App = (): JSX.Element => {
  const state = useStartlistState();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <h1>スタートリスト・ウィザード</h1>
          <p className="muted">バックエンド API に接続してスタートリストを作成します。</p>
        </div>
        <StepNavigation steps={steps} statuses={state.statuses} />
        <SnapshotViewer snapshot={state.snapshot} status={state.statuses.snapshot} onRefreshHint />
      </aside>
      <main className="content">
        <div className="section-grid two-columns">
          <div className="card">
            <SettingsForm />
          </div>
          <div className="card">
            <EntryForm />
            <EntryTable />
          </div>
        </div>
        <div className="section-grid two-columns">
          <div className="card">
            <LaneAssignmentPanel />
          </div>
          <div className="card">
            <ClassOrderPanel />
          </div>
        </div>
        <div className="card">
          <StartTimesPanel />
        </div>
      </main>
    </div>
  );
};

export default App;
