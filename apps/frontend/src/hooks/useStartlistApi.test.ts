import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStartlistApi } from './useStartlistApi';

declare global {
  // eslint-disable-next-line no-var
  var fetch: ReturnType<typeof vi.fn>;
}

describe('useStartlistApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('posts settings payload to the expected endpoint', async () => {
    const { result } = renderHook(() => useStartlistApi());
    const snapshot = { ok: true };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const startTime = new Date('2024-01-01T00:00:00.000Z');

    await result.current.enterSettings({
      startlistId: 'SL-1',
      settings: {
        eventId: 'event',
        startTime,
        intervals: {
          laneClass: { milliseconds: 60000 },
          classPlayer: { milliseconds: 45000 },
        },
        laneCount: 2,
      },
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/startlists/SL-1/settings', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init?.body).toContain('event');
    const body = JSON.parse(init?.body as string);
    expect(body.startTime).toBe(startTime.toISOString());
    expect(body.intervals.laneClass).toEqual({ milliseconds: 60000 });
    expect(body.intervals.classPlayer).toEqual({ milliseconds: 45000 });
  });

  it('normalizes legacy interval fields when fetching snapshots', async () => {
    const { result } = renderHook(() => useStartlistApi());
    const snapshot = {
      settings: {
        eventId: 'legacy',
        startTime: '2024-01-01T00:00:00.000Z',
        interval: { milliseconds: 60000 },
        laneCount: 2,
      },
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await result.current.fetchSnapshot({ startlistId: 'SL-1' });
    const settings = response.settings as Record<string, unknown>;
    expect(settings?.intervals).toBeDefined();
    expect(settings?.intervals).toEqual({
      laneClass: { milliseconds: 60000 },
      classPlayer: { milliseconds: 60000 },
    });
  });

  it('appends optional reason when reassigning lane order manually', async () => {
    const { result } = renderHook(() => useStartlistApi());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(undefined, { status: 204 }),
    );

    await result.current.assignLaneOrder({
      startlistId: 'SL-1',
      assignments: [],
      reason: '調整',
    });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init?.body).toContain('"reason"');
  });

  it('throws when the API responds with an error status', async () => {
    const { result } = renderHook(() => useStartlistApi());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('失敗しました', { status: 500, statusText: 'Server Error' }),
    );

    await expect(result.current.fetchSnapshot({ startlistId: 'bad' })).rejects.toThrow('失敗しました');
  });
});
