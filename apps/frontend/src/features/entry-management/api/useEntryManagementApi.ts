import { useMemo } from 'react';
import { resolveApiEndpoint } from '../../../config/api';

type EntrySummary = {
  id: string;
  name: string;
  club?: string;
};

type EntryManagementApi = {
  fetchEntries: () => Promise<EntrySummary[]>;
};

export const useEntryManagementApi = (): EntryManagementApi => {
  const basePath = resolveApiEndpoint('entryManagement');

  return useMemo(() => {
    return {
      async fetchEntries() {
        console.warn('Entry management API is mocked. Update integration when backend is ready.');
        const response = await fetch(`${basePath}/overview`);
        if (!response.ok) {
          return [];
        }
        return (await response.json()) as EntrySummary[];
      },
    } satisfies EntryManagementApi;
  }, [basePath]);
};
