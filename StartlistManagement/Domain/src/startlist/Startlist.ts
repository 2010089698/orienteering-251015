import { DomainClock } from '../common/DomainClock';
import { DomainError } from '../common/DomainError';
import { DomainEvent } from '../common/DomainEvent';
import { ClassAssignment } from './ClassAssignment';
import { LaneAssignment } from './LaneAssignment';
import { StartTime } from './StartTime';
import { StartlistId } from './StartlistId';
import { StartlistSettings } from './StartlistSettings';
import { StartlistSnapshot } from './StartlistSnapshot';
import { StartlistStatus } from './StartlistStatus';
import { ClassStartOrderManuallyFinalizedEvent } from './events/ClassStartOrderManuallyFinalizedEvent';
import { LaneOrderAndIntervalsAssignedEvent } from './events/LaneOrderAndIntervalsAssignedEvent';
import { LaneOrderManuallyReassignedEvent } from './events/LaneOrderManuallyReassignedEvent';
import { PlayerOrderAndIntervalsAssignedEvent } from './events/PlayerOrderAndIntervalsAssignedEvent';
import { StartTimesAssignedEvent } from './events/StartTimesAssignedEvent';
import { StartTimesInvalidatedEvent } from './events/StartTimesInvalidatedEvent';
import { StartlistFinalizedEvent } from './events/StartlistFinalizedEvent';
import { StartlistSettingsEnteredEvent } from './events/StartlistSettingsEnteredEvent';

export class Startlist {
  private settings?: StartlistSettings;
  private laneAssignments: LaneAssignment[] = [];
  private classAssignments: ClassAssignment[] = [];
  private startTimes: StartTime[] = [];
  private status: StartlistStatus = StartlistStatus.DRAFT;
  private pendingEvents: DomainEvent[] = [];

  private constructor(private readonly id: StartlistId, private readonly clock: DomainClock) {}

  static createNew(id: StartlistId, clock: DomainClock): Startlist {
    return new Startlist(id, clock);
  }

  static reconstitute(params: {
    id: StartlistId;
    clock: DomainClock;
    settings?: StartlistSettings;
    laneAssignments?: LaneAssignment[];
    classAssignments?: ClassAssignment[];
    startTimes?: StartTime[];
    status?: StartlistStatus;
  }): Startlist {
    const startlist = new Startlist(params.id, params.clock);
    if (params.settings) {
      startlist.settings = params.settings;
    }
    if (params.laneAssignments) {
      startlist.laneAssignments = [...params.laneAssignments];
    }
    if (params.classAssignments) {
      startlist.classAssignments = [...params.classAssignments];
    }
    if (params.startTimes) {
      startlist.startTimes = [...params.startTimes];
    }
    if (params.status) {
      startlist.status = params.status;
    }
    return startlist;
  }

  getId(): StartlistId {
    return this.id;
  }

  getStatus(): StartlistStatus {
    return this.status;
  }

  getSettings(): StartlistSettings | undefined {
    return this.settings;
  }

  getLaneAssignments(): ReadonlyArray<LaneAssignment> {
    return [...this.laneAssignments];
  }

  getClassAssignments(): ReadonlyArray<ClassAssignment> {
    return [...this.classAssignments];
  }

  getStartTimes(): ReadonlyArray<StartTime> {
    return [...this.startTimes];
  }

