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
