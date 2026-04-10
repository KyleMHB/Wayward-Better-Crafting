type ItemWithId = {
    id?: unknown;
};
export declare function getItemIdSafe(item: ItemWithId | undefined): number | undefined;
export declare function getValidatedItemId(item: ItemWithId | undefined, context?: string): number | undefined;
export {};
