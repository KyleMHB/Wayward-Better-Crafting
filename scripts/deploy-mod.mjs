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
import { syncModVersion } from "./sync-version.mjs";

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

function parseArray(rawValue) {
    const value = rawValue.trim();
    if (!value.startsWith("[") || !value.endsWith("]")) {
        throw new Error(`Invalid array value: ${rawValue}`);
    }

    const inner = value.slice(1, -1).trim();
    if (!inner) return [];

    const items = [];
    let current = "";
    let inString = false;
    let escaping = false;

    for (const character of inner) {
        if (escaping) {
            current += character;
            escaping = false;
            continue;
        }

        if (character === "\\") {
            current += character;
            escaping = true;
            continue;
        }

        if (character === "\"") {
            current += character;
            inString = !inString;
            continue;
        }

        if (character === "," && !inString) {
            items.push(parseScalar(current));
            current = "";
            continue;
        }

        current += character;
    }

    if (current.trim()) {
        items.push(parseScalar(current));
    }

    return items;
}

function parseValue(rawValue) {
    const value = rawValue.trim();
    return value.startsWith("[") ? parseArray(value) : parseScalar(value);
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
        result[currentSection][key] = parseValue(rawValue);
    }

    return result;
}

function getDeployTargets(config, fallbackTarget) {
    const rawTargets = config.deploy?.targets;
    if (rawTargets !== undefined) {
        if (!Array.isArray(rawTargets)) {
            throw new Error("config.toml deploy.targets must be an array.");
        }

        const targets = rawTargets
            .map(target => String(target).trim())
            .filter(target => target.length > 0)
            .map(target => path.resolve(target));

        if (targets.length === 0) {
            throw new Error("config.toml deploy.targets must contain at least one non-empty target path.");
        }

        const uniqueTargets = [...new Set(targets)];
        if (uniqueTargets.length !== targets.length) {
            throw new Error("config.toml deploy.targets contains duplicate target paths.");
        }

        return uniqueTargets;
    }

    const target = String(config.deploy?.target ?? fallbackTarget).trim();
    if (!target) {
        throw new Error("config.toml deploy.target must contain a non-empty target path.");
    }

    return [path.resolve(target)];
}



async function main() {
    await syncModVersion(rootDir);
    const config = parseConfigToml(await readFile(configPath, "utf8"));
    const modManifest = JSON.parse(await readFile(modJsonPath, "utf8"));

    const sourceDir = path.resolve(rootDir, String(config.build?.source ?? "."));
    const targetDirs = getDeployTargets(config, rootDir);
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

    const runtimeFiles = await collectWhitelistedRuntimeFiles(sourceDir, entryFile);

    for (const targetDir of targetDirs) {
        await mkdir(targetDir, { recursive: true });

        if (cleanTarget) {
            for (const fileName of [entryFile, ...REQUIRED_ROOT_RUNTIME_FILES, ...OPTIONAL_ROOT_RUNTIME_FILES]) {
                const targetFile = path.join(targetDir, fileName);
                if (await fileExists(targetFile)) {
                    await rm(targetFile, { force: true });
                }
            }
        }

        await stageRuntimeFiles(sourceDir, targetDir, runtimeFiles, overwrite);
        console.log(`Deployment complete: ${targetDir}`);
    }

    console.log(`Deployment complete for ${targetDirs.length} target(s): ${targetDirs.join(", ")}`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
