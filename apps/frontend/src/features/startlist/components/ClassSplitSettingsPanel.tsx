import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import {
  createStatus,
  setClassSplitRules,
  setStatus,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import type { ClassSplitMethod, ClassSplitRule, ClassSplitRules } from '../state/types';

interface ClassSplitRow {
  id: string;
  baseClassId?: string;
  partCount?: number;
  method: ClassSplitMethod;
}

const methodOptions: Array<{ value: ClassSplitMethod; label: string }> = [
  { value: 'random', label: 'ランダムに分割' },
  { value: 'balanced', label: '同人数を目指す' },
];

const methodLabelMap = new Map(methodOptions.map((option) => [option.value, option.label]));

const sanitizeRows = (rows: ClassSplitRow[]): ClassSplitRules =>
  rows
    .filter((row) => row.baseClassId && row.partCount && row.partCount > 1)
    .map<ClassSplitRule>((row) => ({
      baseClassId: row.baseClassId!,
      partCount: Math.max(2, Math.floor(row.partCount!)),
      method: row.method,
    }));

const serializeRules = (rules: ClassSplitRules): string =>
  JSON.stringify(
    rules.map((rule) => ({
      baseClassId: rule.baseClassId,
      partCount: rule.partCount,
      method: rule.method,
    })),
  );

const ClassSplitSettingsPanel = (): JSX.Element => {
  const { entries, statuses, classSplitRules } = useStartlistState();
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
    baseClassId?: string,
    partCount = 2,
    method: ClassSplitMethod = 'random',
  ): ClassSplitRow => ({
    id: `class-split-row-${rowIdRef.current++}`,
    baseClassId,
    partCount,
    method,
  });

  const updateRowIdCounter = (rules: ClassSplitRow[]): void => {
    const next = rules.reduce((max, rule) => {
      const match = rule.id.match(/(\d+)$/);
      if (!match) {
        return max;
      }
      const value = Number.parseInt(match[1] ?? '0', 10);
      if (Number.isNaN(value)) {
        return max;
      }
      return Math.max(max, value + 1);
    }, rowIdRef.current);
    rowIdRef.current = Math.max(rowIdRef.current, next);
  };

  const [rows, setRows] = useState<ClassSplitRow[]>(() => {
    if (classSplitRules.length > 0) {
      const initial = classSplitRules.map((rule) =>
        createRow(rule.baseClassId, rule.partCount, rule.method),
      );
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
    const stateSignature = serializeRules(classSplitRules);
    const localSignature = serializeRules(sanitizeRows(rowsRef.current));
    if (stateSignature === localSignature) {
      if (classSplitRules.length === 0 && rowsRef.current.length === 0) {
        setRows([createRow()]);
      }
      return;
    }
    if (classSplitRules.length === 0) {
      setRows([createRow()]);
      return;
    }
    const next = classSplitRules.map((rule) =>
      createRow(rule.baseClassId, rule.partCount, rule.method),
    );
    updateRowIdCounter(next);
    setRows(next);
  }, [classSplitRules]);

  useEffect(() => {
    const sanitized = sanitizeRows(rows);
    const stateSignature = serializeRules(classSplitRules);
    const localSignature = serializeRules(sanitized);
    if (stateSignature !== localSignature) {
      setClassSplitRules(dispatch, sanitized);
    }
  }, [dispatch, rows, classSplitRules]);

  useEffect(() => {
    const availableSet = new Set(availableClassIds);
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.baseClassId && !availableSet.has(row.baseClassId)) {
          changed = true;
          return { ...row, baseClassId: undefined };
        }
        return row;
      });
      return changed ? next : prev;
    });
  }, [availableClassIds]);

  useEffect(() => {
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    const invalidCounts = new Set<string>();

    rows.forEach((row) => {
      if (!row.baseClassId) {
        return;
      }
      if (seen.has(row.baseClassId)) {
        duplicates.add(row.baseClassId);
      }
      seen.add(row.baseClassId);
      if (!row.partCount || !Number.isFinite(row.partCount) || row.partCount < 2) {
        invalidCounts.add(row.baseClassId);
      }
    });

    let level = 'info';
    let message: string;
    if (duplicates.size > 0) {
      level = 'error';
      const duplicateList = Array.from(duplicates).sort((a, b) => a.localeCompare(b, 'ja'));
      message = `同じクラスが複数回設定されています: ${duplicateList.join(', ')}`;
    } else if (invalidCounts.size > 0) {
      level = 'error';
      const invalidList = Array.from(invalidCounts).sort((a, b) => a.localeCompare(b, 'ja'));
      message = `分割数は2以上の整数を入力してください: ${invalidList.join(', ')}`;
    } else {
      const sanitized = sanitizeRows(rows);
      if (sanitized.length === 0) {
        message = 'クラス分割は設定されていません。';
      } else {
        const summary = sanitized
          .map((rule) => {
            const methodLabel = methodLabelMap.get(rule.method) ?? rule.method;
            return `${rule.baseClassId} → ${rule.partCount}組（${methodLabel}）`;
          })
          .join(' / ');
        message = `クラス分割設定: ${summary}`;
      }
    }

    if (statuses.classSplit.level !== level || statuses.classSplit.text !== message) {
      setStatus(dispatch, 'classSplit', createStatus(message, level));
    }
  }, [dispatch, rows, statuses.classSplit.level, statuses.classSplit.text]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, createRow()]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createRow()];
    });
  };

  const handleBaseClassChange = (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value.trim();
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        const nextBase = value.length > 0 ? value : undefined;
        return { ...row, baseClassId: nextBase };
      }),
    );
  };

  const handlePartCountChange = (rowId: string, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const parsed = Number.parseInt(value, 10);
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        if (Number.isNaN(parsed)) {
          return { ...row, partCount: undefined };
        }
        return { ...row, partCount: parsed };
      }),
    );
  };

  const handleMethodChange = (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ClassSplitMethod;
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, method: value } : row)),
    );
  };

  return (
    <section aria-labelledby="class-split-settings-heading" className="class-split-settings">
      <header>
        <h3 id="class-split-settings-heading">クラス分割設定</h3>
        <p className="muted">クラスを複数に分割する場合の設定を行います。</p>
      </header>
      <div className="class-split-settings__rows" role="table">
        <div className="class-split-settings__header" role="row">
          <span role="columnheader">基準クラス</span>
          <span role="columnheader">分割数</span>
          <span role="columnheader">分割方法</span>
          <span role="columnheader" className="visually-hidden">
            行操作
          </span>
        </div>
        {rows.map((row) => {
          const isRemoveDisabled = rows.length === 1;
          return (
            <div key={row.id} className="class-split-settings__row" role="row">
              <label className="class-split-settings__cell" role="cell">
                <span className="visually-hidden">基準クラス</span>
                <select
                  value={row.baseClassId ?? ''}
                  onChange={(event) => handleBaseClassChange(row.id, event)}
                  disabled={availableClassIds.length === 0}
                >
                  <option value="">クラスを選択</option>
                  {availableClassIds.map((classId) => {
                    const disabled = rows.some(
                      (other) => other.id !== row.id && other.baseClassId === classId,
                    );
                    return (
                      <option key={classId} value={classId} disabled={disabled}>
                        {classId}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="class-split-settings__cell" role="cell">
                <span className="visually-hidden">分割数</span>
                <input
                  type="number"
                  min={2}
                  step={1}
                  value={row.partCount ?? ''}
                  onChange={(event) => handlePartCountChange(row.id, event)}
                  placeholder="2"
                />
              </label>
              <label className="class-split-settings__cell" role="cell">
                <span className="visually-hidden">分割方法</span>
                <select value={row.method} onChange={(event) => handleMethodChange(row.id, event)}>
                  {methodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="class-split-settings__cell class-split-settings__cell--actions"
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
      <div className="class-split-settings__actions">
        <button type="button" className="secondary" onClick={handleAddRow}>
          行を追加
        </button>
      </div>
      {availableClassIds.length === 0 ? (
        <p className="muted">エントリーにクラスがまだ登録されていません。</p>
      ) : null}
      <StatusMessage tone={statuses.classSplit.level} message={statuses.classSplit.text} />
    </section>
  );
};

export default ClassSplitSettingsPanel;
