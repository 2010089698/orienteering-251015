import { useMemo } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import type { ClassAssignmentDto } from '@startlist-management/application';
import { useStartlistApi } from '../api/useStartlistApi';
import {
  createStatus,
  setLoading,
  setStatus,
  updateClassAssignments,
  updateSnapshot,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { createDefaultClassAssignments, deriveClassOrderWarnings, updateClassPlayerOrder } from '../utils/startlistUtils';
import { seededRandomClassOrderPolicy, seededRandomUnconstrainedClassOrderPolicy } from '../utils/classOrderPolicy';

type ClassOrderPanelProps = {
  headingLevel?: 'h2' | 'h3' | 'h4';
  headingId?: string;
  showAssignmentPreview?: boolean;
  className?: string;
};

const ClassOrderPanel = ({
  headingLevel = 'h2',
  headingId = 'class-heading',
  showAssignmentPreview = true,
  className,
}: ClassOrderPanelProps): JSX.Element => {
  const {
    entries,
    settings,
    classAssignments,
    startlistId,
    statuses,
    loading,
    laneAssignments,
    classOrderSeed,
    classOrderPreferences,
    worldRanking,
    worldRankingTargetClassIds,
  } = useStartlistState();
  const dispatch = useStartlistDispatch();
  const api = useStartlistApi();

  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const handleGenerate = () => {
    if (!settings) {
      setStatus(dispatch, 'classes', createStatus('先に基本情報を入力してください。', 'error'));
      return;
    }
    if (worldRankingTargetClassIds.size > 0 && worldRanking.size === 0) {
      const message = '世界ランキングファイルを読み込んでからクラス順序を生成してください。';
      setStatus(dispatch, 'classes', createStatus(message, 'error'));
      setStatus(dispatch, 'startOrder', createStatus(message, 'error'));
      return;
    }
    const interval = settings.intervals?.classPlayer?.milliseconds ?? 0;
    const policy = classOrderPreferences.avoidConsecutiveClubs
      ? seededRandomClassOrderPolicy
      : seededRandomUnconstrainedClassOrderPolicy;
    const { assignments, seed, warnings } = createDefaultClassAssignments({
      entries,
      playerIntervalMs: interval,
      laneAssignments,
      startlistId,
      seed: classOrderSeed,
      policy,
      worldRanking,
      worldRankingTargetClassIds,
    });
    updateClassAssignments(dispatch, assignments, seed, warnings);
    if (assignments.length === 0) {
      setStatus(dispatch, 'classes', createStatus('エントリーが登録されていません。', 'error'));
    } else {
      if (classOrderPreferences.avoidConsecutiveClubs && warnings.length > 0) {
        setStatus(
          dispatch,
          'classes',
          createStatus(
            `${assignments.length} クラスの順序を生成しましたが、${warnings.length} クラスで所属が連続する可能性があります。STEP 3 で詳細を確認してください。`,
            'info',
          ),
        );
      } else {
        setStatus(dispatch, 'classes', createStatus(`${assignments.length} クラスの順序を生成しました。`, 'success'));
      }
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
    const warnings = classOrderPreferences.avoidConsecutiveClubs
      ? deriveClassOrderWarnings(updated, entries)
      : [];
    updateClassAssignments(dispatch, updated, undefined, warnings);
    setStatus(dispatch, 'classes', createStatus('クラス内順序を更新しました。', 'info'));
  };

  const HeadingTag = headingLevel;

  return (
    <section aria-labelledby={headingId} className={className}>
      <header>
        <HeadingTag id={headingId}>クラス内順序</HeadingTag>
        <p className="muted">カード番号順をベースに、必要に応じて微調整します。</p>
      </header>
      {statuses.startOrder.level !== 'idle' && (
        <div className="details-group">
          <StatusMessage tone={statuses.startOrder.level} message={statuses.startOrder.text} />
        </div>
      )}
      <div className="actions-row">
        <button type="button" onClick={handleGenerate} disabled={!entries.length}>
          クラス順序を自動生成
        </button>
        <button type="button" className="secondary" onClick={handlePersist} disabled={loading.classes}>
          API に送信
        </button>
        <span className="muted">{classAssignments.length} クラスを編集中</span>
      </div>
      {showAssignmentPreview && (
        classAssignments.length === 0 ? (
          <p className="muted">まだクラス順序が生成されていません。</p>
        ) : (
          <div className="details-group">
            {classAssignments.map((assignment) => (
              <details key={assignment.classId} open>
                <summary>
                  {assignment.classId} ({assignment.playerOrder.length} 人)
                </summary>
                <ol>
                  {assignment.playerOrder.map((playerId, index) => {
                    const entry = entryMap.get(playerId);
                    const cardLabel = entry?.cardNo ?? playerId;
                    return (
                      <li key={playerId}>
                        {cardLabel}
                        <span className="inline-buttons">
                          <button type="button" className="secondary" onClick={() => movePlayer(assignment, index, -1)}>
                            ↑
                          </button>
                          <button type="button" className="secondary" onClick={() => movePlayer(assignment, index, 1)}>
                            ↓
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </details>
            ))}
          </div>
        )
      )}
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
    </section>
  );
};

export default ClassOrderPanel;
