import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { components } from "../api/schema";
import { apiClient } from "../api/client";
import { ALL_ENTITIES_ID, setActiveEntityHeader } from "./entityHeader";

export type LegalEntity = components["schemas"]["LegalEntity"];
export { ALL_ENTITIES_ID };

const STORAGE_KEY = "flyaccounts.entityId";

type EntityContextValue = {
  entities: LegalEntity[];
  selectedEntityId: string;
  selectedEntity: LegalEntity | null;
  isAllEntities: boolean;
  loading: boolean;
  setSelectedEntityId: (id: string) => void;
  entityHeaderValue: string;
};

const EntityContext = createContext<EntityContextValue | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [selectedEntityId, setSelectedEntityIdState] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY) || ALL_ENTITIES_ID;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, response } = await apiClient.GET("/entities");
      if (cancelled) {
        return;
      }
      if (response.ok && data?.entities) {
        setEntities(data.entities);
        const stillValid =
          selectedEntityId === ALL_ENTITIES_ID ||
          data.entities.some((entity) => entity.id === selectedEntityId);
        if (!stillValid) {
          setSelectedEntityIdState(ALL_ENTITIES_ID);
          sessionStorage.setItem(STORAGE_KEY, ALL_ENTITIES_ID);
        }
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const setSelectedEntityId = useCallback((id: string) => {
    setSelectedEntityIdState(id);
    sessionStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.id === selectedEntityId) ?? null,
    [entities, selectedEntityId],
  );

  const isAllEntities = selectedEntityId === ALL_ENTITIES_ID;
  const entityHeaderValue = isAllEntities ? ALL_ENTITIES_ID : selectedEntityId;
  setActiveEntityHeader(entityHeaderValue);

  const value = useMemo(
    () => ({
      entities,
      selectedEntityId,
      selectedEntity,
      isAllEntities,
      loading,
      setSelectedEntityId,
      entityHeaderValue,
    }),
    [
      entities,
      selectedEntityId,
      selectedEntity,
      isAllEntities,
      loading,
      setSelectedEntityId,
      entityHeaderValue,
    ],
  );

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntityContext(): EntityContextValue {
  const value = useContext(EntityContext);
  if (!value) {
    throw new Error("useEntityContext must be used within EntityProvider");
  }
  return value;
}
