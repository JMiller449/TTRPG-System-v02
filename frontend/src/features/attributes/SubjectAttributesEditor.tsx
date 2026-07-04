import type { AttributeBridge, AttributeDefinition } from "@/domain/models";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildAttachSubjectAttributeRequest,
  buildDetachSubjectAttributeRequest,
  buildResetSubjectAttributeValueRequest,
  buildSetSubjectAttributeValueRequest
} from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";

export function SubjectAttributesEditor({
  client,
  subjectType,
  subjectId,
  definitions,
  bridges
}: {
  client: GameClient;
  subjectType: "item" | "action";
  subjectId: string;
  definitions: Record<string, AttributeDefinition>;
  bridges: Record<string, AttributeBridge>;
}): JSX.Element {
  const label = subjectType === "item" ? "Item" : "Action";
  return (
    <SheetAttributesSection
      definitions={definitions}
      bridges={bridges}
      canEdit
      subjectType={subjectType}
      onSaveFormula={(attributeId, formula) =>
        client.sendProtocolRequest(
          buildSetSubjectAttributeValueRequest({
            subjectType,
            subjectId,
            attributeId,
            value: { type: "formula", formula }
          }),
          `Update ${label} Attribute`
        )
      }
      onSaveValue={(attributeId, value) =>
        client.sendProtocolRequest(
          buildSetSubjectAttributeValueRequest({ subjectType, subjectId, attributeId, value }),
          `Update ${label} Attribute`
        )
      }
      onReset={(attributeId) =>
        client.sendProtocolRequest(
          buildResetSubjectAttributeValueRequest({ subjectType, subjectId, attributeId }),
          `Reset ${label} Attribute`
        )
      }
      onAttach={(attributeId) =>
        client.sendProtocolRequest(
          buildAttachSubjectAttributeRequest({
            subjectType,
            subjectId,
            attributeId,
            relationshipId: makeId(`${subjectType}_attribute`)
          }),
          `Attach ${label} Attribute`
        )
      }
      onDetach={(attributeId) =>
        client.sendProtocolRequest(
          buildDetachSubjectAttributeRequest({ subjectType, subjectId, attributeId }),
          `Detach ${label} Attribute`
        )
      }
    />
  );
}
