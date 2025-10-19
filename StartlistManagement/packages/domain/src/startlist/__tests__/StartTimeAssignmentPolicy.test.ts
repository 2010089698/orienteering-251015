import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import { DomainError } from '../../common/DomainError.js';
import { ClassAssignment } from '../ClassAssignment.js';
import { Duration } from '../Duration.js';
import { StartTime } from '../StartTime.js';
import { StartTimeAssignmentPolicy } from '../StartTimeAssignmentPolicy.js';
import { StartlistSettings } from '../StartlistSettings.js';
import {
  ClassAssignmentsNotCompletedError,
  StartlistSettingsNotEnteredError,
} from '../StartlistErrors.js';

const fixedDate = new Date('2024-01-01T10:00:00Z');
const interval = Duration.fromMinutes(1);

const createSettings = () =>
  StartlistSettings.create({
    eventId: 'event-policy',
    startTime: fixedDate,
    laneClassInterval: interval,
    classPlayerInterval: interval,
    laneCount: 2,
  });

const createClassAssignments = () => [
  ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
  ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
];

describe('StartTimeAssignmentPolicy', () => {
  test('requires settings to be present', () => {
    assert.throws(
      () =>
        StartTimeAssignmentPolicy.ensureCanAssign({
          startTimes: [],
          settings: undefined,
          classAssignments: [],
        }),
      (error: unknown) => {
        assert.ok(error instanceof StartlistSettingsNotEnteredError);
        return true;
      },
    );
  });

  test('requires class assignments', () => {
    assert.throws(
      () =>
        StartTimeAssignmentPolicy.ensureCanAssign({
          startTimes: [],
          settings: createSettings(),
          classAssignments: [],
        }),
      (error: unknown) => {
        assert.ok(error instanceof ClassAssignmentsNotCompletedError);
        return true;
      },
    );
  });

  test('validates provided start times', () => {
    const settings = createSettings();
    const classAssignments = createClassAssignments();

    assert.throws(
      () =>
        StartTimeAssignmentPolicy.ensureCanAssign({
          startTimes: [],
          settings,
          classAssignments,
        }),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual((error as Error).message, 'At least one start time must be provided.');
        return true;
      },
    );

    const duplicateStartTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
      StartTime.create({
        playerId: 'player-1',
        startTime: new Date(fixedDate.getTime() + interval.value),
        laneNumber: 2,
      }),
    ];

    assert.throws(
      () =>
        StartTimeAssignmentPolicy.ensureCanAssign({
          startTimes: duplicateStartTimes,
          settings,
          classAssignments,
        }),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual((error as Error).message, 'Start times must be unique per player.');
        return true;
      },
    );

    const unknownPlayerStartTimes = [
      StartTime.create({ playerId: 'player-3', startTime: fixedDate, laneNumber: 1 }),
    ];

    assert.throws(
      () =>
        StartTimeAssignmentPolicy.ensureCanAssign({
          startTimes: unknownPlayerStartTimes,
          settings,
          classAssignments,
        }),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual(
          (error as Error).message,
          'Player player-3 does not have a class assignment and cannot receive a start time.',
        );
        return true;
      },
    );

    const laneOverflowStartTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 3 }),
    ];

    assert.throws(
      () =>
        StartTimeAssignmentPolicy.ensureCanAssign({
          startTimes: laneOverflowStartTimes,
          settings,
          classAssignments,
        }),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual((error as Error).message, 'Start time lane number exceeds configured lane count.');
        return true;
      },
    );
  });

  test('passes when all start times are valid', () => {
    const settings = createSettings();
    const classAssignments = createClassAssignments();
    const startTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
      StartTime.create({
        playerId: 'player-2',
        startTime: new Date(fixedDate.getTime() + interval.value),
        laneNumber: 2,
      }),
    ];

    assert.doesNotThrow(() =>
      StartTimeAssignmentPolicy.ensureCanAssign({
        startTimes,
        settings,
        classAssignments,
      }),
    );
  });
});
