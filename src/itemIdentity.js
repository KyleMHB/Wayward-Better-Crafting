define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getItemIdSafe = getItemIdSafe;
    exports.getValidatedItemId = getValidatedItemId;
    exports.getItemIds = getItemIds;
    exports.getItemIdSet = getItemIdSet;
    function getItemIdSafe(item) {
        if (!item)
            return undefined;
        const { id } = item;
        return typeof id === "number" && Number.isFinite(id) ? id : undefined;
    }
    function getValidatedItemId(item, context = "item") {
        const id = getItemIdSafe(item);
        if (item && id === undefined) {
            throw new Error(`[Better Crafting] Expected ${context}.id to be a finite number.`);
        }
        return id;
    }
    function getItemIds(items, getId) {
        if (!items)
            return [];
        return items.map(item => getId(item)).filter((id) => id !== undefined);
    }
    function getItemIdSet(items, getId) {
        return new Set(getItemIds(items, getId));
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlbUlkZW50aXR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaXRlbUlkZW50aXR5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztJQUlBLHNDQUtDO0lBRUQsZ0RBT0M7SUFFRCxnQ0FHQztJQUVELG9DQUVDO0lBdkJELFNBQWdCLGFBQWEsQ0FBQyxJQUE0QjtRQUN0RCxJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sU0FBUyxDQUFDO1FBRTVCLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDcEIsT0FBTyxPQUFPLEVBQUUsS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDMUUsQ0FBQztJQUVELFNBQWdCLGtCQUFrQixDQUFDLElBQTRCLEVBQUUsT0FBTyxHQUFHLE1BQU07UUFDN0UsTUFBTSxFQUFFLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9CLElBQUksSUFBSSxJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixPQUFPLDRCQUE0QixDQUFDLENBQUM7UUFDdkYsQ0FBQztRQUVELE9BQU8sRUFBRSxDQUFDO0lBQ2QsQ0FBQztJQUVELFNBQWdCLFVBQVUsQ0FBSSxLQUErQixFQUFFLEtBQXNDO1FBQ2pHLElBQUksQ0FBQyxLQUFLO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDdEIsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFnQixFQUFFLENBQUMsRUFBRSxLQUFLLFNBQVMsQ0FBQyxDQUFDO0lBQ3pGLENBQUM7SUFFRCxTQUFnQixZQUFZLENBQUksS0FBK0IsRUFBRSxLQUFzQztRQUNuRyxPQUFPLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUM3QyxDQUFDIn0=