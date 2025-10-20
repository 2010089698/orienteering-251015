import type {
  AttachStartlistCommand,
  AttachStartlistService,
  CreateEventCommand,
  CreateEventService,
  EventDto,
  EventQueryService,
  ScheduleRaceCommand,
  ScheduleRaceService,
} from '@event-management/application';

export interface HttpResponse<T = unknown> {
  status: number;
  body: T;
}

export interface EventHttpControllerDependencies {
  createEventService: CreateEventService;
  scheduleRaceService: ScheduleRaceService;
  attachStartlistService: AttachStartlistService;
  eventQueryService: EventQueryService;
}

export interface CreateEventRequest {
  body: CreateEventCommand;
}

export interface ScheduleRaceRequest {
  body: ScheduleRaceCommand;
}

export interface AttachStartlistRequest {
  body: AttachStartlistCommand;
}

export interface GetEventRequest {
  params: { id: string };
}

export type ListEventsRequest = Record<string, never>;

export class EventHttpController {
  constructor(private readonly deps: EventHttpControllerDependencies) {}

  async createEvent(request: CreateEventRequest): Promise<HttpResponse<{ event: EventDto }>> {
    const event = await this.deps.createEventService.execute(request.body);
    return { status: 201, body: { event } };
  }

  async scheduleRace(request: ScheduleRaceRequest): Promise<HttpResponse<{ event: EventDto }>> {
    const event = await this.deps.scheduleRaceService.execute(request.body);
    return { status: 200, body: { event } };
  }

  async attachStartlist(request: AttachStartlistRequest): Promise<HttpResponse<{ event: EventDto }>> {
    const event = await this.deps.attachStartlistService.execute(request.body);
    return { status: 200, body: { event } };
  }

  async getEvent(request: GetEventRequest): Promise<HttpResponse<{ event: EventDto } | { message: string }>> {
    const event = await this.deps.eventQueryService.getById(request.params.id);
    if (!event) {
      return { status: 404, body: { message: 'Event not found' } };
    }
    return { status: 200, body: { event } };
  }

  async listEvents(_request: ListEventsRequest): Promise<HttpResponse<{ events: EventDto[] }>> {
    const events = await this.deps.eventQueryService.listAll();
    return { status: 200, body: { events } };
  }
}

export function createEventHttpController(deps: EventHttpControllerDependencies): EventHttpController {
  return new EventHttpController(deps);
}
