import type { ComponentType, PropsWithChildren } from 'react';

export type CapabilityProvider = ComponentType<PropsWithChildren>;

export interface CapabilityHooks {
  useApi?: () => unknown;
}

export interface BusinessCapabilityModule {
  id: string;
  title: string;
  routePath: string;
  component: ComponentType;
  providers?: CapabilityProvider[];
  navigationLabel: string;
  hooks?: CapabilityHooks;
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
}
