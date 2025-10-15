import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import { DomainError } from '../../common/DomainError';
import { ClassAssignment } from '../ClassAssignment';
import { Duration } from '../Duration';
import { LaneAssignment } from '../LaneAssignment';
import { StartTime } from '../StartTime';
import { Startlist } from '../Startlist';
import { StartlistId } from '../StartlistId';
import { StartlistSettings } from '../StartlistSettings';
import { StartlistStatus } from '../StartlistStatus';
import { ClassStartOrderManuallyFinalizedEvent } from '../events/ClassStartOrderManuallyFinalizedEvent';
import { LaneOrderAndIntervalsAssignedEvent } from '../events/LaneOrderAndIntervalsAssignedEvent';
import { LaneOrderManuallyReassignedEvent } from '../events/LaneOrderManuallyReassignedEvent';
import { PlayerOrderAndIntervalsAssignedEvent } from '../events/PlayerOrderAndIntervalsAssignedEvent';
import { StartTimesAssignedEvent } from '../events/StartTimesAssignedEvent';
import { StartTimesInvalidatedEvent } from '../events/StartTimesInvalidatedEvent';
import { StartlistFinalizedEvent } from '../events/StartlistFinalizedEvent';
import { StartlistSettingsEnteredEvent } from '../events/StartlistSettingsEnteredEvent';

const fixedDate = new Date('2024-01-01T10:00:00Z');

const clockStub = {
  now: () => fixedDate,
};

test('assignStartTimes rejects players without class assignments', () => {
  const startlist = Startlist.createNew(StartlistId.create('startlist-1'), clockStub);

  const interval = Duration.fromMinutes(2);
  startlist.enterSettings(
    StartlistSettings.create({
      eventId: 'event-1',
      startTime: fixedDate,
      interval,
      laneCount: 1,
    }),
  );

  startlist.assignLaneOrderAndIntervals([
    LaneAssignment.create({ laneNumber: 1, classOrder: ['class-1'], interval, laneCount: 1 }),
  ]);

  startlist.assignPlayerOrderAndIntervals([
    ClassAssignment.create({ classId: 'class-1', playerOrder: ['player-1'], interval }),
  ]);

  const startTime = StartTime.create({ playerId: 'player-2', startTime: fixedDate, laneNumber: 1 });

  assert.throws(
    () => startlist.assignStartTimes([startTime]),
    (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.match(
        (error as Error).message,
        /player-2 does not have a class assignment/i,
      );
      return true;
    },
  );
});

