import { useMemo } from 'react';
import { StatusMessage, Tag } from '@orienteering/shared-ui';
import type { LaneAssignmentDto } from '@startlist-management/application';
import { useStartlistApi } from '../api/useStartlistApi';
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
  const {
    entries,
    settings,
    laneAssignments,
    startlistId,
    statuses,
    loading,
    classSplitRules,
    classSplitResult,
  } = useStartlistState();
  const dispatch = useStartlistDispatch();
  const api = useStartlistApi();

  const splitMetadataByClassId = useMemo(() => {
    const meta = new Map<
      string,
      { baseClassId: string; splitIndex?: number; partCount: number; displayName?: string }
    >();
    const baseCounts = new Map<string, number>();
    classSplitResult?.splitClasses.forEach((item) => {
      const current = baseCounts.get(item.baseClassId) ?? 0;
      baseCounts.set(item.baseClassId, current + 1);
    });
    classSplitResult?.splitClasses.forEach((item) => {
      meta.set(item.classId, {
        baseClassId: item.baseClassId,
        splitIndex: item.splitIndex,
        partCount: baseCounts.get(item.baseClassId) ?? 1,
        displayName: item.displayName,
      });
    });
    laneAssignments.forEach((lane) => {
      lane.classOrder.forEach((classId) => {
        if (!meta.has(classId)) {
          meta.set(classId, { baseClassId: classId, partCount: 1 });
        }
      });
    });
    entries.forEach((entry) => {
      const trimmed = entry.classId.trim();
      if (!meta.has(trimmed)) {
        meta.set(trimmed, { baseClassId: trimmed, partCount: 1 });
      }
    });
    return meta;
  }, [classSplitResult, laneAssignments, entries]);

  const splitEntryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (classSplitResult?.splitIdToEntryIds) {
      classSplitResult.splitIdToEntryIds.forEach((ids, classId) => {
        counts.set(classId, ids.length);
      });
    }
    if (counts.size === 0) {
      entries.forEach((entry) => {
        const classId = entry.classId.trim();
        counts.set(classId, (counts.get(classId) ?? 0) + 1);
      });
    }
    return counts;
  }, [classSplitResult, entries]);

  const handleGenerate = () => {
    if (!settings) {
      setStatus(dispatch, 'lanes', createStatus('先に基本情報を保存してください。', 'error'));
      return;
    }
    const interval = settings.intervals?.laneClass?.milliseconds ?? 0;
    const { assignments, splitResult } = generateLaneAssignments(entries, settings.laneCount, interval, {
      splitRules: classSplitRules,
      previousSplitResult: classSplitResult,
    });
    updateLaneAssignments(dispatch, assignments, splitResult);
    if (assignments.length === 0) {
      setStatus(dispatch, 'lanes', createStatus('エントリーとレーン数を確認してください。', 'error'));
    } else {
      const assignedClasses = assignments.reduce((sum, assignment) => sum + assignment.classOrder.length, 0);
      setStatus(
        dispatch,
        'lanes',
        createStatus(`分割後 ${assignedClasses} クラスを生成（${assignments.length} レーン）`, 'success'),
      );
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
    updateLaneAssignments(dispatch, updated, classSplitResult);
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
                {assignment.classOrder.map((classId, index) => {
                  const meta = splitMetadataByClassId.get(classId);
                  const helperParts: string[] = [];
                  if (meta?.baseClassId && meta.baseClassId !== classId) {
                    helperParts.push(meta.baseClassId);
                  }
                  if ((meta?.partCount ?? 1) > 1) {
                    const splitLabel = meta.displayName ? `分割 ${meta.displayName}` : '分割';
                    const position = meta.splitIndex !== undefined ? `${meta.splitIndex + 1}/${meta.partCount}` : '';
                    helperParts.push(position ? `${splitLabel} (${position})` : splitLabel);
                  }
                  const helperText = helperParts.join(' • ');
                  const competitorCount = splitEntryCounts.get(classId) ?? 0;
                  return (
                    <li key={classId}>
                      <div className="lane-assignment__class-header">
                        <span>{classId}</span>
                        <Tag label={`${competitorCount} 名`} tone="info" />
                      </div>
                      {helperText ? <p className="muted small-text">{helperText}</p> : null}
                      <span className="inline-buttons">
                        <button type="button" className="secondary" onClick={() => moveClass(assignment, index, -1)}>
                          ↑
                        </button>
                        <button type="button" className="secondary" onClick={() => moveClass(assignment, index, 1)}>
                          ↓
                        </button>
                      </span>
                    </li>
                  );
                })}
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
