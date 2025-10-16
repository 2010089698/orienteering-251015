import type { BusinessCapabilityModule } from '../../contexts/types';
import EntryManagementPlaceholder from './pages/EntryManagementPlaceholder';
import { useEntryManagementApi } from './api/useEntryManagementApi';

export const entryManagementModule: BusinessCapabilityModule = {
  id: 'entry-management',
  title: 'Entry Management',
  routePath: '/entry-management',
  component: EntryManagementPlaceholder,
  navigationLabel: 'エントリー管理',
  hooks: {
    useApi: useEntryManagementApi,
  },
};
