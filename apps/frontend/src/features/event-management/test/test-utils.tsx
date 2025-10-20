import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { type PropsWithChildren } from 'react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { vi } from 'vitest';

import type { useEventManagementApi } from '../api/useEventManagementApi';

export type EventManagementApiMock = ReturnType<typeof useEventManagementApi>;

export const createEventManagementApiMock = (
  overrides: Partial<EventManagementApiMock> = {},
): EventManagementApiMock => ({
  listEvents: vi.fn(async () => []),
  getEvent: vi.fn(async () => {
    throw new Error('getEvent mock not implemented');
  }),
  createEvent: vi.fn(async () => {
    throw new Error('createEvent mock not implemented');
  }),
  scheduleRace: vi.fn(async () => {
    throw new Error('scheduleRace mock not implemented');
  }),
  attachStartlist: vi.fn(async () => {
    throw new Error('attachStartlist mock not implemented');
  }),
  ...overrides,
});

interface RenderWithRouterOptions extends Omit<RenderOptions, 'wrapper'> {
  router?: MemoryRouterProps;
}

export const renderWithEventManagementRouter = (
  ui: ReactElement,
  { router, ...options }: RenderWithRouterOptions = {},
) => {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <MemoryRouter {...router}>{children}</MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};
