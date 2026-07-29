// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { ItemPlayerCatalogAccess } from "@/domain/models";
import { ItemPlayerAvailabilityEditor } from "@/features/items/components/ItemPlayerAvailabilityEditor";

function StatefulAvailabilityEditor(): JSX.Element {
  const [value, setValue] = useState<ItemPlayerCatalogAccess>({
    mode: "none",
    instanceIds: []
  });
  return <ItemPlayerAvailabilityEditor value={value} onChange={setValue} />;
}

describe("ItemPlayerAvailabilityEditor", () => {
  it("replaces the global checkbox with none, all, and selected access modes", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<StatefulAvailabilityEditor />));

    expect(container.textContent).toContain("Player inventory availability");
    expect(container.querySelector<HTMLInputElement>('input[value="none"]')?.checked).toBe(true);

    await act(async () =>
      container.querySelector<HTMLInputElement>('input[value="selected"]')?.click()
    );
    expect(container.querySelector<HTMLInputElement>('input[value="selected"]')?.checked).toBe(
      true
    );
    expect(container.textContent).toContain("Allowed player sheets");
    expect(container.textContent).toContain("No options are available.");

    await act(async () => root.unmount());
    container.remove();
  });
});
