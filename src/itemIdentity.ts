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

export function getItemIds<T>(items: readonly T[] | undefined, getId: (item: T) => number | undefined): number[] {
    if (!items) return [];
    return items.map(item => getId(item)).filter((id): id is number => id !== undefined);
}

export function getItemIdSet<T>(items: readonly T[] | undefined, getId: (item: T) => number | undefined): Set<number> {
    return new Set(getItemIds(items, getId));
}
