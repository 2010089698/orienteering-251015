import type { BusinessCapabilityModule } from '../../contexts/types';
import EventManagementLayout from './EventManagementLayout';
import { EventManagementProvider } from './state';
import { useEventManagementApi } from './api/useEventManagementApi';

export const eventManagementModule: BusinessCapabilityModule = {
  id: 'event-management',
  title: 'Event Management',
  routePath: '/events',
  navigationLabel: 'イベント管理',
  component: EventManagementLayout,
  providers: [EventManagementProvider],
  hooks: {
    useApi: useEventManagementApi,
  },
};

export { EventManagementProvider } from './state';
