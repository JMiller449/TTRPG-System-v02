import type { FactBridge, FactDefinition } from "@/domain/models";
import { SheetFactsSection } from "@/features/sheets/components/SheetFactsSection";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildAttachSubjectFactRequest,
  buildDetachSubjectFactRequest,
  buildResetSubjectFactValueRequest,
  buildSetSubjectFactValueRequest
} from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";

export function SubjectFactsEditor({
  client,
  subjectType,
  subjectId,
  definitions,
  bridges
}: {
  client: GameClient;
  subjectType: "item" | "action";
  subjectId: string;
  definitions: Record<string, FactDefinition>;
  bridges: Record<string, FactBridge>;
}): JSX.Element {
  const label = subjectType === "item" ? "Item" : "Action";
  return (
    <SheetFactsSection
      definitions={definitions}
      bridges={bridges}
      canEdit
      subjectType={subjectType}
      onSaveFormula={(factId, formula) =>
        client.sendProtocolRequest(
          buildSetSubjectFactValueRequest({
            subjectType,
            subjectId,
            factId,
            value: { type: "formula", formula }
          }),
          `Update ${label} Fact`
        )
      }
      onSaveValue={(factId, value) =>
        client.sendProtocolRequest(
          buildSetSubjectFactValueRequest({ subjectType, subjectId, factId, value }),
          `Update ${label} Fact`
        )
      }
      onReset={(factId) =>
        client.sendProtocolRequest(
          buildResetSubjectFactValueRequest({ subjectType, subjectId, factId }),
          `Reset ${label} Fact`
        )
      }
      onAttach={(factId) =>
        client.sendProtocolRequest(
          buildAttachSubjectFactRequest({
            subjectType,
            subjectId,
            factId,
            relationshipId: makeId(`${subjectType}_fact`)
          }),
          `Attach ${label} Fact`
        )
      }
      onDetach={(factId) =>
        client.sendProtocolRequest(
          buildDetachSubjectFactRequest({ subjectType, subjectId, factId }),
          `Detach ${label} Fact`
        )
      }
    />
  );
}
