# Sigil inscriptions

## Domain and ownership

`backend/state/models/sigil.py` defines a dedicated `State.sigils` registry.
Each inscription belongs to a spawned character and may reference one inventory
relationship containing exactly one item. It never modifies a shared Item or
Action definition. Two inventory relationships for the same Item can have
independent inscriptions. Stack entries must be separated into individual copies
before inscription; inscription does not invent stack-splitting rules.

A sigil has one root and an ordered list of nodes with stable IDs and parent IDs.
Sibling order follows list order. Iterative validation rejects duplicate node IDs,
missing parents, cycles, multiple roots, and nonpositive/nonfinite diameters
without imposing a recursive depth limit. Names, Action bindings, explicit
casting-cost step IDs, and power-bearing step IDs are configured per node.

DMs manage inscriptions and select which player characters may create/edit them
using **Players who can create sigils** on the Sigils page. Each spawned instance
stores `can_inscribe_sigils`, default false; selected owners may manage their own
inscriptions. Only the DM-only `set_sigil_authoring_access` request changes this
permission. Creation, save, duplication, and deletion recheck the permission
inside the state-sync transaction. Revocation hides creation/editor controls,
discards unsaved drafts, and blocks direct requests without removing existing
sigils or charges. The setting persists through schema version 59 saves/backups.

DMs can separately assign additional character access to an existing sigil. Service authorization checks both the session's claimed
character and the inscription's owner/access list. Access grants use and
activation, not configuration editing. Snapshot redaction withholds unrelated
inscriptions; player patches replace the visible registry so access revocation
removes previously visible inscriptions. The last imbuer uses its stable instance
ID, even when that character is absent from the viewer's projection.

## Item-attached inscriptions

The main sigil configuration exposes **Attach to inventory item (optional)**.
Selection references the owner's exact inventory relationship; shared Item and
Action definitions are never changed. Only existing entries containing one copy
can be selected, and charged attachments cannot be changed until discharged.
Every Action-bound node in the hierarchy belongs to that attachment.

The full Inventory and Dense inventory cards render per-node Action names,
charged/uncharged status, and activation/imbue/recharge controls on the bound item.
Charge state remains visible after discharge. Charged item nodes are also projected
into the character Action list with stable sigil/node relationship identifiers;
discharged, missing-item, and stacked-item entries do not grant an available Action.
This is presentation of authoritative sigil records, not a second persistent
ItemActionGrant or Action definition. Sigil entries do not use ordinary Action
casting requests: the shared invocation helper emits `activate_sigil`, forwarding
compatible roll mode and Roll20 visibility through the existing pipeline. Normal
Action requests keep their original behavior. Inventory activation retains the
shared Action-point recovery flow. Charged entries are not pinnable; their
availability follows the stored charge.

The existing activation request now accepts the same optional roll modes as
`perform_action`, defaulting to normal for older clients. No persisted shape
change or new migration is needed for this item projection. Snapshot/patch
reconciliation immediately updates both surfaces after imbuement, successful
activation, recharge, hierarchy edits, or item deletion. Existing rollback leaves
weapon status and the charged Action intact after failure.

## Charging and activation

`backend/features/sigils/` owns registry-backed typed requests and validation.
Imbuement evaluates the existing Action's calculated values and explicitly
selected caster-mana decrement amounts using the existing formula runtime.
It deducts `floor(diameter * total original casting cost)` and records the charge
in one state-sync transaction. Imbuement performs no Action effects, proficiency
growth, inventory consumption, history output, or Roll20 delivery. A serialized,
isolated read provides an authoritative cost preview.

Each charge records its Action ID, imbuer instance ID, paid mana, and a signature
of the Action and its referenced Formula definitions. Charges do not create
parallel Action definitions. Editing or deleting the referenced Action/Formula
invalidates activation rather than silently executing a different spell.
Configuration and charges persist through schema version 58 and later checkpoints and
private export/import. Schema version 59 adds default-off player authoring access. Missing owner, item, Action, or imbuer references remain
recoverable in persisted configuration, but runtime operations fail explicitly.
The owner/DM can discard a stale charge without refund and rebind/recharge.

Charged nodes cannot be recharged or have their diameter, binding, cost steps,
power steps, or item relationship changed. Names and tree organization may be
edited while preserving charges. Configuration saves and deletion require the
current revision. Branch and whole-sigil duplication generate new IDs and clear
charges and imbuer metadata; duplication never copies prepaid power.

Activation reuses `backend/features/sheet_runtime/service.py::perform_action`.
The authorized activator controls mutation targets, history actor identity, and
the user's Roll20 bridge. The stored imbuer supplies the formula context and
matching formula effects, using its current instance stats. Missing/invalid
imbuers never fall back to the activator. Existing execution restrictions,
including the absence of cross-sheet targets, continue to apply. Existing
successful-use proficiency behavior applies to the executing character.

Selected casting-cost steps alone are skipped. Other mana effects still execute.
Selected numeric effect values and roll output expressions receive the node's
diameter multiplier at their consumption/output step. Calculated-value producer
steps are not selectable for scaling, avoiding accidental double scaling through
reused variables. Structured roll steps scale all results of the selected step;
free-form message steps scale their inline-roll expressions. Select only steps
whose outputs are spell power, not unrelated check/utility results. Source-item
formulas require the original imbuer's referenced inventory item; the binding
supplies formula context rather than an inventory-use grant.

Discharge occurs inside the existing Action transaction. Validation, delivery
acknowledgement, and checkpoint failures roll back the discharge and mutations.
The state-sync lock and request deduplication reject concurrent or repeated
activation. Existing Roll20 guarantees cannot delete an early message if a later
message fails. Successful execution uses the existing bounded Action history
and terminal `action_executed` event.

## Interface and verification

`frontend/src/features/sigils/` provides the shared player/GM Sigils destination,
listing, configuration drafts, hierarchy editing, branch duplication/removal/
reparenting/reordering, shared Action catalogue selection, per-node charge state,
last imbuer, authoritative cost preview, and imbue/recharge/activate/discard
controls. The creator uses the shared catalog/editor workspace and Field controls,
with Item-style section dividers and disclosures for hierarchy, stored Action,
character access, and charging. Creation is in the page toolbar; configuration
actions stay at the bottom of the vertically scrolling editor. GM player-creation
access lives in a separate disclosure above the workspace. Navigation and
navigation search show Sigils to players only when
their claimed character has authoring permission or has an accessible inscription;
unselected players with accessible inscriptions get a read-only configuration
and runtime controls. It introduces no Action editor or frontend calculations.
Centralized typed builders consume regenerated contracts; snapshots and patches
use the existing reducer/adapters. Pending saves retain drafts on rejection;
runtime controls require saved configuration.

Backend coverage lives in `backend/tests/test_sigils.py`, alongside runtime,
state-sync, transport, permissions, and persistence tests. Frontend tree, UI,
and reconciliation tests live in the sigil directory. Validation and deferred
combined-area rules are tracked in [PLAN.md](../../plan/active/PLAN.md).
