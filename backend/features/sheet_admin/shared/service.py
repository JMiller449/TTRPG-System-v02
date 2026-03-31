from backend.features.sheet_admin.actions import service as actions_service
from backend.features.sheet_admin.formulas import service as formulas_service
from backend.features.sheet_admin.items import service as items_service
from backend.features.sheet_admin.sheets import service as sheets_service
from backend.features.sheet_admin.stats import service as stats_service
from backend.features.sheet_admin.shared.schema import (
    CreateEntity,
    DeleteEntity,
    SheetAdminRequest,
    UpdateEntity,
)


async def dispatch_admin_request(request: SheetAdminRequest) -> None:
    entity_kind = request.entity_kind
    if entity_kind == "sheet":
        await sheets_service.handle_request(request)
        return
    if entity_kind == "item":
        await items_service.handle_request(request)
        return
    if entity_kind == "action":
        await actions_service.handle_request(request)
        return
    if entity_kind == "formula":
        await formulas_service.handle_request(request)
        return
    if entity_kind == "stat":
        raise NotImplementedError(stats_service.build_not_implemented_message(request))

    if isinstance(request, DeleteEntity):
        raise ValueError(
            "Sheet admin delete requests require an entity_kind of sheet, item, action, "
            "formula, or stat."
        )

    if isinstance(request, (CreateEntity, UpdateEntity)):
        raise ValueError(
            "Sheet admin create/update requests require an entity_kind of sheet, item, "
            "action, formula, or stat."
        )

    raise ValueError(f"Unhandled sheet admin request type: {request.type}")
