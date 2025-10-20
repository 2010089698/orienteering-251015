import { RENTAL_CARD_LABEL, type Entry, type EntryDraft } from '../state/types';

const headerMap: Record<string, keyof EntryDraft> = {
  name: 'name',
  名前: 'name',
  氏名: 'name',
  選手名: 'name',
  club: 'club',
  所属: 'club',
  class: 'classId',
  classid: 'classId',
  class_id: 'classId',
  classname: 'classId',
  クラス: 'classId',
  クラス名: 'classId',
  カテゴリ: 'classId',
  'チーム名(氏名)': 'name',
  'チーム名（氏名）': 'name',
  'カード番号': 'cardNo',
  'カード番号:': 'cardNo',
  'カード番号：': 'cardNo',
  カードno: 'cardNo',
  カードﾅﾝﾊﾞｰ: 'cardNo',
  'cardnumber': 'cardNo',
  'card number': 'cardNo',
  card: 'cardNo',
  cardno: 'cardNo',
  card_no: 'cardNo',
  iofid: 'iofId',
  iof: 'iofId',
  iofnumber: 'iofId',
  iofno: 'iofId',
  iofcode: 'iofId',
  'iof番号': 'iofId',
  'iofid番号': 'iofId',
  iofidnumber: 'iofId',
};

const stripHeaderPrefixes = (value: string): string =>
  value.replace(/^[\ufeff]+/, '').replace(/^(?:[0-9０-９]+)\s*(?:人目|名|番目)?\s*/iu, '');

const normalizeHeader = (value: string): string =>
  stripHeaderPrefixes(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const compactHeaderKey = (value: string): string => normalizeHeader(value).replace(/\s+/g, '');

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizeCardNo = (value: string): string => value.replace(/\s+/g, '').trim();

const normalizeIofId = (value: string): string => value.replace(/\s+/g, '').toUpperCase().trim();

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

const mapHeaderValue = (value: string): keyof EntryDraft | undefined => {
  const normalized = compactHeaderKey(value);
  return headerMap[normalized as keyof typeof headerMap];
};

const mapHeaders = (
  rows: string[][],
  startRow: number,
  endRow: number,
): { headers: (keyof EntryDraft | undefined)[]; lastHeaderRow: number } => {
  const columnCount = rows
    .slice(startRow, endRow)
    .reduce((max, row) => Math.max(max, row.length), 0);

  const headers: (keyof EntryDraft | undefined)[] = Array.from({ length: columnCount }, () => undefined);
  const headerRowByColumn: number[] = Array.from({ length: columnCount }, () => startRow);

  for (let rowIndex = startRow; rowIndex < endRow; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const cell = row[columnIndex] ?? '';
      const mapped = mapHeaderValue(cell);
      if (mapped) {
        headers[columnIndex] = mapped;
        headerRowByColumn[columnIndex] = rowIndex;
      }
    }
  }

  const lastHeaderRow = headerRowByColumn.reduce((max, rowIndex, index) => {
    if (headers[index]) {
      return Math.max(max, rowIndex);
    }
    return max;
  }, startRow);

  return { headers, lastHeaderRow };
};

const requiredColumns: (keyof EntryDraft)[] = ['name', 'classId', 'cardNo'];
const requiredRowFields: (keyof EntryDraft)[] = ['name', 'classId', 'cardNo'];

const HEADER_SCAN_LIMIT = 10;

const ensureRequiredColumns = (mappedHeaders: (keyof EntryDraft | undefined)[]): void => {
  const present = new Set(mappedHeaders.filter(Boolean));
  const missing = requiredColumns.filter((field) => !present.has(field));
  if (missing.length > 0) {
    throw new Error('CSV ファイルに必須列 (name, class, card number) が含まれていません。');
  }
};

const createEntryFromRow = (
  row: string[],
  headers: (keyof EntryDraft | undefined)[],
  rowNumber: number,
): EntryDraft => {
  const entry: EntryDraft = {
    name: '',
    club: '',
    classId: '',
    cardNo: '',
  };

  headers.forEach((key, index) => {
    if (!key) {
      return;
    }

    const raw = row[index] ?? '';
    let normalized: string;
    if (key === 'cardNo') {
      normalized = normalizeCardNo(raw);
    } else if (key === 'iofId') {
      normalized = normalizeIofId(raw);
    } else {
      normalized = normalizeText(raw);
    }
    if (!normalized) {
      return;
    }

    entry[key] = normalized;
  });

  if (!entry.cardNo) {
    entry.cardNo = RENTAL_CARD_LABEL;
  }

  for (const field of requiredRowFields) {
    if (!entry[field] || entry[field]?.toString().length === 0) {
      throw new Error(`CSV ${rowNumber} 行目で必須項目 ${field} が空です。`);
    }
  }

  return entry;
};

