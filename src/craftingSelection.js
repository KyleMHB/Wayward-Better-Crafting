define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isSplitConsumption = isSplitConsumption;
    exports.filterSelectableItems = filterSelectableItems;
    exports.getConsumedSelectionCount = getConsumedSelectionCount;
    exports.getUsedSelectionCount = getUsedSelectionCount;
    exports.partitionSelectedItems = partitionSelectedItems;
    exports.buildCraftExecutionPayload = buildCraftExecutionPayload;
    function isSplitConsumption(requiredAmount, consumedAmount) {
        return consumedAmount > 0 && requiredAmount > consumedAmount;
    }
    function filterSelectableItems(items, getId) {
        const seenIds = new Set();
        const filtered = [];
        for (const item of items) {
            const itemId = getId(item);
            if (itemId === undefined || seenIds.has(itemId))
                continue;
            seenIds.add(itemId);
            filtered.push(item);
        }
        return filtered;
    }
    function getConsumedSelectionCount(requiredAmount, consumedAmount) {
        if (consumedAmount <= 0)
            return 0;
        return Math.min(requiredAmount, consumedAmount);
    }
    function getUsedSelectionCount(requiredAmount, consumedAmount) {
        return Math.max(0, requiredAmount - getConsumedSelectionCount(requiredAmount, consumedAmount));
    }
    function partitionSelectedItems(items, requiredAmount, consumedAmount) {
        const required = items.slice(0, requiredAmount);
        const consumedCount = Math.min(required.length, getConsumedSelectionCount(requiredAmount, consumedAmount));
        return {
            required,
            consumed: required.slice(0, consumedCount),
        };
    }
    function buildCraftExecutionPayload(selections, getCounts) {
        const required = [];
        const consumed = [];
        let slotIndex = 0;
        for (const selection of selections) {
            const { requiredAmount, consumedAmount } = getCounts(selection, slotIndex);
            const partitioned = partitionSelectedItems(selection, requiredAmount, consumedAmount);
            required.push(...partitioned.required);
            consumed.push(...partitioned.consumed);
            slotIndex++;
        }
        return {
            required: [...required],
            consumed: [...consumed],
        };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JhZnRpbmdTZWxlY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjcmFmdGluZ1NlbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7SUFVQSxnREFFQztJQUVELHNEQWFDO0lBRUQsOERBR0M7SUFFRCxzREFFQztJQUVELHdEQVlDO0lBRUQsZ0VBb0JDO0lBOURELFNBQWdCLGtCQUFrQixDQUFDLGNBQXNCLEVBQUUsY0FBc0I7UUFDN0UsT0FBTyxjQUFjLEdBQUcsQ0FBQyxJQUFJLGNBQWMsR0FBRyxjQUFjLENBQUM7SUFDakUsQ0FBQztJQUVELFNBQWdCLHFCQUFxQixDQUFJLEtBQW1CLEVBQUUsS0FBc0M7UUFDaEcsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUNsQyxNQUFNLFFBQVEsR0FBUSxFQUFFLENBQUM7UUFFekIsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUN2QixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDM0IsSUFBSSxNQUFNLEtBQUssU0FBUyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO2dCQUFFLFNBQVM7WUFFMUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNwQixRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hCLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNwQixDQUFDO0lBRUQsU0FBZ0IseUJBQXlCLENBQUMsY0FBc0IsRUFBRSxjQUFzQjtRQUNwRixJQUFJLGNBQWMsSUFBSSxDQUFDO1lBQUUsT0FBTyxDQUFDLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRUQsU0FBZ0IscUJBQXFCLENBQUMsY0FBc0IsRUFBRSxjQUFzQjtRQUNoRixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBRUQsU0FBZ0Isc0JBQXNCLENBQ2xDLEtBQW1CLEVBQ25CLGNBQXNCLEVBQ3RCLGNBQXNCO1FBRXRCLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ2hELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSx5QkFBeUIsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUUzRyxPQUFPO1lBQ0gsUUFBUTtZQUNSLFFBQVEsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUM7U0FDN0MsQ0FBQztJQUNOLENBQUM7SUFFRCxTQUFnQiwwQkFBMEIsQ0FDdEMsVUFBa0MsRUFDbEMsU0FBNkc7UUFFN0csTUFBTSxRQUFRLEdBQVEsRUFBRSxDQUFDO1FBQ3pCLE1BQU0sUUFBUSxHQUFRLEVBQUUsQ0FBQztRQUV6QixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFDbEIsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNqQyxNQUFNLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxHQUFHLFNBQVMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDM0UsTUFBTSxXQUFXLEdBQUcsc0JBQXNCLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUN0RixRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdkMsU0FBUyxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUVELE9BQU87WUFDSCxRQUFRLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQztZQUN2QixRQUFRLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQztTQUMxQixDQUFDO0lBQ04sQ0FBQyJ9