import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import { DomainError } from '../../common/DomainError.js';
import { DomainEvent } from '../../common/DomainEvent.js';
import { ClassAssignment } from '../ClassAssignment.js';
import { Duration } from '../Duration.js';
import { LaneAssignment } from '../LaneAssignment.js';
import { StartTime } from '../StartTime.js';
import { Startlist } from '../Startlist.js';
import { StartlistId } from '../StartlistId.js';
import { StartlistSettings } from '../StartlistSettings.js';
import { StartlistStatus } from '../StartlistStatus.js';
import {
  toClassAssignmentDto,
  toLaneAssignmentDto,
  toStartTimeDto,
  toStartlistSettingsDto,
  toStartlistSnapshotDto,
} from '../StartlistDtos.js';
import { ClassStartOrderManuallyFinalizedEvent } from '../events/ClassStartOrderManuallyFinalizedEvent.js';
import { LaneOrderAndIntervalsAssignedEvent } from '../events/LaneOrderAndIntervalsAssignedEvent.js';
import { LaneOrderManuallyReassignedEvent } from '../events/LaneOrderManuallyReassignedEvent.js';
import { PlayerOrderAndIntervalsAssignedEvent } from '../events/PlayerOrderAndIntervalsAssignedEvent.js';
import { StartTimesAssignedEvent } from '../events/StartTimesAssignedEvent.js';
import { StartTimesInvalidatedEvent } from '../events/StartTimesInvalidatedEvent.js';
import { StartlistFinalizedEvent } from '../events/StartlistFinalizedEvent.js';
import { StartlistSettingsEnteredEvent } from '../events/StartlistSettingsEnteredEvent.js';
import { StartlistVersionGeneratedEvent } from '../events/StartlistVersionGeneratedEvent.js';

const fixedDate = new Date('2024-01-01T10:00:00Z');

const clockStub = {
  now: () => fixedDate,
};

const createStartlist = (
  startlistId: StartlistId,
  eventId: string,
  raceId?: string,
) =>
  Startlist.createNew(startlistId, clockStub, {
    eventId,
    raceId: raceId ?? `${startlistId.toString()}-race`,
  });

test('reconstitute clones provided state', () => {
  const startlistId = StartlistId.create('startlist-reconstitute');
  const interval = Duration.fromMinutes(1);
  const eventId = 'event-reconstitute';
  const raceId = 'race-reconstitute';
  const settings = StartlistSettings.create({
    eventId,
    startTime: fixedDate,
    laneClassInterval: interval,
    classPlayerInterval: interval,
    laneCount: 2,
  });
  const laneAssignments = [
    LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
    LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
  ];
  const classAssignments = [
    ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
  ];
  const startTimes = [
    StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
    StartTime.create({
      playerId: 'player-2',
      startTime: new Date(fixedDate.getTime() + interval.value),
      laneNumber: 2,
    }),
  ];

  const snapshotDto = toStartlistSnapshotDto({
    id: startlistId.toString(),
    eventId,
    raceId,
    settings,
    laneAssignments,
    classAssignments,
    startTimes,
    status: StartlistStatus.START_TIMES_ASSIGNED,
  });

  const startlist = Startlist.reconstitute({
    id: startlistId,
    clock: clockStub,
    snapshot: snapshotDto,
  });

  snapshotDto.laneAssignments.push({
    laneNumber: 3,
    classOrder: ['class-c'],
    interval: { milliseconds: interval.value },
  });
  snapshotDto.classAssignments[0] = {
    classId: 'class-a',
    playerOrder: ['player-3'],
    interval: { milliseconds: interval.value },
  };
  snapshotDto.startTimes[0] = {
    playerId: 'player-4',
    startTime: new Date(fixedDate.getTime() + interval.value * 2).toISOString(),
    laneNumber: 1,
  };

  assert.strictEqual(startlist.getStatus(), StartlistStatus.START_TIMES_ASSIGNED);
  assert.strictEqual(startlist.getEventId(), eventId);
  assert.strictEqual(startlist.getRaceId(), raceId);
  const snapshot = startlist.toSnapshot();
  assert.notStrictEqual(snapshot, snapshotDto);
  assert.deepStrictEqual(
    snapshot,
    toStartlistSnapshotDto({
      id: startlistId.toString(),
      eventId,
      raceId,
      settings,
      laneAssignments,
      classAssignments,
      startTimes,
      status: StartlistStatus.START_TIMES_ASSIGNED,
    }),
  );
});

