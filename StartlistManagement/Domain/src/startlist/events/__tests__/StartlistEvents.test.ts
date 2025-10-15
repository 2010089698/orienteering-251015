import assert from 'node:assert/strict';
import { test } from '@jest/globals';

import { ClassAssignment } from '../../../startlist/ClassAssignment.js';
import { Duration } from '../../../startlist/Duration.js';
import { LaneAssignment } from '../../../startlist/LaneAssignment.js';
import { StartTime } from '../../../startlist/StartTime.js';
import { StartlistSettings } from '../../../startlist/StartlistSettings.js';
import { StartlistSnapshot } from '../../../startlist/StartlistSnapshot.js';
import { StartlistStatus } from '../../../startlist/StartlistStatus.js';
import { ClassStartOrderManuallyFinalizedEvent } from '../ClassStartOrderManuallyFinalizedEvent.js';
import { LaneOrderAndIntervalsAssignedEvent } from '../LaneOrderAndIntervalsAssignedEvent.js';
import { LaneOrderManuallyReassignedEvent } from '../LaneOrderManuallyReassignedEvent.js';
import { PlayerOrderAndIntervalsAssignedEvent } from '../PlayerOrderAndIntervalsAssignedEvent.js';
import { StartTimesAssignedEvent } from '../StartTimesAssignedEvent.js';
import { StartTimesInvalidatedEvent } from '../StartTimesInvalidatedEvent.js';
import { StartlistFinalizedEvent } from '../StartlistFinalizedEvent.js';
import { StartlistSettingsEnteredEvent } from '../StartlistSettingsEnteredEvent.js';

const baseDate = new Date('2024-01-02T12:00:00Z');
const interval = Duration.fromMinutes(1);
const baseSettings = StartlistSettings.create({
  eventId: 'event-immutable',
  startTime: baseDate,
  interval,
  laneCount: 2,
});

const baseLaneAssignments = [
  LaneAssignment.create({ laneNumber: 1, classOrder: ['class-a'], interval, laneCount: 2 }),
  LaneAssignment.create({ laneNumber: 2, classOrder: ['class-b'], interval, laneCount: 2 }),
];

const baseClassAssignments = [
  ClassAssignment.create({ classId: 'class-a', playerOrder: ['player-1'], interval }),
  ClassAssignment.create({ classId: 'class-b', playerOrder: ['player-2'], interval }),
];

const baseStartTimes = [
  StartTime.create({ playerId: 'player-1', startTime: baseDate, laneNumber: 1 }),
  StartTime.create({
    playerId: 'player-2',
    startTime: new Date(baseDate.getTime() + interval.value),
    laneNumber: 2,
  }),
];

test('StartlistSettingsEnteredEvent copies the provided date', () => {
  const occurrence = new Date(baseDate);
  const event = new StartlistSettingsEnteredEvent('startlist-immutable', baseSettings, occurrence);

  occurrence.setUTCFullYear(2030);

  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});

test('LaneOrderAndIntervalsAssignedEvent copies input arrays and date', () => {
  const occurrence = new Date(baseDate);
  const laneAssignments = [...baseLaneAssignments];
  const event = new LaneOrderAndIntervalsAssignedEvent('startlist-immutable', laneAssignments, occurrence);

  occurrence.setUTCMinutes(occurrence.getUTCMinutes() + 5);
  laneAssignments.splice(0, laneAssignments.length);

  assert.strictEqual(event.laneAssignments.length, baseLaneAssignments.length);
  assert.deepStrictEqual(event.laneAssignments, baseLaneAssignments);
  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});

test('LaneOrderManuallyReassignedEvent copies input arrays and date', () => {
  const occurrence = new Date(baseDate);
  const laneAssignments = [...baseLaneAssignments];
  const event = new LaneOrderManuallyReassignedEvent('startlist-immutable', laneAssignments, occurrence);

  occurrence.setUTCDate(occurrence.getUTCDate() + 1);
  laneAssignments.push(LaneAssignment.create({ laneNumber: 3, classOrder: ['class-c'], interval, laneCount: 3 }));

  assert.strictEqual(event.laneAssignments.length, baseLaneAssignments.length);
  assert.deepStrictEqual(event.laneAssignments, baseLaneAssignments);
  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});

