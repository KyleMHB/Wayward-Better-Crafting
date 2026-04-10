import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { syncModVersion } from "../scripts/sync-version.mjs";

async function writeWorkspace(rootDir, packageJson, modJson) {
    await writeFile(path.join(rootDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
    await writeFile(path.join(rootDir, "mod.json"), `${JSON.stringify(modJson, null, "\t")}\n`);
}

test("syncModVersion updates mod.json when package.json version differs", async () => {
    const rootDir = await mkdtemp(path.join("/tmp", "better-crafting-sync-version-"));
    await writeWorkspace(
        rootDir,
        { name: "Better Crafting", version: "1.7.1" },
        { name: "Better Crafting", version: "1.7.0" },
    );

    const result = await syncModVersion(rootDir);
    const modJson = JSON.parse(await readFile(path.join(rootDir, "mod.json"), "utf8"));

    assert.equal(result.updated, true);
    assert.equal(result.version, "1.7.1");
    assert.equal(modJson.version, "1.7.1");

    await rm(rootDir, { recursive: true, force: true });
});

test("syncModVersion leaves mod.json unchanged when already synced", async () => {
    const rootDir = await mkdtemp(path.join("/tmp", "better-crafting-sync-version-"));
    await writeWorkspace(
        rootDir,
        { name: "Better Crafting", version: "1.7.0" },
        { name: "Better Crafting", version: "1.7.0" },
    );

    const before = await readFile(path.join(rootDir, "mod.json"), "utf8");
    const result = await syncModVersion(rootDir);
    const after = await readFile(path.join(rootDir, "mod.json"), "utf8");

    assert.equal(result.updated, false);
    assert.equal(after, before);

    await rm(rootDir, { recursive: true, force: true });
});

test("syncModVersion fails when package.json version is missing", async () => {
    const rootDir = await mkdtemp(path.join("/tmp", "better-crafting-sync-version-"));
    await writeWorkspace(
        rootDir,
        { name: "Better Crafting" },
        { name: "Better Crafting", version: "1.7.0" },
    );

    await assert.rejects(
        () => syncModVersion(rootDir),
        /package\.json version must be a non-empty semver string\./u,
    );

    await rm(rootDir, { recursive: true, force: true });
});
