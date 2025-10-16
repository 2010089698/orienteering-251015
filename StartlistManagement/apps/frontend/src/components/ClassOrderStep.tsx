import { useMemo } from 'react';
import { StatusMessage } from '@startlist-management/ui-components';
import {
  createStatus,
  setStatus,
  updateClassAssignments,
  updateStartTimes,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { calculateStartTimes, updateClassPlayerOrder } from '../utils/startlistUtils';

type ClassOrderStepProps = {
  onBack: () => void;
};

const formatStartTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

const ClassOrderStep = ({ onBack }: ClassOrderStepProps): JSX.Element => {
  const { classAssignments, startTimes, settings, laneAssignments, entries, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const entryMap = useMemo(() => {
    return new Map(entries.map((entry) => [entry.cardNo, entry]));
  }, [entries]);

  const startTimeRows = useMemo(() => {
    return startTimes.map((item) => {
      const entry = entryMap.get(item.playerId);
      const isoValue = typeof item.startTime === 'string' ? item.startTime : new Date(item.startTime).toISOString();
      return {
        playerId: item.playerId,
        name: entry?.name ?? '（名前未入力）',
        classId: entry?.classId ?? '不明',
        laneNumber: item.laneNumber,
        startTime: formatStartTime(isoValue),
      };
    });
  }, [startTimes, entryMap]);

  const handleMove = (classId: string, index: number, direction: number) => {
    const targetIndex = index + direction;
    const assignment = classAssignments.find((item) => item.classId === classId);
    if (!assignment || targetIndex < 0 || targetIndex >= assignment.playerOrder.length) {
      return;
    }
    const nextAssignments = updateClassPlayerOrder(classAssignments, classId, index, targetIndex);
    updateClassAssignments(dispatch, nextAssignments);
    if (!settings) {
      return;
    }
    const nextStartTimes = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments: nextAssignments,
      entries,
    });
    updateStartTimes(dispatch, nextStartTimes);
    setStatus(dispatch, 'classes', createStatus('順番を更新しました。', 'info'));
    setStatus(dispatch, 'startTimes', createStatus('スタート時間を再計算しました。', 'info'));
  };

  return (
    <section aria-labelledby="step3-heading">
      <header>
        <h2 id="step3-heading">STEP 3 クラス内順序とスタート時間</h2>
        <p className="muted">並び順を変更すると、スタート時間が自動で計算し直されます。</p>
      </header>
      {classAssignments.length === 0 ? (
        <p className="muted">クラス内順序がまだ作成されていません。STEP 2 から進めてください。</p>
      ) : (
        <div className="class-order-grid">
          {classAssignments.map((assignment) => (
            <div key={assignment.classId} className="class-card">
              <h3>{assignment.classId}</h3>
              {assignment.playerOrder.length === 0 ? (
                <p className="muted">参加者が登録されていません。</p>
              ) : (
                <ol>
                  {assignment.playerOrder.map((playerId, index) => {
                    const entry = entryMap.get(playerId);
                    return (
                      <li key={playerId}>
                        <div className="order-row">
                          <span>
                            {entry?.name || '（名前未入力）'} / {playerId}
                          </span>
                          <span className="inline-buttons">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleMove(assignment.classId, index, -1)}
                              disabled={index === 0}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleMove(assignment.classId, index, 1)}
                              disabled={index === assignment.playerOrder.length - 1}
                            >
                              ↓
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="actions-row step-actions">
        <button type="button" className="secondary" onClick={onBack}>
          戻る
        </button>
      </div>
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
      {startTimeRows.length > 0 && (
        <div className="table-wrapper">
          <table>
            <caption>スタート時間一覧</caption>
            <thead>
              <tr>
                <th>クラス</th>
                <th>名前 / カード番号</th>
                <th>レーン</th>
                <th>スタート時刻</th>
              </tr>
            </thead>
            <tbody>
              {startTimeRows.map((row) => (
                <tr key={`${row.playerId}-${row.laneNumber}`}>
                  <td>{row.classId}</td>
                  <td>
                    {row.name} / {row.playerId}
                  </td>
                  <td>{row.laneNumber}</td>
                  <td>{row.startTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ClassOrderStep;
