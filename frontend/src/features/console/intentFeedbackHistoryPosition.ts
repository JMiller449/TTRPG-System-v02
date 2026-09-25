export interface HistoryPanelPosition {
  left: number;
  top?: number;
  bottom?: number;
}

export function historyPanelPosition(trigger: DOMRect): HistoryPanelPosition {
  const viewportMargin = 10;
  const panelWidth = Math.min(440, window.innerWidth - viewportMargin * 2);
  const left = Math.min(
    Math.max(viewportMargin, trigger.right - panelWidth),
    window.innerWidth - panelWidth - viewportMargin
  );
  return trigger.top > window.innerHeight / 2
    ? { left, bottom: window.innerHeight - trigger.top + 9 }
    : { left, top: trigger.bottom + 9 };
}
