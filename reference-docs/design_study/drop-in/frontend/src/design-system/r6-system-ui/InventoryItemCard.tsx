import type { ReactElement } from "react";
import type { R6InventoryItem } from "./types";

export interface InventoryItemCardProps {
  item: R6InventoryItem;
  onEquip?: () => void;
  onUse?: () => void;
  onInspect?: () => void;
}

export function InventoryItemCard({ item, onEquip, onUse, onInspect }: InventoryItemCardProps): ReactElement {
  const rarity = item.rarity ?? "common";
  return (
    <article className={`r6-item-card r6-item-card--${rarity}${item.depleted ? " r6-item-card--depleted" : ""}`}>
      <div className="r6-item-card__heading">
        <div>
          <p className="r6-kicker">{item.category} · {rarity}</p>
          <h3>{item.name}</h3>
        </div>
        <span className="r6-item-card__quantity" aria-label={`Quantity ${item.quantity}`}>×{item.quantity}</span>
      </div>
      {item.equipped ? <span className="r6-chip r6-chip--success">Equipped</span> : null}
      {item.description ? <p className="r6-item-card__description">{item.description}</p> : null}
      {item.tags?.length ? (
        <div className="r6-chip-row">
          {item.tags.map((tag) => <span className="r6-chip r6-chip--neutral" key={tag}>{tag}</span>)}
        </div>
      ) : null}
      <div className="r6-item-card__actions">
        {onInspect ? <button type="button" className="r6-button r6-button--ghost" onClick={onInspect}>Inspect</button> : null}
        {onEquip ? <button type="button" className="r6-button r6-button--secondary" onClick={onEquip}>{item.equipped ? "Unequip" : "Equip"}</button> : null}
        {onUse ? <button type="button" className="r6-button r6-button--primary" onClick={onUse} disabled={item.depleted || item.quantity <= 0}>Use</button> : null}
      </div>
    </article>
  );
}
