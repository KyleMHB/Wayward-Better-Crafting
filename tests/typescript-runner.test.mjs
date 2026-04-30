import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveLocalTypeScriptBin, resolveNpmCommand } from "../scripts/typescript-runner.mjs";

test("resolveNpmCommand uses the platform-specific npm executable", () => {
    assert.equal(resolveNpmCommand("win32"), "npm.cmd");
    assert.equal(resolveNpmCommand("linux"), "npm");
    assert.equal(resolveNpmCommand("darwin"), "npm");
});

test("resolveLocalTypeScriptBin returns undefined when TypeScript is not installed", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "better-crafting-typescript-runner-missing-"));
    await writeFile(path.join(rootDir, "package.json"), "{}");

    assert.equal(resolveLocalTypeScriptBin(rootDir), undefined);

    await rm(rootDir, { recursive: true, force: true });
});

test("resolveLocalTypeScriptBin finds a locally installed TypeScript binary", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "better-crafting-typescript-runner-installed-"));
    await writeFile(path.join(rootDir, "package.json"), "{}");
    await mkdir(path.join(rootDir, "node_modules", "typescript", "bin"), { recursive: true });
    await writeFile(path.join(rootDir, "node_modules", "typescript", "bin", "tsc"), "");

    const resolvedBin = resolveLocalTypeScriptBin(rootDir);
    assert.ok(resolvedBin);
    assert.equal(path.basename(resolvedBin), "tsc");
    assert.ok(resolvedBin.endsWith(path.join("node_modules", "typescript", "bin", "tsc")));

    await rm(rootDir, { recursive: true, force: true });
});
