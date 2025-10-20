import type { BusinessCapabilityModule, NavigationItem } from './types';
import { startlistModule } from '../features/startlist';
import { entryManagementModule } from '../features/entry-management';
import { eventManagementModule } from '../features/event-management';

const registry = new Map<string, BusinessCapabilityModule>();

export const registerBusinessCapability = (module: BusinessCapabilityModule): void => {
  if (registry.has(module.id)) {
    throw new Error(`Business capability with id "${module.id}" is already registered.`);
  }
  registry.set(module.id, module);
};

export const getBusinessCapabilities = (): BusinessCapabilityModule[] => {
  return Array.from(registry.values());
};

export const getBusinessCapability = (id: string): BusinessCapabilityModule | undefined => {
  return registry.get(id);
};

export const getCapabilityHooks = (id: string) => {
  return registry.get(id)?.hooks;
};

export const getNavigationItems = (): NavigationItem[] => {
  return getBusinessCapabilities().map((module) => ({
    id: module.id,
    label: module.navigationLabel,
    path: module.routePath,
  }));
};

[startlistModule, eventManagementModule, entryManagementModule].forEach(registerBusinessCapability);
