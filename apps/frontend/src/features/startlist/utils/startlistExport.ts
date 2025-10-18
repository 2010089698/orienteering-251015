import type { ClassAssignmentDto, StartTimeDto } from '@startlist-management/application';
import { RENTAL_CARD_LABEL, type Entry } from '../state/types';

type DownloadContext = {
  createObjectURL: typeof URL.createObjectURL;
  revokeObjectURL: typeof URL.revokeObjectURL;
  document: Document;
};

export type StartlistExportRow = {
  classId: string;
  startNumber: string;
  name: string;
  club: string;
  cardNo: string;
};

export type BuildStartlistExportRowsOptions = {
  entries: Entry[];
  startTimes: StartTimeDto[];
  classAssignments: ClassAssignmentDto[];
  startNumberOffset?: number;
};

const DEFAULT_START_NUMBER_OFFSET = 1;

const formatJstTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
    timeZoneName: 'short',
  });
};

const normalizeStartTime = (startTime: Date | string): { iso: string; timestamp: number; label: string } => {
  const iso = typeof startTime === 'string' ? startTime : startTime.toISOString();
  const timestamp = Date.parse(iso);
  const label = formatJstTimestamp(iso);
  return { iso, timestamp, label };
};

const escapeCsvValue = (value: string): string => {
  const normalized = value ?? '';
  if (/[",\n\r]/.test(normalized)) {
    const escaped = normalized.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return normalized;
};

export const buildStartlistExportRows = ({
  entries,
  startTimes,
  classAssignments,
  startNumberOffset = DEFAULT_START_NUMBER_OFFSET,
}: BuildStartlistExportRowsOptions): StartlistExportRow[] => {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const playerClassMap = new Map<string, string>();
  classAssignments.forEach((assignment) => {
    assignment.playerOrder.forEach((playerId) => {
      if (!playerClassMap.has(playerId)) {
        playerClassMap.set(playerId, assignment.classId);
      }
    });
  });

  const startTimeEntries = startTimes.map((item, index) => {
    const normalized = normalizeStartTime(item.startTime);
    return {
      item,
      index,
      normalized,
    };
  });

  startTimeEntries.sort((a, b) => {
    const aInvalid = Number.isNaN(a.normalized.timestamp);
    const bInvalid = Number.isNaN(b.normalized.timestamp);
    if (aInvalid && bInvalid) {
      return a.index - b.index;
    }
    if (aInvalid) {
      return 1;
    }
    if (bInvalid) {
      return -1;
    }
    if (a.normalized.timestamp === b.normalized.timestamp) {
      return a.index - b.index;
    }
    return a.normalized.timestamp - b.normalized.timestamp;
  });

  const rows: StartlistExportRow[] = [];
  const usedStartNumbers = new Set<string>();

  startTimeEntries.forEach(({ item }, sortedIndex) => {
    const entry = entryMap.get(item.playerId);
    const classId = entry?.classId ?? playerClassMap.get(item.playerId) ?? '不明';
    const name = entry?.name ?? '（名前未入力）';
    const club = entry?.club ?? '';
    let cardNo = entry?.cardNo ?? item.playerId;
    if (cardNo === RENTAL_CARD_LABEL) {
      cardNo = '';
    }

    const startNumberValue = startNumberOffset + sortedIndex;
    const startNumberNumericText = String(startNumberValue);
    if (startNumberNumericText.length >= 6) {
      throw new Error('start number range exceeded');
    }
    const startNumber = startNumberNumericText.padStart(3, '0');
    if (usedStartNumbers.has(startNumber)) {
      throw new Error(`duplicate start number detected: ${startNumber}`);
    }
    usedStartNumbers.add(startNumber);

    rows.push({
      classId,
      startNumber,
      name,
      club,
      cardNo,
    });
  });

  return rows;
};

export const exportRowToCsvLine = (row: StartlistExportRow): string => {
  const values = [row.classId, row.startNumber, row.name, row.club ?? '', row.cardNo ?? ''];
  return values.map((value) => escapeCsvValue(value)).join(',');
};

export type DownloadStartlistCsvOptions = {
  entries: Entry[];
  startTimes: StartTimeDto[];
  classAssignments: ClassAssignmentDto[];
  fileNamePrefix?: string;
  context?: Partial<DownloadContext>;
};

const DEFAULT_FILE_PREFIX = 'startlist';

const resolveDownloadContext = (override?: Partial<DownloadContext>): DownloadContext => {
  const globalDocument = typeof document === 'undefined' ? undefined : document;
  const createObjectURL = override?.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeObjectURL = override?.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  const doc = override?.document ?? globalDocument;
  if (!doc || typeof doc.createElement !== 'function' || !doc.body) {
    throw new Error('document is not available for CSV download');
  }
  return { createObjectURL, revokeObjectURL, document: doc };
};

const buildDefaultFileName = (prefix: string): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${year}${month}${day}.csv`;
};

export const downloadStartlistCsv = ({
  entries,
  startTimes,
  classAssignments,
  fileNamePrefix = DEFAULT_FILE_PREFIX,
  context: contextOverride,
}: DownloadStartlistCsvOptions): number => {
  if (startTimes.length === 0) {
    throw new Error('スタート時間が存在しません。');
  }

  const { createObjectURL, revokeObjectURL, document: doc } = resolveDownloadContext(contextOverride);

  const rows = buildStartlistExportRows({ entries, startTimes, classAssignments });
  const header = ['クラス', 'スタート番号', '氏名', 'クラブ', 'カード番号'];
  const csvLines = [header.join(','), ...rows.map((row) => exportRowToCsvLine(row))];
  const csvContent = `\ufeff${csvLines.join('\r\n')}`;

  let link: HTMLAnchorElement | null = null;
  let url: string | null = null;

  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    url = createObjectURL(blob);
    link = doc.createElement('a');
    link.href = url;
    link.download = buildDefaultFileName(fileNamePrefix);
    link.style.display = 'none';
    doc.body.appendChild(link);
    link.click();
  } finally {
    if (link && link.isConnected) {
      link.remove();
    }
    if (url) {
      revokeObjectURL(url);
    }
  }

  return rows.length;
};