describe('Startlist lifecycle scenarios', () => {
  test('successful flow from settings to finalization', () => {
    const startlistId = StartlistId.create('startlist-lifecycle-1');
    const startlist = Startlist.createNew(startlistId, clockStub);
    const interval = Duration.fromMinutes(1);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.DRAFT);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings: undefined,
      laneAssignments: [],
      classAssignments: [],
      startTimes: [],
      status: StartlistStatus.DRAFT,
    });
    assert.deepStrictEqual(startlist.pullDomainEvents(), []);

    const settings = StartlistSettings.create({
      eventId: 'event-lifecycle-1',
      startTime: fixedDate,
      interval,
      laneCount: 2,
    });
    startlist.enterSettings(settings);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.SETTINGS_ENTERED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments: [],
      classAssignments: [],
      startTimes: [],
      status: StartlistStatus.SETTINGS_ENTERED,
    });
    let events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const settingsEvent = events[0];
    assert(settingsEvent instanceof StartlistSettingsEnteredEvent);
    assert.strictEqual(settingsEvent.startlistId, startlistId.toString());
    assert.strictEqual(settingsEvent.settings, settings);
    assert.strictEqual(settingsEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
    ];
    startlist.assignLaneOrderAndIntervals(laneAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.LANE_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments,
      classAssignments: [],
      startTimes: [],
      status: StartlistStatus.LANE_ORDER_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const laneEvent = events[0];
    assert(laneEvent instanceof LaneOrderAndIntervalsAssignedEvent);
    assert.strictEqual(laneEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(laneEvent.laneAssignments, startlist.getLaneAssignments());
    assert.strictEqual(laneEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
    ];
    startlist.assignPlayerOrderAndIntervals(classAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments,
      classAssignments,
      startTimes: [],
      status: StartlistStatus.PLAYER_ORDER_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const classEvent = events[0];
    assert(classEvent instanceof PlayerOrderAndIntervalsAssignedEvent);
    assert.strictEqual(classEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(classEvent.classAssignments, startlist.getClassAssignments());
    assert.strictEqual(classEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const startTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
      StartTime.create({
        playerId: 'player-2',
        startTime: new Date(fixedDate.getTime() + interval.value),
        laneNumber: 2,
      }),
    ];
    startlist.assignStartTimes(startTimes);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.START_TIMES_ASSIGNED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments,
      classAssignments,
      startTimes,
      status: StartlistStatus.START_TIMES_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const startTimesEvent = events[0];
    assert(startTimesEvent instanceof StartTimesAssignedEvent);
    assert.strictEqual(startTimesEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(startTimesEvent.startTimes, startlist.getStartTimes());
    assert.strictEqual(startTimesEvent.occurredAt.toISOString(), fixedDate.toISOString());

    startlist.finalizeStartlist();

    assert.strictEqual(startlist.getStatus(), StartlistStatus.FINALIZED);
    const finalizedSnapshot = startlist.toSnapshot();
    assert.deepStrictEqual(finalizedSnapshot, {
      id: startlistId.toString(),
      settings,
      laneAssignments,
      classAssignments,
      startTimes,
      status: StartlistStatus.FINALIZED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const finalizedEvent = events[0];
    assert(finalizedEvent instanceof StartlistFinalizedEvent);
    assert.strictEqual(finalizedEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(finalizedEvent.finalStartlist, finalizedSnapshot);
    assert.strictEqual(finalizedEvent.occurredAt.toISOString(), fixedDate.toISOString());
  });

  test('manual lane reassignment and class order finalization invalidate start times', () => {
    const startlistId = StartlistId.create('startlist-lifecycle-2');
    const startlist = Startlist.createNew(startlistId, clockStub);
    const interval = Duration.fromMinutes(1);

    const settings = StartlistSettings.create({
      eventId: 'event-lifecycle-2',
      startTime: fixedDate,
      interval,
      laneCount: 2,
    });
    startlist.enterSettings(settings);
    startlist.pullDomainEvents();

    const initialLaneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
    ];
    startlist.assignLaneOrderAndIntervals(initialLaneAssignments);
    startlist.pullDomainEvents();

    const initialClassAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
    ];
    startlist.assignPlayerOrderAndIntervals(initialClassAssignments);
    startlist.pullDomainEvents();

    const initialStartTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
      StartTime.create({
        playerId: 'player-2',
        startTime: new Date(fixedDate.getTime() + interval.value),
        laneNumber: 2,
      }),
    ];
    startlist.assignStartTimes(initialStartTimes);
    startlist.pullDomainEvents();

    startlist.manuallyReassignLaneOrder(
      [
        LaneAssignment.create({ laneNumber: 1, classOrder: ['class-b'], interval, laneCount: 2 }),
        LaneAssignment.create({ laneNumber: 2, classOrder: ['class-a'], interval, laneCount: 2 }),
      ],
    );

    assert.strictEqual(startlist.getStatus(), StartlistStatus.LANE_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments(),
      classAssignments: initialClassAssignments,
      startTimes: [],
      status: StartlistStatus.LANE_ORDER_ASSIGNED,
    });
    let events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 2);
    const invalidatedByLaneEvent = events[0];
    assert(invalidatedByLaneEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(invalidatedByLaneEvent.startlistId, startlistId.toString());
    assert.strictEqual(invalidatedByLaneEvent.reason, 'Lane order manually reassigned');
    assert.strictEqual(invalidatedByLaneEvent.occurredAt.toISOString(), fixedDate.toISOString());
    const laneReassignedEvent = events[1];
    assert(laneReassignedEvent instanceof LaneOrderManuallyReassignedEvent);
    assert.strictEqual(laneReassignedEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(laneReassignedEvent.laneAssignments, startlist.getLaneAssignments());
    assert.strictEqual(laneReassignedEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const reorderedClassAssignments = [
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];
    startlist.assignPlayerOrderAndIntervals(reorderedClassAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments(),
      classAssignments: reorderedClassAssignments,
      startTimes: [],
      status: StartlistStatus.PLAYER_ORDER_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const reassignedClassEvent = events[0];
    assert(reassignedClassEvent instanceof PlayerOrderAndIntervalsAssignedEvent);
    assert.strictEqual(reassignedClassEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(reassignedClassEvent.classAssignments, startlist.getClassAssignments());
    assert.strictEqual(reassignedClassEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const reorderedStartTimes = [
      StartTime.create({ playerId: 'player-2', startTime: new Date(fixedDate.getTime() + interval.value * 2), laneNumber: 1 }),
      StartTime.create({ playerId: 'player-1', startTime: new Date(fixedDate.getTime() + interval.value * 3), laneNumber: 2 }),
    ];
    startlist.assignStartTimes(reorderedStartTimes);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.START_TIMES_ASSIGNED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments(),
      classAssignments: reorderedClassAssignments,
      startTimes: reorderedStartTimes,
      status: StartlistStatus.START_TIMES_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const reorderedStartTimesEvent = events[0];
    assert(reorderedStartTimesEvent instanceof StartTimesAssignedEvent);
    assert.strictEqual(reorderedStartTimesEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(reorderedStartTimesEvent.startTimes, startlist.getStartTimes());
    assert.strictEqual(reorderedStartTimesEvent.occurredAt.toISOString(), fixedDate.toISOString());

    startlist.manuallyFinalizeClassStartOrder(reorderedClassAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.toSnapshot(), {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments(),
      classAssignments: reorderedClassAssignments,
      startTimes: [],
      status: StartlistStatus.PLAYER_ORDER_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 2);
    const invalidatedByManualClassEvent = events[0];
    assert(invalidatedByManualClassEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(invalidatedByManualClassEvent.startlistId, startlistId.toString());
    assert.strictEqual(
      invalidatedByManualClassEvent.reason,
      'Class start order manually finalized',
    );
    assert.strictEqual(invalidatedByManualClassEvent.occurredAt.toISOString(), fixedDate.toISOString());
    const manuallyFinalizedClassEvent = events[1];
    assert(manuallyFinalizedClassEvent instanceof ClassStartOrderManuallyFinalizedEvent);
    assert.strictEqual(manuallyFinalizedClassEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(
      manuallyFinalizedClassEvent.classAssignments,
      startlist.getClassAssignments(),
    );
    assert.strictEqual(manuallyFinalizedClassEvent.occurredAt.toISOString(), fixedDate.toISOString());
  });
});
