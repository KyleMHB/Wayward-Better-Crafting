var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "@wayward/game/mod/Mod", "./src/PrecisionCraftingDialog", "@wayward/game/event/EventManager", "@wayward/game/event/EventBuses", "@wayward/game/game/entity/action/IAction", "@wayward/game/ui/screen/IScreen", "@wayward/game/game/entity/action/ActionExecutor", "@wayward/game/game/entity/action/actions/Craft"], function (require, exports, Mod_1, PrecisionCraftingDialog_1, EventManager_1, EventBuses_1, IAction_1, IScreen_1, ActionExecutor_1, Craft_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Mod_1 = __importDefault(Mod_1);
    PrecisionCraftingDialog_1 = __importDefault(PrecisionCraftingDialog_1);
    ActionExecutor_1 = __importDefault(ActionExecutor_1);
    Craft_1 = __importDefault(Craft_1);
    class Precision extends Mod_1.default {
        constructor() {
            super(...arguments);
            this.bypassIntercept = false;
            this.shiftHeld = false;
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
        onInitialize() {
        }
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
            this.panel?.remove();
            this.panel = undefined;
        }
        ensurePanel() {
            if (!this.panel) {
                const gameScreen = ui?.screens?.get(IScreen_1.ScreenId.Game);
                if (gameScreen) {
                    this.panel = new PrecisionCraftingDialog_1.default(async (itemType, tools, consumed, base) => {
                        await this.executeCraft(itemType, tools, consumed, base);
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
    exports.default = Precision;
    __decorate([
        (0, EventManager_1.EventHandler)(EventBuses_1.EventBus.Actions, "preExecuteAction")
    ], Precision.prototype, "onPreExecuteAction", null);
    __decorate([
        Mod_1.default.instance()
    ], Precision, "INSTANCE", void 0);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlY2lzaW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicHJlY2lzaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7SUFhQSxNQUFxQixTQUFVLFNBQVEsYUFBRztRQUExQzs7WUFLVyxvQkFBZSxHQUFHLEtBQUssQ0FBQztZQUN2QixjQUFTLEdBQUcsS0FBSyxDQUFDO1lBb0JsQixjQUFTLEdBQUcsQ0FBQyxDQUFnQixFQUFFLEVBQUU7Z0JBQ3JDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxPQUFPO29CQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2pELENBQUMsQ0FBQztZQUVNLFlBQU8sR0FBRyxDQUFDLENBQWdCLEVBQUUsRUFBRTtnQkFDbkMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLE9BQU87b0JBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDbEQsQ0FBQyxDQUFDO1lBRU0sV0FBTSxHQUFHLEdBQUcsRUFBRTtnQkFDbEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDM0IsQ0FBQyxDQUFDO1FBZ0ROLENBQUM7UUE1RW1CLFlBQVk7UUFDNUIsQ0FBQztRQUVlLE1BQU07WUFDbEIsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDckQsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUVlLFFBQVE7WUFDcEIsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDeEQsUUFBUSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FB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