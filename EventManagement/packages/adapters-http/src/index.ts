import type {
  RegisterEventUseCase,
  ListEventsQuery,
  GetEventQuery
} from '@event-management/application';
import type { EventDefinition } from '@event-management/domain';

export interface HttpResponse<T = unknown> {
  status: number;
  body: T;
}

export interface EventHttpControllerDependencies {
  registerEventUseCase: RegisterEventUseCase;
  listEventsQuery: ListEventsQuery;
  getEventQuery: GetEventQuery;
}

export interface RegisterEventRequest {
  body: EventDefinition;
}

export interface GetEventRequest {
  params: { id: string };
}

export type ListEventsRequest = Record<string, never>;

export class EventHttpController {
  constructor(private readonly deps: EventHttpControllerDependencies) {}

  async registerEvent(request: RegisterEventRequest): Promise<HttpResponse<{ event: EventDefinition }>> {
    const event = await this.deps.registerEventUseCase.execute(request.body);
    return { status: 201, body: { event } };
  }

  async getEvent(request: GetEventRequest): Promise<HttpResponse<{ event: EventDefinition } | { message: string }>> {
    const event = await this.deps.getEventQuery.execute(request.params.id);
    if (!event) {
      return { status: 404, body: { message: 'Event not found' } };
    }

    return { status: 200, body: { event } };
  }

  async listEvents(_request: ListEventsRequest): Promise<HttpResponse<{ events: readonly EventDefinition[] }>> {
    const events = await this.deps.listEventsQuery.execute();
    return { status: 200, body: { events } };
  }
}

export function createEventHttpController(deps: EventHttpControllerDependencies): EventHttpController {
  return new EventHttpController(deps);
}
