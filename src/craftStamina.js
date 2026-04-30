define(["require", "exports", "@wayward/game/game/item/IItem"], function (require, exports, IItem_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DEFAULT_CRAFT_STAMINA_COST = exports.STAMINA_COST_PER_LEVEL = void 0;
    exports.getCraftStaminaCost = getCraftStaminaCost;
    exports.STAMINA_COST_PER_LEVEL = {
        [IItem_1.RecipeLevel.Simple]: 2,
        [IItem_1.RecipeLevel.Intermediate]: 5,
        [IItem_1.RecipeLevel.Advanced]: 10,
        [IItem_1.RecipeLevel.Expert]: 16,
        [IItem_1.RecipeLevel.Master]: 25,
    };
    exports.DEFAULT_CRAFT_STAMINA_COST = 4;
    function getCraftStaminaCost(level) {
        return exports.STAMINA_COST_PER_LEVEL[level] ?? exports.DEFAULT_CRAFT_STAMINA_COST;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JhZnRTdGFtaW5hLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY3JhZnRTdGFtaW5hLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7SUFlQSxrREFFQztJQVpZLFFBQUEsc0JBQXNCLEdBQXlDO1FBQ3hFLENBQUMsbUJBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ3ZCLENBQUMsbUJBQVcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQzdCLENBQUMsbUJBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFO1FBQzFCLENBQUMsbUJBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFO1FBQ3hCLENBQUMsbUJBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFO0tBQzNCLENBQUM7SUFFVyxRQUFBLDBCQUEwQixHQUFHLENBQUMsQ0FBQztJQUU1QyxTQUFnQixtQkFBbUIsQ0FBQyxLQUFrQjtRQUNsRCxPQUFPLDhCQUFzQixDQUFDLEtBQUssQ0FBQyxJQUFJLGtDQUEwQixDQUFDO0lBQ3ZFLENBQUMifQ==