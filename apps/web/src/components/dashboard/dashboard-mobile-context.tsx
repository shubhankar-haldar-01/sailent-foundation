'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

interface DashboardMobileContextValue {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const DashboardMobileContext = React.createContext<DashboardMobileContextValue | null>(null);

export function DashboardMobileProvider({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  React.useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (isDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isDrawerOpen]);

  const openDrawer = React.useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = React.useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = React.useCallback(() => setIsDrawerOpen((prev) => !prev), []);

  return (
    <DashboardMobileContext.Provider
      value={{
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
      }}
    >
      {children}
    </DashboardMobileContext.Provider>
  );
}

export function useDashboardMobile() {
  const ctx = React.useContext(DashboardMobileContext);
  if (!ctx) {
    throw new Error('useDashboardMobile must be used within DashboardMobileProvider');
  }
  return ctx;
}
