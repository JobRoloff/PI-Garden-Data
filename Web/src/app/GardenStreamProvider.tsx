import React, { createContext, useContext, type ReactNode } from 'react';
import { useGardenStream, type GardenStreamState } from './hooks/useGardenStream';

type GardenStreamContextValue = GardenStreamState & {
  connect: () => void;
  disconnect: () => void;
};

const GardenStreamContext = createContext<GardenStreamContextValue | null>(null);

export function GardenStreamProvider({ children }: { children: ReactNode }) {
  const stream = useGardenStream();
  return (
    <GardenStreamContext.Provider value={stream}>
      {children}
    </GardenStreamContext.Provider>
  );
}

export function useGardenStreamContext(): GardenStreamContextValue {
  const ctx = useContext(GardenStreamContext);
  if (!ctx) throw new Error('useGardenStreamContext must be used within GardenStreamProvider');
  return ctx;
}
