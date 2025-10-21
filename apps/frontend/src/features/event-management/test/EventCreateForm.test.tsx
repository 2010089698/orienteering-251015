import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EventCreateForm from '../components/EventCreateForm';
import type { EventDto } from '@event-management/application';

describe('EventCreateForm', () => {
  const renderForm = () => {
    const onCreate = vi
      .fn(async () =>
        ({
          id: 'event-id',
          name: 'event',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-01T00:00:00.000Z',
          venue: 'Tokyo',
          allowMultipleRacesPerDay: false,
          allowScheduleOverlap: false,
          races: [],
        }) as EventDto,
      );

    render(<EventCreateForm isSubmitting={false} onCreate={onCreate} />);
  };

  it('prefills the end date when the start date changes and the user has not overridden it', () => {
    renderForm();

    const startInput = screen.getByLabelText('開始日');
    const endInput = screen.getByLabelText('終了日');

    fireEvent.change(startInput, { target: { value: '2024-05-10' } });

    expect(endInput).toHaveValue('2024-05-10');
  });

  it('stops syncing the end date after the user edits it manually', () => {
    renderForm();

    const startInput = screen.getByLabelText('開始日');
    const endInput = screen.getByLabelText('終了日');

    fireEvent.change(startInput, { target: { value: '2024-05-10' } });
    expect(endInput).toHaveValue('2024-05-10');

    fireEvent.change(endInput, { target: { value: '2024-05-11' } });
    expect(endInput).toHaveValue('2024-05-11');

    fireEvent.change(startInput, { target: { value: '2024-05-12' } });

    expect(endInput).toHaveValue('2024-05-11');
  });

  it('resumes syncing when the user aligns the end date with the start date again', () => {
    renderForm();

    const startInput = screen.getByLabelText('開始日');
    const endInput = screen.getByLabelText('終了日');

    fireEvent.change(startInput, { target: { value: '2024-05-10' } });
    expect(endInput).toHaveValue('2024-05-10');

    fireEvent.change(endInput, { target: { value: '2024-05-11' } });
    expect(endInput).toHaveValue('2024-05-11');

    fireEvent.change(endInput, { target: { value: '2024-05-10' } });
    expect(endInput).toHaveValue('2024-05-10');

    fireEvent.change(startInput, { target: { value: '2024-05-12' } });

    expect(endInput).toHaveValue('2024-05-12');
  });
});
