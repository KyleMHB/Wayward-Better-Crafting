type ItemWithId = {
    id?: unknown;
};
export declare function getItemIdSafe(item: ItemWithId | undefined): number | undefined;
export declare function getValidatedItemId(item: ItemWithId | undefined, context?: string): number | undefined;
export declare function getItemIds<T>(items: readonly T[] | undefined, getId: (item: T) => number | undefined): number[];
export declare function getItemIdSet<T>(items: readonly T[] | undefined, getId: (item: T) => number | undefined): Set<number>;
export {};
