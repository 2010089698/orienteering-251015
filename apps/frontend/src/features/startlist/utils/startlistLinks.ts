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

export const buildStartlistPublicUrl = (
  startlistId: string,
  version: number,
): string | undefined => {
  if (!startlistId || typeof version !== 'number' || Number.isNaN(version)) {
    return undefined;
  }
  const baseUrl = readPublicBaseUrl();
  if (!baseUrl) {
    return undefined;
  }
  return `${baseUrl}${buildStartlistSpectatorPath(startlistId, version)}`;
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
    if (!snapshot.id) {
      return undefined;
    }

    return buildStartlistPublicUrl(snapshot.id, latestVersion.version);
  }, [snapshot, latestVersion]);
};
