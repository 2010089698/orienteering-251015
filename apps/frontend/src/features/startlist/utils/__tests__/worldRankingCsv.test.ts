import { describe, expect, it } from 'vitest';
import { parseWorldRankingCsv } from '../worldRankingCsv';

describe('parseWorldRankingCsv', () => {
  it('parses IOF IDs and rankings from CSV text', () => {
    const csv = [
      'Rank,Name,IOF ID',
      '1,Runner One,IOF-001',
      '2,Runner Two, IOF-002 ',
    ].join('\n');

    const ranking = parseWorldRankingCsv(csv);

    expect(ranking.size).toBe(2);
    expect(ranking.get('IOF-001')).toBe(1);
    expect(ranking.get('IOF-002')).toBe(2);
  });

  it('keeps the best ranking for duplicate IOF IDs and handles different headers', () => {
    const csv = [
      '\ufeffWorld Ranking\tRunner ID\tExtra',
      '15\tiof003\tfoo',
      '12\tIOF003\tbar',
    ].join('\n');

    const ranking = parseWorldRankingCsv(csv);

    expect(ranking.size).toBe(1);
    expect(ranking.get('IOF003')).toBe(12);
  });

  it('returns an empty map when rows are empty', () => {
    expect(parseWorldRankingCsv('\n')).toEqual(new Map());
  });

  it('throws when required columns are missing', () => {
    const csv = ['Rank,Name', '1,Runner One'].join('\n');
    expect(() => parseWorldRankingCsv(csv)).toThrow(
      '世界ランキング CSV に必要な列 (IOF ID, Rank) が見つかりません。',
    );
  });
});
