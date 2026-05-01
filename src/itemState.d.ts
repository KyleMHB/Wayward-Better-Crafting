type ItemProtectionState = {
    isProtected?: unknown;
    protected?: unknown;
};
type ItemDurabilityState = {
    durability?: number;
    description?: {
        damageOnUse?: Record<number, number | undefined>;
    };
    getDamageModifier?: () => number | undefined;
};
export declare function isItemProtected(item: ItemProtectionState): boolean;
export declare function getCraftDurabilityLoss(item: ItemDurabilityState): number;
export declare function getDismantleDurabilityLoss(item: ItemDurabilityState, dismantleActionType: number): number;
export declare function getRemainingDurabilityUses(durability: number | undefined, perUseLoss: number, leaveOneUse: boolean): number;
export declare function canUseDurability(durability: number | undefined, perUseLoss: number, leaveOneUse: boolean): boolean;
export {};