const toLaneAssignmentDtos = (assignments: ReadonlyArray<LaneAssignment>) =>
  Array.from(assignments, (assignment) => toLaneAssignmentDto(assignment));

const toClassAssignmentDtos = (assignments: ReadonlyArray<ClassAssignment>) =>
  Array.from(assignments, (assignment) => toClassAssignmentDto(assignment));

const toStartTimeDtos = (startTimes: ReadonlyArray<StartTime>) =>
  Array.from(startTimes, (startTime) => toStartTimeDto(startTime));

const expectSnapshot = (
  startlist: Startlist,
  params: {
    id: string;
    settings?: StartlistSettings;
    laneAssignments: ReadonlyArray<LaneAssignment>;
    classAssignments: ReadonlyArray<ClassAssignment>;
    startTimes: ReadonlyArray<StartTime>;
    status: StartlistStatus;
  },
) => {
  assert.deepStrictEqual(
    startlist.toSnapshot(),
    toStartlistSnapshotDto({
      ...params,
      eventId: startlist.getEventId(),
      raceId: startlist.getRaceId(),
    }),
  );
};

test('pullDomainEvents returns a copy and clears the queue', () => {
  const startlistId = StartlistId.create('startlist-events');
  const startlist = createStartlist(startlistId, 'event-events');
  const interval = Duration.fromMinutes(1);

  const settings = StartlistSettings.create({
    eventId: 'event-events',
    startTime: fixedDate,
    laneClassInterval: interval,
    classPlayerInterval: interval,
    laneCount: 1,
  });
  startlist.enterSettings(settings);

  const laneAssignments = [
    LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 1 }),
  ];
  startlist.assignLaneOrderAndIntervals(laneAssignments);

  const classAssignments = [
    ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
  ];
  startlist.assignPlayerOrderAndIntervals(classAssignments);

  const internalEventsBeforePull = (startlist as unknown as { pendingEvents: DomainEvent[] }).pendingEvents;
  assert.strictEqual(internalEventsBeforePull.length, 3);

  const events = startlist.pullDomainEvents();
  assert.strictEqual(events.length, 3);
  assert.notStrictEqual(events, internalEventsBeforePull);

  events.splice(0, events.length);

  const internalEventsAfterPull = (startlist as unknown as { pendingEvents: DomainEvent[] }).pendingEvents;
  assert.deepStrictEqual(internalEventsAfterPull, []);

  const startTimes = [
    StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
  ];
  startlist.assignStartTimes(startTimes);

  const subsequentEvents = startlist.pullDomainEvents();
  assert.strictEqual(subsequentEvents.length, 1);
  assert(subsequentEvents[0] instanceof StartTimesAssignedEvent);
});

