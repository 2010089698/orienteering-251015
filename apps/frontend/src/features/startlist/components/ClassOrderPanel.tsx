import { useMemo } from 'react';
import type { ChangeEvent } from 'react';
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
  updateWorldRanking,
  setWorldRankingTargetClasses,
} from '../state/StartlistContext';
import { createDefaultClassAssignments, deriveClassOrderWarnings, updateClassPlayerOrder } from '../utils/startlistUtils';
import { seededRandomClassOrderPolicy, seededRandomUnconstrainedClassOrderPolicy } from '../utils/classOrderPolicy';
import { parseWorldRankingCsv } from '../utils/worldRankingCsv';

const readFileAsText = async (file: File): Promise<string> => {
  if (typeof file.text === 'function') {
    return file.text();
  }
  if (typeof FileReader !== 'undefined') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => {
        reject(reader.error ?? new Error('ファイルの読み込みに失敗しました。'));
      };
      reader.onload = () => {
        const result = reader.result;
        resolve(typeof result === 'string' ? result : '');
      };
      reader.readAsText(file);
    });
  }
  return new Response(file).text();
};

const ClassOrderPanel = (): JSX.Element => {
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
  const availableClassIds = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.classId))).sort((a, b) => a.localeCompare(b, 'ja')),
    [entries],
  );

  const handleWorldRankingUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) {
      return;
    }

    try {
      setLoading(dispatch, 'worldRanking', true);
      const text = await readFileAsText(file);
      const ranking = parseWorldRankingCsv(text);
      updateWorldRanking(dispatch, ranking);
      if (ranking.size === 0) {
        setStatus(
          dispatch,
          'worldRanking',
          createStatus('世界ランキングファイルに順位データが見つかりませんでした。', 'info'),
        );
      } else {
        setStatus(
          dispatch,
          'worldRanking',
          createStatus(`世界ランキングを ${ranking.size} 件読み込みました。`, 'success'),
        );
      }
    } catch (error) {
      updateWorldRanking(dispatch, new Map());
      const message =
        error instanceof Error
          ? error.message
          : '世界ランキングファイルの解析に失敗しました。';
      setStatus(dispatch, 'worldRanking', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'worldRanking', false);
      event.target.value = '';
    }
  };

  const handleToggleWorldRankingClass = (classId: string) => {
    const next = new Set(worldRankingTargetClassIds);
    if (next.has(classId)) {
      next.delete(classId);
    } else {
      next.add(classId);
    }
    setWorldRankingTargetClasses(dispatch, next);
    if (next.size === 0) {
      setStatus(dispatch, 'worldRanking', createStatus('世界ランキング対象クラスを選択していません。', 'info'));
    } else {
      const selectedList = Array.from(next).sort((a, b) => a.localeCompare(b, 'ja')).join(', ');
      setStatus(
        dispatch,
        'worldRanking',
        createStatus(`世界ランキング対象クラス: ${selectedList}`, 'info'),
      );
    }
  };

  const handleGenerate = () => {
    if (!settings) {
      setStatus(dispatch, 'classes', createStatus('先に基本情報を入力してください。', 'error'));
      return;
    }
    if (worldRankingTargetClassIds.size > 0 && worldRanking.size === 0) {
      const message = '世界ランキングファイルを読み込んでからクラス順序を生成してください。';
      setStatus(dispatch, 'classes', createStatus(message, 'error'));
      setStatus(dispatch, 'worldRanking', createStatus(message, 'error'));
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

  return (
    <section aria-labelledby="class-heading">
      <header>
        <h2 id="class-heading">クラス内順序</h2>
        <p className="muted">カード番号順をベースに、必要に応じて微調整します。</p>
      </header>
      <div className="details-group">
        <fieldset>
          <legend>世界ランキング設定</legend>
          <div className="stack">
            <label htmlFor="world-ranking-upload">世界ランキングファイル (CSV)</label>
            <input
              id="world-ranking-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={handleWorldRankingUpload}
              disabled={Boolean(loading.worldRanking)}
            />
            <p className="muted">IOF ID と順位を含む CSV を読み込みます。</p>
            {availableClassIds.length === 0 ? (
              <p className="muted">エントリーにクラスがまだ登録されていません。</p>
            ) : (
              <div className="stack">
                <p className="muted">世界ランキング順序を適用するクラスを選択してください。</p>
                <div className="checkbox-group">
                  {availableClassIds.map((classId) => (
                    <label key={classId} className="checkbox">
                      <input
                        type="checkbox"
                        checked={worldRankingTargetClassIds.has(classId)}
                        onChange={() => handleToggleWorldRankingClass(classId)}
                        disabled={worldRanking.size === 0 || Boolean(loading.worldRanking)}
                      />
                      {classId}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <StatusMessage tone={statuses.worldRanking.level} message={statuses.worldRanking.text} />
        </fieldset>
      </div>
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
      )}
      <StatusMessage tone={statuses.classes.level} message={statuses.classes.text} />
    </section>
  );
};

export default ClassOrderPanel;
