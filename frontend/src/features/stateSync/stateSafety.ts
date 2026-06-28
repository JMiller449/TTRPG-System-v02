import { buildUndoLastStateChangeRequest } from "@/infrastructure/ws/requestBuilders";

export function buildUndoLastStateChangeSubmission(): {
  request: ReturnType<typeof buildUndoLastStateChangeRequest>;
  label: string;
} {
  return {
    request: buildUndoLastStateChangeRequest(),
    label: "Undo last state change"
  };
}
