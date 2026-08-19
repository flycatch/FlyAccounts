import { useEntityContext, ALL_ENTITIES_ID } from "../entity/EntityContext";
import "./EntitySwitcher.css";

export function EntitySwitcher() {
  const { entities, selectedEntityId, setSelectedEntityId, loading } = useEntityContext();

  return (
    <label className="entity-switcher">
      <span className="entity-switcher-label">Entity</span>
      <select
        className="entity-switcher-select"
        value={selectedEntityId}
        disabled={loading}
        onChange={(event) => setSelectedEntityId(event.target.value)}
        aria-label="Active legal entity"
      >
        <option value={ALL_ENTITIES_ID}>All Entities</option>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.name}
          </option>
        ))}
      </select>
    </label>
  );
}
