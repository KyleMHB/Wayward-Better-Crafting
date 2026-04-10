import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadTranspiledTsModule(relativePath) {
    const filePath = path.resolve(relativePath);
    const source = await readFile(filePath, "utf8");
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
        },
        fileName: filePath,
    });

    const module = { exports: {} };
    const context = {
        module,
        exports: module.exports,
        require(specifier) {
            throw new Error(`Unexpected require in ${relativePath}: ${specifier}`);
        },
    };

    vm.runInNewContext(transpiled.outputText, context, { filename: filePath });
    return module.exports;
}

test("getItemIdSafe returns undefined for stale item identities while strict lookup still throws", async () => {
    const { getItemIdSafe, getValidatedItemId } = await loadTranspiledTsModule("./src/itemIdentity.ts");

    assert.equal(getItemIdSafe(undefined), undefined);
    assert.equal(getItemIdSafe({ id: 42 }), 42);
    assert.equal(getItemIdSafe({ id: "42" }), undefined);
    assert.throws(() => getValidatedItemId({ id: "42" }, "item"), /Expected item\.id to be a finite number/);
});

test("partitionSelectedItems only consumes the consumed subset for partial-consumption slots", async () => {
    const { partitionSelectedItems } = await loadTranspiledTsModule("./src/craftingSelection.ts");
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const partitioned = partitionSelectedItems(items, 2, 1);

    assert.deepEqual(partitioned.required, items.slice(0, 2));
    assert.deepEqual(partitioned.consumed, items.slice(0, 1));
});

test("buildCraftExecutionPayload preserves consumed-first ordering across slots", async () => {
    const { buildCraftExecutionPayload } = await loadTranspiledTsModule("./src/craftingSelection.ts");
    const slotSelections = [
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }],
    ];

    const payload = buildCraftExecutionPayload(slotSelections, (_, slotIndex) => {
        if (slotIndex === 0) {
            return { requiredAmount: 2, consumedAmount: 1 };
        }

        return { requiredAmount: 1, consumedAmount: 0 };
    });

    assert.equal(JSON.stringify(payload.required), JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]));
    assert.equal(JSON.stringify(payload.consumed), JSON.stringify([{ id: 1 }]));
});

test("split-consumption helpers report the consumed and used counts separately", async () => {
    const { getConsumedSelectionCount, getUsedSelectionCount, isSplitConsumption } = await loadTranspiledTsModule("./src/craftingSelection.ts");

    assert.equal(isSplitConsumption(2, 1), true);
    assert.equal(getConsumedSelectionCount(2, 1), 1);
    assert.equal(getUsedSelectionCount(2, 1), 1);
    assert.equal(isSplitConsumption(1, 0), false);
    assert.equal(getConsumedSelectionCount(1, 0), 0);
    assert.equal(getUsedSelectionCount(1, 0), 1);
});

test("filterSelectableItems removes invalid and duplicate item identities", async () => {
    const { filterSelectableItems } = await loadTranspiledTsModule("./src/craftingSelection.ts");
    const items = [
        { id: 10, label: "first" },
        { id: undefined, label: "invalid" },
        { id: 10, label: "duplicate" },
        { id: 11, label: "second" },
    ];

    const filtered = filterSelectableItems(items, item => typeof item.id === "number" ? item.id : undefined);

    assert.equal(
        JSON.stringify(filtered.map(item => ({ id: item.id, label: item.label }))),
        JSON.stringify([
            { id: 10, label: "first" },
            { id: 11, label: "second" },
        ]),
    );
});
