define(["require", "exports", "../craftingSelection"], function (require, exports, craftingSelection_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sanitizeSelectedItems = sanitizeSelectedItems;
    exports.supplementSelectedItems = supplementSelectedItems;
    exports.filterUnreservedItems = filterUnreservedItems;
    exports.repairSelectedItemsForRole = repairSelectedItemsForRole;
    exports.repairSplitSelection = repairSplitSelection;
    function sanitizeSelectedItems(items, getItemId, candidates, maxCount) {
        const candidateIds = candidates ? new Set(candidates.map(item => getItemId(item)).filter((id) => id !== undefined)) : undefined;
        const seenIds = new Set();
        const sanitized = [];
        for (const item of items) {
            const itemId = getItemId(item);
            if (!item || itemId === undefined || seenIds.has(itemId))
                continue;
            if (candidateIds && !candidateIds.has(itemId))
                continue;
            sanitized.push(item);
            seenIds.add(itemId);
            if (maxCount !== undefined && sanitized.length >= maxCount)
                break;
        }
        return sanitized;
    }
    function supplementSelectedItems(selectedItems, candidates, maxCount, getItemId) {
        if (selectedItems.length >= maxCount)
            return selectedItems.slice(0, maxCount);
        const selectedIds = new Set(selectedItems.map(item => getItemId(item)).filter((id) => id !== undefined));
        const supplemented = [...selectedItems];
        for (const item of candidates) {
            const itemId = getItemId(item);
            if (itemId !== undefined && selectedIds.has(itemId))
                continue;
            supplemented.push(item);
            if (itemId !== undefined)
                selectedIds.add(itemId);
            if (supplemented.length >= maxCount)
                break;
        }
        return supplemented;
    }
    function filterUnreservedItems(items, reservations, getItemId, currentRole) {
        return items.filter(item => {
            const itemId = getItemId(item);
            if (itemId === undefined)
                return true;
            const reservedRole = reservations.get(itemId);
            return reservedRole === undefined || reservedRole === currentRole;
        });
    }
    function repairSelectedItemsForRole(selectedItems, candidates, maxCount, reservations, role, getItemId, forceTopVisible = false) {
        const selectableCandidates = filterUnreservedItems(candidates, reservations, getItemId, role);
        if (forceTopVisible)
            return selectableCandidates.slice(0, maxCount);
        const candidateValidSelection = sanitizeSelectedItems([...selectedItems], getItemId, candidates, maxCount);
        const repairedSelection = sanitizeSelectedItems([...selectedItems], getItemId, selectableCandidates, maxCount);
        if (repairedSelection.length < candidateValidSelection.length) {
            return supplementSelectedItems(repairedSelection, selectableCandidates, maxCount, getItemId);
        }
        return repairedSelection;
    }
    function repairSplitSelection(component, current, usedCandidates, consumedCandidates, getItemId) {
        const consumedCount = (0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount);
        const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount);
        const used = sanitizeSelectedItems(current.used, getItemId, usedCandidates, usedCount);
        const repairedUsed = supplementSelectedItems(used, usedCandidates, usedCount, getItemId);
        const repairedUsedIds = new Set(repairedUsed.map(item => getItemId(item)).filter((id) => id !== undefined));
        const availableConsumedCandidates = consumedCandidates.filter(item => {
            const itemId = getItemId(item);
            return itemId === undefined || !repairedUsedIds.has(itemId);
        });
        const consumed = sanitizeSelectedItems(current.consumed, getItemId, availableConsumedCandidates, consumedCount);
        const repairedConsumed = supplementSelectedItems(consumed, availableConsumedCandidates, consumedCount, getItemId);
        return {
            consumed: repairedConsumed,
            used: repairedUsed,
        };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztJQVlBLHNEQW9CQztJQUVELDBEQXFCQztJQUVELHNEQVlDO0lBRUQsZ0VBbUJDO0lBRUQsb0RBdUJDO0lBdkdELFNBQWdCLHFCQUFxQixDQUNqQyxLQUEyQixFQUMzQixTQUEwQixFQUMxQixVQUF5QixFQUN6QixRQUFpQjtRQUVqQixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQWdCLEVBQUUsQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzlJLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDbEMsTUFBTSxTQUFTLEdBQVEsRUFBRSxDQUFDO1FBRTFCLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7WUFDdkIsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQy9CLElBQUksQ0FBQyxJQUFJLElBQUksTUFBTSxLQUFLLFNBQVMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztnQkFBRSxTQUFTO1lBQ25FLElBQUksWUFBWSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7Z0JBQUUsU0FBUztZQUN4RCxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JCLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDcEIsSUFBSSxRQUFRLEtBQUssU0FBUyxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksUUFBUTtnQkFBRSxN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