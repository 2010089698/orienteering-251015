export type EventId = string;

export interface EventDefinition {
  id: EventId;
  name: string;
  startDate: Date;
  venue: string;
  disciplines: readonly string[];
}

export class EventDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventDomainError';
  }
}

export function validateEventDefinition(definition: EventDefinition): EventDefinition {
  if (!definition.id || !definition.id.trim()) {
    throw new EventDomainError('Event id must be provided.');
  }

  if (!definition.name || !definition.name.trim()) {
    throw new EventDomainError('Event name must not be empty.');
  }

  if (!(definition.startDate instanceof Date) || Number.isNaN(definition.startDate.valueOf())) {
    throw new EventDomainError('Event start date must be a valid Date instance.');
  }

  if (!definition.venue || !definition.venue.trim()) {
    throw new EventDomainError('Event venue must not be empty.');
  }

  const disciplines = Array.from(definition.disciplines);
  const hasBlankDiscipline = disciplines.some((discipline) => !discipline.trim());
  if (hasBlankDiscipline) {
    throw new EventDomainError('Discipline names must not contain empty values.');
  }

  const hasUniqueDisciplines =
    new Set(disciplines.map((discipline) => discipline.toLowerCase())).size === disciplines.length;
  if (!hasUniqueDisciplines) {
    throw new EventDomainError('Discipline names must be unique.');
  }

  return {
    ...definition,
    name: definition.name.trim(),
    venue: definition.venue.trim(),
    disciplines
  };
}

export function toEventSummary(definition: EventDefinition): string {
  const formattedDate = definition.startDate.toISOString();
  return `${definition.name} @ ${definition.venue} (${formattedDate})`;
}
