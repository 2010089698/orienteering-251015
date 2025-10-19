import { DomainError } from '../common/DomainError.js';

export class StartlistSettingsNotEnteredError extends DomainError {
  constructor(message = 'Startlist settings must be entered before performing this action.') {
    super(message);
    this.name = 'StartlistSettingsNotEnteredError';
  }
}

export class LaneAssignmentsNotCompletedError extends DomainError {
  constructor(message = 'Lane assignments must be completed before performing this action.') {
    super(message);
    this.name = 'LaneAssignmentsNotCompletedError';
  }
}

export class ClassAssignmentsNotCompletedError extends DomainError {
  constructor(message = 'Class assignments must be completed before performing this action.') {
    super(message);
    this.name = 'ClassAssignmentsNotCompletedError';
  }
}

export class NoStartTimesAssignedError extends DomainError {
  constructor(message = 'No start times are assigned to invalidate.') {
    super(message);
    this.name = 'NoStartTimesAssignedError';
  }
}
