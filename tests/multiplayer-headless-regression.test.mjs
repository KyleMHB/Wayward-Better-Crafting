import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("blocked remote craft reports via status packet instead of server-side translation messages", async () => {
    const source = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.match(source, /private sendStatus\(to: any, status: IBetterCraftingRequestStatus\): void/);
    assert.match(source, /this\.reportBlockedRemoteCraft\(player, "That vanilla craft could not be validated in multiplayer\. Try again without bypass if it keeps happening\."/);
    assert.doesNotMatch(source, /playerMessages\.send\(TranslationImpl\.generator\("That vanilla craft could not be validated in multiplayer\. Try again without bypass if it keeps happening\."\)\)/);
    assert.doesNotMatch(source, /playerMessages\.send\(TranslationImpl\.generator\(message\)\)/);
});

test("multiplayer diagnostics include pass and bypass tracing for blocked craft handling", async () => {
    const source = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.match(source, /Evaluating remote \$\{ActionType\[actionType\]\} action on server\./);
    assert.match(source, /No vanilla bypass permit found for player \$\{key\}\./);
    assert.match(source, /No server pass found for player \$\{key\}\./);
    assert.match(source, /Blocked remote \$\{ActionType\[diagnostics\.actionType\]\} action: \$\{diagnostics\.reason\}\./);
});

test("vanilla bypass is queued for approval and replayed only after approval", async () => {
    const source = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.match(source, /private readonly pendingVanillaBypasses = new Map<number, IPendingVanillaBypass>\(\)/);
    assert.match(source, /kind: "vanillaBypass"/);
    assert.match(source, /Queued vanilla bypass request \$\{currentRequestId\}\./);
    assert.match(source, /Blocked original vanilla craft pending bypass approval \$\{requestId\}\./);
    assert.match(source, /Replaying approved vanilla bypass \$\{approval\.requestId\}\./);
    assert.match(source, /private async replayApprovedVanillaBypass\(pendingBypass: IPendingVanillaBypass, requestId: number\): Promise<void>/);
    assert.match(source, /Granted vanilla bypass pass \$\{request\.requestId\} to player \$\{key\}\./);
    assert.match(source, /this\.serverCraftPasses\.set\(key, \{/);
    assert.doesNotMatch(source, /Registered vanilla bypass permit \$\{request\.requestId\} for player \$\{key\}\./);
});

test("remote multiplayer bypass intercept blocks the original craft while approval is pending", async () => {
    const source = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.match(source, /Intercepted vanilla bypass craft and blocked the original action pending approval\./);
    assert.match(source, /const queued = this\.trySendVanillaBypassPermit\(args\);/);
    assert.match(source, /if \(queued\) \{/);
    assert.match(source, /return false;/);
    assert.doesNotMatch(source, /return this\.trySendVanillaBypassPermit\(args\) \? undefined : false;/);
});

test("shift-held tooltip handlers are shared with bulk and dismantle row builders", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /private bindTooltipRowHandlers\(/);
    assert.match(source, /this\.bindTooltipRowHandlers\(row, item, displayName, !autoExcluded && !isUsedSelection\(\)/);
    assert.match(source, /this\.bindTooltipRowHandlers\(row, item, displayName, \{/);
    assert.match(source, /this\.bindTooltipRowHandlers\(row, item, displayName\);/);
});

test("normal and bulk tabs keep distinct gold and blue identities", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /\.bc-tab-normal \{/);
    assert.match(source, /\.bc-tab-normal\.bc-tab-active \{/);
    assert.match(source, /\.bc-tab-bulk \{/);
    assert.match(source, /\.bc-tab-bulk\.bc-tab-active \{/);
    assert.doesNotMatch(source, /\.bc-tab-btn\.bc-tab-active \{/);
});

test("craft stamina is normalized through the shared helper for bulk and normal craft", async () => {
    const helperSource = await readFile(new URL("../src/craftStamina.ts", import.meta.url), "utf8");
    const dialogSource = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");
    const runtimeSource = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.match(helperSource, /export const STAMINA_COST_PER_LEVEL: Partial<Record<RecipeLevel, number>> = \{/);
    assert.match(helperSource, /export function getCraftStaminaCost\(level: RecipeLevel\): number \{/);
    assert.match(dialogSource, /import \{ getCraftStaminaCost \} from "\.\/craftStamina";/);
    assert.match(runtimeSource, /import \{ getCraftStaminaCost \} from "\.\/src\/craftStamina";/);

    for (const [level, stamina] of [
        ["Simple", 2],
        ["Intermediate", 5],
        ["Advanced", 10],
        ["Expert", 16],
        ["Master", 25],
    ]) {
        assert.match(helperSource, new RegExp(`\\[RecipeLevel\\.${level}\\]:\\s+${stamina}`));
    }

    assert.match(dialogSource, /const staminaCost = getCraftStaminaCost\(this\.recipe\.level\);/);
    assert.match(runtimeSource, /const staminaCost = getCraftStaminaCost\(recipe\.level\);/);
    assert.match(runtimeSource, /if \(this\.panel\?\.isSafeCraftingEnabled\(\) && getCurrentStamina\(\) < staminaCost\) break;/);
    assert.match(dialogSource, /if \(this\.safeCraftingEnabled && currentStamina < staminaCost\) \{/);
});

test("normal craft blocks on low stamina before execution and surfaces a validation error", async () => {
    const dialogSource = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");
    const runtimeSource = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.match(dialogSource, /const staminaCost = getCraftStaminaCost\(this\.recipe\.level\);/);
    assert.match(dialogSource, /if \(this\.safeCraftingEnabled && currentStamina < staminaCost\) \{/);
    assert.match(dialogSource, /this\.showValidationError\(`Need \$\{staminaCost\} stamina to craft \(have \$\{currentStamina\}\)`\);/);
    assert.match(runtimeSource, /const recipe = itemDescriptions\[itemType\]\?\.recipe;/);
    assert.match(runtimeSource, /const staminaCost = getCraftStaminaCost\(recipe\.level\);/);
    assert.match(runtimeSource, /if \(this\.panel\?\.isSafeCraftingEnabled\(\) && getCurrentStamina\(\) < staminaCost\) return;/);
});

test("dismantle safety gates use the safe toggle for stamina only", async () => {
    const source = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.doesNotMatch(source, /isUnsafeCraftingEnabled/);
    assert.doesNotMatch(source, /if \(!this\.panel\?\.isSafeCraftingEnabled\(\)\) return true;/);
    assert.match(source, /getCurrentStamina\(\) < 1/);
    assert.doesNotMatch(source, /DISMANTLE_STAMINA_COST/);
    assert.match(source, /this\.canUseForDismantle\(resolvedRequiredItem, preserveDurability\)/);
});

test("dismantle max calculation separates safe stamina logic from protect durability logic", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /private computeDismantleStaminaMax\(\): number \{/);
    assert.match(source, /const staminaMax = this\.computeDismantleStaminaMax\(\);/);
    assert.match(source, /return Math\.max\(0, Math\.floor\(currentStamina\)\);/);
    assert.doesNotMatch(source, /DISMANTLE_STAMINA_COST/);
    assert.match(source, /const durabilityMax = !this\.dismantleRequiredSelection/);
    assert.match(source, /Math\.max\(0, Math\.min\(targetMax, staminaMax, durabilityMax\)\)/);
    assert.match(source, /this\.hasDismantleStaminaLimit\(\)/);
});

test("dismantle required item is reserved from overlapping target selections", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /private isReservedDismantleRequiredItem\(item: Item\): boolean \{/);
    assert.match(source, /return itemId === requiredItemId;/);
    assert.match(source, /return item === requiredItem;/);
    assert.match(source, /return !this\.isReservedDismantleRequiredItem\(item\)/);
    assert.match(source, /const targets = this\.sanitizeSelectedItems\(this\.getIncludedDismantleItems\(\)\.slice\(0, quantity\)/);
    assert.match(source, /const targets = this\.getIncludedDismantleItems\(\)\.slice\(0, this\.bulkQuantity\);/);
});

test("safe toggle is shown only in bulk footer and refreshes bulk state with safe-on semantics", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /private bulkSafeToggleEl: CheckButton \| null = null;/);
    assert.match(source, /this\.bulkSafeToggleWrap = this\.createSafeToggle/);
    assert.match(source, /label\.textContent = "Safe";/);
    assert.match(source, /toggle\.setChecked\(this\.safeCraftingEnabled, false\);/);
    assert.match(source, /this\.updateBulkMaxDisplay\(\);/);
    assert.match(source, /this\.updateBulkCraftBtnState\(\);/);
    assert.doesNotMatch(source, /private normalSafeToggleEl: CheckButton \| null = null;/);
    assert.doesNotMatch(source, /this\.normalSafeToggleWrap = this\.createSafeToggle/);
});

test("remaining uses are shown for all eligible non-consumed craft rows", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /if \(maxUses >= Number\.MAX_SAFE_INTEGER \|\| maxUses <= 0\) return "";/);
    assert.match(source, /return `uses remaining \$\{maxUses\}`;/);
    assert.match(source, /const usableActions = Math\.ceil\(durability \/ perUseLoss\);/);
    assert.match(source, /this\.appendRemainingUsesHint\(row\.element, item, this\.getCraftDurabilityLoss\(item\), false\);/);
    assert.match(source, /this\.appendRemainingUsesHint\(row\.element, item, this\.getCraftDurabilityLoss\(item\), this\.bulkPreserveDurabilityBySlot\.get\(slotIndex\) \?\? true\);/);
    assert.match(source, /this\.appendRemainingUsesHint\(row\.element, item, this\.getDismantleDurabilityLoss\(item\), this\.preserveDismantleRequiredDurability\);/);
});

test("dismantle runtime and UI share the same preserve-one-use semantics", async () => {
    const source = await readFile(new URL("../betterCrafting.ts", import.meta.url), "utf8");

    assert.match(source, /private getRemainingDurabilityUses\(requiredItem: Item, perUseLoss: number, leaveOneUse: boolean\): number \{/);
    assert.match(source, /const usableActions = Math\.ceil\(durability \/ perUseLoss\);/);
    assert.match(source, /return Math\.max\(0, usableActions - \(leaveOneUse \? 1 : 0\)\);/);
    assert.match(source, /private canUseForDismantle\(requiredItem\?: Item, leaveOneUse = false\): boolean \{/);
});

test("bulk durability limits only preserve one use when Protect remains enabled", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /const preserveDurability = this\.bulkPreserveDurabilityBySlot\.get\(i\) !== false;/);
    assert.match(source, /if \(comp\.consumedAmount > 0\) continue;/);
    assert.match(source, /const pinned = this\.bulkPinnedToolSelections\.get\(slotIndex\) \?\? \[\];/);
    assert.match(source, /if \(pinned\.length > 0\) \{/);
});

test("section filters drive visible item ordering and active reselection", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /private getFilteredSortedSectionItems\(/);
    assert.match(source, /ItemSort\.createSorter\(state\.sort, state\.sortDirection\)/);
    assert.match(source, /private pendingSectionReselectKeys: Set<string> = new Set\(\);/);
    assert.match(source, /this\.selectedItems\.set\(-1, visibleItems\.slice\(0, 1\)\);/);
    assert.match(source, /this\.bulkPinnedToolSelections\.set\(slotIndex, this\.getBulkToolSelection\(slotIndex, visibleItems, requiredAmount/);
    assert.match(source, /this\.dismantleExcludedIds\.clear\(\);/);
});

test("new selections are promoted to the front and selection order is preserved through refresh", async () => {
    const source = await readFile(new URL("../src/BetterCraftingDialog.ts", import.meta.url), "utf8");

    assert.match(source, /selected\.unshift\(item\);/);
    assert.match(source, /target\.unshift\(item\);/);
    assert.match(source, /this\.bulkPinnedUsedSelections\.set\(slotIndex, \[\.\.\.selected\]\);/);
    assert.match(source, /this\._pendingSelectionIds = this\.collectCurrentNormalSelectionIds\(\);/);
    assert.match(source, /this\._pendingSplitSelectionIds = this\.collectCurrentSplitSelectionIds\(\);/);
    assert.doesNotMatch(source, /private scrollRestoreGeneration = 0;/);
    assert.doesNotMatch(source, /setTimeout\(applyRestore, 0\);/);
});
