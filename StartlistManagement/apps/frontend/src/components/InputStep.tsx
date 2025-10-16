import { StatusMessage } from '@startlist-management/ui-components';
import SettingsForm from './SettingsForm';
import EntryForm from './EntryForm';
import EntryTable from './EntryTable';
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
  const { entries, settings, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const handleComplete = () => {
    if (!settings) {
      setStatus(dispatch, 'lanes', createStatus('基本情報を保存してから進んでください。', 'error'));
      return;
    }
    if (!entries.length) {
      setStatus(dispatch, 'lanes', createStatus('参加者を1人以上登録してください。', 'error'));
      return;
    }
    const intervalMs = settings.laneClassInterval?.milliseconds ?? 0;
    if (!intervalMs) {
      setStatus(dispatch, 'lanes', createStatus('スタート間隔が正しく設定されていません。', 'error'));
      return;
    }
    const laneCount = settings.laneCount ?? 0;
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
      <div className="step-grid">
        <SettingsForm />
        <EntryForm />
        <EntryTable />
      </div>
      <div className="actions-row step-actions">
        <button type="button" onClick={handleComplete}>
          入力完了（レーンを自動作成）
        </button>
      </div>
      <StatusMessage tone={statuses.lanes.level} message={statuses.lanes.text} />
    </section>
  );
};

export default InputStep;
