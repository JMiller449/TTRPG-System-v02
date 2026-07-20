export type DestructiveActionVerb = "Delete" | "Deny" | "Despawn" | "Detach" | "Remove" | "Undo";

export interface DestructiveActionConfirmation {
  action: DestructiveActionVerb;
  subject: string;
  consequence: string;
}

export function destructiveActionMessage({
  action,
  subject,
  consequence
}: DestructiveActionConfirmation): string {
  return `${action} “${subject}”?\n\n${consequence}`;
}

export function confirmDestructiveAction(confirmation: DestructiveActionConfirmation): boolean {
  return window.confirm(destructiveActionMessage(confirmation));
}
