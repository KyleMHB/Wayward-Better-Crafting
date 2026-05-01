import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const stubs = {
    "@wayward/game/game/IObject": {
        Quality: {
            None: 0,
            Random: 1,
            Superior: 2,
            Remarkable: 3,
            Exceptional: 4,
            Mastercrafted: 5,
            Relic: 6,
            0: "None",
            1: "Random",
            2: "Superior",
            3: "Remarkable",
            4: "Exceptional",
            5: "Mastercrafted",
            6: "Relic",
        },
    },
    "@wayward/game/game/item/IItem": {
        ContainerSort: {
            Recent: 0,
            Name: 1,
            Weight: 2,
            Group: 3,
            Durability: 4,
            Quality: 5,
            Magical: 6,
            Decay: 7,
            Worth: 8,
            BestForCrafting: 9,
        },
    },
    "@wayward/game/save/ISaveManager": {
        SortDirection: {
            Ascending: 0,
            Descending: 1,
        },
    },
};

async function loadTranspiledTsModule(relativePath, cache = new Map()) {
    const filePath = path.resolve(relativePath);
    if (cache.has(filePath)) return cache.get(filePath).exports;

    const source = await readFile(filePath, "utf8");
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
        },
        fileName: filePath,
    });

    const module = { exports: {} };
    cache.set(filePath, module);
    const context = {
        module,
        exports: module.exports,
        require(specifier) {
            if (stubs[specifier]) return stubs[specifier];
            if (specifier.startsWith(".")) {
                const resolvedPath = path.resolve(path.dirname(filePath), `${specifier}.ts`);
                const localModule = cache.get(resolvedPath);
                if (localModule) return localModule.exports;
                throw new Error(`Local module ${resolvedPath} must be preloaded before ${relativePath}`);
            }
            throw new Error(`Unexpected require in ${relativePath}: ${specifier}`);
        },
    };

    vm.runInNewContext(transpiled.outputText, context, { filename: filePath });
    return module.exports;
}

async function loadDialogModules() {
    const cache = new Map();
    await loadTranspiledTsModule("./src/craftingSelection.ts", cache);
    await loadTranspiledTsModule("./src/dialog/theme.ts", cache);
    const sort = await loadTranspiledTsModule("./src/dialog/sort.ts", cache);
    const selection = await loadTranspiledTsModule("./src/dialog/selection.ts", cache);
    return { sort, selection, theme: cache.get(path.resolve("./src/dialog/theme.ts")).exports };
}

test("dialog sort helpers expose quality color fallback and direction-aware comparison", async () => {
    const { sort } = await loadDialogModules();

    assert.equal(sort.getQualityColor(6), "#ffd700");
    assert.equal(sort.getQualityColor(999), "#e0d0b0");
    assert.equal(sort.getQualityName(4), "Exceptional");
    assert.equal(sort.getQualityName(0), "");
    assert.equal(sort.qualitySortKey(1), 0);
    assert.equal(Math.sign(sort.compareQuality({ quality: 6 }, { quality: 2 }, 1)), -1);
    assert.equal(Math.sign(sort.compareQuality({ quality: 6 }, { quality: 2 }, 0)), 1);
});

test("dialog selection helpers repair split selections without duplicate consumed and used ids", async () => {
    const { selection } = await loadDialogModules();
    const getId = item => item?.id;
    const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const repaired = selection.repairSplitSelection(
        { requiredAmount: 2, consumedAmount: 1 },
        { consumed: [{ id: 1 }], used: [{ id: 1 }] },
        candidates,
        candidates,
        getId,
    );

    assert.equal(JSON.stringify(repaired.used.map(getId)), JSON.stringify([1]));
    assert.equal(JSON.stringify(repaired.consumed.map(getId)), JSON.stringify([2]));
});

test("dialog selection helpers sanitize and supplement stale or duplicate item ids", async () => {
    const { selection } = await loadDialogModules();
    const getId = item => item?.id;
    const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];

    assert.equal(
        JSON.stringify(selection.sanitizeSelectedItems([{ id: 1 }, { id: 1 }, { id: 9 }, undefined], getId, candidates, 3).map(getId)),
        JSON.stringify([1]),
    );
    assert.equal(
        JSON.stringify(selection.supplementSelectedItems([{ id: 1 }], candidates, 3, getId).map(getId)),
        JSON.stringify([1, 2, 3]),
    );
});
