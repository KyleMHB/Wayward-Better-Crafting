export type ItemIdGetter<T> = (item: T | undefined) => number | undefined;
export interface ISplitSelection<T> {
    consumed: T[];
    used: T[];
}
export declare function sanitizeSelectedItems<T>(items: Array<T | undefined>, getItemId: ItemIdGetter<T>, candidates?: readonly T[], maxCount?: number): T[];
export declare function supplementSelectedItems<T>(selectedItems: readonly T[], candidates: readonly T[], maxCount: number, getItemId: ItemIdGetter<T>): T[];
export declare function filterUnreservedItems<T, R>(items: readonly T[], reservations: ReadonlyMap<number, R>, getItemId: ItemIdGetter<T>, currentRole?: R): T[];
export declare function repairSelectedItemsForRole<T, R>(selectedItems: readonly T[], candidates: readonly T[], maxCount: number, reservations: ReadonlyMap<number, R>, role: R, getItemId: ItemIdGetter<T>, forceTopVisible?: boolean): T[];
export declare function repairSplitSelection<T>(component: {
    requiredAmount: number;
    consumedAmount: number;
}, current: ISplitSelection<T>, usedCandidates: readonly T[], consumedCandidates: readonly T[], getItemId: ItemIdGetter<T>): ISplitSelection<T>;