const isRentalCard = (cardNo: string): boolean => {
  const normalized = cardNo.trim();
  return normalized.length === 0 || normalized === RENTAL_CARD_LABEL;
};

const createCardComparisonKey = (cardNo: string): string | null => {
  const normalized = cardNo.trim();
  if (normalized.length === 0 || normalized === RENTAL_CARD_LABEL) {
    return null;
  }
  return normalized;
};

const ensureNoDuplicates = (entries: EntryDraft[], existingEntries: Entry[]): void => {
  const existingCards = new Set<string>();

  existingEntries.forEach((entry) => {
    const key = createCardComparisonKey(entry.cardNo);
    if (key) {
      existingCards.add(key);
    }
  });

  for (const entry of entries) {
    if (isRentalCard(entry.cardNo)) {
      continue;
    }
    const normalizedCardNo = entry.cardNo.trim();
    if (existingCards.has(normalizedCardNo)) {
      throw new Error(`カード番号 ${normalizedCardNo} はすでに登録されています。`);
    }
  }

  const withinFile = new Set<string>();
  for (const entry of entries) {
    if (isRentalCard(entry.cardNo)) {
      continue;
    }
    const normalizedCardNo = entry.cardNo.trim();
    if (withinFile.has(normalizedCardNo)) {
      throw new Error(`CSV 内に重複したカード番号 ${normalizedCardNo} が含まれています。`);
    }
    withinFile.add(normalizedCardNo);
  }
};

export const parseEntriesFromCsvText = (text: string, existingEntries: Entry[]): EntryDraft[] => {
  const rows = parseCsv(text.replace(/^\ufeff/, ''));
  if (rows.length === 0) {
    return [];
  }
  const findHeaderRow = (): {
    headerIndex: number;
    mappedHeaders: (keyof EntryDraft | undefined)[];
  } => {
    const scanLimit = Math.min(rows.length, HEADER_SCAN_LIMIT);
    for (let startRow = 0; startRow < scanLimit; startRow += 1) {
      const { headers, lastHeaderRow } = mapHeaders(rows, startRow, scanLimit);
      try {
        ensureRequiredColumns(headers);
        return {
          headerIndex: lastHeaderRow,
          mappedHeaders: headers,
        };
      } catch (error) {
        // continue searching for a valid header row
      }
    }

    const fallbackLimit = Math.min(rows.length, HEADER_SCAN_LIMIT || rows.length);
    const { headers: fallbackHeaders, lastHeaderRow: fallbackHeaderIndex } = mapHeaders(
      rows,
      0,
      Math.max(fallbackLimit, 1),
    );
    ensureRequiredColumns(fallbackHeaders);
    return {
      headerIndex: fallbackHeaderIndex,
      mappedHeaders: fallbackHeaders,
    };
  };

  const { headerIndex, mappedHeaders } = findHeaderRow();
  const dataRows = rows.slice(headerIndex + 1);

  const entries = dataRows.map((row, index) =>
    createEntryFromRow(row, mappedHeaders, headerIndex + index + 2),
  );

  ensureNoDuplicates(entries, existingEntries);

  return entries;
};

export const parseEntriesFromCsvFile = async (
  file: File,
  existingEntries: Entry[],
): Promise<EntryDraft[]> => {
  const readFileText = async (): Promise<string> => {
    if (typeof file.text === 'function') {
      try {
        return await file.text();
      } catch (error) {
        if (error instanceof Error) {
          // fall back to alternative strategies below
        }
      }
    }

    if (typeof FileReader !== 'undefined') {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(typeof reader.result === 'string' ? reader.result : '');
        };
        reader.onerror = () => {
          reject(reader.error ?? new Error('ファイルの読み込みに失敗しました。'));
        };
        reader.readAsText(file);
      });
    }

    if (typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      return new TextDecoder().decode(buffer);
    }

    return new Response(file).text();
  };

  const text = await readFileText();
  return parseEntriesFromCsvText(text, existingEntries);
};
