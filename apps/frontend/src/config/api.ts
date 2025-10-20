const DEFAULT_ENDPOINTS = {
  startlist: '/api/startlists',
  entryManagement: '/api/entries',
  japanRanking: '/api/japan-ranking',
} as const;

export type ApiEndpointKey = keyof typeof DEFAULT_ENDPOINTS;

type ImportMetaEnvWithAny = ImportMetaEnv & Record<string, string | undefined>;

const toEnvKey = (key: ApiEndpointKey): string => {
  return `VITE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}_API_BASE_URL`;
};

const readEnvEndpoint = (key: ApiEndpointKey): string | undefined => {
  const env = import.meta.env as ImportMetaEnvWithAny;
  const envKey = toEnvKey(key);
  const value = env[envKey];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().replace(/\/$/, '');
  }
  return undefined;
};

export const resolveApiEndpoint = (key: ApiEndpointKey): string => {
  return readEnvEndpoint(key) ?? DEFAULT_ENDPOINTS[key];
};
