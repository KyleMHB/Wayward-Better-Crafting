define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getItemIdSafe = getItemIdSafe;
    exports.getValidatedItemId = getValidatedItemId;
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlbUlkZW50aXR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaXRlbUlkZW50aXR5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztJQUlBLHNDQUtDO0lBRUQsZ0RBT0M7SUFkRCxTQUFnQixhQUFhLENBQUMsSUFBNEI7UUFDdEQsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLFNBQVMsQ0FBQztRQUU1QixNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLE9BQU8sT0FBTyxFQUFFLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzFFLENBQUM7SUFFRCxTQUFnQixrQkFBa0IsQ0FBQyxJQUE0QixFQUFFLE9BQU8sR0FBRyxNQUFNO1FBQzdFLE1BQU0sRUFBRSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvQixJQUFJLElBQUksSUFBSSxFQUFFLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDM0IsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsT0FBTyw0QkFBNEIsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFFRCxPQUFPLEVBQUUsQ0FBQztJQUNkLENBQUMifQ==