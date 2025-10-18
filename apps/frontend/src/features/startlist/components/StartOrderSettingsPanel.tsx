import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import {
  createStatus,
  setLoading,
  setStatus,
  setStartOrderRules,
  updateClassWorldRanking,
  removeClassWorldRanking,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import { parseWorldRankingCsv } from '../utils/worldRankingCsv';
import type { StartOrderRule } from '../state/types';

type StartOrderRow = StartOrderRule;

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

const serializeRules = (rules: StartOrderRow[]): string =>
  JSON.stringify(
    rules.map((rule) => ({
      id: rule.id,
      classId: rule.classId ?? null,
      method: rule.method,
      csvName: rule.csvName ?? null,
    })),
  );

const StartOrderSettingsPanel = (): JSX.Element => {
  const { entries, statuses, loading, startOrderRules } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const availableClassIds = useMemo(
    () =>
      Array.from(new Set(entries.map((entry) => entry.classId))).sort((a, b) =>
        a.localeCompare(b, 'ja'),
      ),
    [entries],
  );

  const rowIdRef = useRef(0);
  const createRow = (
    classId?: string,
    method: StartOrderRow['method'] = 'random',
    csvName?: string,
  ): StartOrderRow => ({
    id: `start-order-row-${rowIdRef.current++}`,
    classId,
    method,
    csvName,
  });

  const updateRowIdCounter = (rules: StartOrderRow[]): void => {
    const next = rules.reduce((max, rule) => {
      const match = rule.id.match(/(\d+)$/);
      if (!match) {
        return max;
      }
      const value = Number.parseInt(match[1], 10);
      if (Number.isNaN(value)) {
        return max;
      }
      return Math.max(max, value + 1);
    }, rowIdRef.current);
    rowIdRef.current = Math.max(rowIdRef.current, next);
  };

  const [rows, setRows] = useState<StartOrderRow[]>(() => {
    if (startOrderRules.length > 0) {
      const initial = startOrderRules.map((rule) => ({ ...rule }));
      updateRowIdCounter(initial);
      return initial;
    }
    return [createRow()];
  });

  const rowsRef = useRef(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const stateSignature = serializeRules(startOrderRules);
    const localSignature = serializeRules(rowsRef.current);
    if (stateSignature === localSignature) {
      return;
    }
    if (startOrderRules.length === 0) {
      if (rowsRef.current.length === 0) {
        setRows([createRow()]);
      }
      return;
    }
    const next = startOrderRules.map((rule) => ({ ...rule }));
    updateRowIdCounter(next);
    setRows(next);
  }, [startOrderRules]);

  useEffect(() => {
    const stateSignature = serializeRules(startOrderRules);
    const localSignature = serializeRules(rows);
    if (stateSignature === localSignature) {
      return;
    }
    setStartOrderRules(dispatch, rows);
  }, [dispatch, rows, startOrderRules]);

  useEffect(() => {
    const availableSet = new Set(availableClassIds);
    const removed: string[] = [];
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.classId && !availableSet.has(row.classId)) {
          if (row.method === 'worldRanking') {
            removed.push(row.classId);
          }
          changed = true;
          return { ...row, classId: undefined, method: 'random', csvName: undefined };
        }
        return row;
      });
      return changed ? next : prev;
    });
    removed.forEach((classId) => removeClassWorldRanking(dispatch, classId));
  }, [availableClassIds, dispatch]);

  useEffect(() => {
    const targets = deriveTargets(rows);
    if (statuses.startOrder.level === 'success' || statuses.startOrder.level === 'error') {
      return;
    }
    const message =
      targets.length === 0
        ? '世界ランキング対象クラスを選択していません。'
        : `世界ランキング対象クラス: ${targets.join(', ')}`;
    setStatus(dispatch, 'startOrder', createStatus(message, 'info'));
  }, [dispatch, rows, statuses.startOrder.level]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, createRow()]);
  };

  const handleRemoveRow = (rowId: string) => {
    let removedClassId: string | undefined;
    setRows((prev) => {
      const target = prev.find((row) => row.id === rowId);
      if (target?.method === 'worldRanking' && target.classId) {
        removedClassId = target.classId;
      }
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createRow()];
    });
    if (removedClassId) {
      removeClassWorldRanking(dispatch, removedClassId);
    }
  };

  const handleClassChange = (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value.trim();
    let removedClassId: string | undefined;
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        const nextClassId = value.length > 0 ? value : undefined;
        if (row.method === 'worldRanking' && row.classId && row.classId !== nextClassId) {
          removedClassId = row.classId;
        }
        return {
          ...row,
          classId: nextClassId,
          csvName: nextClassId === row.classId ? row.csvName : undefined,
        };
      }),
    );
    if (removedClassId) {
      removeClassWorldRanking(dispatch, removedClassId);
    }
  };

  const handleMethodChange = (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as StartOrderRow['method'];
    let removedClassId: string | undefined;
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        if (value === 'random') {
          if (row.method === 'worldRanking' && row.classId) {
            removedClassId = row.classId;
          }
          return { ...row, method: value, csvName: undefined };
        }
        return { ...row, method: value };
      }),
    );
    if (removedClassId) {
      removeClassWorldRanking(dispatch, removedClassId);
    }
  };

  const handleWorldRankingUpload =
    (rowId: string) => async (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.target.files ?? []);
      if (!file) {
        return;
      }

      const targetRow = rows.find((row) => row.id === rowId);
      if (!targetRow) {
        event.target.value = '';
        return;
      }
      if (!targetRow.classId) {
        setStatus(dispatch, 'startOrder', createStatus('先にクラスを選択してください。', 'error'));
        event.target.value = '';
        return;
      }

      try {
        setLoading(dispatch, 'startOrder', true);
        const text = await readFileAsText(file);
        const ranking = parseWorldRankingCsv(text);
        updateClassWorldRanking(dispatch, targetRow.classId, ranking);
        setRows((prev) =>
          prev.map((row) => (row.id === rowId ? { ...row, csvName: file.name } : row)),
        );
        if (ranking.size === 0) {
          setStatus(
            dispatch,
            'startOrder',
            createStatus(
              `クラス ${targetRow.classId} の世界ランキングに順位データが見つかりませんでした。`,
              'info',
            ),
          );
        } else {
          setStatus(
            dispatch,
            'startOrder',
            createStatus(
              `クラス ${targetRow.classId} の世界ランキングを ${ranking.size} 件読み込みました。`,
              'success',
            ),
          );
        }
      } catch (error) {
        removeClassWorldRanking(dispatch, targetRow.classId);
        setRows((prev) =>
          prev.map((row) => (row.id === rowId ? { ...row, csvName: undefined } : row)),
        );
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
          <span role="columnheader">CSV ファイル</span>
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
                    const disabled = rows.some(
                      (other) => other.id !== row.id && other.classId === classId,
                    );
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
              <div className="start-order-settings__cell" role="cell">
                {row.method === 'worldRanking' ? (
                  <div className="stack">
                    <label htmlFor={`start-order-world-ranking-${row.id}`}>
                      世界ランキング CSV
                    </label>
                    <input
                      id={`start-order-world-ranking-${row.id}`}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleWorldRankingUpload(row.id)}
                      disabled={!row.classId || Boolean(loading.startOrder)}
                    />
                    <p className="muted">
                      {row.classId
                        ? row.csvName
                          ? `読み込み済み: ${row.csvName}`
                          : 'CSV を読み込んでください。'
                        : 'クラスを先に選択してください。'}
                    </p>
                  </div>
                ) : (
                  <p className="muted">CSV は不要です。</p>
                )}
              </div>
              <div
                className="start-order-settings__cell start-order-settings__cell--actions"
                role="cell"
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleRemoveRow(row.id)}
                  disabled={isRemoveDisabled}
                >
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
      <StatusMessage tone={statuses.startOrder.level} message={statuses.startOrder.text} />
    </section>
  );
};

export default StartOrderSettingsPanel;
