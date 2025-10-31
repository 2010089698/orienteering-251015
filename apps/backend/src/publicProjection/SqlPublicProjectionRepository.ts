import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';

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

interface EventRow {
  event_id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue: string;
  allow_multiple_races_per_day: number;
  allow_schedule_overlap: number;
  event_created_at: string;
  event_updated_at: string;
  race_id?: string;
  race_name?: string;
  schedule_start?: string;
  schedule_end?: string | null;
  duplicate_day?: number;
  overlaps_existing?: number;
  race_startlist_id?: string | null;
  race_created_at?: string;
  race_updated_at?: string;
  startlist_id?: string | null;
  startlist_status?: string | null;
  startlist_snapshot?: string | null;
  startlist_confirmed_at?: string | null;
  startlist_created_at?: string | null;
  startlist_updated_at?: string | null;
}

interface StartlistRow {
  id: string;
  event_id: string;
  race_id: string;
  status: string;
  snapshot: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  version: number;
  startlist_id: string;
  snapshot: string;
  confirmed_at: string;
  created_at: string;
}

export interface SqlPublicProjectionRepositoryOptions {
  databasePath: string;
  migrationsDir?: string;
}

const defaultMigrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));

export class SqlPublicProjectionRepository implements PublicProjectionRepository {
  private constructor(private readonly db: Database) {}

  static async initialize(options: SqlPublicProjectionRepositoryOptions): Promise<SqlPublicProjectionRepository> {
    const db = await open({ filename: options.databasePath, driver: sqlite3.Database });
    await db.exec('PRAGMA foreign_keys = ON;');
    const migrationsDir = options.migrationsDir ?? defaultMigrationsDir;
    await applyMigrations(db, migrationsDir);
    return new SqlPublicProjectionRepository(db);
  }

