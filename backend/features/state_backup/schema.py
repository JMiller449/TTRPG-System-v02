from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel, ResponseModel


class ExportStateBackup(RequestModel):
    type: Literal["export_state_backup"]


class ImportStateBackup(RequestModel):
    persisted_state_json: str = Field(min_length=1)
    type: Literal["import_state_backup"]


@dataclass
class StateBackupExported(ResponseModel):
    persisted_state_json: str
    schema_version: int
    type: Literal["state_backup_exported"] = "state_backup_exported"
    request_id: str | None = None
