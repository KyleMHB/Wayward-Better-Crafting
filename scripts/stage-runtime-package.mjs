import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { collectWhitelistedRuntimeFiles, fileExists, pathExists, stageRuntimeFiles } from "./runtime-package.mjs";

const rootDir = process.cwd();
const modJsonPath = path.join(rootDir, "mod.json");
const stagingRoot = path.join(rootDir, "dist");
const stagingDir = path.join(stagingRoot, "package");

function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn("cmd.exe", ["/d", "/s", "/c", command, ...args], {
            cwd: rootDir,
            stdio: "inherit",
            shell: false,
        });

        child.on("error", reject);
        child.on("exit", code => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
        });
    });
}

async function main() {
    const modManifest = JSON.parse(await readFile(modJsonPath, "utf8"));
    const entryFile = modManifest.file;

    if (typeof entryFile !== "string" || !entryFile) {
        throw new Error("mod.json must contain a non-empty 'file' field.");
    }

    if (!(await pathExists(rootDir))) {
        throw new Error(`Build source directory does not exist: ${rootDir}`);
    }

    await runCommand("npm.cmd", ["exec", "--yes", "--package", "typescript", "--", "tsc", "-p", "tsconfig.json"]);

    const entryFilePath = path.join(rootDir, entryFile);
    if (!(await fileExists(entryFilePath))) {
        throw new Error(`Configured entry file was not found in build output: ${entryFilePath}`);
    }

    await mkdir(stagingRoot, { recursive: true });
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });

    const runtimeFiles = await collectWhitelistedRuntimeFiles(rootDir, entryFile);
    await stageRuntimeFiles(rootDir, stagingDir, runtimeFiles, true);

    console.log(`Runtime package staged: ${stagingDir}`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
