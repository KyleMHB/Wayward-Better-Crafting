define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isItemProtected = isItemProtected;
    exports.getCraftDurabilityLoss = getCraftDurabilityLoss;
    exports.getDismantleDurabilityLoss = getDismantleDurabilityLoss;
    exports.getRemainingDurabilityUses = getRemainingDurabilityUses;
    exports.canUseDurability = canUseDurability;
    function isItemProtected(item) {
        return item.isProtected === true || item.protected === true;
    }
    function getCraftDurabilityLoss(item) {
        return Math.max(0, item.getDamageModifier?.() ?? 0);
    }
    function getDismantleDurabilityLoss(item, dismantleActionType) {
        return Math.max(0, item.description?.damageOnUse?.[dismantleActionType] ?? item.getDamageModifier?.() ?? 0);
    }
    function getRemainingDurabilityUses(durability, perUseLoss, leaveOneUse) {
        if (perUseLoss <= 0)
            return Number.MAX_SAFE_INTEGER;
        if (durability === undefined || durability <= 0)
            return 0;
        const usableActions = Math.ceil(durability / perUseLoss);
        return Math.max(0, usableActions - (leaveOneUse ? 1 : 0));
    }
    function canUseDurability(durability, perUseLoss, leaveOneUse) {
        return getRemainingDurabilityUses(durability, perUseLoss, leaveOneUse) > 0;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlbVN0YXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaXRlbVN0YXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztJQWFBLDBDQUVDO0lBRUQsd0RBRUM7SUFFRCxnRUFFQztJQUVELGdFQVVDO0lBRUQsNENBTUM7SUE5QkQsU0FBZ0IsZUFBZSxDQUFDLElBQXlCO1FBQ3JELE9BQU8sSUFBSSxDQUFDLFdBQVcsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLENBQUM7SUFDaEUsQ0FBQztJQUVELFNBQWdCLHNCQUFzQixDQUFDLElBQXlCO1FBQzVELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQsU0FBZ0IsMEJBQTBCLENBQUMsSUFBeUIsRUFBRSxtQkFBMkI7UUFDN0YsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoSCxDQUFDO0lBRUQsU0FBZ0IsMEJBQTBCLENBQ3RDLFVBQThCLEVBQzlCLFVBQWtCLEVBQ2xCLFdBQW9CO1FBRXBCLElBQUksVUFBVSxJQUFJLENBQUM7WUFBRSxPQUFPLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztRQUNwRCxJQUFJLFVBQVUsS0FBSyxTQUFTLElBQUksVUFBVSxJQUFJLENBQUM7WUFBRSxPQUFPLENBQUMsQ0FBQztRQUUxRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQztRQUN6RCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGFBQWEsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFRCxTQUFnQixnQkFBZ0IsQ0FDNUIsVUFBOEIsRUFDOUIsVUFBa0IsRUFDbEIsV0FBb0I7UUFFcEIsT0FBTywwQkFBMEIsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMvRSxDQUFDIn0=