describe('Startlist lifecycle scenarios', () => {
  test('successful flow from settings to finalization', () => {
    const startlistId = StartlistId.create('startlist-lifecycle-1');
    const startlist = createStartlist(startlistId, 'event-lifecycle-1');
    const interval = Duration.fromMinutes(1);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.DRAFT);
    expectSnapshot(startlist, {
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
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 2,
    });
    startlist.enterSettings(settings);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.SETTINGS_ENTERED);
    expectSnapshot(startlist, {
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
    assert.deepStrictEqual(settingsEvent.settings, toStartlistSettingsDto(settings));
    assert.strictEqual(settingsEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
    ];
    startlist.assignLaneOrderAndIntervals(laneAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.LANE_ORDER_ASSIGNED);
    expectSnapshot(startlist, {
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
    assert.deepStrictEqual(laneEvent.laneAssignments, toLaneAssignmentDtos(startlist.getLaneAssignments()));
    assert.strictEqual(laneEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
    ];
    startlist.assignPlayerOrderAndIntervals(classAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    expectSnapshot(startlist, {
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
    assert.deepStrictEqual(classEvent.classAssignments, toClassAssignmentDtos(startlist.getClassAssignments()));
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
    expectSnapshot(startlist, {
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
    assert.deepStrictEqual(startTimesEvent.startTimes, toStartTimeDtos(startlist.getStartTimes()));
    assert.strictEqual(startTimesEvent.occurredAt.toISOString(), fixedDate.toISOString());

    startlist.finalizeStartlist();

    assert.strictEqual(startlist.getStatus(), StartlistStatus.FINALIZED);
    const finalizedSnapshot = startlist.toSnapshot();
    assert.deepStrictEqual(
      finalizedSnapshot,
      toStartlistSnapshotDto({
        id: startlistId.toString(),
        eventId: startlist.getEventId(),
        raceId: startlist.getRaceId(),
        settings,
        laneAssignments,
        classAssignments,
        startTimes,
        status: StartlistStatus.FINALIZED,
      }),
    );
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 2);
    const [finalizedEvent, versionEvent] = events;
    assert(finalizedEvent instanceof StartlistFinalizedEvent);
    assert.strictEqual(finalizedEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(finalizedEvent.finalStartlist, finalizedSnapshot);
    assert.strictEqual(finalizedEvent.occurredAt.toISOString(), fixedDate.toISOString());
    assert(versionEvent instanceof StartlistVersionGeneratedEvent);
    assert.strictEqual(versionEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(versionEvent.snapshot, finalizedSnapshot);
    assert.strictEqual(versionEvent.confirmedAt.toISOString(), fixedDate.toISOString());
  });

  test('manual lane reassignment and class order finalization invalidate start times', () => {
    const startlistId = StartlistId.create('startlist-lifecycle-2');
    const startlist = createStartlist(startlistId, 'event-lifecycle-2');
    const interval = Duration.fromMinutes(1);

    const settings = StartlistSettings.create({
      eventId: 'event-lifecycle-2',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
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
    expectSnapshot(startlist, {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments() as LaneAssignment[],
      classAssignments: initialClassAssignments,
      startTimes: [],
      status: StartlistStatus.LANE_ORDER_ASSIGNED,
    });
    let events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 2);
    const invalidatedByLaneEvent = events[0];
    assert(invalidatedByLaneEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(invalidatedByLaneEvent.startlistId, startlistId.toString());
    assert.strictEqual(
      invalidatedByLaneEvent.reason,
      'Lane order manually reassigned - start times invalidated',
    );
    assert.strictEqual(invalidatedByLaneEvent.occurredAt.toISOString(), fixedDate.toISOString());
    const laneReassignedEvent = events[1];
    assert(laneReassignedEvent instanceof LaneOrderManuallyReassignedEvent);
    assert.strictEqual(laneReassignedEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(
      laneReassignedEvent.laneAssignments,
      toLaneAssignmentDtos(startlist.getLaneAssignments()),
    );
    assert.strictEqual(laneReassignedEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const reorderedClassAssignments = [
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];
    startlist.assignPlayerOrderAndIntervals(reorderedClassAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    expectSnapshot(startlist, {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments() as LaneAssignment[],
      classAssignments: reorderedClassAssignments,
      startTimes: [],
      status: StartlistStatus.PLAYER_ORDER_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const reassignedClassEvent = events[0];
    assert(reassignedClassEvent instanceof PlayerOrderAndIntervalsAssignedEvent);
    assert.strictEqual(reassignedClassEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(
      reassignedClassEvent.classAssignments,
      toClassAssignmentDtos(startlist.getClassAssignments()),
    );
    assert.strictEqual(reassignedClassEvent.occurredAt.toISOString(), fixedDate.toISOString());

    const reorderedStartTimes = [
      StartTime.create({ playerId: 'player-2', startTime: new Date(fixedDate.getTime() + interval.value * 2), laneNumber: 1 }),
      StartTime.create({ playerId: 'player-1', startTime: new Date(fixedDate.getTime() + interval.value * 3), laneNumber: 2 }),
    ];
    startlist.assignStartTimes(reorderedStartTimes);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.START_TIMES_ASSIGNED);
    expectSnapshot(startlist, {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments() as LaneAssignment[],
      classAssignments: reorderedClassAssignments,
      startTimes: reorderedStartTimes,
      status: StartlistStatus.START_TIMES_ASSIGNED,
    });
    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const reorderedStartTimesEvent = events[0];
    assert(reorderedStartTimesEvent instanceof StartTimesAssignedEvent);
    assert.strictEqual(reorderedStartTimesEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(
      reorderedStartTimesEvent.startTimes,
      toStartTimeDtos(startlist.getStartTimes()),
    );
    assert.strictEqual(reorderedStartTimesEvent.occurredAt.toISOString(), fixedDate.toISOString());

    startlist.manuallyFinalizeClassStartOrder(reorderedClassAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    expectSnapshot(startlist, {
      id: startlistId.toString(),
      settings,
      laneAssignments: startlist.getLaneAssignments() as LaneAssignment[],
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
      'Class start order manually finalized - start times invalidated',
    );
    assert.strictEqual(invalidatedByManualClassEvent.occurredAt.toISOString(), fixedDate.toISOString());
    const manuallyFinalizedClassEvent = events[1];
    assert(manuallyFinalizedClassEvent instanceof ClassStartOrderManuallyFinalizedEvent);
    assert.strictEqual(manuallyFinalizedClassEvent.startlistId, startlistId.toString());
    assert.deepStrictEqual(
      manuallyFinalizedClassEvent.classAssignments,
      toClassAssignmentDtos(startlist.getClassAssignments()),
    );
    assert.strictEqual(manuallyFinalizedClassEvent.occurredAt.toISOString(), fixedDate.toISOString());
  });
});

describe('Startlist failure scenarios', () => {
  test('enterSettings rejects subsequent invocations', () => {
    const startlistId = StartlistId.create('startlist-failure-settings');
    const startlist = createStartlist(startlistId, 'event-failure-settings');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-settings',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });

    startlist.enterSettings(settings);
    startlist.pullDomainEvents();

    assert.throws(
      () => startlist.enterSettings(settings),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual(
          (error as Error).message,
          'Startlist settings can only be entered once while in draft.',
        );
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);
  });

  test('assignLaneOrderAndIntervals requires settings', () => {
    const startlistId = StartlistId.create('startlist-failure-lane-prereq');
    const startlist = createStartlist(startlistId, 'event-failure-lane-prereq');
    const interval = Duration.fromMinutes(1);
    const laneAssignment = LaneAssignment.create({
      laneNumber: 1,
      classOrder: ['class-a'],
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });

    assert.throws(
      () => startlist.assignLaneOrderAndIntervals([laneAssignment]),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual(
          (error as Error).message,
          'Startlist settings must be entered before performing this action.',
        );
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);
  });

  test('assignLaneOrderAndIntervals validates lane limits and uniqueness', () => {
    const startlistId = StartlistId.create('startlist-failure-lane-validation');
    const startlist = createStartlist(startlistId, 'event-failure-lane-validation');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-lane-validation',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });

    startlist.enterSettings(settings);
    startlist.pullDomainEvents();

    const exceedingLaneAssignment = LaneAssignment.create({
      laneNumber: 2,
      classOrder: ['class-a'],
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 2,
    });

    assert.throws(
      () => startlist.assignLaneOrderAndIntervals([exceedingLaneAssignment]),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual(
          (error as Error).message,
          'Lane assignment exceeds configured lane count.',
        );
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);

    const duplicateLaneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 1 }),
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-b'], interval, laneCount: 1 }),
    ];

    assert.throws(
      () => startlist.assignLaneOrderAndIntervals(duplicateLaneAssignments),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual((error as Error).message, 'Each lane can only be assigned once.');
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);
  });

  test('assignLaneOrderAndIntervals reopens a finalized startlist and clears start times', () => {
    const startlistId = StartlistId.create('startlist-failure-lane-finalized');
    const startlist = createStartlist(startlistId, 'event-failure-lane-finalized');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-lane-finalized',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 2,
    });
    const initialLaneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
    ];
    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
    ];
    const startTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
      StartTime.create({
        playerId: 'player-2',
        startTime: new Date(fixedDate.getTime() + interval.value),
        laneNumber: 2,
      }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(initialLaneAssignments);
    startlist.assignPlayerOrderAndIntervals(classAssignments);
    startlist.assignStartTimes(startTimes);
    startlist.finalizeStartlist();
    startlist.pullDomainEvents();

    const updatedLaneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-b'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-a'], interval, laneCount: 2 }),
    ];

    startlist.assignLaneOrderAndIntervals(updatedLaneAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.LANE_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.getStartTimes(), []);

    const events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 2);
    const invalidatedEvent = events[0];
    assert(invalidatedEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(invalidatedEvent.reason, 'Lane order assigned - start times invalidated');
    const reassignedEvent = events[1];
    assert(reassignedEvent instanceof LaneOrderAndIntervalsAssignedEvent);
    assert.deepStrictEqual(
      reassignedEvent.laneAssignments,
      toLaneAssignmentDtos(startlist.getLaneAssignments()),
    );
  });

  test('assignPlayerOrderAndIntervals requires lane assignments', () => {
    const startlistId = StartlistId.create('startlist-failure-player-prereq');
    const startlist = createStartlist(startlistId, 'event-failure-player-prereq');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-player-prereq',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });
    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];

    startlist.enterSettings(settings);
    startlist.pullDomainEvents();

    assert.throws(
      () => startlist.assignPlayerOrderAndIntervals(classAssignments),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual(
          (error as Error).message,
          'Lane assignments must be completed before performing this action.',
        );
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);
  });

  test('assignPlayerOrderAndIntervals validates class uniqueness and membership', () => {
    const startlistId = StartlistId.create('startlist-failure-player-validation');
    const startlist = createStartlist(startlistId, 'event-failure-player-validation');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-player-validation',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 2,
    });
    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(laneAssignments);
    startlist.pullDomainEvents();

    const duplicateClasses = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-2'], interval }),
    ];

    assert.throws(
      () => startlist.assignPlayerOrderAndIntervals(duplicateClasses),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual((error as Error).message, 'Each class can only be assigned once.');
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);

    const unrelatedClasses = [
      ClassAssignment.create({ classId: 'class-c', playerOrder: ['player-3'], interval }),
    ];

    assert.throws(
      () => startlist.assignPlayerOrderAndIntervals(unrelatedClasses),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual(
          (error as Error).message,
          'Class class-c is not part of the lane assignments and cannot be ordered.',
        );
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);
  });

  test('assignPlayerOrderAndIntervals reopens a finalized startlist and clears start times', () => {
    const startlistId = StartlistId.create('startlist-failure-player-finalized');
    const startlist = createStartlist(startlistId, 'event-failure-player-finalized');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-player-finalized',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 2,
    });
    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
    ];
    const initialClassAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
    ];
    const startTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
      StartTime.create({
        playerId: 'player-2',
        startTime: new Date(fixedDate.getTime() + interval.value),
        laneNumber: 2,
      }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(laneAssignments);
    startlist.assignPlayerOrderAndIntervals(initialClassAssignments);
    startlist.assignStartTimes(startTimes);
    startlist.finalizeStartlist();
    startlist.pullDomainEvents();

    const reorderedClassAssignments = [
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];

    startlist.assignPlayerOrderAndIntervals(reorderedClassAssignments);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.getStartTimes(), []);

    const events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 2);
    const invalidatedEvent = events[0];
    assert(invalidatedEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(invalidatedEvent.reason, 'Player order assigned - start times invalidated');
    const reassignedEvent = events[1];
    assert(reassignedEvent instanceof PlayerOrderAndIntervalsAssignedEvent);
    assert.deepStrictEqual(
      reassignedEvent.classAssignments,
      toClassAssignmentDtos(startlist.getClassAssignments()),
    );
  });

  test('assignStartTimes reopens a finalized startlist and can finalize again', () => {
    const startlistId = StartlistId.create('startlist-failure-starttime-finalized');
    const startlist = createStartlist(startlistId, 'event-failure-starttime-finalized');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-starttime-finalized',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });
    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 1 }),
    ];
    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];
    const initialStartTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(laneAssignments);
    startlist.assignPlayerOrderAndIntervals(classAssignments);
    startlist.assignStartTimes(initialStartTimes);
    startlist.finalizeStartlist();
    startlist.pullDomainEvents();

    const rescheduledStartTimes = [
      StartTime.create({
        playerId: 'player-1',
        startTime: new Date(fixedDate.getTime() + interval.value),
        laneNumber: 1,
      }),
    ];

    startlist.assignStartTimes(rescheduledStartTimes);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.START_TIMES_ASSIGNED);
    assert.deepStrictEqual(startlist.getStartTimes(), rescheduledStartTimes);

    let events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const assignedEvent = events[0];
    assert(assignedEvent instanceof StartTimesAssignedEvent);
    assert.deepStrictEqual(
      assignedEvent.startTimes,
      toStartTimeDtos(startlist.getStartTimes()),
    );

    startlist.finalizeStartlist();

    assert.strictEqual(startlist.getStatus(), StartlistStatus.FINALIZED);

    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 2);
    const [finalizedEvent, versionEvent] = events;
    assert(finalizedEvent instanceof StartlistFinalizedEvent);
    assert.deepStrictEqual(finalizedEvent.finalStartlist, startlist.toSnapshot());
    assert(versionEvent instanceof StartlistVersionGeneratedEvent);
    assert.deepStrictEqual(versionEvent.snapshot, startlist.toSnapshot());
  });

  test('finalizeStartlist requires assigned start times', () => {
    const startlistId = StartlistId.create('startlist-failure-finalize-prereq');
    const startlist = createStartlist(startlistId, 'event-failure-finalize-prereq');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-finalize-prereq',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });
    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 1 }),
    ];
    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(laneAssignments);
    startlist.assignPlayerOrderAndIntervals(classAssignments);
    startlist.pullDomainEvents();

    assert.throws(
      () => startlist.finalizeStartlist(),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual(
          (error as Error).message,
          'Startlist can only be finalized after assigning start times.',
        );
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);
  });

  test('invalidateStartTimes requires existing assignments and reopens finalized startlist', () => {
    const startlistId = StartlistId.create('startlist-failure-invalidate');
    const startlist = createStartlist(startlistId, 'event-failure-invalidate');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-invalidate',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });
    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 1 }),
    ];
    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];
    const startTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(laneAssignments);
    startlist.assignPlayerOrderAndIntervals(classAssignments);

    // clear setup events before asserting error case
    startlist.pullDomainEvents();

    assert.throws(
      () => startlist.invalidateStartTimes('No start times yet'),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.strictEqual((error as Error).message, 'No start times are assigned to invalidate.');
        return true;
      },
    );

    assert.deepStrictEqual(startlist.pullDomainEvents(), []);

    startlist.assignStartTimes(startTimes);
    startlist.finalizeStartlist();
    startlist.pullDomainEvents();

    const reopenReason = 'Weather delay - start times cleared';

    startlist.invalidateStartTimes(reopenReason);

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.getStartTimes(), []);

    let events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 1);
    const invalidatedEvent = events[0];
    assert(invalidatedEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(invalidatedEvent.reason, reopenReason);

    startlist.assignStartTimes(startTimes);
    startlist.finalizeStartlist();

    assert.strictEqual(startlist.getStatus(), StartlistStatus.FINALIZED);

    events = startlist.pullDomainEvents();
    assert.strictEqual(events.length, 3);
    const reassignedEvent = events[0];
    assert(reassignedEvent instanceof StartTimesAssignedEvent);
    const finalizedEvent = events[1];
    assert(finalizedEvent instanceof StartlistFinalizedEvent);
    const versionEvent = events[2];
    assert(versionEvent instanceof StartlistVersionGeneratedEvent);
  });

  test('manuallyReassignLaneOrder propagates reason and reopens finalized startlist', () => {
    const startlistId = StartlistId.create('startlist-failure-manual-lane');
    const startlist = createStartlist(startlistId, 'event-failure-manual-lane');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-manual-lane',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 2,
    });
    const initialLaneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
    ];
    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
      ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
    ];
    const startTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
      StartTime.create({ playerId: 'player-2', startTime: new Date(fixedDate.getTime() + interval.value), laneNumber: 2 }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(initialLaneAssignments);
    startlist.assignPlayerOrderAndIntervals(classAssignments);
    startlist.assignStartTimes(startTimes);
    startlist.pullDomainEvents();

    const manualReason = 'Manual lane reorder for fairness';
    const newLaneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-b'], interval, laneCount: 2 }),
      LaneAssignment.create({ laneNumber: 2, classOrder: ['class-a'], interval, laneCount: 2 }),
    ];

    startlist.manuallyReassignLaneOrder(newLaneAssignments, manualReason);

    const manualLaneEvents = startlist.pullDomainEvents();
    assert.strictEqual(manualLaneEvents.length, 2);
    const invalidatedEvent = manualLaneEvents[0];
    assert(invalidatedEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(
      invalidatedEvent.reason,
      `${manualReason} - start times invalidated`,
    );
    const reassignedEvent = manualLaneEvents[1];
    assert(reassignedEvent instanceof LaneOrderManuallyReassignedEvent);
    assert.deepStrictEqual(
      reassignedEvent.laneAssignments,
      toLaneAssignmentDtos(startlist.getLaneAssignments()),
    );

    assert.strictEqual(startlist.getStatus(), StartlistStatus.LANE_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.getStartTimes(), []);
  });

  test('manuallyFinalizeClassStartOrder propagates reason and reopens finalized startlist', () => {
    const startlistId = StartlistId.create('startlist-failure-manual-class');
    const startlist = createStartlist(startlistId, 'event-failure-manual-class');
    const interval = Duration.fromMinutes(1);
    const settings = StartlistSettings.create({
      eventId: 'event-failure-manual-class',
      startTime: fixedDate,
      laneClassInterval: interval,
      classPlayerInterval: interval,
      laneCount: 1,
    });
    const laneAssignments = [
      LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 1 }),
    ];
    const classAssignments = [
      ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
    ];
    const startTimes = [
      StartTime.create({ playerId: 'player-1', startTime: fixedDate, laneNumber: 1 }),
    ];

    startlist.enterSettings(settings);
    startlist.assignLaneOrderAndIntervals(laneAssignments);
    startlist.assignPlayerOrderAndIntervals(classAssignments);
    startlist.assignStartTimes(startTimes);
    startlist.pullDomainEvents();

    const manualReason = 'Manual class order adjustment';

    startlist.manuallyFinalizeClassStartOrder(classAssignments, manualReason);

    const manualClassEvents = startlist.pullDomainEvents();
    assert.strictEqual(manualClassEvents.length, 2);
    const invalidatedEvent = manualClassEvents[0];
    assert(invalidatedEvent instanceof StartTimesInvalidatedEvent);
    assert.strictEqual(
      invalidatedEvent.reason,
      `${manualReason} - start times invalidated`,
    );
    const finalizedClassEvent = manualClassEvents[1];
    assert(finalizedClassEvent instanceof ClassStartOrderManuallyFinalizedEvent);
    assert.deepStrictEqual(
      finalizedClassEvent.classAssignments,
      toClassAssignmentDtos(startlist.getClassAssignments()),
    );

    assert.strictEqual(startlist.getStatus(), StartlistStatus.PLAYER_ORDER_ASSIGNED);
    assert.deepStrictEqual(startlist.getStartTimes(), []);
  });
});
