import { StartlistSyncError, StartlistSyncPort } from '@event-management/application';
import { EventId, RaceId, RaceSchedule } from '@event-management/domain';

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

  async notifyRaceScheduled(payload: {
    eventId: EventId;
    raceId: RaceId;
    schedule: RaceSchedule;
    updatedAt: Date;
  }): Promise<void> {
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

    if (!response.ok) {
      const message = await safeReadBody(response);
      throw new StartlistSyncError(
        `Failed to sync startlist: ${response.status} ${message}`.trim(),
      );
    }
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
