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
                    paragraph.setText(TranslationImpl_1.default.generator("Ignore stamina limits and bypass damage-based safety stops during bulk crafting."));
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
            if (this.settings.unsafeBulkCrafting)
                return false;
            return true;
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
        waitForActionDelayClear() {
            return new Promise(resolve => {
                const poll = () => {
                    if (this.bulkAbortController?.aborted || !localPlayer?.hasDelay?.()) {
                        resolve();
                    }
                    else {
                        requestAnimationFrame(poll);
                    }
                };
                poll();
            });
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
            const sessionConsumedIds = new Set();
            try {
                for (let i = 0; i < quantity; i++) {
                    if (this.bulkAbortController.aborted)
                        break;
                    await this.waitForActionDelayClear();
                    if (this.bulkAbortController.aborted)
                        break;
                    if (!localPlayer?.island)
                        break;
                    const currentStamina = localPlayer.stat?.get?.(IStats_1.Stat.Stamina)?.value ?? 0;
                    if (!this.settings.unsafeBulkCrafting && currentStamina < staminaCost)
                        break;
                    const resolved = this.panel?.resolveForBulkCraft(itemType, excludedIds, sessionConsumedIds);
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
                    for (const item of resolved.consumed) {
                        const id = this.getItemId(item);
                        if (id !== undefined)
                            sessionConsumedIds.add(id);
                    }
                    if (resolved.base) {
                        const id = this.getItemId(resolved.base);
                        if (id !== undefined)
                            sessionConsumedIds.add(id);
                    }
                    this.panel?.setBulkProgress(i + 1, quantity);
                    await turnEndPromise;
                }
            }
            finally {
                cleanupHooks();
                this.bulkAbortController = null;
                this.panel?.setBulkAbortCallback(null);
                this.isBulkCrafting = false;
                this.bypassIntercept = false;
                this.panel?.showBulkCraftResults(craftResults);
                this.panel?.onBulkCraftEnd();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBMkNBLE1BQU0sZ0JBQWdCLEdBQXdDO1FBQzFELGNBQWMsRUFBRSxvQkFBb0I7UUFDcEMsZ0JBQWdCLEVBQUUsT0FBTztRQUN6QixrQkFBa0IsRUFBRSxLQUFLO0tBQzVCLENBQUM7SUFFRixNQUFxQixjQUFlLFNBQVEsYUFBRztRQUEvQzs7WUFTVyxvQkFBZSxHQUFHLEtBQUssQ0FBQztZQUN2QixjQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ2xCLG1CQUFjLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLHdCQUFtQixHQUtoQixJQUFJLENBQUM7WUFpSlIsY0FBUyxHQUFHLENBQUMsQ0FBZ0IsRUFBRSxFQUFFO2dCQUNyQyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO29CQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQzlELENBQUMsQ0FBQztZQUVNLFlBQU8sR0FBRyxDQUFDLENBQWdCLEVBQUUsRUFBRTtnQkFDbkMsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztvQkFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUMvRCxDQUFDLENBQUM7WUFFTSxXQUFNLEdBQUcsR0FBRyxFQUFFO2dCQUNsQixJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUNoQyxDQUFDLENBQUM7UUF3WE4sQ0FBQztRQS9nQm1CLG9CQUFvQixDQUFDLElBQWE7WUFDOUMsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEMsQ0FBQztRQUVlLFlBQVk7WUFDeEIsSUFBSSxDQUFDLG9CQUFvQixFQUFF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