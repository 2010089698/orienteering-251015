import { Type } from '@sinclair/typebox';
import type { TSchema } from '@sinclair/typebox';
import { StartlistStatus } from '@startlist-management/domain';

export const StartlistIdParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

export const DurationSchema = Type.Object(
  {
    milliseconds: Type.Number({
      minimum: 0,
      description: 'Duration expressed in milliseconds. Must be greater than or equal to 0.',
    }),
  },
  { description: 'Duration value used for interval configuration.' },
);

const StartlistSettingsBaseSchema = {
  eventId: Type.String({ minLength: 1, description: 'Identifier of the event the startlist belongs to.' }),
  startTime: Type.String({
    format: 'date-time',
    description: 'ISO 8601 timestamp indicating when the first start should happen.',
  }),
  laneCount: Type.Integer({ minimum: 1, description: 'Total number of lanes used in the competition.' }),
};

const StartlistIntervalsSchema = Type.Object({
  laneClass: DurationSchema,
  classPlayer: DurationSchema,
});

const StartlistSettingsIntervalsSchema = Type.Object({
  ...StartlistSettingsBaseSchema,
  intervals: StartlistIntervalsSchema,
  interval: Type.Optional(
    DurationSchema,
    {
      description: 'Deprecated single interval setting kept for backward compatibility.',
    },
  ),
});

const StartlistSettingsLegacyIntervalSchema = Type.Object({
  ...StartlistSettingsBaseSchema,
  interval: DurationSchema,
});

export const StartlistSettingsSchema = Type.Union(
  [
    StartlistSettingsIntervalsSchema,
    StartlistSettingsLegacyIntervalSchema,
  ],
  {
    description:
      'Startlist settings payload. New clients must provide both intervals.laneClass and intervals.classPlayer. A legacy single "interval" field is accepted for backwards compatibility.',
  },
);

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

const StartlistSettingsResponseSchema = Type.Object(
  {
    eventId: Type.String(),
    startTime: Type.String({ format: 'date-time' }),
    intervals: StartlistIntervalsSchema,
    laneCount: Type.Integer({ minimum: 1 }),
  },
  {
    description:
      'Startlist settings returned by the API. Both laneClass and classPlayer intervals are always included.',
  },
);

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

export const StartlistVersionSummarySchema = Type.Object({
  version: Type.Integer({ minimum: 1 }),
  confirmedAt: Type.String({ format: 'date-time' }),
});

const createDiffValueSchema = <T extends TSchema>(schema: T) =>
  Type.Object({
    previous: Type.Optional(schema),
    current: Type.Optional(schema),
  });

const StartlistDiffSchema = Type.Object({
  startlistId: Type.String(),
  to: StartlistVersionSummarySchema,
  from: Type.Optional(StartlistVersionSummarySchema),
  changes: Type.Object({
    settings: Type.Optional(createDiffValueSchema(StartlistSettingsResponseSchema)),
    laneAssignments: Type.Optional(createDiffValueSchema(Type.Array(LaneAssignmentResponseSchema))),
    classAssignments: Type.Optional(createDiffValueSchema(Type.Array(ClassAssignmentResponseSchema))),
    startTimes: Type.Optional(createDiffValueSchema(Type.Array(StartTimeSchema))),
    status: Type.Optional(createDiffValueSchema(Type.Enum(StartlistStatus))),
  }),
});

export const StartlistResponseSchema = Type.Object({
  id: Type.String(),
  status: Type.Enum(StartlistStatus),
  settings: Type.Optional(StartlistSettingsResponseSchema),
  laneAssignments: Type.Array(LaneAssignmentResponseSchema),
  classAssignments: Type.Array(ClassAssignmentResponseSchema),
  startTimes: Type.Array(StartTimeSchema),
  versions: Type.Optional(Type.Array(StartlistVersionSummarySchema)),
  diff: Type.Optional(StartlistDiffSchema),
});

export const StartlistVersionResponseSchema = Type.Object({
  version: Type.Integer({ minimum: 1 }),
  confirmedAt: Type.String({ format: 'date-time' }),
  snapshot: StartlistResponseSchema,
});

export const StartlistVersionListResponseSchema = Type.Object({
  startlistId: Type.String(),
  total: Type.Integer({ minimum: 0 }),
  items: Type.Array(StartlistVersionResponseSchema),
});

export const StartlistDiffResponseSchema = StartlistDiffSchema;

export const StartlistQueryOptionsSchema = Type.Object({
  includeVersions: Type.Optional(Type.Boolean()),
  versionLimit: Type.Optional(Type.Integer({ minimum: 1 })),
  includeDiff: Type.Optional(Type.Boolean()),
  diffFromVersion: Type.Optional(Type.Integer({ minimum: 1 })),
  diffToVersion: Type.Optional(Type.Integer({ minimum: 1 })),
});

export const StartlistVersionListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const StartlistDiffQuerySchema = Type.Object({
  fromVersion: Type.Optional(Type.Integer({ minimum: 1 })),
  toVersion: Type.Optional(Type.Integer({ minimum: 1 })),
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
