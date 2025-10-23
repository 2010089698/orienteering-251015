import type { BusinessCapabilityModule } from '../../contexts/types';
import { StartlistProvider } from './state/StartlistContext';
import { EventManagementProvider } from '../event-management';
import { useStartlistApi } from './api/useStartlistApi';
import StartlistWorkflowPage from './pages/StartlistWorkflowPage';

export const startlistModule: BusinessCapabilityModule = {
  id: 'startlist',
  title: 'Startlist Management',
  routePath: '/startlist',
  component: StartlistWorkflowPage,
  providers: [EventManagementProvider, StartlistProvider],
  navigationLabel: 'スタートリスト',
  hooks: {
    useApi: useStartlistApi,
  },
};
