import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
    OPTIONAL_ROOT_RUNTIME_FILES,
    REQUIRED_ROOT_RUNTIME_FILES,
    collectWhitelistedRuntimeFiles,
    fileExists,
    pathExists,
    stageRuntimeFiles,
} from "./runtime-package.mjs";

const rootDir = process.cwd();
const configPath = path.join(rootDir, "config.toml");
const modJsonPath = path.join(rootDir, "mod.json");

function parseScalar(rawValue) {
    const value = rawValue.trim();

    if (value === "true") return true;
    if (value === "false") return false;

    if (value.startsWith("\"") && value.endsWith("\"")) {
        return value
            .slice(1, -1)
            .replace(/\\\\/g, "\\")
            .replace(/\\\"/g, "\"");
    }

    return value;
}

function parseConfigToml(content) {
    const result = {};
    let currentSection;

    for (const rawLine of content.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const sectionMatch = line.match(/^\[(.+)\]$/u);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            result[currentSection] ??= {};
            continue;
        }

        const keyValueMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/u);
        if (!keyValueMatch || !currentSection) {
            throw new Error(`Invalid config line: ${rawLine}`);
        }

        const [, key, rawValue] = keyValueMatch;
        result[currentSection][key] = parseScalar(rawValue);
    }

    return result;
}



async function main() {
    const config = parseConfigToml(await readFile(configPath, "utf8"));
    const modManifest = JSON.parse(await readFile(modJsonPath, "utf8"));

    const sourceDir = path.resolve(rootDir, String(config.build?.source ?? "."));
    const targetDir = path.resolve(String(config.deploy?.target ?? rootDir));
    const overwrite = config.deploy?.overwrite !== false;
    const cleanTarget = config.deploy?.cleanTarget === true;
    const entryFile = modManifest.file;

    if (typeof entryFile !== "string" || !entryFile) {
        throw new Error("mod.json must contain a non-empty 'file' field.");
    }

    if (!(await pathExists(sourceDir))) {
        throw new Error(`Build source directory does not exist: ${sourceDir}`);
    }

    const entryFilePath = path.join(sourceDir, entryFile);
    if (!(await fileExists(entryFilePath))) {
        throw new Error(`Configured entry file was not found in build output: ${entryFilePath}`);
    }

    await mkdir(targetDir, { recursive: true });

    if (cleanTarget) {
        for (const fileName of [entryFile, ...REQUIRED_ROOT_RUNTIME_FILES, ...OPTIONAL_ROOT_RUNTIME_FILES]) {
            const targetFile = path.join(targetDir, fileName);
            if (await fileExists(targetFile)) {
                await rm(targetFile, { force: true });
            }
        }
    }

    const runtimeFiles = await collectWhitelistedRuntimeFiles(sourceDir, entryFile);
    await stageRuntimeFiles(sourceDir, targetDir, runtimeFiles, overwrite);

    console.log(`Deployment complete: ${targetDir}`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
