import { describe, expect, it, vi } from 'vitest';

import { DomainEventBus } from '../DomainEventBus.js';

const createEvent = () => ({
  type: 'TestEvent',
  occurredAt: new Date(),
});

describe('DomainEventBus', () => {
  it('continues to notify subscribers when one fails', async () => {
    const logger = { error: vi.fn() };
    const bus = new DomainEventBus(logger);
    const event = createEvent();

    const failingSubscriber = vi.fn(() => {
      throw new Error('subscriber failed');
    });
    const successfulSubscriber = vi.fn();

    bus.subscribe(failingSubscriber);
    bus.subscribe(successfulSubscriber);

    await bus.publish([event]);

    expect(successfulSubscriber).toHaveBeenCalledWith(event);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toBe('DomainEventBus subscriber failed');
    expect(logger.error.mock.calls[0]?.[1]).toBeInstanceOf(Error);
  });

  it('awaits asynchronous subscribers', async () => {
    const logger = { error: vi.fn() };
    const bus = new DomainEventBus(logger);
    const event = createEvent();

    const order: string[] = [];
    const asyncSubscriber = vi.fn(async () => {
      await Promise.resolve();
      order.push('async');
    });

    bus.subscribe(asyncSubscriber);

    await bus.publish([event]);

    expect(asyncSubscriber).toHaveBeenCalledWith(event);
    expect(order).toContain('async');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs rejections from asynchronous subscribers', async () => {
    const logger = { error: vi.fn() };
    const bus = new DomainEventBus(logger);
    const event = createEvent();

    const asyncFailure = vi.fn(async () => {
      await Promise.resolve();
      throw new Error('async failure');
    });
    const anotherSubscriber = vi.fn();

    bus.subscribe(asyncFailure);
    bus.subscribe(anotherSubscriber);

    await bus.publish([event]);

    expect(anotherSubscriber).toHaveBeenCalledWith(event);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[1]).toBeInstanceOf(Error);
  });
});
