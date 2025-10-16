import { Type } from '@sinclair/typebox';

export const EntrySummarySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  classId: Type.String(),
  cardNumber: Type.String(),
  club: Type.Optional(Type.String()),
});

export const EntryResponseSchema = Type.Intersect([
  EntrySummarySchema,
  Type.Object({
    createdAt: Type.String({ format: 'date-time' }),
  }),
]);

export const RegisterEntryBodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  classId: Type.String({ minLength: 1 }),
  cardNumber: Type.String({ minLength: 1 }),
  club: Type.Optional(Type.String()),
});
