import "./PillList.css";

type PillListProps = {
  items: string[];
  max?: number;
};

export function PillList({ items, max = 3 }: PillListProps) {
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="pill-list">
      {visible.map((item) => (
        <li key={item} className="pill-list-item" title={item}>
          {item}
        </li>
      ))}
      {overflow > 0 ? <li className="pill-list-more">+{overflow}</li> : null}
    </ul>
  );
}
