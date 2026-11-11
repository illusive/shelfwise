# Product

## Purpose

Help Royal Unibrew sales reps in Denmark understand the client's shelf presence and observed
pricing during store visits, and compare it with earlier visits. The POC is a focused vertical
slice that must also be polished enough for sales demonstrations. It replaces the manual,
tag-everything flow of the incumbent shelf-recognition tool.

## Scope (agreed)

In scope: a default test rep with switching from the user drawer; store search and assigned stores; store overview and history;
in-app repeated photo capture with import fallback; draft persistence; capture review;
idempotent submission with real job states and retry; mock analysis behind the agreed
contract; results summary (shelf and cooler Share of Shelf, comparison, prices, promotions,
limitations); full report; photo evidence viewer; quick rep review of unresolved items;
archive.

Out of scope for now: live recognition (blocked), out-of-stock/must-stock and price
compliance (deferred; data model ready), export/manager reporting, catalogue/store admin,
offline sync, ERP/CRM, native apps, route planning, Danish UI (strings centralised).

## Terminology

| Term                 | Meaning                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Client               | Royal Unibrew: every brand it sells in Denmark — `owned` and `licensed`/distributed (e.g. Pepsi, Heineken).                                   |
| Facing               | One visible front-facing product position. Empty space is not a facing.                                                                       |
| Eligible facing      | Any beverage facing on a shelf or in a cooler, including unknown ones. Display facings are excluded.                                          |
| Share of Shelf (SoS) | Client facings ÷ eligible facings × 100, per scope.                                                                                           |
| Scope                | `shelf` (ambient), `cooler` (cold) or `overall` (shelf + cooler counts aggregated).                                                           |
| Display              | Floor/end-cap/secondary placement; reported as a count, excluded from SoS.                                                                    |
| Unique products      | Distinct recognised client SKUs. Brand-only identifications are listed but not counted as SKUs.                                               |
| Unresolved           | A facing that is unknown, a low-confidence candidate or a conflict between overlapping photos; a price label that is unreadable or ambiguous. |
| Rep correction       | A rep's answer for an unresolved item, stored next to (never over) the AI value.                                                              |
| Qualified            | A measure shown with a caveat (e.g. many unknowns, unreconciled overlap).                                                                     |
| Unavailable          | No defensible value (e.g. no coolers captured); shown as "—" with a reason.                                                                   |
| pp                   | Percentage points — the unit of SoS change between visits.                                                                                    |

## Journeys

1. **Open the app** → Home as the default rep (Alex). Switch rep from the user drawer (avatar,
   top right) if needed.
2. **Start visit:** Home → Stores (assigned first, search all by name/street/postcode/customer
   no.) → Store (latest result, history, or "No visits yet") → _Start visit_ → Camera.
3. **Capture:** camera stays open; each tap adds a photo (flash, count badge). Tap the
   thumbnail to remove/retake without leaving the camera. _Done_ → Daily captures.
4. **Review & submit:** remove (×), retake, add, import; _Analyze N captures_ → Processing
   (job id, attempt, photo preparation count, analysis) → Results. Failures offer _Retry_ or
   _Edit photos_.
5. **Results:** SoS by scope with pp change vs. last comparable visit, facing grid, category
   breakdown, prices, promotions, displays, limitations, _Review now_ for unresolved items,
   full report, photo evidence.
6. **History:** Store page and Archive (filters by store and period; dates in the store's
   local time zone).

## Acceptance criteria (POC)

Met with the mock provider (verified by unit tests and the Playwright journey):

- Find an assigned store or search the catalogue and begin a visit.
- Capture several photos in succession without naming or tagging.
- Inspect, remove, retake and add photos before submission; drafts survive reload/navigation.
- Upload/analysis states are clear; failures retry without duplicate jobs or results.
- Shelf and cooler SoS are produced or explicitly unavailable; overlap does not inflate counts.
- Results separate unique products, facings, prices, promotions and unresolved items.
- Findings trace to photos (evidence boxes); visits persist and compare with disclosure.
- Mocked results are clearly identifiable.

Not met yet (blocked, see `docs/decisions.md`): live analysis of real store photos; validation
on real devices; recognition quality and coverage evaluated against agreed examples/targets.
