import { useMemo } from 'react';

import { useStartlistLatestVersion, useStartlistSnapshot } from '../state/StartlistContext';

type ImportMetaEnvWithRecord = ImportMetaEnv & Record<string, string | undefined>;

const readPublicBaseUrl = (): string | undefined => {
  const env = import.meta.env as ImportMetaEnvWithRecord;
  const rawValue = env.VITE_STARTLIST_PUBLIC_BASE_URL;
  if (typeof rawValue !== 'string') {
    return undefined;
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, '');
};

const buildStartlistSpectatorPath = (startlistId: string, version: number): string => {
  const encodedId = encodeURIComponent(startlistId);
  return `/startlists/${encodedId}/v/${version}`;
};

export const useFinalizedStartlistLink = (): string | undefined => {
  const snapshot = useStartlistSnapshot();
  const latestVersion = useStartlistLatestVersion();

  return useMemo(() => {
    if (!snapshot || snapshot.status !== 'FINALIZED') {
      return undefined;
    }
    if (!latestVersion) {
      return undefined;
    }
    const baseUrl = readPublicBaseUrl();
    if (!baseUrl) {
      return undefined;
    }

    if (!snapshot.id) {
      return undefined;
    }

    return `${baseUrl}${buildStartlistSpectatorPath(snapshot.id, latestVersion.version)}`;
  }, [snapshot, latestVersion]);
};
