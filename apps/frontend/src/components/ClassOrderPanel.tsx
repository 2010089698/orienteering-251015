import { StatusMessage } from '@orienteering/shared-ui';
import type { ClassAssignmentDto } from '@startlist-management/application';
import { useStartlistApi } from '../hooks/useStartlistApi';
import {
  createStatus,
  setLoading,
  setStatus,
  updateClassAssignments,
  updateSnapshot,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { createDefaultClassAssignments, updateClassPlayerOrder } from '../utils/startlistUtils';

const ClassOrderPanel = (): JSX.Element => {
  const { entries, settings, classAssignments, startlistId, statuses, loading } = useStartlistState();
  const dispatch = useStartlistDispatch();
  const api = useStartlistApi();

  const handleGenerate = () => {
    if (!settings) {
      setStatus(dispatch, 'classes', createStatus('先に基本情報を入力してください。', 'error'));
      return;
    }
    const interval = settings.intervals?.classPlayer?.milliseconds ?? 0;
    const assignments = createDefaultClassAssignments(entries, interval);
    updateClassAssignments(dispatch, assignments);
    if (assignments.length === 0) {
      setStatus(dispatch, 'classes', createStatus('エントリーが登録されていません。', 'error'));
    } else {
      setStatus(dispatch, 'classes', createStatus(`${assignments.length} クラスの順序を生成しました。`, 'success'));
    }
  };

  const handlePersist = async () => {
    if (!startlistId) {
      setStatus(dispatch, 'classes', createStatus('スタートリスト ID を設定してください。', 'error'));
      return;
    }
    if (classAssignments.length === 0) {
      setStatus(dispatch, 'classes', createStatus('クラス順序を生成してから送信してください。', 'error'));
      return;
    }
    try {
      setLoading(dispatch, 'classes', true);
      const snapshot = await api.assignPlayerOrder({ startlistId, assignments: classAssignments });
      updateSnapshot(dispatch, snapshot);
      setStatus(dispatch, 'classes', createStatus('クラス順序を送信しました。', 'success'));
      if (snapshot) {
        setStatus(dispatch, 'snapshot', createStatus('スナップショットを更新しました。', 'info'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'クラス順序の送信に失敗しました。';
      setStatus(dispatch, 'classes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'classes', false);
    }
  };

  const movePlayer = (assignment: ClassAssignmentDto, index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= assignment.playerOrder.length) {
      return;
    }
    const updated = updateClassPlayerOrder(classAssignments, assignment.classId, index, nextIndex);
    updateClassAssignments(dispatch, updated);
    setStatus(dispatch, 'classes', createStatus('クラス内順序を更新しました。', 'info'));
  };

  return (
    <section aria-labelledby="class-heading">
      <header>
        <h2 id="class-heading">クラス内順序</h2>
        <p className="muted">カード番号順をベースに、必要に応じて微調整します。</p>
      </header>
      <div className="actions-row">
        <button type="button" onClick={handleGenerate} disabled={!entries.length}>
          クラス順序を自動生成
        </button>
        <button type="button" className="secondary" onClick={handlePersist} disabled={loading.classes}>
          API に送信
        </button>
        <span className="muted">{classAssignments.length} クラスを編集中</span>
      </div>
      {classAssignments.length === 0 ? (
        <p className="muted">まだクラス順序が生成されていません。</p>
      ) : (
        <div className="details-group">
          {classAssignments.map((assignment) => (
            <details key={assignment.classId} open>
              <summary>
                {assignment.classId} ({assignment.playerOrder.length} 人)
              </summary>
              <ol>
                {assignment.playerOrder.map((playerId, index) => (
                  <li key={playerId}>
                    {playerId}
                    <span className="inline-buttons">
                      <button type="button" className="secondary" onClick={() => movePlayer(assignment, index, -1)}>
                        ↑
                      </button>
                      <button type="button" className="secondary" onClick={() => movePlayer(assignment, index, 1)}>
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      )}
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
    </section>
  );
};

export default ClassOrderPanel;
