import { type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

import { ValidationError } from './errors.js';

export function validateWithSchema<TSchemaType extends TSchema>(
  schema: TSchemaType,
  payload: unknown,
): Static<TSchemaType> {
  if (!Value.Check(schema, payload)) {
    const [firstError] = Value.Errors(schema, payload);
    const message = firstError
      ? `${firstError.path || 'input'} ${firstError.message}`
      : 'Input did not satisfy validation schema.';
    throw new ValidationError(message);
  }

  return Value.Cast(schema, payload);
}
