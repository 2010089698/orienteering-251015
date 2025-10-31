import {
  type NewPublicStartlistVersion,
  type PublicEventRecord,
  type PublicEventView,
  type PublicRaceRecord,
  type PublicRaceView,
  type PublicStartlistDetails,
  type PublicStartlistRecord,
  type PublicStartlistVersionRecord,
} from './models.js';
import type { PublicProjectionRepository } from './repository.js';

interface RepositoryState {
  events: Map<string, PublicEventRecord>;
  races: Map<string, PublicRaceRecord>;
  startlists: Map<string, PublicStartlistRecord>;
  history: Map<string, PublicStartlistVersionRecord[]>;
}

const clone = <T>(value: T): T => structuredClone(value);

const ensureStateValue = <K, V>(map: Map<K, V>, key: K, factory: () => V): V => {
  if (!map.has(key)) {
    map.set(key, factory());
  }
  return map.get(key)!;
};

export class InMemoryPublicProjectionRepository implements PublicProjectionRepository {
  private readonly state: RepositoryState;

  constructor(initialState?: Partial<RepositoryState>) {
    this.state = {
      events: initialState?.events ?? new Map(),
      races: initialState?.races ?? new Map(),
      startlists: initialState?.startlists ?? new Map(),
      history: initialState?.history ?? new Map(),
    };
  }

  async upsertEvent(record: PublicEventRecord): Promise<void> {
    const existing = this.state.events.get(record.id);
    const createdAt = existing?.createdAt ?? record.createdAt;
    this.state.events.set(record.id, { ...record, createdAt });
  }

  async upsertRace(record: PublicRaceRecord): Promise<void> {
    const existing = this.state.races.get(record.id);
    const createdAt = existing?.createdAt ?? record.createdAt;
    this.state.races.set(record.id, { ...record, createdAt });
  }

  async upsertStartlist(record: PublicStartlistRecord): Promise<void> {
    const existing = this.state.startlists.get(record.id);
    const createdAt = existing?.createdAt ?? record.createdAt;
    this.state.startlists.set(record.id, { ...clone(record), createdAt });
  }

  async appendStartlistVersion(
    record: NewPublicStartlistVersion,
  ): Promise<PublicStartlistVersionRecord> {
    const history = ensureStateValue(this.state.history, record.startlistId, () => []);
    const version = history.length + 1;
    const stored: PublicStartlistVersionRecord = {
      version,
      startlistId: record.startlistId,
      snapshot: clone(record.snapshot),
      confirmedAt: record.confirmedAt,
      createdAt: record.createdAt,
    };
    history.push(stored);
    return clone(stored);
  }

  async clearAll(): Promise<void> {
    this.state.events.clear();
    this.state.races.clear();
    this.state.startlists.clear();
    this.state.history.clear();
  }

  async listEvents(): Promise<PublicEventView[]> {
    const racesByEvent = new Map<string, PublicRaceView[]>();
    for (const race of this.state.races.values()) {
      const raceView: PublicRaceView = {
        ...clone(race),
        startlist: race.startlistId ? this.cloneStartlist(race.startlistId) : undefined,
      };
      const races = ensureStateValue(racesByEvent, race.eventId, () => []);
      races.push(raceView);
    }

    return Array.from(this.state.events.values()).map((event) => ({
      ...clone(event),
      races: racesByEvent.get(event.id)?.map((race) => clone(race)) ?? [],
    }));
  }

  async findEventById(eventId: string): Promise<PublicEventView | undefined> {
    const event = this.state.events.get(eventId);
    if (!event) {
      return undefined;
    }
    const races = Array.from(this.state.races.values())
      .filter((race) => race.eventId === eventId)
      .map((race) => ({
        ...clone(race),
        startlist: race.startlistId ? this.cloneStartlist(race.startlistId) : undefined,
      }));
    return { ...clone(event), races };
  }

  async findStartlistByRace(
    eventId: string,
    raceId: string,
  ): Promise<PublicStartlistDetails | undefined> {
    const race = this.state.races.get(raceId);
    if (!race || race.eventId !== eventId || !race.startlistId) {
      return undefined;
    }
    const startlist = this.state.startlists.get(race.startlistId);
    if (!startlist) {
      return undefined;
    }
    const history = this.state.history.get(startlist.id) ?? [];
    return {
      startlist: this.cloneStartlist(startlist.id),
      history: history.map((item) => clone(item)),
    };
  }

  private cloneStartlist(startlistId: string): PublicStartlistRecord | undefined {
    const startlist = this.state.startlists.get(startlistId);
    return startlist ? clone(startlist) : undefined;
  }
}
