import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { RaceDto } from '@event-management/application';

import RaceList from '../RaceList';

const createRace = (overrides: Partial<RaceDto> = {}): RaceDto => ({
  id: 'race-1',
  name: '決勝',
  schedule: { start: '2024-03-01T09:00:00.000Z', end: undefined },
  duplicateDay: false,
  overlapsExisting: false,
  startlist: {
    id: 'SL-1',
    status: 'FINALIZED',
  },
  ...overrides,
});

describe('RaceList', () => {
  it('renders a viewer link when a startlist identifier is available', () => {
    const race = createRace();

    render(
      <MemoryRouter>
        <RaceList races={[race]} eventId="event-1" />
      </MemoryRouter>,
    );

    const viewerLink = screen.getByRole('link', { name: 'ビューアーを開く' });
    expect(viewerLink).toHaveAttribute('href', '/startlists/SL-1');
  });

  it('does not render a viewer link when the startlist is missing', () => {
    const race = createRace({ startlist: undefined });

    render(
      <MemoryRouter>
        <RaceList races={[race]} eventId="event-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'ビューアーを開く' })).not.toBeInTheDocument();
  });
});
