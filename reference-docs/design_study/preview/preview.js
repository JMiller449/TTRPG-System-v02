(() => {
  const toast = document.getElementById("toast");
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  const modal = document.getElementById("modal");
  const dialog = modal.querySelector("[role=dialog]");
  const openNotice = document.getElementById("open-notice");
  let lastFocus = null;

  function announce(message) {
    toast.textContent = message;
  }

  function activateTab(id, focus = false) {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === id;
      tab.classList.toggle("r6-tab--active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== id; });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        activateTab(next.dataset.tab, true);
      }
    });
  });

  document.querySelectorAll("[data-roll]").forEach((button) => {
    button.addEventListener("click", () => {
      const die = Math.floor(Math.random() * 100) + 1;
      const stat = Number(button.dataset.stat || 100);
      const result = Math.floor((die / 100) * stat);
      announce(`${button.dataset.roll}: d100 ${die} → ${result}`);
    });
  });

  document.querySelectorAll("[data-feedback]").forEach((button) => button.addEventListener("click", () => announce(button.dataset.feedback)));

  document.querySelectorAll("[data-resource]").forEach((resource) => {
    resource.querySelectorAll("[data-delta]").forEach((button) => {
      button.addEventListener("click", () => {
        const max = Number(resource.dataset.max);
        const step = Number(resource.dataset.step);
        const delta = Number(button.dataset.delta) * step;
        const current = Math.min(max, Math.max(0, Number(resource.dataset.current) + delta));
        resource.dataset.current = String(current);
        const output = resource.querySelector("output");
        output.querySelector("strong").textContent = current.toLocaleString();
        output.querySelector("span").textContent = ` / ${max.toLocaleString()}`;
        const track = resource.querySelector("[role=progressbar]");
        track.setAttribute("aria-valuenow", String(current));
        track.querySelector(".r6-resource__fill").style.width = `${max ? (current / max) * 100 : 0}%`;
        announce(`${resource.dataset.resource === "hp" ? "Health" : "Mana"} changed to ${current.toLocaleString()}.`);
      });
    });
  });

  document.getElementById("use-potion").addEventListener("click", () => {
    const mana = document.querySelector('[data-resource="mana"]');
    const max = Number(mana.dataset.max);
    const current = Math.min(max, Number(mana.dataset.current) + 80);
    mana.dataset.current = String(current);
    mana.querySelector("strong").textContent = current.toLocaleString();
    mana.querySelector("output span").textContent = ` / ${max.toLocaleString()}`;
    mana.querySelector("[role=progressbar]").setAttribute("aria-valuenow", String(current));
    mana.querySelector(".r6-resource__fill").style.width = `${(current / max) * 100}%`;
    announce(`Concentrated Mana Vial used. Mana restored to ${current}.`);
  });

  function showModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    requestAnimationFrame(() => dialog.focus());
  }
  function hideModal() {
    modal.hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  openNotice.addEventListener("click", showModal);
  document.getElementById("close-modal").addEventListener("click", hideModal);
  document.getElementById("dismiss-modal").addEventListener("click", hideModal);
  document.getElementById("accept-mission").addEventListener("click", () => { hideModal(); announce("Mission accepted: Stabilize the North Gate."); });
  modal.addEventListener("mousedown", (event) => { if (event.target === modal) hideModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) hideModal(); });
})();
