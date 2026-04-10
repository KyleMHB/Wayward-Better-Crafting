import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

export function resolveNpmCommand(platform = process.platform) {
    return platform === "win32" ? "npm.cmd" : "npm";
}

export function resolveLocalTypeScriptBin(cwd = process.cwd()) {
    const requireFromCwd = createRequire(path.join(cwd, "package.json"));

    try {
        return requireFromCwd.resolve("typescript/bin/tsc");
    } catch {
        return undefined;
    }
}

export function runTypeScript(args, options = {}) {
    const { cwd = process.cwd(), stdio = "inherit" } = options;
    const localTypeScriptBin = resolveLocalTypeScriptBin(cwd);

    if (localTypeScriptBin) {
        return new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [localTypeScriptBin, ...args], {
                cwd,
                stdio,
                shell: false,
            });

            child.on("error", reject);
            child.on("exit", code => {
                if (code === 0) {
                    resolve();
                    return;
                }

                reject(new Error(`TypeScript exited with code ${code ?? "unknown"}`));
            });
        });
    }

    const npmCommand = resolveNpmCommand();

    return new Promise((resolve, reject) => {
        const child = spawn(npmCommand, ["exec", "--yes", "--package", "typescript", "--", "tsc", ...args], {
            cwd,
            stdio,
            shell: false,
        });

        child.on("error", reject);
        child.on("exit", code => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`TypeScript exited with code ${code ?? "unknown"}`));
        });
    });
}
