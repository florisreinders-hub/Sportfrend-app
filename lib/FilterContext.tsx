import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DiscoverFilters = {
  /** Fixed lower bound of 18 in the UI; this is the adjustable upper bound. */
  maxAge: number;
  distanceKm: number;
  /** null = no sport filter ("Alle sporten"). */
  sport: string | null;
  /** null = no level filter ("Alle niveaus"). */
  level: string | null;
};

export const DEFAULT_FILTERS: DiscoverFilters = {
  maxAge: 90,
  distanceKm: 150,
  sport: null,
  level: null,
};

const STORAGE_KEY = "sportfrend.discoverFilters";

type FilterContextValue = {
  filters: DiscoverFilters;
  setFilters: (filters: DiscoverFilters) => void;
  resetFilters: () => void;
};

const FilterContext = createContext<FilterContextValue>({
  filters: DEFAULT_FILTERS,
  setFilters: () => {},
  resetFilters: () => {},
});

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<DiscoverFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        setFiltersState({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
      } catch {
        // ignore malformed cached filters, keep defaults
      }
    });
  }, []);

  const setFilters = (next: DiscoverFilters) => {
    setFiltersState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <FilterContext.Provider value={{ filters, setFilters, resetFilters }}>{children}</FilterContext.Provider>
  );
}

export function useDiscoverFilters() {
  return useContext(FilterContext);
}
