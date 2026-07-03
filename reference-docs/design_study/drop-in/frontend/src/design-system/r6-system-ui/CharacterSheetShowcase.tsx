import { useMemo, useState, type ReactElement } from "react";
import { ActionCard } from "./ActionCard";
import { ConditionChip } from "./ConditionChip";
import { InventoryItemCard } from "./InventoryItemCard";
import { ProficiencyRow } from "./ProficiencyRow";
import { ResourceMeter } from "./ResourceMeter";
import { SheetTabs } from "./SheetTabs";
import { StatGrid } from "./StatGrid";
import { StatusHeader } from "./StatusHeader";
import { SyncStatus } from "./SyncStatus";
import { SystemModal } from "./SystemModal";
import { SystemPanel } from "./SystemPanel";
import { demoActions, demoItems, demoStats, demoTabs } from "./demoData";

export function CharacterSheetShowcase(): ReactElement {
  const [activeTab, setActiveTab] = useState("status");
  const [hp, setHp] = useState(2220);
  const [mana, setMana] = useState(315);
  const [modalOpen, setModalOpen] = useState(false);
  const [feedback, setFeedback] = useState("Interface ready.");

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const roll = (label: string, stat = 100): void => {
    const die = Math.floor(Math.random() * 100) + 1;
    const result = Math.floor((die / 100) * stat);
    setFeedback(`${label}: d100 ${die} → ${numberFormatter.format(result)}`);
  };

  return (
    <main className="r6-theme r6-showcase">
      <SystemPanel
        title="Character Status"
        eyebrow="R6 System Interface"
        actions={<SyncStatus status="synced" version={128} />}
        variant="raised"
      >
        <StatusHeader
          name="Kael Ardent"
          title="Unregistered Rift Walker"
          subtitle="Human · Vanguard"
          rank="C"
          level={18}
          badges={["Frontline", "Awakened"]}
          trailing={<button className="r6-button r6-button--secondary" onClick={() => setModalOpen(true)}>System Notice</button>}
        />

        <div className="r6-resource-grid">
          <ResourceMeter label="Health" current={hp} max={2400} tone="health" glyph="✚" step={25} onAdjust={(delta) => setHp((value) => Math.min(2400, Math.max(0, value + delta)))} />
          <ResourceMeter label="Mana" current={mana} max={420} tone="mana" glyph="✦" step={10} onAdjust={(delta) => setMana((value) => Math.min(420, Math.max(0, value + delta)))} />
          <ResourceMeter label="Actions" current={7} max={9} tone="action" glyph="⬡" compact />
        </div>

        <SheetTabs tabs={demoTabs} activeId={activeTab} onChange={setActiveTab} />

        <div className="r6-tab-panel" role="tabpanel" id={`r6-panel-${activeTab}`} aria-labelledby={`r6-tab-${activeTab}`} tabIndex={0}>
          {activeTab === "status" ? <StatGrid stats={demoStats} onRoll={(stat) => roll(stat.label, Number(stat.value))} /> : null}
          {activeTab === "actions" ? <div className="r6-card-grid">{demoActions.map((action) => <ActionCard action={action} key={action.id} onRoll={(mode) => roll(`${action.name} (${mode})`, action.governingStat === "Arcane" ? 112 : 148)} />)}</div> : null}
          {activeTab === "equipment" ? <div className="r6-card-grid">{demoItems.map((item) => <InventoryItemCard item={item} key={item.id} onInspect={() => setFeedback(`Inspecting ${item.name}`)} onEquip={() => setFeedback(`${item.equipped ? "Unequipped" : "Equipped"} ${item.name}`)} onUse={item.category === "Consumable" ? () => setMana((value) => Math.min(420, value + 80)) : undefined} />)}</div> : null}
          {activeTab === "proficiencies" ? <div className="r6-stack"><ProficiencyRow name="Longsword" category="Weapon" rank={4} progress={68} bonus="+1.40×" note="Specialization: counter-parry" /><ProficiencyRow name="Arc Burst" category="Ability" rank={2} progress={31} bonus="+1.15×" /></div> : null}
          {activeTab === "conditions" ? <div className="r6-condition-board"><ConditionChip label="Fatigued" meta="−1 action" tone="warning" /><ConditionChip label="Mana Burn" meta="2 rounds" tone="arcane" /><p className="r6-muted">Condition details should show source, mechanical effect, and expiration in an adjacent detail card.</p></div> : null}
        </div>
      </SystemPanel>

      <div className="r6-toast" role="status" aria-live="polite">{feedback}</div>

      <SystemModal
        open={modalOpen}
        title="A mission has arrived"
        onClose={() => setModalOpen(false)}
        actions={<><button className="r6-button r6-button--ghost" onClick={() => setModalOpen(false)}>Dismiss</button><button className="r6-button r6-button--primary" onClick={() => { setModalOpen(false); setFeedback("Mission accepted: Stabilize the North Gate"); }}>Accept Mission</button></>}
      >
        <p><strong>Stabilize the North Gate</strong></p>
        <p>Difficulty C · Expires after the next long rest · Reward: 240 XP and one skill card.</p>
      </SystemModal>
    </main>
  );
}
