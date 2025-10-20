import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStartlistApi } from './useStartlistApi';

const originalFetch = global.fetch;

let fetchMock: ReturnType<typeof vi.fn>;

describe('useStartlistApi', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('posts settings payload to the expected endpoint', async () => {
    const { result } = renderHook(() => useStartlistApi());
    const snapshot = { ok: true };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await result.current.enterSettings({
      startlistId: 'SL-1',
      settings: {
        eventId: 'event',
        startTime: '2024-01-01T00:00:00.000Z',
        intervals: {
          laneClass: { milliseconds: 60000 },
          classPlayer: { milliseconds: 45000 },
        },
        laneCount: 2,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/startlists/SL-1/settings', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toContain('event');
    const body = JSON.parse(init?.body as string);
    expect(body.startTime).toBe('2024-01-01T00:00:00.000Z');
    expect(body.intervals.laneClass).toEqual({ milliseconds: 60000 });
    expect(body.intervals.classPlayer).toEqual({ milliseconds: 45000 });
  });

  it('returns fetched snapshots without additional normalization', async () => {
    const { result } = renderHook(() => useStartlistApi());
    const snapshot = {
      settings: {
        eventId: 'legacy',
        startTime: '2024-01-01T00:00:00.000Z',
        intervals: {
          laneClass: { milliseconds: 60000 },
          classPlayer: { milliseconds: 60000 },
        },
        laneCount: 2,
      },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await result.current.fetchSnapshot({ startlistId: 'SL-1' });
    expect(response).toEqual(snapshot);
  });

  it('appends optional reason when reassigning lane order manually', async () => {
    const { result } = renderHook(() => useStartlistApi());
    fetchMock.mockResolvedValue(
      new Response(undefined, { status: 204 }),
    );

    await result.current.assignLaneOrder({
      startlistId: 'SL-1',
      assignments: [],
      reason: '調整',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toContain('"reason"');
  });

  it('throws when the API responds with an error status', async () => {
    const { result } = renderHook(() => useStartlistApi());
    fetchMock.mockResolvedValue(
      new Response('失敗しました', { status: 500, statusText: 'Server Error' }),
    );

    await expect(result.current.fetchSnapshot({ startlistId: 'bad' })).rejects.toThrow('失敗しました');
  });

  it('honours custom base path from environment variables', async () => {
    const originalEnv = { ...import.meta.env } as Record<string, string>;
    Object.assign(import.meta.env, { VITE_STARTLIST_API_BASE_URL: 'https://api.example.com/startlists/' });

    const { result } = renderHook(() => useStartlistApi());

    fetchMock.mockResolvedValue(
      new Response(undefined, { status: 204 }),
    );

    await result.current.enterSettings({
      startlistId: 'SL-9',
      settings: {
        eventId: 'event',
        startTime: '2024-01-01T00:00:00.000Z',
        intervals: {
          laneClass: { milliseconds: 60000 },
          classPlayer: { milliseconds: 60000 },
        },
        laneCount: 6,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/startlists/SL-9/settings',
      expect.objectContaining({ method: 'POST' }),
    );

    Object.assign(import.meta.env, originalEnv);
  });
});
