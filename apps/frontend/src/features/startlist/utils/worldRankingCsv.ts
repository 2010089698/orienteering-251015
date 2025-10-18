import { type WorldRankingMap } from '../state/types';

const headerMap: Record<string, 'iofId' | 'ranking'> = {
  'iof id': 'iofId',
  iofid: 'iofId',
  iof: 'iofId',
  'athlete id': 'iofId',
  'athleteid': 'iofId',
  'athlete no': 'iofId',
  'athlete number': 'iofId',
  'runner id': 'iofId',
  'runnerid': 'iofId',
  'runner no': 'iofId',
  'runner number': 'iofId',
  'ranking position': 'ranking',
  rank: 'ranking',
  ranking: 'ranking',
  'world ranking': 'ranking',
  'wr rank': 'ranking',
  position: 'ranking',
};

const normalizeHeader = (value: string): string =>
  value
    .replace(/^[\ufeff]+/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

const detectDelimiter = (text: string): ',' | '\t' => {
  let inQuotes = false;
  const newlineIndex = text.search(/\r\n|\n|\r/);
  const endIndex = newlineIndex === -1 ? text.length : newlineIndex;

  for (let i = 0; i < endIndex; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (char === ',' || char === '\t')) {
      return char as ',' | '\t';
    }
  }

  return ',';
};

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  const delimiter = detectDelimiter(text);
  const pushCell = (row: string[]) => {
    row.push(current);
    current = '';
  };

  let row: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      pushCell(row);
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      pushCell(row);
      rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    pushCell(row);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
};

const ensureHeaders = (headers: (keyof typeof headerMap | undefined)[]): void => {
  const hasIof = headers.includes('iofId');
  const hasRanking = headers.includes('ranking');
  if (!hasIof || !hasRanking) {
    throw new Error('世界ランキング CSV に必要な列 (IOF ID, Rank) が見つかりません。');
  }
};

const normalizeIofId = (value: string): string => value.replace(/\s+/g, '').toUpperCase();

const parseRankingValue = (value: string): number | undefined => {
  const normalized = value
    .replace(/[^0-9.,-]+/g, '')
    .replace(/,(?=[0-9])/g, '.')
    .trim();
  if (!normalized) {
    return undefined;
  }
  const numeric = Number.parseFloat(normalized);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return Math.round(numeric);
};

export const parseWorldRankingCsv = (text: string): WorldRankingMap => {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return new Map();
  }

  const headerRow = rows[0] ?? [];
  const mappedHeaders = headerRow.map((cell) => headerMap[normalizeHeader(cell)]);
  ensureHeaders(mappedHeaders);

  const ranking = new Map<string, number>();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    let iofId = '';
    let rankValue: number | undefined;

    for (let columnIndex = 0; columnIndex < mappedHeaders.length; columnIndex += 1) {
      const column = mappedHeaders[columnIndex];
      if (!column) {
        continue;
      }
      const cell = row[columnIndex] ?? '';
      if (column === 'iofId') {
        iofId = normalizeIofId(cell);
      } else if (column === 'ranking') {
        rankValue = parseRankingValue(cell);
      }
    }

    if (!iofId || rankValue === undefined) {
      continue;
    }

    const existing = ranking.get(iofId);
    if (existing === undefined || rankValue < existing) {
      ranking.set(iofId, rankValue);
    }
  }

  return ranking;
};
