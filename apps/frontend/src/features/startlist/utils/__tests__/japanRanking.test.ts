import { describe, expect, it, vi } from 'vitest';
import { fetchJapanRanking, parseJapanRankingHtml } from '../japanRanking';

const createHtml = (rows: Array<{ rank: string; iofId: string }>): string => {
  const body = rows
    .map(
      (row) =>
        `<tr><td>${row.rank}</td><td>${row.iofId}</td></tr>`,
    )
    .join('');
  return `
    <table>
      <thead>
        <tr><th>順位</th><th>IOF ID</th></tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  `;
};

describe('parseJapanRankingHtml', () => {
  it('parses IOF IDs and ranks from ranking tables', () => {
    const html = createHtml([
      { rank: '1', iofId: '  IOF001 ' },
      { rank: '2位', iofId: 'iof-002' },
      { rank: '3', iofId: ' ' },
    ]);

    const entries = parseJapanRankingHtml(html);
    expect(entries).toEqual([
      { iofId: 'IOF001', rank: 1 },
      { iofId: 'IOF-002', rank: 2 },
    ]);
  });

  it('returns an empty list when no suitable table exists', () => {
    const html = '<div><p>No data</p></div>';
    expect(parseJapanRankingHtml(html)).toEqual([]);
  });
});

describe('fetchJapanRanking', () => {
  it('fetches multiple pages and merges overlapping rows', async () => {
    const firstPage = createHtml([
      { rank: '1', iofId: 'IOF001' },
      { rank: '2', iofId: 'IOF002' },
      { rank: '3', iofId: 'IOF003' },
    ]);
    const secondPage = createHtml([
      { rank: '3', iofId: 'IOF003' },
      { rank: '4', iofId: 'IOF004' },
      { rank: '5', iofId: 'IOF005' },
    ]);

    const fetchMock = vi.fn<
      Parameters<NonNullable<Parameters<typeof fetchJapanRanking>[0]['fetchImpl']>>,
      Promise<Response>
    >();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => firstPage,
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => secondPage,
    } as Response);

    const ranking = await fetchJapanRanking({ categoryId: '1', pages: 2, fetchImpl: fetchMock });
    expect(Array.from(ranking.entries())).toEqual([
      ['IOF001', 1],
      ['IOF002', 2],
      ['IOF003', 3],
      ['IOF004', 4],
      ['IOF005', 5],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('assigns sequential ranks when page numbering restarts', async () => {
    const firstPage = createHtml([
      { rank: '1', iofId: 'IOF010' },
      { rank: '2', iofId: 'IOF011' },
    ]);
    const secondPage = createHtml([
      { rank: '1', iofId: 'IOF012' },
      { rank: '2', iofId: 'IOF013' },
    ]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => {
        return fetchMock.mock.calls.length === 1 ? firstPage : secondPage;
      },
    } as Response);

    const ranking = await fetchJapanRanking({ categoryId: '1', pages: 2, fetchImpl: fetchMock });
    expect(Array.from(ranking.entries())).toEqual([
      ['IOF010', 1],
      ['IOF011', 2],
      ['IOF012', 3],
      ['IOF013', 4],
    ]);
  });
});
