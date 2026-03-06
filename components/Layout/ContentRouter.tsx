import React, { Suspense, lazy, useState, useEffect } from 'react';
import { MenuId } from '../../types';
import { ModuleLoader } from '../UI/ModuleLoader';
import { ErrorBoundary } from '../UI/ErrorBoundary';
import { KEEP_ALIVE_MENUS } from '../../utils';

// --- Code Splitting (Lazy Loading) ---
const Overview = lazy(() => import('../Dashboard/Overview').then(m => ({ default: m.Overview })));

// Updated paths to standardized folder structure
const InventoryManager = lazy(() => import('../Modules/Inventory/InventoryManager').then(m => ({ default: m.InventoryManager })));
const MaterialManager = lazy(() => import('../Modules/Material/MaterialManager').then(m => ({ default: m.MaterialManager })));
const ReferenceManager = lazy(() => import('../Modules/Reference/ReferenceManager').then(m => ({ default: m.ReferenceManager })));
const PaperCalculationManager = lazy(() => import('../Modules/PaperCalculation/PaperCalculationManager').then(m => ({ default: m.PaperCalculationManager })));
const ExpectedSchedule = lazy(() => import('../Modules/Schedule/ExpectedSchedule').then(m => ({ default: m.ExpectedSchedule })));

// Optimization: Define route map statically outside component
// This prevents object recreation on every render and keeps the component pure
const ROUTE_COMPONENTS: Partial<Record<MenuId, React.LazyExoticComponent<React.FC>>> = {
  OVERVIEW: Overview,
  INVENTORY: InventoryManager,
  REFERENCE: ReferenceManager,
  PAPER_CALCULATION: PaperCalculationManager,
  EXPECTED_SCHEDULE: ExpectedSchedule,
  
  // Configured Material Inventory
  MATERIAL_INVENTORY: MaterialManager, 
};

interface ContentRouterProps {
  currentMenu: MenuId;
}

export const ContentRouter: React.FC<ContentRouterProps> = React.memo(({ currentMenu }) => {
  const Component = ROUTE_COMPONENTS[currentMenu];
  
  // Track which menus have been visited to lazy load them
  const [visitedMenus, setVisitedMenus] = useState<Set<MenuId>>(new Set([currentMenu]));

  useEffect(() => {
    setVisitedMenus(prev => {
      if (prev.has(currentMenu)) return prev;
      const next = new Set(prev);
      next.add(currentMenu);
      return next;
    });
  }, [currentMenu]);

  return (
    <>
      {/* Persistent Views (PowerBI Dashboards) - Mounted on first visit, hidden when inactive */}
      {(visitedMenus.has('OVERVIEW') || currentMenu === 'OVERVIEW') && (
        <div className={currentMenu === 'OVERVIEW' ? 'h-full' : 'hidden'}>
          <Suspense fallback={<ModuleLoader />}>
            <Overview />
          </Suspense>
        </div>
      )}

      {/* Standard Views - Mounted only when active */}
      {!KEEP_ALIVE_MENUS.includes(currentMenu) && (
        <Suspense fallback={<ModuleLoader />}>
          <ErrorBoundary resetKey={currentMenu}>
            {Component ? <Component /> : null}
          </ErrorBoundary>
        </Suspense>
      )}
    </>
  );
});