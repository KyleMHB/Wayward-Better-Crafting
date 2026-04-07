var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "@wayward/game/mod/Mod", "./src/BetterCraftingDialog", "@wayward/game/event/EventManager", "@wayward/game/event/EventBuses", "@wayward/game/game/entity/action/IAction", "@wayward/game/ui/screen/IScreen", "@wayward/game/game/entity/action/ActionExecutor", "@wayward/game/game/entity/action/actions/Craft", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/entity/IStats"], function (require, exports, Mod_1, BetterCraftingDialog_1, EventManager_1, EventBuses_1, IAction_1, IScreen_1, ActionExecutor_1, Craft_1, ItemDescriptions_1, IStats_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Mod_1 = __importDefault(Mod_1);
    BetterCraftingDialog_1 = __importStar(BetterCraftingDialog_1);
    ActionExecutor_1 = __importDefault(ActionExecutor_1);
    Craft_1 = __importDefault(Craft_1);
    class BetterCrafting extends Mod_1.default {
        constructor() {
            super(...arguments);
            this.bypassIntercept = false;
            this.shiftHeld = false;
            this.isBulkCrafting = false;
            this.bulkAbortController = null;
            this.onKeyDown = (e) => {
                if (e.key === "Shift")
                    this.shiftHeld = true;
            };
            this.onKeyUp = (e) => {
                if (e.key === "Shift")
                    this.shiftHeld = false;
            };
            this.onBlur = () => {
                this.shiftHeld = false;
            };
        }
        onInitialize() { }
        onLoad() {
            document.addEventListener("keydown", this.onKeyDown);
            document.addEventListener("keyup", this.onKeyUp);
            window.addEventListener("blur", this.onBlur);
        }
        onUnload() {
            document.removeEventListener("keydown", this.onKeyDown);
            document.removeEventListener("keyup", this.onKeyUp);
            window.removeEventListener("blur", this.onBlur);
            this.panel?.hidePanel();
            this.panel?.destroyListeners();
            this.panel?.remove();
            this.panel = undefined;
        }
        ensurePanel() {
            if (!this.panel) {
                const gameScreen = ui?.screens?.get(IScreen_1.ScreenId.Game);
                if (gameScreen) {
                    this.panel = new BetterCraftingDialog_1.default(async (itemType, tools, consumed, base) => {
                        await this.executeCraft(itemType, tools, consumed, base);
                    }, async (itemType, quantity, excludedIds) => {
                        await this.executeBulkCraft(itemType, quantity, excludedIds);
                    });
                    gameScreen.append(this.panel);
                }
            }
            return this.panel;
        }
        async executeCraft(itemType, tools, consumed, base) {
            this.bypassIntercept = true;
            try {
                await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, tools, consumed, base, undefined);
            }
            finally {
                this.bypassIntercept = false;
            }
        }
        waitForTurnEnd() {
            const turnEndPromise = new Promise(resolve => {
                localPlayer.event.subscribeNext("turnEnd", () => {
                    const poll = () => {
                        if (this.bulkAbortController?.aborted || !localPlayer.hasDelay?.()) {
                            resolve();
                        }
                        else {
                            requestAnimationFrame(poll);
                        }
                    };
                    requestAnimationFrame(poll);
                });
            });
            const abortPromise = new Promise(resolve => {
                const ctrl = this.bulkAbortController;
                if (!ctrl) {
                    resolve();
                    return;
                }
                if (ctrl.aborted) {
                    resolve();
                    return;
                }
                ctrl.resolveWait = resolve;
            });
            return Promise.race([turnEndPromise, abortPromise]);
        }
        abortBulkCraft(reason) {
            if (this.bulkAbortController) {
                this.bulkAbortController.aborted = true;
                this.bulkAbortController.reason = reason;
                this.bulkAbortController.resolveWait?.();
                this.bulkAbortController.resolveWait = null;
            }
        }
        registerBulkInterruptHooks() {
            const moveHandler = (_, fromTile, toTile) => {
                if (fromTile !== toTile)
                    this.abortBulkCraft("movement");
            };
            const statHandler = (_, stat, oldValue, _info) => {
                if (stat.type === IStats_1.Stat.Health && (stat.value ?? 0) < oldValue) {
                    this.abortBulkCraft("damage");
                }
            };
            localPlayer.event.subscribe("postMove", moveHandler);
            localPlayer.event.subscribe("statChanged", statHandler);
            return () => {
                localPlayer.event.unsubscribe("postMove", moveHandler);
                localPlayer.event.unsubscribe("statChanged", statHandler);
            };
        }
        async executeBulkCraft(itemType, quantity, excludedIds) {
            if (this.isBulkCrafting)
                return;
            const recipe = ItemDescriptions_1.itemDescriptions[itemType]?.recipe;
            if (!recipe)
                return;
            const staminaCost = BetterCraftingDialog_1.STAMINA_COST_PER_LEVEL[recipe.level] ?? 4;
            this.bulkAbortController = { aborted: false, reason: "", resolveWait: null };
            const cleanupHooks = this.registerBulkInterruptHooks();
            this.panel?.setBulkAbortCallback(() => this.abortBulkCraft("user_stop"));
            this.panel?.onBulkCraftStart(quantity);
            this.isBulkCrafting = true;
            this.bypassIntercept = true;
            try {
                for (let i = 0; i < quantity; i++) {
                    if (this.bulkAbortController.aborted)
                        break;
                    if (!localPlayer?.island)
                        break;
                    const currentStamina = localPlayer.stat?.get?.(IStats_1.Stat.Stamina)?.value ?? 0;
                    if (currentStamina < staminaCost)
                        break;
                    const resolved = this.panel?.resolveForBulkCraft(itemType, excludedIds);
                    if (!resolved)
                        break;
                    if (this.bulkAbortController.aborted)
                        break;
                    const turnEndPromise = this.waitForTurnEnd();
                    await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, resolved.tools.length > 0 ? resolved.tools : undefined, resolved.consumed.length > 0 ? resolved.consumed : undefined, resolved.base, undefined);
                    this.panel?.setBulkProgress(i + 1, quantity);
                    await turnEndPromise;
                }
            }
            finally {
                cleanupHooks();
                this.bulkAbortController = null;
                this.panel?.setBulkAbortCallback(null);
                this.panel?.onBulkCraftEnd();
                this.isBulkCrafting = false;
                this.bypassIntercept = false;
            }
        }
        onPreExecuteAction(host, actionType, actionApi, args) {
            if (this.bypassIntercept)
                return;
            if (this.shiftHeld)
                return;
            if (actionType === IAction_1.ActionType.Craft && actionApi.executor === localPlayer) {
                const itemType = args[0];
                const panel = this.ensurePanel();
                if (panel) {
                    panel.updateRecipe(itemType);
                    panel.showPanel();
                }
                return false;
            }
        }
    }
    exports.default = BetterCrafting;
    __decorate([
        (0, EventManager_1.EventHandler)(EventBuses_1.EventBus.Actions, "preExecuteAction")
    ], BetterCrafting.prototype, "onPreExecuteAction", null);
    __decorate([
        Mod_1.default.instance()
    ], BetterCrafting, "INSTANCE", void 0);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBa0JBLE1BQXFCLGNBQWUsU0FBUSxhQUFHO1FBQS9DOztZQU1XLG9CQUFlLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLGNBQVMsR0FBRyxLQUFLLENBQUM7WUFDbEIsbUJBQWMsR0FBRyxLQUFLLENBQUM7WUFDdkIsd0JBQW1CLEdBS2hCLElBQUksQ0FBQztZQXNCUixjQUFTLEdBQUcsQ0FBQyxDQUFnQixFQUFFLEVBQUU7Z0JBQ3JDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxPQUFPO29CQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2pELENBQUMsQ0FBQztZQUVNLFlBQU8sR0FBRyxDQUFDLENBQWdCLEVBQUUsRUFBRTtnQkFDbkMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLE9BQU87b0JBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDbEQsQ0FBQyxDQUFDO1lBRU0sV0FBTSxHQUFHLEdBQUcsRUFBRTtnQkFDbEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDM0IsQ0FBQyxDQUFDO1FBb09OLENBQUM7UUFoUW1CLFlBQVksS0FBVSxDQUFDO1FBRXZCLE1BQU07WUFDbEIsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDckQsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUVlLFFBQVE7WUFDcEIsUUFBUSxDQUFD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