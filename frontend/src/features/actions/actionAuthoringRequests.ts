import type { ActionDefinition } from "@/domain/models";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildCreateActionRequest,
  buildDeleteActionRequest,
  buildGetActionFormulaAuthoringMetadataRequest,
  buildUpdateActionRequest
} from "@/infrastructure/ws/requestBuilders";
import {
  getActionEditorValidationError,
  toActionDefinitionPayload,
  toUpdatedActionDefinitionPayload,
  type ActionAttributeValidationContext,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";

export interface ActionAuthoringSubmission {
  request: ProtocolApplicationRequest;
  label: string;
}

export function selectOrderedActionDefinitions(
  actionRecords: Record<string, ActionDefinition>,
  actionOrder: string[]
): ActionDefinition[] {
  return actionOrder
    .map((id) => actionRecords[id])
    .filter((action): action is ActionDefinition => Boolean(action));
}

export function buildCreateActionSubmission(
  values: ActionEditorValues,
  actionId: string,
  context: ActionAttributeValidationContext = {}
): ActionAuthoringSubmission | null {
  if (getActionEditorValidationError(values, context)) {
    return null;
  }

  const action = toActionDefinitionPayload(values, actionId);
  return {
    request: buildCreateActionRequest({ action }),
    label: `Create action: ${action.name}`
  };
}

export function buildUpdateActionSubmission(
  action: ActionDefinition | undefined,
  values: ActionEditorValues,
  context: ActionAttributeValidationContext = {}
): ActionAuthoringSubmission | null {
  if (!action || getActionEditorValidationError(values, context)) {
    return null;
  }

  const updatedAction = toUpdatedActionDefinitionPayload(action, values);
  return {
    request: buildUpdateActionRequest({
      actionId: action.id,
      action: updatedAction
    }),
    label: `Update action: ${updatedAction.name}`
  };
}

export function buildDeleteActionSubmission(
  actionId: string,
  action: ActionDefinition | undefined
): ActionAuthoringSubmission {
  return {
    request: buildDeleteActionRequest({ actionId }),
    label: `Delete action: ${action?.name ?? "action"}`
  };
}

export function buildLoadActionFormulaAuthoringMetadataSubmission(): ActionAuthoringSubmission {
  return {
    request: buildGetActionFormulaAuthoringMetadataRequest(),
    label: "Load action metadata"
  };
}
