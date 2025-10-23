import { describe, expect, it, vi } from 'vitest';

vi.mock('../startlistLinks', () => ({
  buildStartlistPublicUrl: vi.fn(),
}));

import { tryAutoAttachStartlist } from '../eventLinking';
import { buildStartlistPublicUrl } from '../startlistLinks';

const buildStartlistPublicUrlMock = vi.mocked(buildStartlistPublicUrl);

describe('tryAutoAttachStartlist', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('attaches startlists and updates status on success', async () => {
    buildStartlistPublicUrlMock.mockReturnValue('https://public/startlists/SL-1');
    const dispatch = vi.fn();
    const attachStartlist = vi.fn().mockResolvedValue(undefined);

    const result = await tryAutoAttachStartlist({
      dispatch,
      eventContext: { eventId: 'event-1', raceId: 'race-1' },
      startlistId: 'SL-1',
      version: 3,
      confirmedAt: '2024-04-05T09:00:00.000Z',
      startlistStatus: 'FINALIZED',
      attachStartlist,
    });

    expect(result).toBe('success');
    expect(buildStartlistPublicUrlMock).toHaveBeenCalledWith('SL-1', 3);
    expect(attachStartlist).toHaveBeenCalledWith({
      eventId: 'event-1',
      raceId: 'race-1',
      startlistId: 'SL-1',
      confirmedAt: '2024-04-05T09:00:00.000Z',
      version: 3,
      publicUrl: 'https://public/startlists/SL-1',
      status: 'FINALIZED',
    });
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'context/setEventLinkStatus',
        payload: expect.objectContaining({ status: 'linking', startlistLink: 'https://public/startlists/SL-1' }),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'context/setEventLinkStatus',
        payload: expect.objectContaining({ status: 'success', startlistLink: 'https://public/startlists/SL-1' }),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'status/setStatus',
        payload: expect.objectContaining({ key: 'snapshot' }),
      }),
    );
  });

  it('surfaces errors when the attachment fails', async () => {
    buildStartlistPublicUrlMock.mockReturnValue('https://public/startlists/SL-1');
    const dispatch = vi.fn();
    const attachStartlist = vi.fn().mockRejectedValue(new Error('network down'));

    const result = await tryAutoAttachStartlist({
      dispatch,
      eventContext: { eventId: 'event-1', raceId: 'race-1' },
      startlistId: 'SL-1',
      version: 2,
      confirmedAt: '2024-04-06T10:00:00.000Z',
      attachStartlist,
    });

    expect(result).toBe('error');
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'context/setEventLinkStatus',
        payload: expect.objectContaining({ status: 'error', errorMessage: 'network down' }),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'status/setStatus',
        payload: expect.objectContaining({ key: 'snapshot' }),
      }),
    );
  });
});
