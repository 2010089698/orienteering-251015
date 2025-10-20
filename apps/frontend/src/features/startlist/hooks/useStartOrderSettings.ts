import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  createStatus,
  removeClassWorldRanking,
  setLoading,
  setStartOrderRules,
  setStatus,
  updateClassWorldRanking,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistLoading,
  useStartlistStartOrderRules,
  useStartlistStatuses,
} from '../state/StartlistContext';
import type { StartOrderRule, StatusMessageState } from '../state/types';
import { parseWorldRankingCsv } from '../utils/worldRankingCsv';

type StartOrderRow = StartOrderRule;

export interface UseStartOrderSettingsReturn {
  rows: StartOrderRow[];
  availableClassIds: string[];
  status: StatusMessageState;
  isLoading: boolean;
  handleAddRow: () => void;
  handleRemoveRow: (rowId: string) => void;
  handleClassChange: (rowId: string, event: ChangeEvent<HTMLSelectElement>) => void;
  handleMethodChange: (rowId: string, event: ChangeEvent<HTMLSelectElement>) => void;
  handleWorldRankingUpload: (
    rowId: string,
  ) => (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

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

type ComparableRow = Pick<StartOrderRow, 'method'> & {
  classId: string | null;
  csvName: string | null;
};

const toComparableRows = (rows: StartOrderRow[]): ComparableRow[] =>
  rows.map((row) => ({
    method: row.method,
    classId: row.classId ?? null,
    csvName: row.csvName ?? null,
  }));

const areComparableRowsEqual = (a: ComparableRow[], b: ComparableRow[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((row, index) => {
    const other = b[index];
    if (!other) {
      return false;
    }
    return row.method === other.method && row.classId === other.classId && row.csvName === other.csvName;
  });
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

export const useStartOrderSettings = (): UseStartOrderSettingsReturn => {
  const entries = useStartlistEntries();
  const statuses = useStartlistStatuses();
  const loading = useStartlistLoading();
  const startOrderRules = useStartlistStartOrderRules();
  const dispatch = useStartlistDispatch();

  const availableClassIds = useMemo(
    () =>
      Array.from(new Set(entries.map((entry) => entry.classId))).sort((a, b) =>
        a.localeCompare(b, 'ja'),
      ),
    [entries],
  );

  const rowIdRef = useRef(0);

  const createRow = useCallback(
    (classId?: string, method: StartOrderRow['method'] = 'random', csvName?: string): StartOrderRow => ({
      id: `start-order-row-${rowIdRef.current++}`,
      classId,
      method,
      csvName,
    }),
    [],
  );

  const updateRowIdCounter = useCallback((rules: StartOrderRow[]) => {
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
  }, []);

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

  const comparableRows = useMemo(() => toComparableRows(rows), [rows]);
  const comparableRowsRef = useRef(comparableRows);
  useEffect(() => {
    comparableRowsRef.current = comparableRows;
  }, [comparableRows]);

  const comparableStartOrderRules = useMemo(
    () => toComparableRows(startOrderRules),
    [startOrderRules],
  );
  const comparableStartOrderRulesRef = useRef(comparableStartOrderRules);
  useEffect(() => {
    comparableStartOrderRulesRef.current = comparableStartOrderRules;
  }, [comparableStartOrderRules]);

  useEffect(() => {
    if (areComparableRowsEqual(comparableStartOrderRules, comparableRowsRef.current)) {
      return;
    }
    if (startOrderRules.length === 0) {
      setRows((prev) => (prev.length === 0 ? [createRow()] : prev));
      return;
    }
    const next = startOrderRules.map((rule) => ({ ...rule }));
    updateRowIdCounter(next);
    setRows(next);
  }, [comparableStartOrderRules, createRow, startOrderRules, updateRowIdCounter]);

  useEffect(() => {
    if (areComparableRowsEqual(comparableRows, comparableStartOrderRulesRef.current)) {
      return;
    }
    setStartOrderRules(dispatch, rowsRef.current);
  }, [comparableRows, dispatch]);

  useEffect(() => {
    const availableSet = new Set(availableClassIds);
    const removed: string[] = [];
    setRows((prev) => {
      let changed = false;
      const next = prev.map<StartOrderRow>((row) => {
        if (row.classId && !availableSet.has(row.classId)) {
          if (row.method === 'worldRanking') {
            removed.push(row.classId);
          }
          changed = true;
          const sanitized: StartOrderRow = {
            ...row,
            classId: undefined,
            method: 'random',
            csvName: undefined,
          };
          return sanitized;
        }
        return row;
      });
      return changed ? next : prev;
    });
    removed.forEach((classId) => removeClassWorldRanking(dispatch, classId));
  }, [availableClassIds, dispatch]);

  useEffect(() => {
    const targets = deriveTargets(rowsRef.current);
    if (statuses.startOrder.level === 'success' || statuses.startOrder.level === 'error') {
      return;
    }
    const message =
      targets.length === 0
        ? '世界ランキング対象クラスを選択していません。'
        : `世界ランキング対象クラス: ${targets.join(', ')}`;
    setStatus(dispatch, 'startOrder', createStatus(message, 'info'));
  }, [dispatch, statuses.startOrder.level]);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createRow()]);
  }, [createRow]);

  const handleRemoveRow = useCallback(
    (rowId: string) => {
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
    },
    [createRow, dispatch],
  );

  const handleClassChange = useCallback(
    (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value.trim();
      let removedClassId: string | undefined;
      setRows((prev) =>
        prev.map<StartOrderRow>((row) => {
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
    },
    [dispatch],
  );

  const handleMethodChange = useCallback(
    (rowId: string, event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as StartOrderRow['method'];
      let removedClassId: string | undefined;
      setRows((prev) =>
        prev.map<StartOrderRow>((row) => {
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
    },
    [dispatch],
  );

  const handleWorldRankingUpload = useCallback(
    (rowId: string) => async (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.target.files ?? []);
      if (!file) {
        return;
      }

      const targetRow = rowsRef.current.find((row) => row.id === rowId);
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
          prev.map<StartOrderRow>((row) => (row.id === rowId ? { ...row, csvName: file.name } : row)),
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
          prev.map<StartOrderRow>((row) =>
            row.id === rowId ? { ...row, csvName: undefined } : row,
          ),
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
    },
    [dispatch],
  );

  return {
    rows,
    availableClassIds,
    status: statuses.startOrder,
    isLoading: Boolean(loading.startOrder),
    handleAddRow,
    handleRemoveRow,
    handleClassChange,
    handleMethodChange,
    handleWorldRankingUpload,
  };
};

export default useStartOrderSettings;
