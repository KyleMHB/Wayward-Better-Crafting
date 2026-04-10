export interface IPartitionedSelection<T> {
    required: T[];
    consumed: T[];
}
export interface ICraftExecutionPayload<T> {
    required: T[];
    consumed: T[];
}
export declare function isSplitConsumption(requiredAmount: number, consumedAmount: number): boolean;
export declare function filterSelectableItems<T>(items: readonly T[], getId: (item: T) => number | undefined): T[];
export declare function getConsumedSelectionCount(requiredAmount: number, consumedAmount: number): number;
export declare function getUsedSelectionCount(requiredAmount: number, consumedAmount: number): number;
export declare function partitionSelectedItems<T>(items: readonly T[], requiredAmount: number, consumedAmount: number): IPartitionedSelection<T>;
export declare function buildCraftExecutionPayload<T>(selections: Iterable<readonly T[]>, getCounts: (selection: readonly T[], slotIndex: number) => {
    requiredAmount: number;
    consumedAmount: number;
}): ICraftExecutionPayload<T>;
