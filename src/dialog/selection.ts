import {
    getConsumedSelectionCount,
    getUsedSelectionCount,
} from "../craftingSelection";

export type ItemIdGetter<T> = (item: T | undefined) => number | undefined;

export interface ISplitSelection<T> {
    consumed: T[];
    used: T[];
}

export function sanitizeSelectedItems<T>(
    items: Array<T | undefined>,
    getItemId: ItemIdGetter<T>,
    candidates?: readonly T[],
    maxCount?: number,
): T[] {
    const candidateIds = candidates ? new Set(candidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined)) : undefined;
    const seenIds = new Set<number>();
    const sanitized: T[] = [];

    for (const item of items) {
        const itemId = getItemId(item);
        if (!item || itemId === undefined || seenIds.has(itemId)) continue;
        if (candidateIds && !candidateIds.has(itemId)) continue;
        sanitized.push(item);
        seenIds.add(itemId);
        if (maxCount !== undefined && sanitized.length >= maxCount) break;
    }

    return sanitized;
}

export function supplementSelectedItems<T>(
    selectedItems: readonly T[],
    candidates: readonly T[],
    maxCount: number,
    getItemId: ItemIdGetter<T>,
): T[] {
    if (selectedItems.length >= maxCount) return selectedItems.slice(0, maxCount);

    const selectedIds = new Set(selectedItems.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
    const supplemented = [...selectedItems];

    for (const item of candidates) {
        const itemId = getItemId(item);
        if (itemId !== undefined && selectedIds.has(itemId)) continue;

        supplemented.push(item);
        if (itemId !== undefined) selectedIds.add(itemId);
        if (supplemented.length >= maxCount) break;
    }

    return supplemented;
}

export function filterUnreservedItems<T, R>(
    items: readonly T[],
    reservations: ReadonlyMap<number, R>,
    getItemId: ItemIdGetter<T>,
    currentRole?: R,
): T[] {
    return items.filter(item => {
        const itemId = getItemId(item);
        if (itemId === undefined) return true;
        const reservedRole = reservations.get(itemId);
        return reservedRole === undefined || reservedRole === currentRole;
    });
}

export function repairSelectedItemsForRole<T, R>(
    selectedItems: readonly T[],
    candidates: readonly T[],
    maxCount: number,
    reservations: ReadonlyMap<number, R>,
    role: R,
    getItemId: ItemIdGetter<T>,
    forceTopVisible = false,
): T[] {
    const selectableCandidates = filterUnreservedItems(candidates, reservations, getItemId, role);
    if (forceTopVisible) return selectableCandidates.slice(0, maxCount);

    const candidateValidSelection = sanitizeSelectedItems([...selectedItems], getItemId, candidates, maxCount);
    const repairedSelection = sanitizeSelectedItems([...selectedItems], getItemId, selectableCandidates, maxCount);
    if (repairedSelection.length < candidateValidSelection.length) {
        return supplementSelectedItems(repairedSelection, selectableCandidates, maxCount, getItemId);
    }

    return repairedSelection;
}

export function repairSplitSelection<T>(
    component: { requiredAmount: number; consumedAmount: number },
    current: ISplitSelection<T>,
    usedCandidates: readonly T[],
    consumedCandidates: readonly T[],
    getItemId: ItemIdGetter<T>,
): ISplitSelection<T> {
    const consumedCount = getConsumedSelectionCount(component.requiredAmount, component.consumedAmount);
    const usedCount = getUsedSelectionCount(component.requiredAmount, component.consumedAmount);
    const used = sanitizeSelectedItems(current.used, getItemId, usedCandidates, usedCount);
    const repairedUsed = supplementSelectedItems(used, usedCandidates, usedCount, getItemId);
    const repairedUsedIds = new Set(repairedUsed.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
    const availableConsumedCandidates = consumedCandidates.filter(item => {
        const itemId = getItemId(item);
        return itemId === undefined || !repairedUsedIds.has(itemId);
    });
    const consumed = sanitizeSelectedItems(current.consumed, getItemId, availableConsumedCandidates, consumedCount);
    const repairedConsumed = supplementSelectedItems(consumed, availableConsumedCandidates, consumedCount, getItemId);

    return {
        consumed: repairedConsumed,
        used: repairedUsed,
    };
}