test('PlayerOrderAndIntervalsAssignedEvent copies input arrays and date', () => {
  const occurrence = new Date(baseDate);
  const classAssignments = [...baseClassAssignments];
  const event = new PlayerOrderAndIntervalsAssignedEvent('startlist-immutable', classAssignments, occurrence);

  occurrence.setUTCSeconds(occurrence.getUTCSeconds() + 30);
  classAssignments.reverse();

  assert.strictEqual(event.classAssignments.length, baseClassAssignments.length);
  assert.deepStrictEqual(event.classAssignments, baseClassAssignments);
  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});

test('ClassStartOrderManuallyFinalizedEvent copies input arrays and date', () => {
  const occurrence = new Date(baseDate);
  const classAssignments = [...baseClassAssignments];
  const event = new ClassStartOrderManuallyFinalizedEvent('startlist-immutable', classAssignments, occurrence);

  occurrence.setUTCMonth(occurrence.getUTCMonth() + 1);
  classAssignments.splice(0, classAssignments.length);

  assert.strictEqual(event.classAssignments.length, baseClassAssignments.length);
  assert.deepStrictEqual(event.classAssignments, baseClassAssignments);
  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});

test('StartTimesAssignedEvent copies input arrays and date', () => {
  const occurrence = new Date(baseDate);
  const startTimes = [...baseStartTimes];
  const event = new StartTimesAssignedEvent('startlist-immutable', startTimes, occurrence);

  occurrence.setUTCHours(occurrence.getUTCHours() + 1);
  startTimes.pop();

  assert.strictEqual(event.startTimes.length, baseStartTimes.length);
  assert.deepStrictEqual(event.startTimes, baseStartTimes);
  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});

test('StartTimesInvalidatedEvent copies the provided date', () => {
  const occurrence = new Date(baseDate);
  const event = new StartTimesInvalidatedEvent('startlist-immutable', 'reason', occurrence);

  occurrence.setUTCFullYear(2020);

  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});

test('StartlistFinalizedEvent copies the provided snapshot, arrays, and date', () => {
  const occurrence = new Date(baseDate);
  const snapshot: StartlistSnapshot = {
    id: 'startlist-immutable',
    settings: baseSettings,
    laneAssignments: [...baseLaneAssignments],
    classAssignments: [...baseClassAssignments],
    startTimes: [...baseStartTimes],
    status: StartlistStatus.START_TIMES_ASSIGNED,
  };
  const event = new StartlistFinalizedEvent('startlist-immutable', snapshot, occurrence);

  occurrence.setUTCMinutes(occurrence.getUTCMinutes() + 10);
  (snapshot.laneAssignments as LaneAssignment[]).push(
    LaneAssignment.create({ laneNumber: 3, classOrder: ['class-c'], interval, laneCount: 3 }),
  );
  (snapshot.classAssignments as ClassAssignment[]).splice(0, snapshot.classAssignments.length);
  (snapshot.startTimes as StartTime[]).splice(0, snapshot.startTimes.length);

  assert.strictEqual(event.finalStartlist.laneAssignments.length, baseLaneAssignments.length);
  assert.deepStrictEqual(event.finalStartlist.laneAssignments, baseLaneAssignments);
  assert.strictEqual(event.finalStartlist.classAssignments.length, baseClassAssignments.length);
  assert.deepStrictEqual(event.finalStartlist.classAssignments, baseClassAssignments);
  assert.strictEqual(event.finalStartlist.startTimes.length, baseStartTimes.length);
  assert.deepStrictEqual(event.finalStartlist.startTimes, baseStartTimes);
  assert.strictEqual(event.occurredAt.toISOString(), baseDate.toISOString());
});
