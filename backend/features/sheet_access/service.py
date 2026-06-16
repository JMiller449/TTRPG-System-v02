from __future__ import annotations

import secrets

from backend.features.sheet_access.schema import (
    SheetAccessCodePayload,
    SheetAccessCodes,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.access_code import SheetAccessCode
from backend.state.models.state import State
from backend.state.store import StateSingleton


def _generate_access_code() -> str:
    return secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()


def _access_code_payload(access_code: SheetAccessCode) -> SheetAccessCodePayload:
    return SheetAccessCodePayload(
        code=access_code.code,
        sheet_id=access_code.sheet_id,
        instance_id=access_code.instance_id,
        active=access_code.active,
    )


def _build_response(
    state: State,
    *,
    request_id: str | None = None,
) -> SheetAccessCodes:
    return SheetAccessCodes(
        response_id=None,
        codes=[
            _access_code_payload(access_code)
            for access_code in sorted(
                state.sheet_access_codes.values(),
                key=lambda access_code: access_code.code,
            )
        ],
        request_id=request_id,
    )


async def list_sheet_access_codes(
    *,
    request_id: str | None = None,
) -> SheetAccessCodes:
    return _build_response(StateSingleton.getState(), request_id=request_id)


async def generate_sheet_access_code(
    *,
    sheet_id: str,
    instance_id: str | None = None,
    request_id: str | None = None,
) -> SheetAccessCodes:
    def mutation(state: State) -> SheetAccessCodes:
        if sheet_id not in state.sheets:
            raise ValueError(f"Sheet '{sheet_id}' does not exist.")

        if instance_id is not None:
            instance = state.instanced_sheets.get(instance_id)
            if instance is None:
                raise ValueError(f"Instance '{instance_id}' does not exist.")
            if instance.parent_id != sheet_id:
                raise ValueError(
                    f"Instance '{instance_id}' does not belong to sheet '{sheet_id}'."
                )

        code = _generate_access_code()
        while code in state.sheet_access_codes:
            code = _generate_access_code()

        state.sheet_access_codes[code] = SheetAccessCode(
            code=code,
            sheet_id=sheet_id,
            instance_id=instance_id,
            active=True,
        )
        return _build_response(state, request_id=request_id)

    return await state_sync_service.apply_private_mutation(mutation)
