import { useState, type ReactElement } from "react";
import { AccessibleSheetTabs } from "./AccessibleSheetTabs";
import { ActionDeck } from "./ActionDeck";
import { CharacterHeroBar } from "./CharacterHeroBar";
import { ConditionTray } from "./ConditionTray";
import { QuickRollDock } from "./QuickRollDock";
import { StatCluster } from "./StatCluster";
import type { CharacterSheetViewModel, SheetTabDefinition } from "./types";

const TABS: readonly SheetTabDefinition[] = [
  { id: "overview", label: "Overview" },
  { id: "actions", label: "Actions" },
  { id: "conditions", label: "Conditions" },
  { id: "equipment", label: "Equipment" },
  { id: "proficiencies", label: "Proficiencies" },
  { id: "notes", label: "Notes" }
];

export function CharacterSheetStudyDemo({ model }: { model: CharacterSheetViewModel }): ReactElement {
  const [activeTab, setActiveTab] = useState("overview");
  const tabs = TABS.map((tab) => tab.id === "conditions" ? { ...tab, badge: model.conditions.length } : tab);

  return (
    <div className="cs-theme cs-theme--command cs-sheet">
      <CharacterHeroBar {...model.hero} />
      <AccessibleSheetTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} idPrefix="study-sheet" />

      <main className="cs-sheet__content">
        {activeTab === "overview" ? (
          <section role="tabpanel" id="study-sheet-panel-overview" aria-labelledby="study-sheet-tab-overview" tabIndex={0}>
            {model.conditions.length ? <ConditionTray conditions={model.conditions.slice(0, 2)} /> : null}
            <section className="cs-section" aria-labelledby="cs-stat-title">
              <div className="cs-section__heading">
                <div><p className="cs-eyebrow">Core profile</p><h2 id="cs-stat-title">Stats and substats</h2></div>
              </div>
              <div className="cs-stat-grid">{model.stats.map((group) => <StatCluster key={group.id} group={group} />)}</div>
            </section>
          </section>
        ) : null}

        {activeTab === "actions" ? (
          <div role="tabpanel" id="study-sheet-panel-actions" aria-labelledby="study-sheet-tab-actions" tabIndex={0}>
            <ActionDeck actions={model.actions} />
          </div>
        ) : null}

        {activeTab === "conditions" ? (
          <div role="tabpanel" id="study-sheet-panel-conditions" aria-labelledby="study-sheet-tab-conditions" tabIndex={0}>
            <ConditionTray conditions={model.conditions} />
          </div>
        ) : null}

        {!["overview", "actions", "conditions"].includes(activeTab) ? (
          <section className="cs-section" role="tabpanel" id={`study-sheet-panel-${activeTab}`} aria-labelledby={`study-sheet-tab-${activeTab}`} tabIndex={0}>
            <p className="cs-empty">This destination is intentionally left as an integration slot for the repo’s existing {activeTab} section.</p>
          </section>
        ) : null}
      </main>

      <QuickRollDock items={model.quickRolls ?? []} />
    </div>
  );
}
