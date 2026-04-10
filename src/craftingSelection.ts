export interface IPartitionedSelection<T> {
    required: T[];
    consumed: T[];
}

export interface ICraftExecutionPayload<T> {
    required: T[];
    consumed: T[];
}

export function isSplitConsumption(requiredAmount: number, consumedAmount: number): boolean {
    return consumedAmount > 0 && requiredAmount > consumedAmount;
}

export function filterSelectableItems<T>(items: readonly T[], getId: (item: T) => number | undefined): T[] {
    const seenIds = new Set<number>();
    const filtered: T[] = [];

    for (const item of items) {
        const itemId = getId(item);
        if (itemId === undefined || seenIds.has(itemId)) continue;

        seenIds.add(itemId);
        filtered.push(item);
    }

    return filtered;
}

export function getConsumedSelectionCount(requiredAmount: number, consumedAmount: number): number {
    if (consumedAmount <= 0) return 0;
    return Math.min(requiredAmount, consumedAmount);
}

export function getUsedSelectionCount(requiredAmount: number, consumedAmount: number): number {
    return Math.max(0, requiredAmount - getConsumedSelectionCount(requiredAmount, consumedAmount));
}

export function partitionSelectedItems<T>(
    items: readonly T[],
    requiredAmount: number,
    consumedAmount: number,
): IPartitionedSelection<T> {
    const required = items.slice(0, requiredAmount);
    const consumedCount = Math.min(required.length, getConsumedSelectionCount(requiredAmount, consumedAmount));

    return {
        required,
        consumed: required.slice(0, consumedCount),
    };
}

export function buildCraftExecutionPayload<T>(
    selections: Iterable<readonly T[]>,
    getCounts: (selection: readonly T[], slotIndex: number) => { requiredAmount: number; consumedAmount: number },
): ICraftExecutionPayload<T> {
    const required: T[] = [];
    const consumed: T[] = [];

    let slotIndex = 0;
    for (const selection of selections) {
        const { requiredAmount, consumedAmount } = getCounts(selection, slotIndex);
        const partitioned = partitionSelectedItems(selection, requiredAmount, consumedAmount);
        required.push(...partitioned.required);
        consumed.push(...partitioned.consumed);
        slotIndex++;
    }

    return {
        required: [...required],
        consumed: [...consumed],
    };
}
