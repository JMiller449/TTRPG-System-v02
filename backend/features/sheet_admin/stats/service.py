from backend.features.sheet_admin.shared.schema import SheetAdminRequest


def build_not_implemented_message(_request: SheetAdminRequest) -> str:
    return "Stat authoring flows are not implemented yet."
