import { describe, expect, it, vi } from 'vitest';
import {
  LaneOrderManuallyReassignedEvent,
  ClassStartOrderManuallyFinalizedEvent,
} from '@startlist-management/domain';
import { InvalidateStartTimesUseCase } from '../commands/InvalidateStartTimesUseCase.js';
import { InvalidCommandError } from '../errors.js';
import { StartlistProcessManager } from '../process-manager/StartlistProcessManager.js';

const createEvent = (EventCtor: new (...args: any[]) => any, startlistId: string) => {
  return new EventCtor(startlistId, [], new Date());
};

describe('StartlistProcessManager', () => {
  it('invokes invalidate start times for manual lane changes', async () => {
    const invalidate: InvalidateStartTimesUseCase = {
      execute: vi.fn().mockResolvedValue(void 0),
    };
    const manager = new StartlistProcessManager(invalidate);
    const event = createEvent(LaneOrderManuallyReassignedEvent, 'startlist-1');

    await manager.handle(event);

    expect(invalidate.execute).toHaveBeenCalledWith({
      startlistId: 'startlist-1',
      reason: 'Lane order manually reassigned',
    });
  });

  it('invokes invalidate start times for manual class order finalization', async () => {
    const invalidate: InvalidateStartTimesUseCase = {
      execute: vi.fn().mockResolvedValue(void 0),
    };
    const manager = new StartlistProcessManager(invalidate);
    const event = createEvent(ClassStartOrderManuallyFinalizedEvent, 'startlist-1');

    await manager.handle(event);

    expect(invalidate.execute).toHaveBeenCalledWith({
      startlistId: 'startlist-1',
      reason: 'Class start order manually finalized',
    });
  });

  it('suppresses no-op invalid command errors', async () => {
    const invalidate: InvalidateStartTimesUseCase = {
      execute: vi.fn().mockRejectedValue(new InvalidCommandError('No start times are assigned to invalidate.')),
    };
    const manager = new StartlistProcessManager(invalidate);
    const event = createEvent(LaneOrderManuallyReassignedEvent, 'startlist-1');

    await expect(manager.handle(event)).resolves.toBeUndefined();
  });

  it('rethrows unexpected errors', async () => {
    const error = new InvalidCommandError('Unexpected');
    const invalidate: InvalidateStartTimesUseCase = {
      execute: vi.fn().mockRejectedValue(error),
    };
    const manager = new StartlistProcessManager(invalidate);
    const event = createEvent(LaneOrderManuallyReassignedEvent, 'startlist-1');

    await expect(manager.handle(event)).rejects.toBe(error);
  });
});
