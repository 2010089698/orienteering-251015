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
  it('submits a manually entered startlist link', async () => {
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

    const urlInput = screen.getByLabelText('スタートリストURL');
    await user.type(urlInput, 'https://example.com/startlist');

    const submitButton = screen.getByRole('button', { name: 'スタートリストを設定' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onAttach).toHaveBeenCalledWith({
        eventId: 'event-1',
        raceId: 'race-1',
        startlistLink: 'https://example.com/startlist',
      });
    });

    expect(onAttached).toHaveBeenCalled();
  });

  it('submits the finalized startlist link when requested', async () => {
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
        defaultStartlistLink="https://public.example.com/startlists/SL-1/v/3"
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
        startlistLink: 'https://public.example.com/startlists/SL-1/v/3',
      });
    });

    expect(onAttached).toHaveBeenCalled();
  });
});
