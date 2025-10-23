import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AttachStartlistForm from '../AttachStartlistForm';

const baseRaces = [
  {
    id: 'race-1',
    name: '本戦',
  },
];

describe('AttachStartlistForm', () => {
  it('submits a manually entered startlist payload', async () => {
    const user = userEvent.setup();
    const onAttach = vi.fn().mockResolvedValue(undefined);
    const onAttached = vi.fn();

    render(
      <AttachStartlistForm
        eventId="event-1"
        races={baseRaces}
        isSubmitting={false}
        onAttach={onAttach}
        onAttached={onAttached}
      />,
    );

    const raceSelect = screen.getByLabelText('対象レース');
    await user.selectOptions(raceSelect, 'race-1');

    const startlistIdInput = screen.getByLabelText('スタートリストID');
    await user.type(startlistIdInput, 'SL-manual');

    const versionInput = screen.getByLabelText('公開バージョン（任意）');
    await user.type(versionInput, '4');

    const urlInput = screen.getByLabelText('公開URL（任意）');
    await user.type(urlInput, 'https://example.com/startlists/SL-manual/v/4');

    const submitButton = screen.getByRole('button', { name: 'スタートリストを設定' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onAttach).toHaveBeenCalledWith({
        eventId: 'event-1',
        raceId: 'race-1',
        startlistId: 'SL-manual',
        startlistLink: 'https://example.com/startlists/SL-manual/v/4',
        startlistPublicVersion: 4,
      });
    });

    expect(onAttached).toHaveBeenCalled();
  });

  it('submits the finalized startlist metadata when requested', async () => {
    const user = userEvent.setup();
    const onAttach = vi.fn().mockResolvedValue(undefined);
    const onAttached = vi.fn();

    render(
      <AttachStartlistForm
        eventId="event-1"
        races={baseRaces}
        isSubmitting={false}
        onAttach={onAttach}
        onAttached={onAttached}
        defaultStartlistId="SL-1"
        defaultStartlistLink="https://public.example.com/startlists/SL-1/v/3"
        defaultStartlistUpdatedAt="2024-04-05T09:00:00.000Z"
        defaultStartlistPublicVersion={3}
      />,
    );

    const raceSelect = screen.getByLabelText('対象レース');
    await user.selectOptions(raceSelect, 'race-1');

    const autoButton = screen.getByRole('button', { name: '確定したスタートリストを連携' });
    expect(autoButton).toBeEnabled();
    await user.click(autoButton);

    await waitFor(() => {
      expect(onAttach).toHaveBeenCalledWith({
        eventId: 'event-1',
        raceId: 'race-1',
        startlistId: 'SL-1',
        startlistLink: 'https://public.example.com/startlists/SL-1/v/3',
        startlistUpdatedAt: '2024-04-05T09:00:00.000Z',
        startlistPublicVersion: 3,
      });
    });

    expect(onAttached).toHaveBeenCalled();
  });
});
