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
define(["require", "exports", "@wayward/game/mod/Mod", "./src/BetterCraftingDialog", "@wayward/game/event/EventManager", "@wayward/game/event/EventBuses", "@wayward/game/game/entity/action/IAction", "@wayward/game/ui/screen/IScreen", "@wayward/game/game/entity/action/ActionExecutor", "@wayward/game/game/entity/action/actions/Craft", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/entity/IStats", "@wayward/game/game/IObject", "@wayward/game/ui/screen/screens/menu/menus/options/TabMods", "@wayward/game/ui/component/ChoiceList", "@wayward/game/ui/component/CheckButton", "@wayward/game/language/impl/TranslationImpl"], function (require, exports, Mod_1, BetterCraftingDialog_1, EventManager_1, EventBuses_1, IAction_1, IScreen_1, ActionExecutor_1, Craft_1, ItemDescriptions_1, IStats_1, IObject_1, TabMods_1, ChoiceList_1, CheckButton_1, TranslationImpl_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Mod_1 = __importDefault(Mod_1);
    BetterCraftingDialog_1 = __importStar(BetterCraftingDialog_1);
    ActionExecutor_1 = __importDefault(ActionExecutor_1);
    Craft_1 = __importDefault(Craft_1);
    TabMods_1 = __importDefault(TabMods_1);
    ChoiceList_1 = __importStar(ChoiceList_1);
    TranslationImpl_1 = __importDefault(TranslationImpl_1);
    const DEFAULT_SETTINGS = {
        activationMode: "holdHotkeyToBypass",
        activationHotkey: "Shift",
        unsafeBulkCrafting: false,
    };
    class BetterCrafting extends Mod_1.default {
        constructor() {
            super(...arguments);
            this.bypassIntercept = false;
            this.shiftHeld = false;
            this.isBulkCrafting = false;
            this.bulkAbortController = null;
            this.onKeyDown = (e) => {
                if (this.isConfiguredHotkey(e.key))
                    this.shiftHeld = true;
            };
            this.onKeyUp = (e) => {
                if (this.isConfiguredHotkey(e.key))
                    this.shiftHeld = false;
            };
            this.onBlur = () => {
                this.clearHeldHotkeyState();
            };
        }
        initializeGlobalData(data) {
            return this.normalizeSettings(data);
        }
        onInitialize() {
            this.clearHeldHotkeyState();
            TabMods_1.default.registerModOptions(this.mod, component => {
                const container = component.element;
                container.replaceChildren();
                const title = document.createElement("h3");
                title.textContent = "Better Crafting Settings";
                container.appendChild(title);
                const intro = document.createElement("p");
                intro.textContent = "Configure the Better Crafting hotkey behavior and bulk crafting safety.";
                container.appendChild(intro);
                const activationLabel = document.createElement("div");
                activationLabel.textContent = "Activation Mode";
                activationLabel.style.marginBottom = "6px";
                container.appendChild(activationLabel);
                const activationChoices = new ChoiceList_1.default();
                const bypassChoice = new ChoiceList_1.Choice("holdHotkeyToBypass");
                bypassChoice.setText(TranslationImpl_1.default.generator("Hold Hotkey to Bypass"));
                const accessChoice = new ChoiceList_1.Choice("holdHotkeyToAccess");
                accessChoice.setText(TranslationImpl_1.default.generator("Hold Hotkey to Access"));
                activationChoices.setChoices(bypassChoice, accessChoice);
                activationChoices.event.subscribe("choose", (_, choice) => {
                    if (!choice)
                        return;
                    this.globalData.activationMode = choice.id;
                    this.clearHeldHotkeyState();
                });
                activationChoices.setRefreshMethod(() => activationChoices.get(this.settings.activationMode));
                activationChoices.refresh();
                container.appendChild(activationChoices.element);
                const hotkeyLabel = document.createElement("div");
                hotkeyLabel.textContent = "Activation Hotkey";
                hotkeyLabel.style.marginTop = "12px";
                hotkeyLabel.style.marginBottom = "6px";
                container.appendChild(hotkeyLabel);
                const hotkeyChoices = new ChoiceList_1.default();
                const shiftChoice = new ChoiceList_1.Choice("Shift");
                shiftChoice.setText(TranslationImpl_1.default.generator("Shift"));
                const controlChoice = new ChoiceList_1.Choice("Control");
                controlChoice.setText(TranslationImpl_1.default.generator("Control"));
                const altChoice = new ChoiceList_1.Choice("Alt");
                altChoice.setText(TranslationImpl_1.default.generator("Alt"));
                hotkeyChoices.setChoices(shiftChoice, controlChoice, altChoice);
                hotkeyChoices.event.subscribe("choose", (_, choice) => {
                    if (!choice)
                        return;
                    this.globalData.activationHotkey = choice.id;
                    this.clearHeldHotkeyState();
                });
                hotkeyChoices.setRefreshMethod(() => hotkeyChoices.get(this.settings.activationHotkey));
                hotkeyChoices.refresh();
                container.appendChild(hotkeyChoices.element);
                const unsafeToggle = new CheckButton_1.CheckButton();
                unsafeToggle.setText(TranslationImpl_1.default.generator("Unsafe Bulk Crafting"));
                unsafeToggle.addDescription(paragraph => {
                    paragraph.setText(TranslationImpl_1.default.generator("Ignore stamina limits for bulk quantity and only stop when health gets critically low."));
                });
                unsafeToggle.event.subscribe("toggle", (_, checked) => {
                    this.globalData.unsafeBulkCrafting = checked;
                });
                unsafeToggle.setRefreshMethod(() => this.settings.unsafeBulkCrafting);
                unsafeToggle.refresh();
                unsafeToggle.style.set("margin-top", "12px");
                container.appendChild(unsafeToggle.element);
            });
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
            this.clearHeldHotkeyState();
            this.panel?.hidePanel();
            this.panel?.destroyListeners();
            this.panel?.remove();
            this.panel = undefined;
        }
        get settings() {
            return this.globalData ?? DEFAULT_SETTINGS;
        }
        normalizeSettings(data) {
            const source = data && typeof data === "object" ? data : {};
            return {
                activationMode: source.activationMode === "holdHotkeyToAccess" || source.activationMode === "holdHotkeyToBypass"
                    ? source.activationMode
                    : DEFAULT_SETTINGS.activationMode,
                activationHotkey: source.activationHotkey === "Shift" || source.activationHotkey === "Control" || source.activationHotkey === "Alt"
                    ? source.activationHotkey
                    : DEFAULT_SETTINGS.activationHotkey,
                unsafeBulkCrafting: typeof source.unsafeBulkCrafting === "boolean"
                    ? source.unsafeBulkCrafting
                    : DEFAULT_SETTINGS.unsafeBulkCrafting,
            };
        }
        clearHeldHotkeyState() {
            this.shiftHeld = false;
        }
        isConfiguredHotkey(key) {
            return key === this.settings.activationHotkey;
        }
        isActivationHotkeyHeld() {
            return this.shiftHeld;
        }
        shouldOpenBetterCrafting() {
            if (this.bypassIntercept)
                return false;
            return this.settings.activationMode === "holdHotkeyToBypass"
                ? !this.isActivationHotkeyHeld()
                : this.isActivationHotkeyHeld();
        }
        shouldAbortForHealthLoss(stat, oldValue) {
            if (stat.type !== IStats_1.Stat.Health || (stat.value ?? 0) >= oldValue)
                return false;
            if (!this.settings.unsafeBulkCrafting)
                return true;
            try {
                const maxHealth = localPlayer?.getMaxHealth?.(true) ?? stat.max;
                if (typeof maxHealth !== "number" || !Number.isFinite(maxHealth) || maxHealth <= 0) {
                    return true;
                }
                return stat.value < maxHealth * 0.1;
            }
            catch {
                return true;
            }
        }
        ensurePanel() {
            if (!this.panel) {
                const gameScreen = ui?.screens?.get(IScreen_1.ScreenId.Game);
                if (gameScreen) {
                    this.panel = new BetterCraftingDialog_1.default(async (itemType, tools, consumed, base) => {
                        await this.executeCraft(itemType, tools, consumed, base);
                    }, async (itemType, quantity, excludedIds) => {
                        await this.executeBulkCraft(itemType, quantity, excludedIds);
                    }, () => this.settings);
                    gameScreen.append(this.panel);
                }
            }
            return this.panel;
        }
        snapshotInventory() {
            const snapshot = new Map();
            if (!localPlayer?.island?.items)
                return snapshot;
            const items = localPlayer.island.items.getItemsInContainer(localPlayer, { includeSubContainers: true });
            for (const item of items) {
                const id = this.getItemId(item);
                if (id === undefined)
                    continue;
                snapshot.set(id, { item, signature: this.getItemSignature(item) });
            }
            return snapshot;
        }
        beginCraftResultCapture(itemType) {
            const eventCandidates = [];
            const pushCandidates = (items) => {
                for (const item of items) {
                    if (item?.type === itemType)
                        eventCandidates.push(item);
                }
            };
            const onAdd = (_, items) => pushCandidates(items);
            const onUpdate = (_, items) => pushCandidates(items);
            localPlayer.event.subscribe("inventoryItemAdd", onAdd);
            localPlayer.event.subscribe("inventoryItemUpdate", onUpdate);
            return {
                before: this.snapshotInventory(),
                eventCandidates,
                unsubscribe: () => {
                    localPlayer.event.unsubscribe("inventoryItemAdd", onAdd);
                    localPlayer.event.unsubscribe("inventoryItemUpdate", onUpdate);
                },
            };
        }
        finishCraftResultCapture(capture, itemType) {
            capture.unsubscribe();
            const after = this.snapshotInventory();
            const item = this.resolveCraftResultItem(itemType, capture.before, after, capture.eventCandidates);
            return { success: !!item, item, itemType };
        }
        resolveCraftResultItem(itemType, before, after, eventCandidates) {
            const candidates = [];
            const seen = new Set();
            const push = (item) => {
                if (!item || item.type !== itemType)
                    return;
                const id = this.getItemId(item);
                if (id === undefined || seen.has(id) || !after.has(id))
                    return;
                seen.add(id);
                candidates.push(after.get(id).item);
            };
            for (const item of eventCandidates)
                push(item);
            for (const [id, entry] of after) {
                const beforeEntry = before.get(id);
                if (!beforeEntry || beforeEntry.signature !== entry.signature) {
                    push(entry.item);
                }
            }
            return candidates.sort((a, b) => (b.quality ?? IObject_1.Quality.None) - (a.quality ?? IObject_1.Quality.None)
                || this.getItemId(b) - this.getItemId(a))[0];
        }
        getItemId(item) {
            return item.id;
        }
        getItemSignature(item) {
            const magic = item.magic ? item.magic.toString?.() ?? "magic" : "";
            const used = item.used ? JSON.stringify(item.used) : "";
            return [
                item.type,
                item.quality ?? IObject_1.Quality.None,
                item.durability,
                item.durabilityMax,
                item.weight.toFixed(3),
                item.bonusAttack ?? "",
                item.bonusDefense ?? "",
                item.baseItem ?? "",
                item.crafterIdentifier ?? "",
                used,
                magic,
            ].join("|");
        }
        async executeCraft(itemType, tools, consumed, base) {
            this.panel?.clearResults();
            const capture = this.beginCraftResultCapture(itemType);
            this.bypassIntercept = true;
            try {
                await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, tools, consumed, base, undefined);
                this.panel?.showSingleCraftResult(this.finishCraftResultCapture(capture, itemType));
            }
            catch (error) {
                capture.unsubscribe();
                this.panel?.showSingleCraftResult({ success: false, itemType });
                throw error;
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
                if (this.shouldAbortForHealthLoss(stat, oldValue)) {
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
            this.panel?.clearResults();
            this.panel?.onBulkCraftStart(quantity);
            this.isBulkCrafting = true;
            this.bypassIntercept = true;
            const craftResults = [];
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
                    const capture = this.beginCraftResultCapture(itemType);
                    try {
                        await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, resolved.tools.length > 0 ? resolved.tools : undefined, resolved.consumed.length > 0 ? resolved.consumed : undefined, resolved.base, undefined);
                        craftResults.push(this.finishCraftResultCapture(capture, itemType));
                    }
                    catch (error) {
                        capture.unsubscribe();
                        craftResults.push({ success: false, itemType });
                        throw error;
                    }
                    this.panel?.setBulkProgress(i + 1, quantity);
                    await turnEndPromise;
                }
            }
            finally {
                cleanupHooks();
                this.bulkAbortController = null;
                this.panel?.setBulkAbortCallback(null);
                this.panel?.showBulkCraftResults(craftResults);
                this.panel?.onBulkCraftEnd();
                this.isBulkCrafting = false;
                this.bypassIntercept = false;
            }
        }
        onPreExecuteAction(host, actionType, actionApi, args) {
            if (!this.shouldOpenBetterCrafting())
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
        Mod_1.default.globalData()
    ], BetterCrafting.prototype, "globalData", void 0);
    __decorate([
        (0, EventManager_1.EventHandler)(EventBuses_1.EventBus.Actions, "preExecuteAction")
    ], BetterCrafting.prototype, "onPreExecuteAction", null);
    __decorate([
        Mod_1.default.instance()
    ], BetterCrafting, "INSTANCE", void 0);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBMkNBLE1BQU0sZ0JBQWdCLEdBQXdDO1FBQzFELGNBQWMsRUFBRSxvQkFBb0I7UUFDcEMsZ0JBQWdCLEVBQUUsT0FBTztRQUN6QixrQkFBa0IsRUFBRSxLQUFLO0tBQzVCLENBQUM7SUFFRixNQUFxQixjQUFlLFNBQVEsYUFBRztRQUEvQzs7WUFTVyxvQkFBZSxHQUFHLEtBQUssQ0FBQztZQUN2QixjQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ2xCLG1CQUFjLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLHdCQUFtQixHQUtoQixJQUFJLENBQUM7WUEwSlIsY0FBUyxHQUFHLENBQUMsQ0FBZ0IsRUFBRSxFQUFFO2dCQUNyQyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO29CQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQzlELENBQUMsQ0FBQztZQUVNLFlBQU8sR0FBRyxDQUFDLENBQWdCLEVBQUUsRUFBRTtnQkFDbkMsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztvQkFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUMvRCxDQUFDLENBQUM7WUFFTSxXQUFNLEdBQUcsR0FBRyxFQUFFO2dCQUNsQixJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUNoQyxDQUFDLENBQUM7UUF3Vk4sQ0FBQztRQXhmbUIsb0JBQW9CLENBQUMsSUFBYTtZQUM5QyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QyxDQUFDO1FBRWUsWUFBWTtZQUN4QixJQUFJLENBQUMsb0JBQW9CLEVBQUUs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