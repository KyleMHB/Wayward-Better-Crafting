import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

export function validateVersion(version) {
    if (typeof version !== "string" || !SEMVER_PATTERN.test(version)) {
        throw new Error("package.json version must be a non-empty semver string.");
    }

    return version;
}

export async function readJson(jsonPath) {
    const content = await readFile(jsonPath, "utf8");
    return JSON.parse(content);
}

export async function syncModVersion(rootDir = process.cwd()) {
    const packageJsonPath = path.join(rootDir, "package.json");
    const modJsonPath = path.join(rootDir, "mod.json");

    const packageJson = await readJson(packageJsonPath);
    const modJson = await readJson(modJsonPath);

    const version = validateVersion(packageJson.version);

    if (typeof modJson.version !== "string" || modJson.version.length === 0) {
        throw new Error("mod.json version must be a non-empty string.");
    }

    if (modJson.version === version) {
        return { updated: false, version };
    }

    modJson.version = version;
    await writeFile(modJsonPath, `${JSON.stringify(modJson, null, "\t")}\n`);
    return { updated: true, version };
}

async function main() {
    const result = await syncModVersion();
    if (result.updated) {
        console.log(`Synced mod.json version to ${result.version}`);
    } else {
        console.log(`mod.json version already synced at ${result.version}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
