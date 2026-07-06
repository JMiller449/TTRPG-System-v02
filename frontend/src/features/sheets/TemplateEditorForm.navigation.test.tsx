// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateEditorForm } from "@/features/sheets/TemplateEditorForm";
import { createEmptyTemplateEditorValues } from "@/features/sheets/templateEditorValues";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderEditor(onSubmit = vi.fn()): Promise<void> {
  const values = createEmptyTemplateEditorValues("player");
  values.name = "Walking Test";
  await act(async () => {
    root.render(
      <TemplateEditorForm
        title="New Template"
        submitLabel="Create Template"
        values={values}
        actions={{}}
        actionOrder={[]}
        proficiencies={{}}
        proficiencyOrder={[]}
        items={{}}
        itemOrder={[]}
        attributes={{}}
        metadata={null}
        onChange={() => undefined}
        onSubmit={onSubmit}
      />
    );
  });
}

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${label}`);
  }
  return match;
}

describe("TemplateEditorForm navigation", () => {
  it("walks forward one section and offers an explicit early-review option", async () => {
    const onSubmit = vi.fn();
    await renderEditor(onSubmit);

    expect(button("Continue to Stats")).toBeTruthy();
    await act(async () => button("Continue to Stats").click());

    expect(container.textContent).toContain("Set the six core stats");
    expect(button("Continue to Actions")).toBeTruthy();
    expect(button("Review and Finish")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => button("Continue to Actions").click());
    expect(button("Continue to Proficiencies")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reviews without submitting until the final submit action", async () => {
    const onSubmit = vi.fn();
    await renderEditor(onSubmit);

    await act(async () => button("Continue to Stats").click());
    await act(async () => button("Review and Finish").click());

    expect(container.textContent).toContain("Review Template");
    expect(button("Create Template").disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
