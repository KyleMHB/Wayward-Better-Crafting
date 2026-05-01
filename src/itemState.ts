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

export function isItemProtected(item: ItemProtectionState): boolean {
    return item.isProtected === true || item.protected === true;
}

export function getCraftDurabilityLoss(item: ItemDurabilityState): number {
    return Math.max(0, item.getDamageModifier?.() ?? 0);
}

export function getDismantleDurabilityLoss(item: ItemDurabilityState, dismantleActionType: number): number {
    return Math.max(0, item.description?.damageOnUse?.[dismantleActionType] ?? item.getDamageModifier?.() ?? 0);
}

export function getRemainingDurabilityUses(
    durability: number | undefined,
    perUseLoss: number,
    leaveOneUse: boolean,
): number {
    if (perUseLoss <= 0) return Number.MAX_SAFE_INTEGER;
    if (durability === undefined || durability <= 0) return 0;

    const usableActions = Math.ceil(durability / perUseLoss);
    return Math.max(0, usableActions - (leaveOneUse ? 1 : 0));
}

export function canUseDurability(
    durability: number | undefined,
    perUseLoss: number,
    leaveOneUse: boolean,
): boolean {
    return getRemainingDurabilityUses(durability, perUseLoss, leaveOneUse) > 0;
}
