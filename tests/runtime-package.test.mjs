import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectWhitelistedRuntimeFiles } from "../scripts/runtime-package.mjs";

test("collectWhitelistedRuntimeFiles includes runtime assets and skips non-runtime files", async () => {
    const rootDir = await mkdtemp(path.join("/tmp", "better-crafting-runtime-"));

    await mkdir(path.join(rootDir, "src"), { recursive: true });
    await writeFile(path.join(rootDir, "mod.json"), "{}");
    await writeFile(path.join(rootDir, "mod.png"), "png");
    await writeFile(path.join(rootDir, "betterCrafting.js"), "entry");
    await writeFile(path.join(rootDir, "src", "BetterCraftingDialog.js"), "dialog");
    await writeFile(path.join(rootDir, "src", "BetterCraftingDialog.css"), "styles");
    await writeFile(path.join(rootDir, "src", "notes.txt"), "ignore me");

    const runtimeFiles = await collectWhitelistedRuntimeFiles(rootDir, "betterCrafting.js");

    assert.deepEqual(runtimeFiles, [
        "betterCrafting.js",
        "mod.json",
        "mod.png",
        "src/BetterCraftingDialog.css",
        "src/BetterCraftingDialog.js",
    ]);

    await rm(rootDir, { recursive: true, force: true });
});
