import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import {
  createStatus,
  setLoading,
  setStatus,
  setWorldRankingTargetClasses,
  updateWorldRanking,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { parseWorldRankingCsv } from '../utils/worldRankingCsv';

type StartOrderMethod = 'random' | 'worldRanking';

type StartOrderRow = {
  id: string;
  classId?: string;
  method: StartOrderMethod;
};

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

const deriveTargets = (rows: StartOrderRow[]): string[] => {
  const targets = rows.reduce<Set<string>>((acc, row) => {
    if (row.method === 'worldRanking' && row.classId) {
      acc.add(row.classId);
    }
    return acc;
  }, new Set<string>());
  return Array.from(targets).sort((a, b) => a.localeCompare(b, 'ja'));
};

const StartOrderSettingsPanel = (): JSX.Element => {
  const { entries, statuses, loading, worldRankingTargetClassIds } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const availableClassIds = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.classId))).sort((a, b) => a.localeCompare(b, 'ja')),
    [entries],
  );

  const targetClassList = useMemo(
    () => Array.from(worldRankingTargetClassIds).sort((a, b) => a.localeCompare(b, 'ja')),
    [worldRankingTargetClassIds],
  );

  const rowIdRef = useRef(0);
  const createRow = (classId?: string, method: StartOrderMethod = 'random'): StartOrderRow => ({
    id: `start-order-row-${rowIdRef.current++}`,
    classId,
    method,
  });

  const [rows, setRows] = useState<StartOrderRow[]>(() => {
    const initialTargets = targetClassList.map((classId) => createRow(classId, 'worldRanking'));
    return initialTargets.length > 0 ? initialTargets : [createRow()];
  });

  useEffect(() => {
    setRows((prev) => {
      const currentTargets = deriveTargets(prev);
      if (
        currentTargets.length === targetClassList.length &&
        currentTargets.every((value, index) => value === targetClassList[index])
      ) {
        return prev;
      }
      const preserved = prev.filter((row) => row.method !== 'worldRanking');
      const synced = targetClassList.map((classId) => {
        const existing = prev.find((row) => row.method === 'worldRanking' && row.classId === classId);
        return existing ?? createRow(classId, 'worldRanking');
      });
      const next = [...preserved, ...synced];
      return next.length > 0 ? next : [createRow()];
    });
  }, [targetClassList]);

  useEffect(() => {
    const availableSet = new Set(availableClassIds);
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.classId && !availableSet.has(row.classId)) {
          changed = true;
          return { ...row, classId: undefined, method: 'random' };
        }
        return row;
      });
      return changed ? next : prev;
    });
  }, [availableClassIds]);

  useEffect(() => {
    const targets = deriveTargets(rows);
    setWorldRankingTargetClasses(dispatch, targets);
    const message =
      targets.length === 0
        ? '世界ランキング対象クラスを選択していません。'
        : `世界ランキング対象クラス: ${targets.join(', ')}`;
    setStatus(dispatch, 'startOrder', createStatus(message, 'info'));
  }, [dispatch, rows]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, createRow()]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      if (next.length === 0) {
        return [createRow()];
      }
      return next;
    });
  };

  const handleClassChange = (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value.trim();
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, classId: value.length > 0 ? value : undefined } : row,
      ),
    );
  };

  const handleMethodChange = (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as StartOrderMethod;
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, method: value } : row)));
  };

  const handleWorldRankingUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) {
      return;
    }

    try {
      setLoading(dispatch, 'startOrder', true);
      const text = await readFileAsText(file);
      const ranking = parseWorldRankingCsv(text);
      updateWorldRanking(dispatch, ranking);
      if (ranking.size === 0) {
        setStatus(
          dispatch,
          'startOrder',
          createStatus('世界ランキングファイルに順位データが見つかりませんでした。', 'info'),
        );
      } else {
        setStatus(
          dispatch,
          'startOrder',
          createStatus(`世界ランキングを ${ranking.size} 件読み込みました。`, 'success'),
        );
      }
    } catch (error) {
      updateWorldRanking(dispatch, new Map());
      const message =
        error instanceof Error
          ? error.message
          : '世界ランキングファイルの解析に失敗しました。';
      setStatus(dispatch, 'startOrder', createStatus(message, 'error'));
    } finally {
      setLoading(dispatch, 'startOrder', false);
      event.target.value = '';
    }
  };

  const requiresWorldRankingFile = rows.some((row) => row.method === 'worldRanking');

  return (
    <section aria-labelledby="start-order-settings-heading" className="start-order-settings">
      <header>
        <h3 id="start-order-settings-heading">スタート順設定</h3>
        <p className="muted">世界ランキング順序を適用するクラスと方式を設定します。</p>
      </header>
      <div className="start-order-settings__rows" role="table">
        <div className="start-order-settings__header" role="row">
          <span role="columnheader">対象クラス</span>
          <span role="columnheader">リスト方式</span>
          <span role="columnheader" className="visually-hidden">
            行操作
          </span>
        </div>
        {rows.map((row) => {
          const isRemoveDisabled = rows.length === 1;
          return (
            <div key={row.id} className="start-order-settings__row" role="row">
              <label className="start-order-settings__cell" role="cell">
                <span className="visually-hidden">対象クラス</span>
                <select
                  value={row.classId ?? ''}
                  onChange={(event) => handleClassChange(row.id, event)}
                  disabled={availableClassIds.length === 0}
                >
                  <option value="">クラスを選択</option>
                  {availableClassIds.map((classId) => {
                    const disabled = rows.some((other) => other.id !== row.id && other.classId === classId);
                    return (
                      <option key={classId} value={classId} disabled={disabled}>
                        {classId}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="start-order-settings__cell" role="cell">
                <span className="visually-hidden">リスト方式</span>
                <select value={row.method} onChange={(event) => handleMethodChange(row.id, event)}>
                  <option value="random">既定（ランダム）</option>
                  <option value="worldRanking">世界ランキング逆順</option>
                </select>
              </label>
              <div className="start-order-settings__cell start-order-settings__cell--actions" role="cell">
                <button type="button" className="secondary" onClick={() => handleRemoveRow(row.id)} disabled={isRemoveDisabled}>
                  行を削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="start-order-settings__actions">
        <button type="button" className="secondary" onClick={handleAddRow}>
          行を追加
        </button>
      </div>
      {availableClassIds.length === 0 ? (
        <p className="muted">エントリーにクラスがまだ登録されていません。</p>
      ) : null}
      {requiresWorldRankingFile ? (
        <div className="stack">
          <label htmlFor="start-order-world-ranking-upload">世界ランキングファイル (CSV)</label>
          <input
            id="start-order-world-ranking-upload"
            type="file"
            accept=".csv,text/csv"
            onChange={handleWorldRankingUpload}
            disabled={Boolean(loading.startOrder)}
          />
          <p className="muted">IOF ID と順位を含む CSV を読み込みます。</p>
        </div>
      ) : null}
      <StatusMessage tone={statuses.startOrder.level} message={statuses.startOrder.text} />
    </section>
  );
};

export default StartOrderSettingsPanel;
