import {
  StartlistCreationResult,
  StartlistSyncError,
  type StartlistSyncPayload,
  StartlistSyncPort,
} from '@event-management/application';
import { RaceSchedule } from '@event-management/domain';

export interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
  }>;
}

export interface HttpStartlistSyncPortOptions {
  baseUrl: string;
  endpoint?: string;
  fetchImpl?: FetchLike;
}

interface RaceScheduledPayload {
  eventId: string;
  raceId: string;
  schedule: {
    start: string;
    end?: string;
  };
  updatedAt: string;
}

export class HttpStartlistSyncPort implements StartlistSyncPort {
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: HttpStartlistSyncPortOptions) {
    this.endpoint = options.endpoint ?? '/api/startlists';
    this.fetchImpl = options.fetchImpl ?? getGlobalFetch();
  }

  async notifyRaceScheduled(payload: StartlistSyncPayload): Promise<void> {
    await this.sendRequest(payload);
  }

  async createStartlist(payload: StartlistSyncPayload): Promise<StartlistCreationResult> {
    const response = await this.sendRequest(payload);
    let parsed: unknown;
    if (!response.body) {
      throw new StartlistSyncError('Startlist creation response was empty.');
    }
    try {
      parsed = JSON.parse(response.body);
    } catch (error) {
      throw new StartlistSyncError('Failed to parse startlist creation response.', error);
    }

    const startlistId = extractString(parsed, ['id', 'startlistId']);
    const status = extractString(parsed, ['status']);

    if (!startlistId) {
      throw new StartlistSyncError('Startlist creation response did not include an identifier.');
    }

    if (!status) {
      throw new StartlistSyncError('Startlist creation response did not include a status.');
    }

    return { startlistId, status };
  }

  private async sendRequest(payload: StartlistSyncPayload): Promise<{ body: string }> {
    const body: RaceScheduledPayload = {
      eventId: payload.eventId.toString(),
      raceId: payload.raceId.toString(),
      schedule: serializeSchedule(payload.schedule),
      updatedAt: payload.updatedAt.toISOString(),
    };

    let response;
    try {
      response = await this.fetchImpl(new URL(this.endpoint, this.options.baseUrl).toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new StartlistSyncError('Failed to sync startlist.', error);
    }

    const responseBody = await safeReadBody(response);

    if (!response.ok) {
      throw new StartlistSyncError(
        `Failed to sync startlist: ${response.status} ${responseBody}`.trim(),
      );
    }

    return { body: responseBody };
  }
}

function serializeSchedule(schedule: RaceSchedule): { start: string; end?: string } {
  const start = schedule.getStart().toISOString();
  const endDate = schedule.getEnd();
  return { start, end: endDate ? endDate.toISOString() : undefined };
}

function getGlobalFetch(): FetchLike {
  const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
  if (!globalFetch) {
    throw new Error('fetch implementation was not provided and global fetch is unavailable.');
  }
  return globalFetch.bind(globalThis);
}

async function safeReadBody(response: { text(): Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function extractString(source: unknown, keys: string[]): string | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }

  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return undefined;
}
