import { useMemo } from 'react';
import { StatusMessage } from '@startlist-management/ui-components';
import {
  createStatus,
  setStatus,
  updateClassAssignments,
  updateLaneAssignments,
  updateStartTimes,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { calculateStartTimes, createDefaultClassAssignments } from '../utils/startlistUtils';
import type { LaneAssignmentDto } from '@startlist-management/application';

interface LaneRow {
  classId: string;
  laneNumber: number;
}

type LaneAssignmentStepProps = {
  onBack: () => void;
  onConfirm: () => void;
};

const ensureLaneRecords = (assignments: LaneAssignmentDto[], laneCount: number) => {
  const lanes = [...assignments];
  for (let laneNumber = 1; laneNumber <= laneCount; laneNumber += 1) {
    if (!lanes.some((lane) => lane.laneNumber === laneNumber)) {
      lanes.push({ laneNumber, classOrder: [], interval: assignments[0]?.interval });
    }
  }
  return lanes.sort((a, b) => a.laneNumber - b.laneNumber);
};

const moveClassToLane = (
  assignments: LaneAssignmentDto[],
  classId: string,
  targetLane: number,
  intervalMs: number,
) => {
  const sanitized = assignments.map((lane) => ({
    ...lane,
    classOrder: lane.classOrder.filter((item) => item !== classId),
  }));
  let target = sanitized.find((lane) => lane.laneNumber === targetLane);
  if (!target) {
    target = { laneNumber: targetLane, classOrder: [], interval: { milliseconds: intervalMs } };
    sanitized.push(target);
  }
  target.classOrder = [...target.classOrder, classId];
  target.interval = target.interval ?? { milliseconds: intervalMs };
  return sanitized
    .filter((lane) => lane.classOrder.length > 0)
    .sort((a, b) => a.laneNumber - b.laneNumber);
};

const LaneAssignmentStep = ({ onBack, onConfirm }: LaneAssignmentStepProps): JSX.Element => {
  const { laneAssignments, entries, settings, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const laneCount = settings?.laneCount ?? laneAssignments.length;
  const intervalMs = settings?.interval?.milliseconds ?? laneAssignments[0]?.interval?.milliseconds ?? 0;

  const laneRows = useMemo<LaneRow[]>(() => {
    return laneAssignments.flatMap((lane) => lane.classOrder.map((classId) => ({ classId, laneNumber: lane.laneNumber })));
  }, [laneAssignments]);

  const laneOptions = useMemo(() => {
    return Array.from({ length: laneCount }, (_, index) => index + 1);
  }, [laneCount]);

  const handleLaneChange = (classId: string, nextLane: number) => {
    if (!intervalMs) {
      setStatus(dispatch, 'lanes', createStatus('スタート間隔を設定してください。', 'error'));
      return;
    }
    const updated = moveClassToLane(laneAssignments, classId, nextLane, intervalMs);
    updateLaneAssignments(dispatch, updated);
    setStatus(dispatch, 'lanes', createStatus(`クラス「${classId}」をレーン ${nextLane} に移動しました。`, 'info'));
  };

  const handleConfirm = () => {
    if (!settings) {
      setStatus(dispatch, 'lanes', createStatus('基本情報を先に入力してください。', 'error'));
      return;
    }
    if (!laneAssignments.length) {
      setStatus(dispatch, 'lanes', createStatus('レーン割り当てを確認してください。', 'error'));
      return;
    }
    const classAssignments = createDefaultClassAssignments(entries, intervalMs);
    updateClassAssignments(dispatch, classAssignments);
    if (classAssignments.length === 0) {
      setStatus(dispatch, 'classes', createStatus('クラス内順序を作成できませんでした。', 'error'));
      return;
    }
    setStatus(dispatch, 'classes', createStatus('クラス内の順序を自動で作成しました。', 'success'));

    const startTimes = calculateStartTimes({
      settings,
      laneAssignments,
      classAssignments,
      entries,
    });
    updateStartTimes(dispatch, startTimes);
    if (startTimes.length === 0) {
      setStatus(dispatch, 'startTimes', createStatus('スタート時間を作成できませんでした。', 'error'));
      return;
    }
    setStatus(dispatch, 'startTimes', createStatus('スタート時間を割り当てました。', 'success'));
    onConfirm();
  };

  const lanesWithPlaceholders = ensureLaneRecords(laneAssignments, laneCount);

  return (
    <section aria-labelledby="step2-heading">
      <header>
        <h2 id="step2-heading">STEP 2 レーン割り当ての調整</h2>
        <p className="muted">自動作成されたレーン割り当てを確認し、必要に応じてクラスごとのレーンを変更してください。</p>
      </header>
      {laneRows.length === 0 ? (
        <p className="muted">まだレーンが作成されていません。STEP 1 から進めてください。</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>クラス</th>
                <th>現在のレーン</th>
              </tr>
            </thead>
            <tbody>
              {laneRows.map((row) => (
                <tr key={row.classId}>
                  <td>{row.classId}</td>
                  <td>
                    <select
                      aria-label={`${row.classId} のレーン`}
                      value={row.laneNumber}
                      onChange={(event) => handleLaneChange(row.classId, Number(event.target.value))}
                    >
                      {laneOptions.map((lane) => (
                        <option key={lane} value={lane}>
                          レーン {lane}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="actions-row step-actions">
        <button type="button" className="secondary" onClick={onBack}>
          戻る
        </button>
        <button type="button" onClick={handleConfirm} disabled={laneRows.length === 0}>
          割り当て確定（順番と時間を作成）
        </button>
      </div>
      <StatusMessage tone={statuses.lanes.level} message={statuses.lanes.text} />
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
      <StatusMessage tone={statuses.startTimes.level} message={statuses.startTimes.text} />
      {lanesWithPlaceholders.length > 0 && (
        <div className="lane-preview">
          {lanesWithPlaceholders.map((lane) => (
            <div key={lane.laneNumber} className="lane-card">
              <h3>レーン {lane.laneNumber}</h3>
              {lane.classOrder.length === 0 ? (
                <p className="muted">クラス未設定</p>
              ) : (
                <ul className="list-reset">
                  {lane.classOrder.map((classId) => (
                    <li key={classId}>{classId}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default LaneAssignmentStep;
