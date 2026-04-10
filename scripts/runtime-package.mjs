import { copyFile, mkdir, opendir, readFile } from "node:fs/promises";
import path from "node:path";

export const ALLOWED_RUNTIME_EXTENSIONS = new Set([".js", ".json", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".css", ".svg"]);
export const OPTIONAL_ROOT_RUNTIME_FILES = ["mod.png"];
export const REQUIRED_ROOT_RUNTIME_FILES = ["mod.json"];
export const REQUIRED_RUNTIME_DIRECTORIES = ["src"];

export async function pathExists(targetPath) {
    try {
        const directory = await opendir(targetPath);
        await directory.close();
        return true;
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return false;
        }

        throw error;
    }
}

export async function fileExists(targetPath) {
    try {
        await readFile(targetPath);
        return true;
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return false;
        }

        throw error;
    }
}

export async function collectRuntimeFiles(directoryPath, relativeDir = "") {
    const runtimeFiles = [];
    const directory = await opendir(directoryPath);

    for await (const entry of directory) {
        const relativePath = path.join(relativeDir, entry.name);
        const fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
            runtimeFiles.push(...await collectRuntimeFiles(fullPath, relativePath));
            continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_RUNTIME_EXTENSIONS.has(extension)) continue;

        runtimeFiles.push(relativePath);
    }

    return runtimeFiles;
}

export async function collectWhitelistedRuntimeFiles(sourceDir, entryFile) {
    const runtimeFiles = new Set([entryFile]);

    for (const fileName of REQUIRED_ROOT_RUNTIME_FILES) {
        const fullPath = path.join(sourceDir, fileName);
        if (!(await fileExists(fullPath))) {
            throw new Error(`Required runtime file does not exist: ${fullPath}`);
        }

        runtimeFiles.add(fileName);
    }

    for (const fileName of OPTIONAL_ROOT_RUNTIME_FILES) {
        const fullPath = path.join(sourceDir, fileName);
        if (await fileExists(fullPath)) {
            runtimeFiles.add(fileName);
        }
    }

    for (const directoryName of REQUIRED_RUNTIME_DIRECTORIES) {
        const fullPath = path.join(sourceDir, directoryName);
        if (!(await pathExists(fullPath))) {
            throw new Error(`Required runtime directory does not exist: ${fullPath}`);
        }

        const directoryFiles = await collectRuntimeFiles(fullPath, directoryName);
        for (const relativeFile of directoryFiles) {
            runtimeFiles.add(relativeFile);
        }
    }

    return [...runtimeFiles].sort((a, b) => a.localeCompare(b));
}

export async function stageRuntimeFiles(sourceDir, targetDir, runtimeFiles, overwrite = true) {
    await mkdir(targetDir, { recursive: true });

    for (const relativeFile of runtimeFiles) {
        const sourceFile = path.join(sourceDir, relativeFile);
        const targetFile = path.join(targetDir, relativeFile);
        const normalizedSourceFile = path.resolve(sourceFile);
        const normalizedTargetFile = path.resolve(targetFile);

        if (normalizedSourceFile === normalizedTargetFile) {
            console.log(`Skipping ${relativeFile}; source and target are the same path.`);
            continue;
        }

        await mkdir(path.dirname(targetFile), { recursive: true });

        if (!overwrite && await fileExists(targetFile)) {
            throw new Error(`Refusing to overwrite existing file: ${targetFile}`);
        }

        await copyFile(sourceFile, targetFile);
        console.log(`Copied ${relativeFile} -> ${targetFile}`);
    }
}