  toSnapshot(): StartlistSnapshot {
    return {
      id: this.id.toString(),
      settings: this.settings,
      laneAssignments: [...this.laneAssignments],
      classAssignments: [...this.classAssignments],
      startTimes: [...this.startTimes],
      status: this.status,
    };
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.pendingEvents];
    this.pendingEvents = [];
    return events;
  }

  enterSettings(settings: StartlistSettings): void {
    this.ensureStatus(StartlistStatus.DRAFT, 'Startlist settings can only be entered once while in draft.');
    this.settings = settings;
    this.status = StartlistStatus.SETTINGS_ENTERED;
    this.record(new StartlistSettingsEnteredEvent(this.id.toString(), settings, this.clock.now()));
  }

  assignLaneOrderAndIntervals(assignments: LaneAssignment[]): void {
    this.ensureNotFinalized('Cannot assign lane order when startlist is finalized.');
    this.ensureSettingsPresent();
    this.updateLaneAssignments(assignments);
    this.record(
      new LaneOrderAndIntervalsAssignedEvent(
        this.id.toString(),
        this.getLaneAssignments(),
        this.clock.now(),
      ),
    );
  }

  assignPlayerOrderAndIntervals(assignments: ClassAssignment[]): void {
    this.ensureNotFinalized('Cannot assign player order when startlist is finalized.');
    this.ensureSettingsPresent();
    this.ensureLaneAssignmentsPresent();
    this.updateClassAssignments(assignments);
    this.record(
      new PlayerOrderAndIntervalsAssignedEvent(
        this.id.toString(),
        this.getClassAssignments(),
        this.clock.now(),
      ),
    );
  }

  assignStartTimes(startTimes: StartTime[]): void {
    this.ensureNotFinalized('Cannot assign start times when startlist is finalized.');
    this.ensureSettingsPresent();
    this.ensureClassAssignmentsPresent();
    if (startTimes.length === 0) {
      throw new DomainError('At least one start time must be provided.');
    }
    const playerIds = new Set<string>();
    const laneCount = this.settings!.laneCount;
    startTimes.forEach((startTime) => {
      if (playerIds.has(startTime.playerId)) {
        throw new DomainError('Start times must be unique per player.');
      }
      if (startTime.laneNumber > laneCount) {
        throw new DomainError('Start time lane number exceeds configured lane count.');
      }
      playerIds.add(startTime.playerId);
    });
    this.startTimes = [...startTimes];
    this.status = StartlistStatus.START_TIMES_ASSIGNED;
    this.record(
      new StartTimesAssignedEvent(this.id.toString(), this.getStartTimes(), this.clock.now()),
    );
  }

  finalizeStartlist(): void {
    this.ensureStatus(
      StartlistStatus.START_TIMES_ASSIGNED,
      'Startlist can only be finalized after assigning start times.',
    );
    this.status = StartlistStatus.FINALIZED;
    this.record(
      new StartlistFinalizedEvent(this.id.toString(), this.toSnapshot(), this.clock.now()),
    );
  }

  manuallyReassignLaneOrder(assignments: LaneAssignment[], reason = 'Lane order manually reassigned'): void {
    this.ensureNotFinalized('Cannot reassign lane order when startlist is finalized.');
    this.ensureSettingsPresent();
    this.updateLaneAssignments(assignments);
    this.invalidateExistingStartTimes(reason, StartlistStatus.LANE_ORDER_ASSIGNED);
    this.record(
      new LaneOrderManuallyReassignedEvent(
        this.id.toString(),
        this.getLaneAssignments(),
        this.clock.now(),
      ),
    );
  }

  manuallyFinalizeClassStartOrder(
    assignments: ClassAssignment[],
    reason = 'Class start order manually finalized',
  ): void {
    this.ensureNotFinalized('Cannot manually finalize class start order when startlist is finalized.');
    this.ensureSettingsPresent();
    this.ensureLaneAssignmentsPresent();
    this.updateClassAssignments(assignments);
    this.invalidateExistingStartTimes(reason, StartlistStatus.PLAYER_ORDER_ASSIGNED);
    this.record(
      new ClassStartOrderManuallyFinalizedEvent(
        this.id.toString(),
        this.getClassAssignments(),
        this.clock.now(),
      ),
    );
  }

  invalidateStartTimes(reason: string): void {
    this.ensureNotFinalized('Cannot invalidate start times when startlist is finalized.');
    if (this.startTimes.length === 0) {
      throw new DomainError('No start times are assigned to invalidate.');
    }
    this.startTimes = [];
    this.status = StartlistStatus.PLAYER_ORDER_ASSIGNED;
    this.record(new StartTimesInvalidatedEvent(this.id.toString(), reason, this.clock.now()));
  }

  private invalidateExistingStartTimes(reason: string, fallbackStatus: StartlistStatus): void {
    if (this.startTimes.length === 0) {
      return;
    }
    this.startTimes = [];
    this.status = fallbackStatus;
    this.record(new StartTimesInvalidatedEvent(this.id.toString(), reason, this.clock.now()));
  }

  private updateLaneAssignments(assignments: LaneAssignment[]): void {
    if (assignments.length === 0) {
      throw new DomainError('At least one lane assignment is required.');
    }
    const laneCount = this.settings!.laneCount;
    const laneNumbers = new Set<number>();
    assignments.forEach((assignment) => {
      if (assignment.laneNumber > laneCount) {
        throw new DomainError('Lane assignment exceeds configured lane count.');
      }
      if (laneNumbers.has(assignment.laneNumber)) {
        throw new DomainError('Each lane can only be assigned once.');
      }
      laneNumbers.add(assignment.laneNumber);
    });
    this.laneAssignments = [...assignments];
    this.status = StartlistStatus.LANE_ORDER_ASSIGNED;
  }

  private updateClassAssignments(assignments: ClassAssignment[]): void {
    if (assignments.length === 0) {
      throw new DomainError('At least one class assignment is required.');
    }
    const classIds = new Set<string>();
    assignments.forEach((assignment) => {
      if (classIds.has(assignment.classId)) {
        throw new DomainError('Each class can only be assigned once.');
      }
      classIds.add(assignment.classId);
    });
    const laneClassIds = new Set<string>(
      this.laneAssignments.flatMap((assignment) => assignment.classOrder),
    );
    assignments.forEach((assignment) => {
      if (!laneClassIds.has(assignment.classId)) {
        throw new DomainError(
          `Class ${assignment.classId} is not part of the lane assignments and cannot be ordered.`,
        );
      }
    });
    this.classAssignments = [...assignments];
    this.status = StartlistStatus.PLAYER_ORDER_ASSIGNED;
  }

  private ensureNotFinalized(message: string): void {
    if (this.status === StartlistStatus.FINALIZED) {
      throw new DomainError(message);
    }
  }

  private ensureSettingsPresent(): void {
    if (!this.settings) {
      throw new DomainError('Startlist settings must be entered before performing this action.');
    }
  }

  private ensureLaneAssignmentsPresent(): void {
    if (this.laneAssignments.length === 0) {
      throw new DomainError('Lane assignments must be completed before performing this action.');
    }
  }

  private ensureClassAssignmentsPresent(): void {
    if (this.classAssignments.length === 0) {
      throw new DomainError('Class assignments must be completed before performing this action.');
    }
  }

  private ensureStatus(expected: StartlistStatus, message: string): void {
    if (this.status !== expected) {
      throw new DomainError(message);
    }
  }

  private record(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }
}
