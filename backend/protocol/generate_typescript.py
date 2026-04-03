from __future__ import annotations

import json
import operator
import sys
from collections import OrderedDict
from functools import reduce
from pathlib import Path
from typing import Annotated, Any, Literal, get_args, get_origin

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = str(Path(__file__).resolve().parent)
if sys.path and sys.path[0] == SCRIPT_DIR:
    sys.path.pop(0)
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pydantic import Field, TypeAdapter  # noqa: E402
from backend.protocol.socket import ErrorEvent  # noqa: E402
from backend.core.request_registry import request_registry  # noqa: E402

OUTPUT_PATH = ROOT / "frontend" / "src" / "generated" / "backendProtocol.ts"
REF_PREFIX = "#/$defs/"


def _merge_defs(target: OrderedDict[str, Any], schema: dict[str, Any]) -> None:
    for name, value in schema.get("$defs", {}).items():
        target[name] = value


def _is_nullable_union(schema: dict[str, Any]) -> bool:
    any_of = schema.get("anyOf")
    if not isinstance(any_of, list) or len(any_of) != 2:
        return False
    return any(isinstance(option, dict) and option.get("type") == "null" for option in any_of)


def _strip_null(schema: dict[str, Any]) -> dict[str, Any]:
    any_of = schema.get("anyOf")
    if not isinstance(any_of, list):
        return schema
    filtered = [
        option
        for option in any_of
        if not (isinstance(option, dict) and option.get("type") == "null")
    ]
    if len(filtered) == 1 and isinstance(filtered[0], dict):
        return filtered[0]
    return schema


def _render_literal(value: Any) -> str:
    return json.dumps(value)


def _render_schema(schema: dict[str, Any], defs: OrderedDict[str, Any]) -> str:
    if "$ref" in schema:
        ref = schema["$ref"]
        if not isinstance(ref, str) or not ref.startswith(REF_PREFIX):
            raise ValueError(f"Unsupported ref: {ref}")
        return ref[len(REF_PREFIX) :]

    if "const" in schema:
        return _render_literal(schema["const"])

    if "enum" in schema:
        return " | ".join(_render_literal(value) for value in schema["enum"])

    if "oneOf" in schema:
        return " | ".join(_render_schema(option, defs) for option in schema["oneOf"])

    if "anyOf" in schema:
        return " | ".join(_render_schema(option, defs) for option in schema["anyOf"])

    schema_type = schema.get("type")

    if schema_type == "string":
        return "string"
    if schema_type == "integer" or schema_type == "number":
        return "number"
    if schema_type == "boolean":
        return "boolean"
    if schema_type == "null":
        return "null"
    if schema_type == "array":
        item_schema = schema.get("items", {})
        item_type = _render_schema(item_schema, defs)
        if " | " in item_type:
            item_type = f"({item_type})"
        return f"{item_type}[]"
    if schema_type == "object":
        properties = schema.get("properties", {})
        additional_properties = schema.get("additionalProperties", None)

        if not properties:
            if additional_properties is True:
                return "Record<string, unknown>"
            if isinstance(additional_properties, dict):
                return f"Record<string, {_render_schema(additional_properties, defs)}>"
            return "Record<string, never>"

        required = set(schema.get("required", []))
        lines: list[str] = ["{"]
        for key, value in properties.items():
            property_schema = value
            optional = key not in required and not (
                key == "type"
                and isinstance(property_schema, dict)
                and "const" in property_schema
            )
            if isinstance(property_schema, dict) and _is_nullable_union(property_schema):
                property_schema = _strip_null(property_schema)
                property_type = f"{_render_schema(property_schema, defs)} | null"
            else:
                property_type = _render_schema(property_schema, defs)
            lines.append(f"  {json.dumps(key)}{'?' if optional else ''}: {property_type};")
        lines.append("}")
        return "\n".join(lines)

    if schema == {}:
        return "unknown"

    raise ValueError(f"Unsupported schema: {schema}")


def _render_export(name: str, schema: dict[str, Any], defs: OrderedDict[str, Any]) -> str:
    return f"export type {name} = {_render_schema(schema, defs)};\n"


def _resolve_type_discriminant(model: type[Any]) -> str:
    type_field = getattr(model, "model_fields", {}).get("type")
    if type_field is None:
        raise ValueError(f"Model {model.__name__} does not declare a type field.")

    if isinstance(type_field.default, str):
        return type_field.default

    annotation = type_field.annotation
    if get_origin(annotation) is Literal:
        literal_args = get_args(annotation)
        if len(literal_args) == 1 and isinstance(literal_args[0], str):
            return literal_args[0]

    raise ValueError(f"Model {model.__name__} does not declare a literal type value.")


def _build_route_contract_manifest() -> list[dict[str, Any]]:
    contracts: list[dict[str, Any]] = []
    for contract in request_registry.route_contracts():
        if contract.client_generation is None:
            continue

        contracts.append(
            {
                "type": contract.type_name,
                "requestModel": contract.request_model.__name__,
                "emittedEventTypes": [
                    _resolve_type_discriminant(model)
                    for model in contract.emitted_event_models
                ],
                "minimumRole": contract.minimum_role,
                "clientNamespace": contract.client_generation.namespace,
                "clientMethodName": contract.client_generation.method_name,
            }
        )

    return contracts


def _build_output() -> str:
    request_models = request_registry.request_models()
    event_models: tuple[type[Any], ...] = (ErrorEvent, *request_registry.emitted_event_models())

    request_union = Annotated[
        reduce(operator.or_, request_models[1:], request_models[0]),
        Field(discriminator="type"),
    ]
    event_union = Annotated[
        reduce(operator.or_, event_models[1:], event_models[0]),
        Field(discriminator="type"),
    ]

    request_schema = TypeAdapter(request_union).json_schema(ref_template="#/$defs/{model}")
    event_schema = TypeAdapter(event_union).json_schema(ref_template="#/$defs/{model}")

    defs: OrderedDict[str, Any] = OrderedDict()
    _merge_defs(defs, request_schema)
    _merge_defs(defs, event_schema)

    lines = [
        "// Generated by backend/protocol/generate_typescript.py",
        "// Do not edit by hand.\n",
    ]

    for name in sorted(defs):
        lines.append(_render_export(name, defs[name], defs))

    lines.append(_render_export("ProtocolApplicationRequest", request_schema, defs))
    lines.append(_render_export("ProtocolServerEvent", event_schema, defs))
    lines.append(
        "\n".join(
            [
                "export type ProtocolRouteContract = {",
                '  "type": ProtocolApplicationRequest["type"];',
                '  "requestModel": string;',
                '  "emittedEventTypes": ProtocolServerEvent["type"][];',
                '  "minimumRole": "unauthenticated" | "player" | "dm";',
                '  "clientNamespace": string;',
                '  "clientMethodName": string;',
                "};\n",
            ]
        )
    )
    route_contract_manifest = json.dumps(_build_route_contract_manifest(), indent=2)
    lines.append(
        "export const protocolRouteContracts = "
        f"{route_contract_manifest} as const satisfies readonly ProtocolRouteContract[];\n"
    )

    return "\n".join(lines)


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(_build_output(), encoding="utf-8")


if __name__ == "__main__":
    main()
