import { StatusMessage, Tag } from '@orienteering/shared-ui';
import type { LaneAssignmentDto } from '@startlist-management/application';
import { useStartlistApi } from '../hooks/useStartlistApi';
import {
  createStatus,
  setLoading,
  setStatus,
  updateLaneAssignments,
  updateSnapshot,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { generateLaneAssignments, reorderLaneClass } from '../utils/startlistUtils';

const LaneAssignmentPanel = (): JSX.Element => {
  const { entries, settings, laneAssignments, startlistId, statuses, loading } = useStartlistState();
  const dispatch = useStartlistDispatch();
  const api = useStartlistApi();

  const handleGenerate = () => {
    if (!settings) {
      setStatus(dispatch, 'lanes', createStatus('先に基本情報を保存してください。', 'error'));
      return;
    }
    const interval = settings.intervals?.laneClass?.milliseconds ?? 0;
    const assignments = generateLaneAssignments(entries, settings.laneCount, interval);
    updateLaneAssignments(dispatch, assignments);
    if (assignments.length === 0) {
      setStatus(dispatch, 'lanes', createStatus('エントリーとレーン数を確認してください。', 'error'));
    } else {
      setStatus(dispatch, 'lanes', createStatus(`${assignments.length} 本のレーン割り当てを生成しました。`, 'success'));
    }
  };

  const handlePersist = async () => {
    if (!startlistId) {
      setStatus(dispatch, 'lanes', createStatus('スタートリスト ID を設定してください。', 'error'));
      return;
    }
    if (laneAssignments.length === 0) {
      setStatus(dispatch, 'lanes', createStatus('割り当てを生成してから送信してください。', 'error'));
      return;
    }
    try {
      setLoading(dispatch, 'lanes', true);
      const snapshot = await api.assignLaneOrder({ startlistId, assignments: laneAssignments });
      updateSnapshot(dispatch, snapshot);
      setStatus(dispatch, 'lanes', createStatus('レーン割り当てを送信しました。', 'success'));
      if (snapshot) {
        setStatus(dispatch, 'snapshot', createStatus('スナップショットを更新しました。', 'info'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'レーン割り当ての送信に失敗しました。';
      setStatus(dispatch, 'lanes', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'lanes', false);
    }
  };

  const moveClass = (assignment: LaneAssignmentDto, index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= assignment.classOrder.length) {
      return;
    }
    const updated = reorderLaneClass(laneAssignments, assignment.laneNumber, index, nextIndex);
    updateLaneAssignments(dispatch, updated);
    setStatus(dispatch, 'lanes', createStatus('クラス順序を更新しました。', 'info'));
  };

  const assignedClassCount = laneAssignments.reduce((sum, assignment) => sum + assignment.classOrder.length, 0);

  return (
    <section aria-labelledby="lane-heading">
      <header>
        <h2 id="lane-heading">レーン割り当て</h2>
        <p className="muted">クラスをレーンに配分し、必要に応じて順序を調整します。</p>
      </header>
      <div className="actions-row">
        <button type="button" onClick={handleGenerate} disabled={!entries.length}>
          レーン割り当てを自動生成
        </button>
        <button type="button" className="secondary" onClick={handlePersist} disabled={loading.lanes}>
          API に送信
        </button>
        <span className="muted">{assignedClassCount} クラスが割り当て済み</span>
      </div>
      {laneAssignments.length === 0 ? (
        <p className="muted">まだレーン割り当てが計算されていません。</p>
      ) : (
        <div className="details-group">
          {laneAssignments.map((assignment) => (
            <details key={assignment.laneNumber} open>
              <summary>
                レーン {assignment.laneNumber}{' '}
                <Tag label={`${assignment.classOrder.length} クラス`} tone="info" />
              </summary>
              <ul className="list-reset">
                {assignment.classOrder.map((classId, index) => (
                  <li key={classId}>
                    {classId}
                    <span className="inline-buttons">
                      <button type="button" className="secondary" onClick={() => moveClass(assignment, index, -1)}>
                        ↑
                      </button>
                      <button type="button" className="secondary" onClick={() => moveClass(assignment, index, 1)}>
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
      <StatusMessage tone={statuses.lanes.level} message={statuses.lanes.text} />
    </section>
  );
};

export default LaneAssignmentPanel;
