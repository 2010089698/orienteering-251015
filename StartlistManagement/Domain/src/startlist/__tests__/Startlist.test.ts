import assert from 'node:assert/strict';
import test from 'node:test';

import { DomainError } from '../../common/DomainError';
import { ClassAssignment } from '../ClassAssignment';
import { Duration } from '../Duration';
import { LaneAssignment } from '../LaneAssignment';
import { StartTime } from '../StartTime';
import { Startlist } from '../Startlist';
import { StartlistId } from '../StartlistId';
import { StartlistSettings } from '../StartlistSettings';

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
