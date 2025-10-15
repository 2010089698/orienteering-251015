import assert from 'node:assert/strict';
import { describe, test } from '@jest/globals';

import { DomainError } from '../../common/DomainError.js';
import { ClassAssignment } from '../ClassAssignment.js';
import { Duration } from '../Duration.js';
import { LaneAssignment } from '../LaneAssignment.js';
import { StartTime } from '../StartTime.js';
import { StartlistId } from '../StartlistId.js';
import { StartlistSettings } from '../StartlistSettings.js';

describe('Duration', () => {
  test('factories produce expected values', () => {
    const duration = Duration.fromMilliseconds(1500);
    const fromSeconds = Duration.fromSeconds(1.5);
    const fromMinutes = Duration.fromMinutes(0.025);

    assert.strictEqual(duration.value, 1500);
    assert.strictEqual(fromSeconds.value, 1500);
    assert.strictEqual(fromMinutes.value, 1500);
    assert.ok(duration.equals(fromSeconds));
    assert.ok(duration.equals(fromMinutes));
    assert.ok(fromSeconds.equals(fromMinutes));
  });

  test('rejects non positive or non finite durations', () => {
    const invalidValues = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    for (const value of invalidValues) {
      assert.throws(
        () => Duration.fromMilliseconds(value),
        (error: unknown) => error instanceof DomainError,
      );
    }
  });

  test('equals returns false for different durations', () => {
    const one = Duration.fromSeconds(1);
    const two = Duration.fromSeconds(2);

    assert.ok(!one.equals(two));
    assert.ok(!two.equals(one));
  });
});

describe('StartlistId', () => {
  test('create stores the provided identifier', () => {
    const id = StartlistId.create('startlist-123');

    assert.strictEqual(id.toString(), 'startlist-123');
    assert.ok(id.equals(StartlistId.create('startlist-123')));
    assert.ok(!id.equals(StartlistId.create('startlist-456')));
  });

  test('create rejects empty or whitespace identifiers', () => {
    const invalidIds = ['', '   '];

    for (const raw of invalidIds) {
      assert.throws(
        () => StartlistId.create(raw),
        (error: unknown) => error instanceof DomainError,
      );
    }
  });
});

