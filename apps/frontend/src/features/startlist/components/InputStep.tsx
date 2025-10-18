import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import SettingsForm, { type SettingsFormHandle } from './SettingsForm';
import EntryForm from './EntryForm';
import EntryTablePanel from './EntryTablePanel';
import {
  createStatus,
  setStatus,
  updateLaneAssignments,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { generateLaneAssignments } from '../utils/startlistUtils';

type InputStepProps = {
  onComplete: () => void;
};

const InputStep = ({ onComplete }: InputStepProps): JSX.Element => {
  const { entries, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const [activeTab, setActiveTab] = useState<string>('all');
  const settingsFormRef = useRef<SettingsFormHandle>(null);

  const { tabs, classIds } = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      const key = entry.classId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const sortedClassIds = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'ja'));
    const tabList = [
      { id: 'all', label: 'すべて', count: entries.length },
      ...sortedClassIds.map((classId) => ({ id: classId, label: classId, count: counts.get(classId) ?? 0 })),
    ];
    return { tabs: tabList, classIds: sortedClassIds };
  }, [entries]);

  useEffect(() => {
    if (activeTab !== 'all' && !classIds.includes(activeTab)) {
      setActiveTab('all');
    }
  }, [activeTab, classIds]);

  const filteredEntries = useMemo(
    () => (activeTab === 'all' ? entries : entries.filter((entry) => entry.classId === activeTab)),
    [activeTab, entries],
  );

  const handleComplete = () => {
    const nextSettings = settingsFormRef.current?.validateAndSave();

    if (!nextSettings) {
      return;
    }
    if (!entries.length) {
      setStatus(dispatch, 'lanes', createStatus('参加者を1人以上登録してください。', 'error'));
      return;
    }
    const intervalMs = nextSettings.intervals?.laneClass?.milliseconds ?? 0;
    if (!intervalMs) {
      setStatus(dispatch, 'lanes', createStatus('スタート間隔が正しく設定されていません。', 'error'));
      return;
    }
    const laneCount = nextSettings.laneCount ?? 0;
    if (!laneCount) {
      setStatus(dispatch, 'lanes', createStatus('レーン数を確認してください。', 'error'));
      return;
    }

    const assignments = generateLaneAssignments(entries, laneCount, intervalMs);
    if (!assignments.length) {
      setStatus(dispatch, 'lanes', createStatus('レーン割り当てを作成できませんでした。入力内容を確認してください。', 'error'));
      return;
    }

    updateLaneAssignments(dispatch, assignments);
    setStatus(dispatch, 'lanes', createStatus('自動でレーン割り当てを作成しました。', 'success'));
    onComplete();
  };

  return (
    <section aria-labelledby="step1-heading">
      <header>
        <h2 id="step1-heading">STEP 1 入力内容の整理</h2>
        <p className="muted">大会の基本情報と参加者を登録し、「入力完了」ボタンで次のステップへ進みます。</p>
      </header>
      <div className="input-step__layout">
        <div className="input-step__cell input-step__cell--settings">
          <SettingsForm ref={settingsFormRef} />
        </div>
        <div className="input-step__cell input-step__cell--entry">
          <EntryForm />
        </div>
        <div className="input-step__cell input-step__cell--table">
          <EntryTablePanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} entries={filteredEntries} />
        </div>
      </div>
      <div className="actions-row step-actions step-actions--sticky">
        <button type="button" onClick={handleComplete}>
          入力完了（レーンを自動作成）
        </button>
      </div>
      <StatusMessage tone={statuses.lanes.level} message={statuses.lanes.text} />
    </section>
  );
};

export default InputStep;
