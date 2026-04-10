type ItemWithId = {
    id?: unknown;
};

export function getItemIdSafe(item: ItemWithId | undefined): number | undefined {
    if (!item) return undefined;

    const { id } = item;
    return typeof id === "number" && Number.isFinite(id) ? id : undefined;
}

export function getValidatedItemId(item: ItemWithId | undefined, context = "item"): number | undefined {
    const id = getItemIdSafe(item);
    if (item && id === undefined) {
        throw new Error(`[Better Crafting] Expected ${context}.id to be a finite number.`);
    }

    return id;
}