describe('StartTime', () => {
  test('create copies provided date and stores fields', () => {
    const inputDate = new Date('2024-03-01T09:00:00Z');
    const startTime = StartTime.create({ playerId: 'player-1', startTime: inputDate, laneNumber: 2 });

    assert.strictEqual(startTime.playerId, 'player-1');
    assert.strictEqual(startTime.laneNumber, 2);
    assert.notStrictEqual(startTime.startTime, inputDate);
    assert.strictEqual(startTime.startTime.toISOString(), inputDate.toISOString());

    inputDate.setUTCFullYear(1999);
    assert.strictEqual(startTime.startTime.toISOString(), '2024-03-01T09:00:00.000Z');
  });

  test('create validates inputs', () => {
    const validDate = new Date('2024-03-01T09:00:00Z');

    assert.throws(
      () => StartTime.create({ playerId: '', startTime: validDate, laneNumber: 1 }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () => StartTime.create({ playerId: 'player-1', startTime: new Date('invalid'), laneNumber: 1 }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () => StartTime.create({ playerId: 'player-1', startTime: validDate, laneNumber: 0 }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () => StartTime.create({ playerId: 'player-1', startTime: validDate, laneNumber: 1.5 }),
      (error: unknown) => error instanceof DomainError,
    );
  });
});

describe('StartlistSettings', () => {
  test('create copies mutable inputs and stores values', () => {
    const interval = Duration.fromMinutes(2);
    const startTime = new Date('2024-04-01T10:00:00Z');
    const settings = StartlistSettings.create({
      eventId: 'event-1',
      startTime,
      interval,
      laneCount: 3,
    });

    assert.strictEqual(settings.eventId, 'event-1');
    assert.strictEqual(settings.interval, interval);
    assert.strictEqual(settings.laneCount, 3);
    assert.notStrictEqual(settings.startTime, startTime);
    assert.strictEqual(settings.startTime.toISOString(), startTime.toISOString());

    startTime.setUTCMonth(5);
    assert.strictEqual(settings.startTime.toISOString(), '2024-04-01T10:00:00.000Z');
  });

  test('create validates inputs', () => {
    const interval = Duration.fromSeconds(30);
    const startTime = new Date('2024-04-01T10:00:00Z');

    assert.throws(
      () =>
        StartlistSettings.create({
          eventId: '',
          startTime,
          interval,
          laneCount: 1,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        StartlistSettings.create({
          eventId: 'event-1',
          startTime: new Date('invalid'),
          interval,
          laneCount: 1,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        StartlistSettings.create({
          eventId: 'event-1',
          startTime,
          interval,
          laneCount: 0,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        StartlistSettings.create({
          eventId: 'event-1',
          startTime,
          interval,
          laneCount: 2.5,
        }),
      (error: unknown) => error instanceof DomainError,
    );
  });
});

describe('LaneAssignment', () => {
  test('create copies class order and stores values', () => {
    const interval = Duration.fromSeconds(45);
    const classOrder = ['class-a', 'class-b'];
    const assignment = LaneAssignment.create({
      laneNumber: 1,
      classOrder,
      interval,
      laneCount: 2,
    });

    assert.strictEqual(assignment.laneNumber, 1);
    assert.strictEqual(assignment.interval, interval);
    assert.deepStrictEqual(assignment.classOrder, classOrder);
    assert.notStrictEqual(assignment.classOrder, classOrder);

    classOrder.push('class-c');
    assert.deepStrictEqual(assignment.classOrder, ['class-a', 'class-b']);
  });

  test('create validates lane bounds and class order', () => {
    const interval = Duration.fromSeconds(45);

    assert.throws(
      () =>
        LaneAssignment.create({
          laneNumber: 0,
          classOrder: ['class-a'],
          interval,
          laneCount: 2,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        LaneAssignment.create({
          laneNumber: 3,
          classOrder: ['class-a'],
          interval,
          laneCount: 2,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        LaneAssignment.create({
          laneNumber: 1,
          classOrder: [],
          interval,
          laneCount: 2,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        LaneAssignment.create({
          laneNumber: 1,
          classOrder: ['class-a', 'class-a'],
          interval,
          laneCount: 2,
        }),
      (error: unknown) => error instanceof DomainError,
    );
  });
});

describe('ClassAssignment', () => {
  test('create copies player order and stores values', () => {
    const interval = Duration.fromSeconds(30);
    const playerOrder = ['player-1', 'player-2'];
    const assignment = ClassAssignment.create({
      classId: 'class-1',
      playerOrder,
      interval,
    });

    assert.strictEqual(assignment.classId, 'class-1');
    assert.strictEqual(assignment.interval, interval);
    assert.deepStrictEqual(assignment.playerOrder, playerOrder);
    assert.notStrictEqual(assignment.playerOrder, playerOrder);

    playerOrder.push('player-3');
    assert.deepStrictEqual(assignment.playerOrder, ['player-1', 'player-2']);
  });

  test('create validates identifier and player order', () => {
    const interval = Duration.fromSeconds(30);

    assert.throws(
      () =>
        ClassAssignment.create({
          classId: '',
          playerOrder: ['player-1'],
          interval,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        ClassAssignment.create({
          classId: 'class-1',
          playerOrder: [],
          interval,
        }),
      (error: unknown) => error instanceof DomainError,
    );
    assert.throws(
      () =>
        ClassAssignment.create({
          classId: 'class-1',
          playerOrder: ['player-1', 'player-1'],
          interval,
        }),
      (error: unknown) => error instanceof DomainError,
    );
  });
});
