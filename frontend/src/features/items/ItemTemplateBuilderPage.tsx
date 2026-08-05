import type { GameClient } from "@/hooks/useGameClient";
import { ItemMakerPage } from "@/features/items/ItemMakerPage";

export function ItemTemplateBuilderPage({ client }: { client: GameClient }): JSX.Element {
  return <ItemMakerPage client={client} templateManagement />;
}
