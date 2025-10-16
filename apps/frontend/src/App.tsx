import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { getBusinessCapabilities, getNavigationItems } from './contexts/registry';
import type { BusinessCapabilityModule, CapabilityProvider } from './contexts/types';
import './styles.css';

const capabilityModules = getBusinessCapabilities();
const navigationItems = getNavigationItems();
const defaultCapabilityPath = capabilityModules[0]?.routePath ?? '/';

const applyProviders = (providers: CapabilityProvider[] | undefined, node: ReactNode): ReactNode => {
  return (providers ?? []).reduceRight((children, Provider) => {
    return <Provider>{children}</Provider>;
  }, node);
};

const ModuleRoute = ({ module }: { module: BusinessCapabilityModule }) => {
  const Component = module.component;
  return <>{applyProviders(module.providers, <Component />)}</>;
};

const App = (): JSX.Element => {
  if (!capabilityModules.length) {
    return <div>Business capabilities are not registered.</div>;
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <aside className="app-nav">
          <div className="app-nav__brand">Orienteering Suite</div>
          <nav aria-label="Business capabilities" className="app-nav__list">
            {navigationItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => (isActive ? 'app-nav__link is-active' : 'app-nav__link')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="app-main">
          <Routes>
            <Route index element={<Navigate to={defaultCapabilityPath} replace />} />
            {capabilityModules.map((module) => (
              <Route key={module.id} path={`${module.routePath}/*`} element={<ModuleRoute module={module} />} />
            ))}
            <Route path="*" element={<Navigate to={defaultCapabilityPath} replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
