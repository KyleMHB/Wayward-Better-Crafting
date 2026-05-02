# Better Crafting Change Summary

This file summarizes the changes made across the project chats and commits for the Better Crafting Wayward mod.

## Current Version

- Mod version is `1.7.6`.
- Wayward compatibility is `2.15.3-beta`.
- Steam Workshop published file id is `3701391059`.

## Gameplay And Crafting Flow

- Reworked Better Crafting from the imported precision-crafting base into a full crafting, bulk crafting, and dismantling workflow.
- Added exact material selection for consumed ingredients, base items, tools, and used requirements.
- Added smart auto-fill for normal crafting that respects rendered, sorted section candidates.
- Added bulk crafting quantity controls with safer validation and exact simulation of requested iterations.
- Added bulk dismantling support with target selection and required-item handling.
- Added safety stops for bulk actions when movement, damage, stat changes, menu close, or user stop events occur.
- Added stamina checks for normal crafting, bulk crafting, and dismantling.
- Added shared stamina normalization logic so normal, bulk, and dismantle paths use the same rules.
- Added durability protection rules for tools and required items, including preserve-one-use behavior.
- Fixed non-split consumed component counters.
- Fixed split-selection defaults so consumed and used item counts are reported separately and correctly.
- Fixed overlapping reservations between consumed, base, used, tool, and dismantle target selections.
- Fixed explicit tool reservations during auto-selection.
- Fixed dismantle target reservation overlap when required items are present.
- Fixed low-stamina validation before normal craft execution.

## Crafting Dialog UI

- Refreshed the crafting dialog frame, tab layout, footer spacing, and close button placement.
- Added separate normal craft, bulk craft, and dismantle selection state.
- Added section filters for large inventories.
- Added active reselection so filtered lists keep meaningful selected items visible.
- Added section counters based on current selected counts.
- Added sort controls including Best for Crafting, quality, name, weight, durability, decay, and worth.
- Defaulted crafting, bulk crafting, and dismantling sections to Best for Crafting.
- Forced quality sort to use descending quality value semantics.
- Preserved manual dismantle exclusions across sort and filter changes.
- Promoted newly selected items to the front while preserving selection order through refreshes.
- Prevented filter inputs from mutating mod-level hotkey state.
- Added hover/inspect detail support for durability, weight, grouping, and action tier values.
- Kept craft and dismantle visual identities distinct, including gold/blue tab identity and neutral dismantle framing.

## Multiplayer

- Added multiplayer-compatible approval and bypass flow for remote crafting.
- Added protocol support for Better Crafting multiplayer messages.
- Blocked remote craft attempts report via status packets instead of server-side translation messages.
- Added diagnostics for approval passes, bypass tracing, and blocked craft handling.
- Ensured vanilla bypasses are queued for approval and replayed only after approval.
- Ensured remote multiplayer bypass intercepts block the original craft while approval is pending.
- Rejected new server approvals while a live pass is already active instead of overwriting it.
- Added server pass consumption logic that decrements passes and deletes exhausted pass entries.
- Added request-local matching item caches for bulk approval validation.

## Code Organization

- Split dialog helper logic into smaller modules:
  - `src/dialog/selection.ts`
  - `src/dialog/sort.ts`
  - `src/dialog/theme.ts`
- Added shared item identity helpers.
- Added shared item state helpers for protection and durability rules.
- Added shared crafting selection helpers for split consumption and reservation logic.
- Added shared DOM helper code for dialog construction behavior.
- Extracted runtime packaging helpers into scripts.
- Added TypeScript runner and version synchronization scripts.
- Refactored server pre-execute and client pre-execute handling into clearer paths.
- Removed stale Precision Crafting dialog files from the Better Crafting codebase.

## Packaging, Build, And Deploy

- Added runtime package staging logic that whitelists deployable assets.
- Added deploy script support using `config.toml`.
- Set deploy target to `E:/Steam/steamapps/common/Wayward/mods/Better Crafting`.
- Kept deploy target cleaning disabled by default.
- Added package/version sync between `package.json` and `mod.json`.
- Added release package workflow.
- Added validation workflow.
- Added build verification in CI and dirty-diff detection after build.
- Added TypeScript typecheck config.
- Added local npm scripts:
  - `sync:version`
  - `build`
  - `typecheck`
  - `test`
  - `verify`
  - `deploy`

## Tests

- Added Node test coverage for crafting selection helpers.
- Added dialog module tests for selection, sort, and theme helpers.
- Added multiplayer headless regression tests.
- Added runtime package tests.
- Added version synchronization tests.
- Added TypeScript runner tests.
- Added coverage for stale item identities, duplicate filtering, split selections, reservations, low stamina, durability protection, bulk approval, server pass consumption, abort hooks, and strict quantity input.
- Current observed test result: 53 passing tests.

## Documentation

- Added and updated `README.md` with features, installation, development commands, compatibility, and credits.
- Added Steam Workshop copy in `steam-workshop-copy.md`.
- Added `CHANGELOG.md`.
- Added this `change.md` project rollup.

## Repository Hygiene

- Removed committed local cache and generated artifacts:
  - `.npm-cache`
  - `.DS_Store`
  - `.codex-write-check`
- Removed stale local checkout artifacts:
  - `.claude`
  - `dist`
  - `REVIEW_PLAN.md`
  - `CLAUDE.md`
  - `tsconfig.tsbuildinfo`
- Updated `.gitignore` for generated, cache, local, and OS metadata files.
- Pruned stale Git worktree metadata.
- Left `node_modules` and `mod-reference` untracked and ignored because they are local build dependencies for this checkout.
