# Validation Notes

The package is designed for the current React/Vite/TypeScript stack and introduces no runtime dependency.

Checks performed before packaging:

- TypeScript no-emit smoke compile for all reusable shared UI components.
- Static preview JavaScript syntax check with Node.
- HTML preview contains no remote script, image, or font dependency.
- CSS selectors are prefixed `cs-` and tokens are scoped beneath `.cs-theme`.
- Component source contains no websocket URL, request payload, backend mutation, or generated protocol copy.
- Zip manifest includes SHA-256 hashes for integrity.

The repo-specific adapter was also compiled against a validation stub matching the current `StatKey`, `ActionDefinition`, and `ActionRollModeKind` shapes. It still imports the live repo aliases `@/domain/models` and `@/shared/ui/...` when copied into the target repo.
