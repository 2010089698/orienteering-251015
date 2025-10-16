import { describe, expect, it } from 'vitest';
import { toStartlistSettings, toLaneAssignments, toClassAssignments, toStartTimes } from '../dto/StartlistMappers.js';

const validDate = '2024-01-01T10:00:00.000Z';

describe('Startlist mappers', () => {
  it('converts startlist settings dto', () => {
    const settings = toStartlistSettings({
      eventId: 'event-1',
      startTime: validDate,
      intervals: {
        laneClass: { milliseconds: 90000 },
        classPlayer: { milliseconds: 60000 },
      },
      laneCount: 4,
    });

    expect(settings.eventId).toBe('event-1');
    expect(settings.laneCount).toBe(4);
    expect(settings.laneClassInterval.value).toBe(90000);
    expect(settings.classPlayerInterval.value).toBe(60000);
  });

  it('throws for invalid start time', () => {
    expect(() =>
      toStartlistSettings({
        eventId: 'event-1',
        startTime: 'invalid-date',
        intervals: {
          laneClass: { milliseconds: 90000 },
          classPlayer: { milliseconds: 60000 },
        },
        laneCount: 4,
      }),
    ).toThrow('Invalid date value: invalid-date');
  });

  it('maps lane assignments with lane count context', () => {
    const [assignment] = toLaneAssignments(
      [{ laneNumber: 1, classOrder: ['class-1'], interval: { milliseconds: 120000 } }],
      3,
    );

    expect(assignment.laneNumber).toBe(1);
    expect(assignment.interval.value).toBe(120000);
  });

  it('maps class assignments dto', () => {
    const [assignment] = toClassAssignments([
      { classId: 'class-1', playerOrder: ['player-1'], interval: { milliseconds: 45000 } },
    ]);

    expect(assignment.classId).toBe('class-1');
  });

  it('maps start time dto', () => {
    const [startTime] = toStartTimes([{ playerId: 'player-1', startTime: validDate, laneNumber: 2 }]);

    expect(startTime.playerId).toBe('player-1');
    expect(startTime.laneNumber).toBe(2);
  });
});