  async upsertEvent(record: PublicEventRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO public_events (
        id, name, start_date, end_date, venue,
        allow_multiple_races_per_day, allow_schedule_overlap, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        venue = excluded.venue,
        allow_multiple_races_per_day = excluded.allow_multiple_races_per_day,
        allow_schedule_overlap = excluded.allow_schedule_overlap,
        updated_at = excluded.updated_at,
        created_at = public_events.created_at`,
      [
        record.id,
        record.name,
        record.startDate,
        record.endDate,
        record.venue,
        record.allowMultipleRacesPerDay ? 1 : 0,
        record.allowScheduleOverlap ? 1 : 0,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async upsertRace(record: PublicRaceRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO public_races (
        id, event_id, name, schedule_start, schedule_end,
        duplicate_day, overlaps_existing, startlist_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        event_id = excluded.event_id,
        name = excluded.name,
        schedule_start = excluded.schedule_start,
        schedule_end = excluded.schedule_end,
        duplicate_day = excluded.duplicate_day,
        overlaps_existing = excluded.overlaps_existing,
        startlist_id = excluded.startlist_id,
        updated_at = excluded.updated_at,
        created_at = public_races.created_at`,
      [
        record.id,
        record.eventId,
        record.name,
        record.schedule.start,
        record.schedule.end ?? null,
        record.duplicateDay ? 1 : 0,
        record.overlapsExisting ? 1 : 0,
        record.startlistId ?? null,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async upsertStartlist(record: PublicStartlistRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO public_startlists (
        id, event_id, race_id, status, snapshot, confirmed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        event_id = excluded.event_id,
        race_id = excluded.race_id,
        status = excluded.status,
        snapshot = excluded.snapshot,
        confirmed_at = excluded.confirmed_at,
        updated_at = excluded.updated_at,
        created_at = public_startlists.created_at`,
      [
        record.id,
        record.eventId,
        record.raceId,
        record.status,
        JSON.stringify(record.snapshot),
        record.confirmedAt ?? null,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async appendStartlistVersion(
    record: NewPublicStartlistVersion,
  ): Promise<PublicStartlistVersionRecord> {
    const row = await this.db.get<{ version: number }>(
      `INSERT INTO public_startlist_versions (
        startlist_id, version, snapshot, confirmed_at, created_at
      ) VALUES (
        ?,
        COALESCE((SELECT MAX(version) FROM public_startlist_versions WHERE startlist_id = ?), 0) + 1,
        ?, ?, ?
      )
      RETURNING version`,
      [
        record.startlistId,
        record.startlistId,
        JSON.stringify(record.snapshot),
        record.confirmedAt,
        record.createdAt,
      ],
    );

    const version = row?.version ?? 1;
    return {
      version,
      startlistId: record.startlistId,
      snapshot: structuredClone(record.snapshot),
      confirmedAt: record.confirmedAt,
      createdAt: record.createdAt,
    };
  }

  async clearAll(): Promise<void> {
    await this.db.exec(`
      DELETE FROM public_startlist_versions;
      DELETE FROM public_startlists;
      DELETE FROM public_races;
      DELETE FROM public_events;
    `);
  }

  async listEvents(): Promise<PublicEventView[]> {
    const rows = await this.db.all<EventRow[]>(
      `SELECT
        e.id AS event_id,
        e.name,
        e.start_date,
        e.end_date,
        e.venue,
        e.allow_multiple_races_per_day,
        e.allow_schedule_overlap,
        e.created_at AS event_created_at,
        e.updated_at AS event_updated_at,
        r.id AS race_id,
        r.name AS race_name,
        r.schedule_start,
        r.schedule_end,
        r.duplicate_day,
        r.overlaps_existing,
        r.startlist_id AS race_startlist_id,
        r.created_at AS race_created_at,
        r.updated_at AS race_updated_at,
        s.id AS startlist_id,
        s.status AS startlist_status,
        s.snapshot AS startlist_snapshot,
        s.confirmed_at AS startlist_confirmed_at,
        s.created_at AS startlist_created_at,
        s.updated_at AS startlist_updated_at
      FROM public_events e
      LEFT JOIN public_races r ON r.event_id = e.id
      LEFT JOIN public_startlists s ON s.id = r.startlist_id
      ORDER BY e.start_date ASC, r.schedule_start IS NULL, r.schedule_start ASC`,
    );
    return mapEventRows(rows);
  }

  async findEventById(eventId: string): Promise<PublicEventView | undefined> {
    const rows = await this.db.all<EventRow[]>(
      `SELECT
        e.id AS event_id,
        e.name,
        e.start_date,
        e.end_date,
        e.venue,
        e.allow_multiple_races_per_day,
        e.allow_schedule_overlap,
        e.created_at AS event_created_at,
        e.updated_at AS event_updated_at,
        r.id AS race_id,
        r.name AS race_name,
        r.schedule_start,
        r.schedule_end,
        r.duplicate_day,
        r.overlaps_existing,
        r.startlist_id AS race_startlist_id,
        r.created_at AS race_created_at,
        r.updated_at AS race_updated_at,
        s.id AS startlist_id,
        s.status AS startlist_status,
        s.snapshot AS startlist_snapshot,
        s.confirmed_at AS startlist_confirmed_at,
        s.created_at AS startlist_created_at,
        s.updated_at AS startlist_updated_at
      FROM public_events e
      LEFT JOIN public_races r ON r.event_id = e.id
      LEFT JOIN public_startlists s ON s.id = r.startlist_id
      WHERE e.id = ?
      ORDER BY r.schedule_start IS NULL, r.schedule_start ASC`,
      [eventId],
    );
    const events = mapEventRows(rows);
    return events[0];
  }

  async findStartlistByRace(
    eventId: string,
    raceId: string,
  ): Promise<PublicStartlistDetails | undefined> {
    const startlist = await this.db.get<StartlistRow>(
      `SELECT * FROM public_startlists WHERE event_id = ? AND race_id = ?`,
      [eventId, raceId],
    );

    if (!startlist) {
      return undefined;
    }

    const historyRows = await this.db.all<VersionRow[]>(
      `SELECT startlist_id, version, snapshot, confirmed_at, created_at
       FROM public_startlist_versions
       WHERE startlist_id = ?
       ORDER BY version ASC`,
      [startlist.id],
    );

    return {
      startlist: mapStartlistRow(startlist),
      history: historyRows.map(mapVersionRow),
    };
  }
}

async function applyMigrations(db: Database, migrationsDir: string): Promise<void> {
  const exists = await fs
    .stat(migrationsDir)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    return;
  }

  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((file) => file.endsWith('.sql')).sort();
  for (const file of sqlFiles) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    await db.exec(sql);
  }
}

function mapEventRows(rows: EventRow[]): PublicEventView[] {
  const events = new Map<string, PublicEventView>();
  for (const row of rows) {
    const existing = events.get(row.event_id);
    const event: PublicEventView = existing ?? {
      id: row.event_id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      venue: row.venue,
      allowMultipleRacesPerDay: Boolean(row.allow_multiple_races_per_day),
      allowScheduleOverlap: Boolean(row.allow_schedule_overlap),
      createdAt: row.event_created_at,
      updatedAt: row.event_updated_at,
      races: [],
    };

    if (!existing) {
      events.set(row.event_id, event);
    }

    if (row.race_id) {
      const race: PublicRaceView = {
        id: row.race_id,
        eventId: row.event_id,
        name: row.race_name ?? '',
        schedule: {
          start: row.schedule_start ?? '',
          ...(row.schedule_end ? { end: row.schedule_end } : {}),
        },
        duplicateDay: Boolean(row.duplicate_day),
        overlapsExisting: Boolean(row.overlaps_existing),
        startlistId: row.race_startlist_id ?? undefined,
        createdAt: row.race_created_at ?? row.event_created_at,
        updatedAt: row.race_updated_at ?? row.event_updated_at,
      };

      if (row.startlist_id) {
        race.startlist = {
          id: row.startlist_id,
          eventId: row.event_id,
          raceId: row.race_id,
          status: row.startlist_status ?? '',
          snapshot: JSON.parse(row.startlist_snapshot ?? '{}'),
          confirmedAt: row.startlist_confirmed_at ?? undefined,
          createdAt: row.startlist_created_at ?? row.event_created_at,
          updatedAt: row.startlist_updated_at ?? row.event_updated_at,
        };
      }

      event.races.push(race);
    }
  }

  return Array.from(events.values());
}

function mapStartlistRow(row: StartlistRow): PublicStartlistRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    raceId: row.race_id,
    status: row.status,
    snapshot: JSON.parse(row.snapshot),
    confirmedAt: row.confirmed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersionRow(row: VersionRow): PublicStartlistVersionRecord {
  return {
    version: row.version,
    startlistId: row.startlist_id,
    snapshot: JSON.parse(row.snapshot),
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}
