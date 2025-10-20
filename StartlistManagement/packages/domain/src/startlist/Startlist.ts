import { DomainClock } from '../common/DomainClock.js';
import { DomainError } from '../common/DomainError.js';
import { DomainEvent } from '../common/DomainEvent.js';
import { ClassAssignment } from './ClassAssignment.js';
import { LaneAssignment } from './LaneAssignment.js';
import { StartTime } from './StartTime.js';
import { StartTimeAssignmentPolicy } from './StartTimeAssignmentPolicy.js';
import { StartlistId } from './StartlistId.js';
import { StartlistSettings } from './StartlistSettings.js';
import {
  StartlistSnapshotDto,
  toClassAssignmentDto,
  toLaneAssignmentDto,
  toStartTimeDto,
  toStartlistSettingsDto,
  toStartlistSnapshotDto,
  fromStartlistSnapshotDto,
} from './StartlistDtos.js';
import { StartlistSnapshot } from './StartlistSnapshot.js';
import { StartlistStatus } from './StartlistStatus.js';
import { LaneAssignmentsNotCompletedError, NoStartTimesAssignedError, StartlistSettingsNotEnteredError } from './StartlistErrors.js';
import { ClassStartOrderManuallyFinalizedEvent } from './events/ClassStartOrderManuallyFinalizedEvent.js';
import { LaneOrderAndIntervalsAssignedEvent } from './events/LaneOrderAndIntervalsAssignedEvent.js';
import { LaneOrderManuallyReassignedEvent } from './events/LaneOrderManuallyReassignedEvent.js';
import { PlayerOrderAndIntervalsAssignedEvent } from './events/PlayerOrderAndIntervalsAssignedEvent.js';
import { StartTimesAssignedEvent } from './events/StartTimesAssignedEvent.js';
import { StartTimesInvalidatedEvent } from './events/StartTimesInvalidatedEvent.js';
import { StartlistFinalizedEvent } from './events/StartlistFinalizedEvent.js';
import { StartlistSettingsEnteredEvent } from './events/StartlistSettingsEnteredEvent.js';
import { StartlistVersionGeneratedEvent } from './events/StartlistVersionGeneratedEvent.js';

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
    snapshot: StartlistSnapshotDto;
  }): Startlist {
    const startlist = new Startlist(params.id, params.clock);
    const { settings, laneAssignments, classAssignments, startTimes, status } =
      fromStartlistSnapshotDto(params.snapshot);
    if (settings) {
      startlist.settings = settings;
    }
    startlist.laneAssignments = laneAssignments;
    startlist.classAssignments = classAssignments;
    startlist.startTimes = startTimes;
    startlist.status = status;
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

  getSettingsOrThrow(): StartlistSettings {
    return this.ensureSettingsPresent();
  }

  toSnapshot(): StartlistSnapshot {
    return toStartlistSnapshotDto({
      id: this.id.toString(),
      settings: this.settings,
      laneAssignments: this.laneAssignments,
      classAssignments: this.classAssignments,
      startTimes: this.startTimes,
      status: this.status,
    });
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.pendingEvents.slice();
    this.pendingEvents.length = 0;
    return events;
  }

  enterSettings(settings: StartlistSettings): void {
    this.ensureStatus(StartlistStatus.DRAFT, 'Startlist settings can only be entered once while in draft.');
    this.settings = settings;
    this.status = StartlistStatus.SETTINGS_ENTERED;
    this.record(
      new StartlistSettingsEnteredEvent(
        this.id.toString(),
        toStartlistSettingsDto(settings),
        this.clock.now(),
      ),
    );
  }

  assignLaneOrderAndIntervals(assignments: LaneAssignment[]): void {
    const settings = this.ensureSettingsPresent();
    this.updateLaneAssignments(assignments, settings.laneCount);
    this.invalidateExistingStartTimes(
      'Lane order assigned - start times invalidated',
      StartlistStatus.LANE_ORDER_ASSIGNED,
    );
    this.record(
      new LaneOrderAndIntervalsAssignedEvent(
        this.id.toString(),
        this.laneAssignments.map(toLaneAssignmentDto),
        this.clock.now(),
      ),
    );
  }

  assignPlayerOrderAndIntervals(assignments: ClassAssignment[]): void {
    this.ensureSettingsPresent();
    this.ensureLaneAssignmentsPresent();
    this.updateClassAssignments(assignments);
    this.invalidateExistingStartTimes(
      'Player order assigned - start times invalidated',
      StartlistStatus.PLAYER_ORDER_ASSIGNED,
    );
    this.record(
      new PlayerOrderAndIntervalsAssignedEvent(
        this.id.toString(),
        this.classAssignments.map(toClassAssignmentDto),
        this.clock.now(),
      ),
    );
  }

  assignStartTimes(startTimes: StartTime[]): void {
    StartTimeAssignmentPolicy.ensureCanAssign({
      startTimes,
      settings: this.settings,
      classAssignments: this.classAssignments,
    });
    this.startTimes = [...startTimes];
    this.status = StartlistStatus.START_TIMES_ASSIGNED;
    this.record(
      new StartTimesAssignedEvent(
        this.id.toString(),
        this.startTimes.map(toStartTimeDto),
        this.clock.now(),
      ),
    );
  }

  finalizeStartlist(): void {
    this.ensureStatus(
      StartlistStatus.START_TIMES_ASSIGNED,
      'Startlist can only be finalized after assigning start times.',
    );
    this.status = StartlistStatus.FINALIZED;
    const occurredAt = this.clock.now();
    const snapshot = this.toSnapshot();
    this.record(new StartlistFinalizedEvent(this.id.toString(), snapshot, occurredAt));
    this.record(new StartlistVersionGeneratedEvent(this.id.toString(), snapshot, occurredAt));
  }

  manuallyReassignLaneOrder(assignments: LaneAssignment[], reason = 'Lane order manually reassigned'): void {
    const settings = this.ensureSettingsPresent();
    this.updateLaneAssignments(assignments, settings.laneCount);
    this.invalidateExistingStartTimes(
      `${reason} - start times invalidated`,
      StartlistStatus.LANE_ORDER_ASSIGNED,
    );
    this.record(
      new LaneOrderManuallyReassignedEvent(
        this.id.toString(),
        this.laneAssignments.map(toLaneAssignmentDto),
        this.clock.now(),
      ),
    );
  }

  manuallyFinalizeClassStartOrder(
    assignments: ClassAssignment[],
    reason = 'Class start order manually finalized',
  ): void {
    this.ensureSettingsPresent();
    this.ensureLaneAssignmentsPresent();
    this.updateClassAssignments(assignments);
    this.invalidateExistingStartTimes(
      `${reason} - start times invalidated`,
      StartlistStatus.PLAYER_ORDER_ASSIGNED,
    );
    this.record(
      new ClassStartOrderManuallyFinalizedEvent(
        this.id.toString(),
        this.classAssignments.map(toClassAssignmentDto),
        this.clock.now(),
      ),
    );
  }

  invalidateStartTimes(reason: string): void {
    if (this.startTimes.length === 0) {
      throw new NoStartTimesAssignedError();
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

  private updateLaneAssignments(assignments: LaneAssignment[], laneCount: number): void {
    if (assignments.length === 0) {
      throw new DomainError('At least one lane assignment is required.');
    }
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

  private ensureSettingsPresent(): StartlistSettings {
    if (!this.settings) {
      throw new StartlistSettingsNotEnteredError();
    }
    return this.settings;
  }

  private ensureLaneAssignmentsPresent(): void {
    if (this.laneAssignments.length === 0) {
      throw new LaneAssignmentsNotCompletedError();
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
