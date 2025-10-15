import { Type } from '@sinclair/typebox';
import { StartlistStatus } from '@startlist-management/domain';

export const StartlistIdParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

export const DurationSchema = Type.Object({
  milliseconds: Type.Number({ minimum: 1 }),
});

export const StartlistSettingsSchema = Type.Object({
  eventId: Type.String({ minLength: 1 }),
  startTime: Type.String({ format: 'date-time' }),
  interval: DurationSchema,
  laneCount: Type.Integer({ minimum: 1 }),
});

export const LaneAssignmentSchema = Type.Object({
  laneNumber: Type.Integer({ minimum: 1 }),
  classOrder: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  interval: DurationSchema,
});

export const ClassAssignmentSchema = Type.Object({
  classId: Type.String({ minLength: 1 }),
  playerOrder: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  interval: DurationSchema,
});

export const StartTimeSchema = Type.Object({
  playerId: Type.String({ minLength: 1 }),
  startTime: Type.String({ format: 'date-time' }),
  laneNumber: Type.Integer({ minimum: 1 }),
});

const StartlistSettingsResponseSchema = Type.Object({
  eventId: Type.String(),
  startTime: Type.String({ format: 'date-time' }),
  interval: DurationSchema,
  laneCount: Type.Integer({ minimum: 1 }),
});

const LaneAssignmentResponseSchema = Type.Object({
  laneNumber: Type.Integer({ minimum: 1 }),
  classOrder: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  interval: DurationSchema,
});

const ClassAssignmentResponseSchema = Type.Object({
  classId: Type.String({ minLength: 1 }),
  playerOrder: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  interval: DurationSchema,
});

export const StartlistResponseSchema = Type.Object({
  id: Type.String(),
  status: Type.Enum(StartlistStatus),
  settings: Type.Optional(StartlistSettingsResponseSchema),
  laneAssignments: Type.Array(LaneAssignmentResponseSchema),
  classAssignments: Type.Array(ClassAssignmentResponseSchema),
  startTimes: Type.Array(StartTimeSchema),
});

export const AssignLaneOrderBodySchema = Type.Object({
  assignments: Type.Array(LaneAssignmentSchema, { minItems: 1 }),
});

export const AssignPlayerOrderBodySchema = Type.Object({
  assignments: Type.Array(ClassAssignmentSchema, { minItems: 1 }),
});

export const AssignStartTimesBodySchema = Type.Object({
  startTimes: Type.Array(StartTimeSchema, { minItems: 1 }),
});

export const ManualLaneOrderBodySchema = Type.Object({
  assignments: Type.Array(LaneAssignmentSchema, { minItems: 1 }),
  reason: Type.Optional(Type.String({ minLength: 1 })),
});

export const ManualClassOrderBodySchema = Type.Object({
  assignments: Type.Array(ClassAssignmentSchema, { minItems: 1 }),
  reason: Type.Optional(Type.String({ minLength: 1 })),
});

export const InvalidateStartTimesBodySchema = Type.Object({
  reason: Type.String({ minLength: 1 }),
});
