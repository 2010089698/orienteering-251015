import type { WorldRankingMap } from '../state/types';

type JapanRankingHeader = 'rank' | 'iofId';

const JAPAN_RANKING_BASE_URL = 'https://japan-o-entry.com/ranking/ranking/ranking_index';

const toHalfWidth = (value: string): string =>
  value.replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));

const normalizeWhitespace = (value: string): string => value.replace(/[\s\u3000]+/g, ' ').trim();

const normalizeHeader = (value: string): string => normalizeWhitespace(toHalfWidth(value)).toLowerCase();

const headerMap: Record<string, JapanRankingHeader> = {
  rank: 'rank',
  'ranking position': 'rank',
  position: 'rank',
  '順位': 'rank',
  'ranking': 'rank',
  'rank.': 'rank',
  'iof id': 'iofId',
  'iofid': 'iofId',
  'iof': 'iofId',
  'iof-id': 'iofId',
  'iof 番号': 'iofId',
  'iof番号': 'iofId',
  '会員番号': 'iofId',
};

const mapHeader = (value: string): JapanRankingHeader | undefined => {
  const normalized = normalizeHeader(value);
  if (headerMap[normalized]) {
    return headerMap[normalized];
  }
  if (normalized.includes('iof')) {
    return 'iofId';
  }
  if (normalized.includes('rank') || normalized.includes('順位')) {
    return 'rank';
  }
  return undefined;
};

const parseDocument = (html: string): Document => {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html');
  }
  throw new Error('DOMParser が利用できません。');
};

const extractText = (element: Element | null | undefined): string =>
  normalizeWhitespace(element?.textContent ?? '');

const normalizeIofId = (value: string): string => toHalfWidth(value).replace(/\s+/g, '').toUpperCase();

const parseRank = (value: string): number | undefined => {
  const normalized = toHalfWidth(value).replace(/[^0-9]+/g, '');
  if (!normalized) {
    return undefined;
  }
  const numeric = Number.parseInt(normalized, 10);
  return Number.isNaN(numeric) ? undefined : numeric;
};

export interface JapanRankingEntry {
  iofId: string;
  rank?: number;
}

export const parseJapanRankingHtml = (html: string): JapanRankingEntry[] => {
  const doc = parseDocument(html);
  const tables = Array.from(doc.querySelectorAll('table'));
  for (const table of tables) {
    const headerRow =
      table.querySelector('thead tr') ??
      Array.from(table.querySelectorAll('tr')).find((row) => row.querySelectorAll('th').length > 0);
    const headerCells = headerRow
      ? Array.from(headerRow.querySelectorAll('th')).length > 0
        ? Array.from(headerRow.querySelectorAll('th'))
        : Array.from(headerRow.children)
      : [];
    if (headerCells.length === 0) {
      continue;
    }
    const mappedHeaders = headerCells.map((cell) => mapHeader(extractText(cell)));
    if (!mappedHeaders.includes('iofId')) {
      continue;
    }
    const dataRows = Array.from(table.querySelectorAll('tr')).filter((row) => {
      if (row === headerRow) {
        return false;
      }
      const cells = row.querySelectorAll('td');
      return cells.length > 0 && extractText(row).length > 0;
    });
    const entries: JapanRankingEntry[] = [];
    dataRows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length === 0) {
        return;
      }
      let iofId = '';
      let rank: number | undefined;
      for (let index = 0; index < Math.min(cells.length, mappedHeaders.length); index += 1) {
        const header = mappedHeaders[index];
        if (!header) {
          continue;
        }
        const cell = cells[index];
        const text = extractText(cell);
        if (header === 'iofId') {
          iofId = normalizeIofId(text);
        } else if (header === 'rank') {
          rank = parseRank(text);
        }
      }
      if (!iofId) {
        return;
      }
      entries.push({ iofId, rank });
    });
    if (entries.length > 0) {
      return entries;
    }
  }
  return [];
};

export interface FetchJapanRankingOptions {
  categoryId: string;
  pages: number;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  signal?: AbortSignal;
}

export const fetchJapanRanking = async ({
  categoryId,
  pages,
  fetchImpl,
  signal,
}: FetchJapanRankingOptions): Promise<WorldRankingMap> => {
  const fetchFn = fetchImpl ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new Error('日本ランキングを取得するための fetch が利用できません。');
  }
  const sanitizedCategoryId = (categoryId ?? '1').trim() || '1';
  const maxPages = Math.max(1, pages || 1);

  const ranking = new Map<string, number>();
  let highestObservedRank = 0;
  let lastAssignedRank = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${JAPAN_RANKING_BASE_URL}/${encodeURIComponent(sanitizedCategoryId)}/${page}`;
    const response = await fetchFn(url, { signal });
    if (!response.ok) {
      throw new Error(`日本ランキングの取得に失敗しました (HTTP ${response.status}).`);
    }
    const html = await response.text();
    const entries = parseJapanRankingHtml(html);
    if (entries.length === 0) {
      break;
    }
    entries.forEach((entry) => {
      if (entry.rank !== undefined && entry.rank > highestObservedRank) {
        highestObservedRank = entry.rank;
      }
      const normalizedId = normalizeIofId(entry.iofId);
      if (!normalizedId || ranking.has(normalizedId)) {
        return;
      }
      let rank = entry.rank;
      if (rank === undefined) {
        rank = Math.max(lastAssignedRank, highestObservedRank) + 1;
      } else if (rank <= lastAssignedRank) {
        rank = lastAssignedRank + 1;
      }
      ranking.set(normalizedId, rank);
      lastAssignedRank = rank;
      if (rank > highestObservedRank) {
        highestObservedRank = rank;
      }
    });
  }

  return ranking;
};

