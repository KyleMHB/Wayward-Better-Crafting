var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@wayward/game/mod/Mod", "./src/BetterCraftingDialog", "@wayward/game/event/EventManager", "@wayward/game/event/EventBuses", "@wayward/game/game/entity/action/IAction", "@wayward/game/ui/screen/IScreen", "@wayward/game/game/entity/action/ActionExecutor", "@wayward/game/game/entity/action/actions/Craft", "@wayward/game/game/entity/action/actions/Dismantle", "@wayward/game/game/item/ItemManager", "@wayward/game/game/item/IItem", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/entity/IStats", "@wayward/utilities/Log", "@wayward/game/multiplayer/packets/ClientPacket", "@wayward/game/multiplayer/packets/ServerPacket", "@wayward/game/ui/screen/screens/menu/menus/options/TabMods", "@wayward/game/ui/component/ChoiceList", "@wayward/game/ui/component/CheckButton", "@wayward/game/language/impl/TranslationImpl", "./src/craftingSelection", "./src/craftStamina", "./src/itemIdentity", "./src/itemState"], function (require, exports, Mod_1, BetterCraftingDialog_1, EventManager_1, EventBuses_1, IAction_1, IScreen_1, ActionExecutor_1, Craft_1, Dismantle_1, ItemManager_1, IItem_1, ItemDescriptions_1, IStats_1, Log_1, ClientPacket_1, ServerPacket_1, TabMods_1, ChoiceList_1, CheckButton_1, TranslationImpl_1, craftingSelection_1, craftStamina_1, itemIdentity_1, itemState_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const DEFAULT_SETTINGS = {
        activationMode: "holdHotkeyToBypass",
        activationHotkey: "Shift",
        closeHotkey: "c",
        safeCrafting: true,
        debugLogging: false,
    };
    const MAX_BULK_CRAFT_QUANTITY = 256;
    const craftDebugLog = Log_1.default.warn("Better Crafting", "CraftDebug");
    function getItemId(item) {
        return (0, itemIdentity_1.getItemIdSafe)(item);
    }
    function getQualitySortKey(item) {
        return (item.quality ?? 0);
    }
    function getCurrentStamina() {
        return localPlayer ? localPlayer.stat?.get?.(IStats_1.Stat.Stamina)?.value ?? 0 : 0;
    }
    function isItemArg(value) {
        return typeof value === "object" && value !== null && "type" in value;
    }
    function getMatchingItemCacheKey(type) {
        return `${ItemManager_1.default.isGroup(type) ? "group" : "type"}:${type}`;
    }
    function normalizeCloseHotkey(value) {
        if (typeof value !== "string")
            return undefined;
        const normalized = value.trim();
        if (/^[a-z]$/i.test(normalized))
            return normalized.toLowerCase();
        if (normalized === "Escape")
            return normalized;
        return undefined;
    }
    class BetterCraftingStatusPacket extends ClientPacket_1.default {
        getDebugInfo() {
            return `BetterCraftingStatus:${this.status?.kind ?? "unknown"}:${this.status?.state ?? "unknown"}`;
        }
        isSyncCheckEnabled() {
            return false;
        }
        process() {
            if (this.status) {
                BetterCrafting.INSTANCE?.handleMultiplayerStatus(this.status);
            }
        }
        getIndexSize() {
            return 1;
        }
        writeData() {
            this.writeIndexedObject(this.status);
        }
        readData() {
            this.status = this.readIndexedObject();
        }
    }
    class BetterCraftingApprovalPacket extends ClientPacket_1.default {
        getDebugInfo() {
            return `BetterCraftingApproval:${this.approval?.kind ?? "unknown"}:${this.approval?.approved ? "approved" : "rejected"}`;
        }
        isSyncCheckEnabled() {
            return false;
        }
        process() {
            if (this.approval) {
                BetterCrafting.INSTANCE?.handleCraftApproval(this.approval);
            }
        }
        getIndexSize() {
            return 1;
        }
        writeData() {
            this.writeIndexedObject(this.approval);
        }
        readData() {
            this.approval = this.readIndexedObject();
        }
    }
    class BetterCraftingCraftRequestPacket extends ServerPacket_1.default {
        getDebugInfo() {
            return `BetterCraftingCraftRequest:${this.request?.itemType ?? "unknown"}`;
        }
        process() {
            if (this.request) {
                BetterCrafting.INSTANCE?.processCraftRequest(this.connection, this.request);
            }
        }
        getIndexSize() {
            return 1;
        }
        writeData() {
            this.writeIndexedObject(this.request);
        }
        readData() {
            this.request = this.readIndexedObject();
        }
    }
    class BetterCraftingBulkCraftRequestPacket extends ServerPacket_1.default {
        getDebugInfo() {
            return `BetterCraftingBulkCraftRequest:${this.request?.itemType ?? "unknown"}:${this.request?.quantity ?? 0}`;
        }
        process() {
            if (this.request) {
                BetterCrafting.INSTANCE?.processBulkCraftRequest(this.connection, this.request);
            }
        }
        getIndexSize() {
            return 1;
        }
        writeData() {
            this.writeIndexedObject(this.request);
        }
        readData() {
            this.request = this.readIndexedObject();
        }
    }
    class BetterCraftingDismantleRequestPacket extends ServerPacket_1.default {
        getDebugInfo() {
            return `BetterCraftingDismantleRequest:${this.request?.itemType ?? "unknown"}:${this.request?.targetItemIds.length ?? 0}`;
        }
        process() {
            if (this.request) {
                BetterCrafting.INSTANCE?.processDismantleRequest(this.connection, this.request);
            }
        }
        getIndexSize() {
            return 1;
        }
        writeData() {
            this.writeIndexedObject(this.request);
        }
        readData() {
            this.request = this.readIndexedObject();
        }
    }
    class BetterCraftingAbortRequestPacket extends ServerPacket_1.default {
        getDebugInfo() {
            return `BetterCraftingAbortRequest:${this.request?.requestId ?? 0}`;
        }
        process() {
            if (this.request) {
                BetterCrafting.INSTANCE?.abortServerRequest(this.connection, this.request);
            }
        }
        getIndexSize() {
            return 1;
        }
        writeData() {
            this.writeIndexedObject(this.request);
        }
        readData() {
            this.request = this.readIndexedObject();
        }
    }
    class BetterCraftingVanillaBypassPermitPacket extends ServerPacket_1.default {
        getDebugInfo() {
            return `BetterCraftingVanillaBypassPermit:${this.request?.itemType ?? "unknown"}:${this.request?.requestId ?? 0}`;
        }
        process() {
            if (this.request) {
                BetterCrafting.INSTANCE?.processVanillaBypassPermit(this.connection, this.request);
            }
        }
        getIndexSize() {
            return 1;
        }
        writeData() {
            this.writeIndexedObject(this.request);
        }
        readData() {
            this.request = this.readIndexedObject();
        }
    }
    const betterCraftingStatusPacketRegistration = Mod_1.default.register.packet(BetterCraftingStatusPacket);
    const betterCraftingApprovalPacketRegistration = Mod_1.default.register.packet(BetterCraftingApprovalPacket);
    const betterCraftingCraftRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingCraftRequestPacket);
    const betterCraftingBulkCraftRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingBulkCraftRequestPacket);
    const betterCraftingDismantleRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingDismantleRequestPacket);
    const betterCraftingAbortRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingAbortRequestPacket);
    const betterCraftingVanillaBypassPermitPacketRegistration = Mod_1.default.register.packet(BetterCraftingVanillaBypassPermitPacket);
    void [
        betterCraftingStatusPacketRegistration,
        betterCraftingApprovalPacketRegistration,
        betterCraftingCraftRequestPacketRegistration,
        betterCraftingBulkCraftRequestPacketRegistration,
        betterCraftingDismantleRequestPacketRegistration,
        betterCraftingAbortRequestPacketRegistration,
        betterCraftingVanillaBypassPermitPacketRegistration,
    ];
    class BetterCrafting extends Mod_1.default {
        constructor() {
            super(...arguments);
            this.bypassIntercept = false;
            this.shiftHeld = false;
            this.isBulkCrafting = false;
            this.bulkAbortController = null;
            this.nextMultiplayerRequestId = 1;
            this.pendingApprovals = new Map();
            this.pendingVanillaBypasses = new Map();
            this.serverCraftPasses = new Map();
            this.serverVanillaBypassPermits = new Map();
            this.settingsOptionUnsubscribers = [];
            this.onKeyDown = (e) => {
                if (this.isTypingInEditableControl(e.target))
                    return;
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
                this.clearSettingsOptionSubscriptions();
                const container = component.element;
                container.replaceChildren();
                const title = document.createElement("h3");
                title.textContent = "Better Crafting Settings";
                container.appendChild(title);
                const intro = document.createElement("p");
                intro.textContent = "Configure Better Crafting hotkey behavior and diagnostics.";
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
                const onActivationChoose = (_, choice) => {
                    if (!choice)
                        return;
                    this.globalData.activationMode = choice.id;
                    this.clearHeldHotkeyState();
                };
                activationChoices.event.subscribe("choose", onActivationChoose);
                this.settingsOptionUnsubscribers.push(() => activationChoices.event.unsubscribe("choose", onActivationChoose));
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
                const onHotkeyChoose = (_, choice) => {
                    if (!choice)
                        return;
                    this.globalData.activationHotkey = choice.id;
                    this.clearHeldHotkeyState();
                };
                hotkeyChoices.event.subscribe("choose", onHotkeyChoose);
                this.settingsOptionUnsubscribers.push(() => hotkeyChoices.event.unsubscribe("choose", onHotkeyChoose));
                hotkeyChoices.setRefreshMethod(() => hotkeyChoices.get(this.settings.activationHotkey));
                hotkeyChoices.refresh();
                container.appendChild(hotkeyChoices.element);
                const closeHotkeyLabel = document.createElement("div");
                closeHotkeyLabel.textContent = "Close UI Hotkey";
                closeHotkeyLabel.style.marginTop = "12px";
                closeHotkeyLabel.style.marginBottom = "6px";
                container.appendChild(closeHotkeyLabel);
                const closeHotkeyChoices = new ChoiceList_1.default();
                const closeHotkeyValues = [
                    "c", "x", "z", "q", "e", "r", "f", "g", "v", "b",
                    "n", "m", "t", "y", "h", "j", "k", "l", "Escape",
                ];
                const closeHotkeyChoiceById = new Map();
                const closeHotkeyChoicesList = closeHotkeyValues.map(closeHotkey => {
                    const choice = new ChoiceList_1.Choice(closeHotkey);
                    choice.setText(TranslationImpl_1.default.generator(closeHotkey === "Escape" ? "Escape" : closeHotkey.toUpperCase()));
                    closeHotkeyChoiceById.set(closeHotkey, choice);
                    return choice;
                });
                closeHotkeyChoices.setChoices(...closeHotkeyChoicesList);
                const onCloseHotkeyChoose = (_, choice) => {
                    if (!choice)
                        return;
                    this.globalData.closeHotkey = choice.id;
                };
                closeHotkeyChoices.event.subscribe("choose", onCloseHotkeyChoose);
                this.settingsOptionUnsubscribers.push(() => closeHotkeyChoices.event.unsubscribe("choose", onCloseHotkeyChoose));
                closeHotkeyChoices.setRefreshMethod(() => closeHotkeyChoiceById.get(this.settings.closeHotkey) ?? closeHotkeyChoiceById.get(DEFAULT_SETTINGS.closeHotkey));
                closeHotkeyChoices.refresh();
                container.appendChild(closeHotkeyChoices.element);
                const diagnosticsLabel = document.createElement("div");
                diagnosticsLabel.textContent = "Diagnostics";
                diagnosticsLabel.style.marginTop = "12px";
                diagnosticsLabel.style.marginBottom = "6px";
                container.appendChild(diagnosticsLabel);
                const diagnosticsRow = document.createElement("div");
                diagnosticsRow.style.display = "flex";
                diagnosticsRow.style.alignItems = "center";
                diagnosticsRow.style.gap = "8px";
                diagnosticsRow.style.flexWrap = "wrap";
                const diagnosticsToggle = new CheckButton_1.CheckButton();
                diagnosticsToggle.setChecked(this.settings.debugLogging, false);
                const onDiagnosticsToggle = (_, checked) => {
                    this.globalData.debugLogging = checked;
                };
                diagnosticsToggle.event.subscribe("toggle", onDiagnosticsToggle);
                this.settingsOptionUnsubscribers.push(() => diagnosticsToggle.event.unsubscribe("toggle", onDiagnosticsToggle));
                diagnosticsRow.appendChild(diagnosticsToggle.element);
                const diagnosticsTextWrap = document.createElement("div");
                diagnosticsTextWrap.style.display = "flex";
                diagnosticsTextWrap.style.flexDirection = "column";
                const diagnosticsText = document.createElement("div");
                diagnosticsText.textContent = "Enable verbose debugging logs";
                diagnosticsText.style.fontWeight = "600";
                diagnosticsTextWrap.appendChild(diagnosticsText);
                const diagnosticsHelp = document.createElement("div");
                diagnosticsHelp.textContent = "Writes detailed crafting diagnostics to the log for troubleshooting.";
                diagnosticsHelp.style.fontSize = "0.9em";
                diagnosticsHelp.style.opacity = "0.8";
                diagnosticsTextWrap.appendChild(diagnosticsHelp);
                diagnosticsRow.appendChild(diagnosticsTextWrap);
                container.appendChild(diagnosticsRow);
            });
        }
        clearSettingsOptionSubscriptions() {
            for (const unsubscribe of this.settingsOptionUnsubscribers.splice(0)) {
                unsubscribe();
            }
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
            this.clearPendingApprovals();
            this.clearPendingVanillaBypasses("mod_unload");
            this.clearSettingsOptionSubscriptions();
            this.serverCraftPasses.clear();
            this.serverVanillaBypassPermits.clear();
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
                closeHotkey: normalizeCloseHotkey(source.closeHotkey) ?? DEFAULT_SETTINGS.closeHotkey,
                safeCrafting: typeof source.safeCrafting === "boolean"
                    ? source.safeCrafting
                    : typeof source.unsafeBulkCrafting === "boolean"
                        ? !source.unsafeBulkCrafting
                        : DEFAULT_SETTINGS.safeCrafting,
                debugLogging: typeof source.debugLogging === "boolean"
                    ? source.debugLogging
                    : DEFAULT_SETTINGS.debugLogging,
            };
        }
        clearHeldHotkeyState() {
            this.shiftHeld = false;
        }
        isConfiguredHotkey(key) {
            return key === this.settings.activationHotkey;
        }
        isTypingInEditableControl(target = document.activeElement) {
            const element = target instanceof HTMLElement ? target : undefined;
            if (!element)
                return false;
            if (element.closest("input, textarea, select"))
                return true;
            const editable = element.closest("[contenteditable]");
            return editable instanceof HTMLElement && editable.isContentEditable;
        }
        isActivationHotkeyHeld() {
            return this.shiftHeld;
        }
        shouldOpenBetterCrafting() {
            if (this.bypassIntercept)
                return false;
            if (this.isTypingInEditableControl())
                return false;
            if (this.isRemoteMultiplayerClient())
                return true;
            return this.settings.activationMode === "holdHotkeyToBypass"
                ? !this.isActivationHotkeyHeld()
                : this.isActivationHotkeyHeld();
        }
        shouldAbortForHealthLoss(stat, oldValue) {
            if (stat.type !== IStats_1.Stat.Health || (stat.value ?? 0) >= oldValue)
                return false;
            if (!this.panel?.isSafeCraftingEnabled())
                return false;
            return true;
        }
        getItemId(item) {
            return (0, itemIdentity_1.getItemIdSafe)(item);
        }
        getCraftReusableItems(itemType, requiredItems) {
            if (!requiredItems?.length)
                return [];
            const recipe = ItemDescriptions_1.itemDescriptions[itemType]?.recipe;
            if (!recipe)
                return [];
            const reusable = [];
            let requiredIndex = 0;
            for (const component of recipe.components) {
                const selectedItems = requiredItems.slice(requiredIndex, requiredIndex + component.requiredAmount);
                requiredIndex += component.requiredAmount;
                if (selectedItems.length < component.requiredAmount)
                    break;
                if (!(0, craftingSelection_1.isSplitConsumption)(component.requiredAmount, component.consumedAmount))
                    continue;
                reusable.push(...selectedItems.slice((0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount)));
            }
            return reusable;
        }
        applyCraftReusableDurability(itemType, requiredItems) {
            const reusableItems = this.getCraftReusableItems(itemType, requiredItems);
            if (reusableItems.length === 0)
                return;
            for (const item of reusableItems) {
                const durabilityLoss = Math.max(0, item.getDamageModifier?.() ?? 0);
                if (durabilityLoss <= 0)
                    continue;
                if (item.isValid === false)
                    continue;
                item.damage("betterCraftingSplitUse", durabilityLoss);
            }
            this.debugLog("Applied reusable craft durability.", {
                itemType,
                reusableIds: (0, itemIdentity_1.getItemIds)(reusableItems, item => this.getItemId(item)),
            });
        }
        get debugLoggingEnabled() {
            return this.settings.debugLogging === true;
        }
        debugLog(message, payload) {
            if (!this.debugLoggingEnabled)
                return;
            if (payload === undefined) {
                craftDebugLog(message);
            }
            else {
                craftDebugLog(message, payload);
            }
        }
        isRemoteMultiplayerClient() {
            return multiplayer?.isConnected === true && multiplayer.isClient;
        }
        showMultiplayerMessage(message) {
            this.panel?.showMultiplayerMessage(message);
        }
        clearPendingApprovals(message) {
            for (const [requestId, pending] of this.pendingApprovals) {
                clearTimeout(pending.timeout);
                pending.resolve(false);
                this.debugLog(`Cleared pending approval ${requestId}.`);
            }
            this.pendingApprovals.clear();
            this.clearPendingVanillaBypasses("approval_clear");
            if (message) {
                this.showMultiplayerMessage(message);
            }
        }
        clearPendingVanillaBypasses(reason) {
            if (this.pendingVanillaBypasses.size === 0)
                return;
            for (const requestId of this.pendingVanillaBypasses.keys()) {
                this.debugLog(`Cleared pending vanilla bypass ${requestId}.`, { requestId, reason });
            }
            this.pendingVanillaBypasses.clear();
        }
        getTypeDebugName(type) {
            if (type === undefined)
                return "unknown";
            if (ItemManager_1.default.isGroup(type)) {
                return IItem_1.ItemTypeGroup[type] ?? `Group ${type}`;
            }
            return IItem_1.ItemType[type] ?? `Item ${type}`;
        }
        formatSelectionFailureMessage(details) {
            const slotLabel = details.slotIndex === -1
                ? "base component"
                : details.slotIndex !== undefined
                    ? `${this.getTypeDebugName(details.itemTypeOrGroup)} slot`
                    : "selection";
            switch (details.reason) {
                case "baseUnavailable":
                    return "Your selected base item is no longer valid. Please reselect it and try again.";
                case "duplicateSelection":
                    return `The same item was selected more than once for the ${slotLabel}. Please reselect that slot.`;
                case "itemProtected":
                    return `A selected item for the ${slotLabel} is protected and can no longer be used.`;
                case "pinnedToolUnavailable":
                    return `Your pinned tool for the ${slotLabel} is no longer usable. Bulk crafting stopped.`;
                case "missingSelection":
                case "itemUnavailable":
                default:
                    return `Your selected items for the ${slotLabel} are no longer valid. Please reselect that slot.`;
            }
        }
        logSelectionFailure(context, requestId, details) {
            this.debugLog(`${context} rejected (${requestId}): ${details.reason}.`, {
                requestId,
                reason: details.reason,
                slotIndex: details.slotIndex,
                itemTypeOrGroup: details.itemTypeOrGroup,
                requestedItemIds: details.requestedItemIds,
                candidateItemIds: details.candidateItemIds,
            });
        }
        createSelectionFailure(reason, options) {
            const details = { reason, ...options };
            return {
                ...details,
                message: this.formatSelectionFailureMessage(details),
            };
        }
        requestApproval(buildAndSend) {
            const requestId = this.nextMultiplayerRequestId++;
            this.debugLog(`Created approval request ${requestId}.`);
            const promise = new Promise(resolve => {
                const timeout = setTimeout(() => {
                    if (!this.pendingApprovals.has(requestId))
                        return;
                    this.pendingApprovals.delete(requestId);
                    this.debugLog(`Approval request ${requestId} timed out.`);
                    this.showMultiplayerMessage("The server did not respond in time. Please try again.");
                    resolve(false);
                }, 10_000);
                this.pendingApprovals.set(requestId, { resolve, timeout });
            });
            let sent;
            try {
                sent = buildAndSend(requestId);
            }
            catch (error) {
                const pending = this.pendingApprovals.get(requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingApprovals.delete(requestId);
                    this.debugLog(`Approval request ${requestId} failed before dispatch.`, error);
                    this.showMultiplayerMessage("Your selection changed. Please reselect the items and try again.");
                    pending.resolve(false);
                }
                return { requestId, promise };
            }
            if (sent === false) {
                const pending = this.pendingApprovals.get(requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingApprovals.delete(requestId);
                    this.debugLog(`Approval request ${requestId} was not dispatched.`);
                    this.showMultiplayerMessage("Your selection changed. Please reselect the items and try again.");
                    pending.resolve(false);
                }
            }
            else {
                this.debugLog(`Dispatched approval request ${requestId}.`);
            }
            return { requestId, promise };
        }
        handleCraftApproval(approval) {
            const pending = this.pendingApprovals.get(approval.requestId);
            if (!pending)
                return;
            this.pendingApprovals.delete(approval.requestId);
            clearTimeout(pending.timeout);
            this.debugLog(`Received approval ${approval.requestId}: ${approval.approved ? "approved" : "rejected"}.`);
            if (approval.selectionFailure) {
                this.debugLog(`Approval ${approval.requestId} failure details:`, approval.selectionFailure);
            }
            if (!approval.approved && approval.message) {
                this.showMultiplayerMessage(approval.message);
            }
            pending.resolve(approval.approved);
            if (!approval.approved) {
                if (this.pendingVanillaBypasses.delete(approval.requestId)) {
                    this.debugLog(`Rejected pending vanilla bypass ${approval.requestId}.`, approval);
                }
                return;
            }
            if (approval.kind === "vanillaBypass") {
                const pendingBypass = this.pendingVanillaBypasses.get(approval.requestId);
                if (!pendingBypass) {
                    this.debugLog(`Approved vanilla bypass ${approval.requestId} without a queued replay.`, approval);
                    return;
                }
                this.pendingVanillaBypasses.delete(approval.requestId);
                this.debugLog(`Replaying approved vanilla bypass ${approval.requestId}.`, {
                    requestId: approval.requestId,
                    itemType: pendingBypass.itemType,
                    requiredIds: (0, itemIdentity_1.getItemIds)(pendingBypass.requiredItems, item => this.getItemId(item)),
                    consumedIds: (0, itemIdentity_1.getItemIds)(pendingBypass.consumedItems, item => this.getItemId(item)),
                    baseId: this.getItemId(pendingBypass.baseItem),
                });
                void this.replayApprovedVanillaBypass(pendingBypass, approval.requestId);
            }
        }
        sendApproval(to, approval) {
            this.debugLog(`Sending approval ${approval.requestId}: ${approval.approved ? "approved" : "rejected"}.`, approval);
            const packet = new BetterCraftingApprovalPacket();
            packet.approval = approval;
            packet.sendTo(to);
        }
        sendStatus(to, status) {
            this.debugLog(`Sending status ${status.requestId}: ${status.kind}/${status.state}.`, status);
            const packet = new BetterCraftingStatusPacket();
            packet.status = status;
            packet.sendTo(to);
        }
        handleMultiplayerStatus(status) {
            this.debugLog(`Received status ${status.requestId}: ${status.kind}/${status.state}.`, status);
            if (status.selectionFailure) {
                this.debugLog(`Status ${status.requestId} failure details:`, status.selectionFailure);
            }
            if (status.state === "error" && status.message) {
                this.showMultiplayerMessage(status.message);
            }
        }
        getPlayerKey(player) {
            return player ? player.id : undefined;
        }
        getPlayerFromConnection(connection) {
            const identifier = connection?.playerIdentifier;
            if (!identifier)
                return;
            return game.playerManager.getByIdentifier(identifier);
        }
        getConnectionForPlayer(player) {
            const identifier = this.getEntityIdentifier(player);
            if (!identifier || !multiplayer?.isServer)
                return;
            return multiplayer.getClients().find(connection => connection.playerIdentifier === identifier);
        }
        getEntityIdentifier(entity) {
            return entity?.identifier;
        }
        getLiveServerPass(playerKey) {
            const pass = this.serverCraftPasses.get(playerKey);
            if (!pass)
                return;
            if (pass.remaining <= 0 || pass.expiresAt < Date.now()) {
                this.serverCraftPasses.delete(playerKey);
                return;
            }
            return pass;
        }
        hasLiveServerPass(playerKey) {
            return this.getLiveServerPass(playerKey) !== undefined;
        }
        rejectLivePass(connection, request, playerKey) {
            if (!this.hasLiveServerPass(playerKey))
                return false;
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: request.kind,
                approved: false,
                message: "A previous crafting batch is still active.",
            });
            return true;
        }
        buildCraftArgsSummary(args) {
            return {
                itemType: args[0],
                requiredCount: Array.isArray(args[1]) ? args[1].length : 0,
                consumedCount: Array.isArray(args[2]) ? args[2].length : 0,
                hasBase: args[3] !== undefined,
            };
        }
        reportBlockedRemoteCraft(player, message, diagnostics) {
            this.debugLog(`Blocked remote ${IAction_1.ActionType[diagnostics.actionType]} action: ${diagnostics.reason}.`, diagnostics);
            const connection = this.getConnectionForPlayer(player);
            if (!connection) {
                this.debugLog("Unable to send blocked craft status because no connection was found for the player.", diagnostics);
                return;
            }
            this.sendStatus(connection, {
                requestId: diagnostics.requestId ?? 0,
                kind: diagnostics.actionType === IAction_1.ActionType.Dismantle ? "dismantle" : "craft",
                state: "error",
                message,
            });
        }
        abortServerRequest(connection, request) {
            const player = this.getPlayerFromConnection(connection);
            const key = this.getPlayerKey(player);
            if (key === undefined)
                return;
            const pass = this.serverCraftPasses.get(key);
            if (pass && pass.requestId === request.requestId) {
                this.serverCraftPasses.delete(key);
            }
        }
        processVanillaBypassPermit(connection, request) {
            this.debugLog(`Received vanilla bypass permit request ${request.requestId}.`, {
                playerIdentifier: connection?.playerIdentifier,
                request,
            });
            const player = this.getPlayerFromConnection(connection);
            const key = this.getPlayerKey(player);
            if (key === undefined) {
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "vanillaBypass",
                    approved: false,
                    message: "The vanilla bypass request could not be matched to a multiplayer player.",
                });
                return;
            }
            if (this.rejectLivePass(connection, { requestId: request.requestId, kind: "vanillaBypass" }, key))
                return;
            const recipe = ItemDescriptions_1.itemDescriptions[request.itemType]?.recipe;
            if (!recipe) {
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "vanillaBypass",
                    approved: false,
                    message: "No recipe was found for that vanilla bypass request.",
                });
                return;
            }
            this.serverCraftPasses.set(key, {
                actionType: IAction_1.ActionType.Craft,
                kind: "vanillaBypass",
                itemType: request.itemType,
                remaining: 1,
                requestId: request.requestId,
                expiresAt: Date.now() + 10_000,
            });
            this.serverVanillaBypassPermits.delete(key);
            this.debugLog(`Granted vanilla bypass pass ${request.requestId} to player ${key}.`, {
                playerIdentifier: connection?.playerIdentifier,
                playerKey: key,
                itemType: request.itemType,
                request,
            });
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "vanillaBypass",
                approved: true,
                passCount: 1,
            });
        }
        getVanillaCraftActionDetails(args) {
            const itemType = args[0];
            if (itemType === undefined)
                return;
            const requiredItems = Array.isArray(args[1]) ? args[1] : undefined;
            const consumedItems = Array.isArray(args[2]) ? args[2] : undefined;
            const base = args[3];
            const requiredItemIds = (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item));
            const consumedItemIds = (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item));
            const baseItemId = this.getItemId(base);
            if ((requiredItems?.length ?? 0) !== requiredItemIds.length)
                return;
            if ((consumedItems?.length ?? 0) !== consumedItemIds.length)
                return;
            if (base !== undefined && baseItemId === undefined)
                return;
            return {
                itemType,
                requiredItemIds,
                consumedItemIds,
                baseItemId,
            };
        }
        areNumberArraysEqual(left, right) {
            if (left.length !== right.length)
                return false;
            for (let i = 0; i < left.length; i++) {
                if (left[i] !== right[i])
                    return false;
            }
            return true;
        }
        consumeVanillaBypassPermit(executor, args) {
            const key = this.getPlayerKey(executor);
            if (key === undefined)
                return false;
            const permit = this.serverVanillaBypassPermits.get(key);
            if (!permit) {
                this.debugLog(`No vanilla bypass permit found for player ${key}.`, {
                    playerIdentifier: this.getEntityIdentifier(executor),
                    playerKey: key,
                    argsSummary: this.buildCraftArgsSummary(args),
                });
                return false;
            }
            if (permit.expiresAt < Date.now()) {
                this.debugLog(`Vanilla bypass permit ${permit.requestId} expired for player ${key}.`);
                this.serverVanillaBypassPermits.delete(key);
                return false;
            }
            const actionDetails = this.getVanillaCraftActionDetails(args);
            if (!actionDetails) {
                this.serverVanillaBypassPermits.delete(key);
                return false;
            }
            const matches = actionDetails.itemType === permit.itemType
                && actionDetails.baseItemId === permit.baseItemId
                && this.areNumberArraysEqual(actionDetails.requiredItemIds, permit.requiredItemIds)
                && this.areNumberArraysEqual(actionDetails.consumedItemIds, permit.consumedItemIds);
            this.serverVanillaBypassPermits.delete(key);
            if (!matches) {
                this.debugLog(`Vanilla bypass permit ${permit.requestId} did not match server craft args for player ${key}.`, {
                    permit,
                    actionDetails,
                });
                return false;
            }
            this.debugLog(`Consumed vanilla bypass permit ${permit.requestId} for player ${key}.`, actionDetails);
            return true;
        }
        trySendVanillaBypassPermit(args) {
            if (!this.isRemoteMultiplayerClient())
                return false;
            const actionDetails = this.getVanillaCraftActionDetails(args);
            if (!actionDetails) {
                this.debugLog("Failed to serialize vanilla bypass permit from craft args.", args);
                this.showMultiplayerMessage("The selected vanilla craft could not be validated for multiplayer. Release the bypass hotkey and try again.");
                return false;
            }
            const itemType = args[0];
            if (itemType === undefined)
                return false;
            const requiredItems = Array.isArray(args[1]) ? [...args[1]] : undefined;
            const consumedItems = Array.isArray(args[2]) ? [...args[2]] : undefined;
            const baseItem = args[3];
            const { requestId, promise } = this.requestApproval(currentRequestId => {
                const packet = new BetterCraftingVanillaBypassPermitPacket();
                packet.request = {
                    requestId: currentRequestId,
                    ...actionDetails,
                };
                this.pendingVanillaBypasses.set(currentRequestId, {
                    itemType,
                    requiredItems,
                    consumedItems,
                    baseItem,
                });
                this.debugLog(`Queued vanilla bypass request ${currentRequestId}.`, {
                    requestId: currentRequestId,
                    itemType,
                    requiredIds: (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item)),
                    consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item)),
                    baseId: this.getItemId(baseItem),
                });
                packet.send();
                return true;
            });
            this.debugLog(`Blocked original vanilla craft pending bypass approval ${requestId}.`, {
                requestId,
                itemType,
            });
            void promise.then(approved => {
                if (!approved && this.pendingVanillaBypasses.delete(requestId)) {
                    this.debugLog(`Cleared denied/timed-out vanilla bypass ${requestId}.`, { requestId });
                }
            });
            return true;
        }
        async replayApprovedVanillaBypass(pendingBypass, requestId) {
            this.bypassIntercept = true;
            try {
                await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, pendingBypass.itemType, pendingBypass.requiredItems ? [...pendingBypass.requiredItems] : undefined, pendingBypass.consumedItems ? [...pendingBypass.consumedItems] : undefined, pendingBypass.baseItem, undefined);
            }
            finally {
                this.debugLog(`Finished replaying vanilla bypass ${requestId}.`, { requestId, itemType: pendingBypass.itemType });
                this.bypassIntercept = false;
            }
        }
        consumeServerPass(executor, actionType, args) {
            const key = this.getPlayerKey(executor);
            if (key === undefined)
                return false;
            const pass = this.serverCraftPasses.get(key);
            if (!pass) {
                this.debugLog(`No server pass found for player ${key}.`, {
                    playerIdentifier: this.getEntityIdentifier(executor),
                    playerKey: key,
                    actionType,
                    argsSummary: this.buildCraftArgsSummary(args),
                });
                return false;
            }
            if (pass.actionType !== actionType) {
                this.debugLog(`Server pass action type mismatch for player ${key}.`, {
                    playerIdentifier: this.getEntityIdentifier(executor),
                    playerKey: key,
                    requestedActionType: actionType,
                    pass,
                    argsSummary: this.buildCraftArgsSummary(args),
                });
                return false;
            }
            if (pass.expiresAt < Date.now()) {
                this.debugLog(`Pass expired for player ${key}.`);
                this.serverCraftPasses.delete(key);
                return false;
            }
            if (actionType === IAction_1.ActionType.Craft) {
                if (args[0] !== pass.itemType) {
                    this.debugLog(`Server craft pass item type mismatch for player ${key}.`, {
                        playerIdentifier: this.getEntityIdentifier(executor),
                        playerKey: key,
                        pass,
                        argsSummary: this.buildCraftArgsSummary(args),
                    });
                    return false;
                }
            }
            else if (actionType === IAction_1.ActionType.Dismantle) {
                const item = isItemArg(args[0]) ? args[0] : undefined;
                const itemId = getItemId(item);
                if (!item || item.type !== pass.itemType || itemId === undefined) {
                    this.debugLog(`Server dismantle pass target mismatch for player ${key}.`, {
                        playerIdentifier: this.getEntityIdentifier(executor),
                        playerKey: key,
                        pass,
                        itemType: item?.type,
                        itemId,
                    });
                    return false;
                }
                if (pass.targetItemIds && !pass.targetItemIds.has(itemId)) {
                    this.debugLog(`Server dismantle pass item id mismatch for player ${key}.`, {
                        playerIdentifier: this.getEntityIdentifier(executor),
                        playerKey: key,
                        pass,
                        itemId,
                    });
                    return false;
                }
                pass.targetItemIds?.delete(itemId);
            }
            pass.remaining--;
            this.debugLog(`Consumed server pass ${pass.requestId} for player ${key}.`, {
                playerIdentifier: this.getEntityIdentifier(executor),
                playerKey: key,
                actionType,
                remaining: pass.remaining,
                argsSummary: this.buildCraftArgsSummary(args),
            });
            if (pass.remaining <= 0) {
                this.serverCraftPasses.delete(key);
            }
            return true;
        }
        ensurePanel() {
            if (!this.panel) {
                const gameScreen = ui?.screens?.get(IScreen_1.ScreenId.Game);
                if (gameScreen) {
                    this.panel = new BetterCraftingDialog_1.default(async (itemType, required, consumed, base) => {
                        await this.executeCraft(itemType, required, consumed, base);
                    }, async (itemType, quantity, excludedIds) => {
                        await this.executeBulkCraft(itemType, quantity, excludedIds);
                    }, async (items, requiredItem) => {
                        await this.executeDismantle(items, requiredItem);
                    }, () => this.settings, this.settings.safeCrafting);
                    this.panel.setPanelHideCallback(() => {
                        this.clearPendingApprovals();
                    });
                    gameScreen.append(this.panel);
                }
            }
            return this.panel;
        }
        findMatchingItems(player, type, cache) {
            if (!player?.island)
                return [];
            const cacheKey = getMatchingItemCacheKey(type);
            const cached = cache?.get(cacheKey);
            if (cached)
                return cached;
            const items = player.island.items;
            const subContainerOpts = { includeSubContainers: true };
            const isGroup = ItemManager_1.default.isGroup(type);
            const result = isGroup
                ? items.getItemsInContainerByGroup(player, type, subContainerOpts)
                : items.getItemsInContainerByType(player, type, subContainerOpts);
            const seenIds = new Set(result.map(item => getItemId(item)).filter((id) => id !== undefined));
            for (const container of items.getAdjacentContainers(player)) {
                const adjacentItems = isGroup
                    ? items.getItemsInContainerByGroup(container, type, subContainerOpts)
                    : items.getItemsInContainerByType(container, type, subContainerOpts);
                for (const item of adjacentItems) {
                    const itemId = getItemId(item);
                    if (itemId === undefined || seenIds.has(itemId))
                        continue;
                    seenIds.add(itemId);
                    result.push(item);
                }
            }
            const matchingItems = (0, craftingSelection_1.filterSelectableItems)(result, getItemId).sort((a, b) => getQualitySortKey(b) - getQualitySortKey(a));
            cache?.set(cacheKey, matchingItems);
            return matchingItems;
        }
        buildRecipeInventorySnapshot(player, itemType) {
            const recipe = ItemDescriptions_1.itemDescriptions[itemType]?.recipe;
            if (!recipe)
                return { itemType, recipe: "missing" };
            return {
                itemType,
                base: recipe.baseComponent === undefined
                    ? undefined
                    : {
                        type: recipe.baseComponent,
                        matchingIds: (0, itemIdentity_1.getItemIds)(this.findMatchingItems(player, recipe.baseComponent), item => this.getItemId(item)),
                    },
                slots: recipe.components.map((component, slotIndex) => ({
                    slotIndex,
                    type: component.type,
                    requiredAmount: component.requiredAmount,
                    consumedAmount: component.consumedAmount,
                    matchingIds: (0, itemIdentity_1.getItemIds)(this.findMatchingItems(player, component.type), item => this.getItemId(item)),
                })),
            };
        }
        buildSlotSelectionMap(selections) {
            const result = new Map();
            for (const selection of selections) {
                result.set(selection.slotIndex, [...selection.itemIds]);
            }
            return result;
        }
        resolveSelectedItems(player, type, itemIds, reservedIds, options = {}) {
            const candidates = this.findMatchingItems(player, type, options.matchingItemCache);
            const candidateItemIds = candidates.map(item => getItemId(item)).filter((id) => id !== undefined);
            const byId = new Map();
            for (const item of candidates) {
                const id = getItemId(item);
                if (id !== undefined && !byId.has(id)) {
                    byId.set(id, item);
                }
            }
            const resolved = [];
            for (const itemId of itemIds) {
                if (reservedIds.has(itemId)) {
                    return {
                        failure: this.createSelectionFailure("duplicateSelection", {
                            slotIndex: options.slotIndex,
                            itemTypeOrGroup: type,
                            requestedItemIds: [...itemIds],
                            candidateItemIds,
                        }),
                    };
                }
                const item = byId.get(itemId);
                if (!item) {
                    return {
                        failure: this.createSelectionFailure(options.failureReason ?? "itemUnavailable", {
                            slotIndex: options.slotIndex,
                            itemTypeOrGroup: type,
                            requestedItemIds: [...itemIds],
                            candidateItemIds,
                        }),
                    };
                }
                if ((0, itemState_1.isItemProtected)(item)) {
                    return {
                        failure: this.createSelectionFailure("itemProtected", {
                            slotIndex: options.slotIndex,
                            itemTypeOrGroup: type,
                            requestedItemIds: [...itemIds],
                            candidateItemIds,
                        }),
                    };
                }
                reservedIds.add(itemId);
                resolved.push(item);
            }
            return { value: resolved };
        }
        resolveCraftSelection(player, request) {
            const recipe = ItemDescriptions_1.itemDescriptions[request.itemType]?.recipe;
            if (!recipe) {
                return {
                    failure: this.createSelectionFailure("itemUnavailable", {
                        requestedItemIds: [],
                        candidateItemIds: [],
                    }),
                };
            }
            const slotSelections = this.buildSlotSelectionMap(request.slotSelections);
            const reservedIds = new Set();
            const resolvedSelections = [];
            for (let i = 0; i < recipe.components.length; i++) {
                const component = recipe.components[i];
                const selectedIds = slotSelections.get(i) ?? [];
                if (selectedIds.length < component.requiredAmount) {
                    return {
                        failure: this.createSelectionFailure("missingSelection", {
                            slotIndex: i,
                            itemTypeOrGroup: component.type,
                            requestedItemIds: selectedIds,
                            candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id) => id !== undefined),
                        }),
                    };
                }
                const resolved = this.resolveSelectedItems(player, component.type, selectedIds, reservedIds, { slotIndex: i });
                if (!resolved.value || resolved.value.length < component.requiredAmount) {
                    return { failure: resolved.failure };
                }
                const partitioned = this.partitionComponentSelection(component.requiredAmount, component.consumedAmount, resolved.value);
                resolvedSelections.push(partitioned.required);
            }
            let base;
            if (recipe.baseComponent !== undefined) {
                if (request.baseItemId === undefined) {
                    return {
                        failure: this.createSelectionFailure("missingSelection", {
                            slotIndex: -1,
                            itemTypeOrGroup: recipe.baseComponent,
                            candidateItemIds: this.findMatchingItems(player, recipe.baseComponent).map(item => getItemId(item)).filter((id) => id !== undefined),
                        }),
                    };
                }
                const resolvedBase = this.resolveSelectedItems(player, recipe.baseComponent, [request.baseItemId], reservedIds, {
                    slotIndex: -1,
                    failureReason: "baseUnavailable",
                });
                if (!resolvedBase.value?.length)
                    return { failure: resolvedBase.failure };
                base = resolvedBase.value[0];
            }
            const payload = (0, craftingSelection_1.buildCraftExecutionPayload)(resolvedSelections, (_, slotIndex) => {
                const component = recipe.components[slotIndex];
                return {
                    requiredAmount: component?.requiredAmount ?? 0,
                    consumedAmount: component?.consumedAmount ?? 0,
                };
            });
            this.debugLog("Resolved multiplayer normal craft selection.", {
                itemType: request.itemType,
                slots: request.slotSelections.map(selection => {
                    const component = recipe.components[selection.slotIndex];
                    const consumedIds = component
                        ? (0, craftingSelection_1.partitionSelectedItems)(selection.itemIds, component.requiredAmount, component.consumedAmount).consumed
                        : [];
                    return {
                        slotIndex: selection.slotIndex,
                        requiredAmount: component?.requiredAmount,
                        consumedAmount: component?.consumedAmount,
                        selectedIds: selection.itemIds,
                        consumedIds,
                        requiredIds: selection.itemIds,
                    };
                }),
                baseId: request.baseItemId,
            });
            return { value: { required: payload.required, consumed: payload.consumed, base } };
        }
        partitionComponentSelection(requiredAmount, consumedAmount, items) {
            return (0, craftingSelection_1.partitionSelectedItems)(items, requiredAmount, consumedAmount);
        }
        resolveBulkSelection(player, request, sessionConsumedIds, matchingItemCache = new Map()) {
            const recipe = ItemDescriptions_1.itemDescriptions[request.itemType]?.recipe;
            if (!recipe) {
                return {
                    failure: this.createSelectionFailure("itemUnavailable", {
                        requestedItemIds: [],
                        candidateItemIds: [],
                    }),
                };
            }
            const reservedIds = new Set(request.excludedIds);
            for (const itemId of sessionConsumedIds) {
                reservedIds.add(itemId);
            }
            const pinnedToolSelections = this.buildSlotSelectionMap(request.pinnedToolSelections);
            const pinnedUsedSelections = this.buildSlotSelectionMap(request.pinnedUsedSelections ?? []);
            const required = [];
            const consumed = [];
            const nextConsumedIds = new Set(sessionConsumedIds);
            const preReservedUsedSelections = new Map();
            const preReservedToolSelections = new Map();
            for (let i = 0; i < recipe.components.length; i++) {
                const component = recipe.components[i];
                if ((0, craftingSelection_1.isSplitConsumption)(component.requiredAmount, component.consumedAmount)) {
                    const pinnedUsedIds = pinnedUsedSelections.get(i) ?? [];
                    if (pinnedUsedIds.length === 0)
                        continue;
                    const resolvedUsed = this.resolveSelectedItems(player, component.type, pinnedUsedIds, reservedIds, {
                        slotIndex: i,
                        failureReason: "pinnedToolUnavailable",
                        matchingItemCache,
                    });
                    const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount);
                    if (resolvedUsed.value && resolvedUsed.value.length >= usedCount) {
                        preReservedUsedSelections.set(i, resolvedUsed.value.slice(0, usedCount));
                    }
                    continue;
                }
                if (component.consumedAmount > 0)
                    continue;
                const pinnedToolIds = pinnedToolSelections.get(i) ?? [];
                if (pinnedToolIds.length === 0)
                    continue;
                const resolvedPinned = this.resolveSelectedItems(player, component.type, pinnedToolIds, reservedIds, {
                    slotIndex: i,
                    failureReason: "pinnedToolUnavailable",
                    matchingItemCache,
                });
                if (resolvedPinned.value && resolvedPinned.value.length >= component.requiredAmount) {
                    preReservedToolSelections.set(i, resolvedPinned.value.slice(0, component.requiredAmount));
                }
            }
            let base;
            if (recipe.baseComponent !== undefined) {
                const baseCandidates = this.findMatchingItems(player, recipe.baseComponent, matchingItemCache)
                    .filter(item => {
                    const itemId = getItemId(item);
                    return itemId !== undefined && !reservedIds.has(itemId) && !(0, itemState_1.isItemProtected)(item);
                });
                if (baseCandidates.length === 0) {
                    return {
                        failure: this.createSelectionFailure("baseUnavailable", {
                            slotIndex: -1,
                            itemTypeOrGroup: recipe.baseComponent,
                            candidateItemIds: [],
                        }),
                    };
                }
                base = baseCandidates[0];
                const baseId = getItemId(base);
                if (baseId !== undefined) {
                    reservedIds.add(baseId);
                    nextConsumedIds.add(baseId);
                }
            }
            for (let i = 0; i < recipe.components.length; i++) {
                const component = recipe.components[i];
                const pinnedToolIds = pinnedToolSelections.get(i) ?? [];
                const pinnedUsedIds = pinnedUsedSelections.get(i) ?? [];
                if ((0, craftingSelection_1.isSplitConsumption)(component.requiredAmount, component.consumedAmount) && pinnedUsedIds.length > 0) {
                    const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount);
                    const consumedCount = (0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount);
                    const usedItems = preReservedUsedSelections.get(i);
                    if (!usedItems || usedItems.length < usedCount) {
                        return {
                            failure: this.createSelectionFailure("pinnedToolUnavailable", {
                                slotIndex: i,
                                itemTypeOrGroup: component.type,
                                requestedItemIds: pinnedUsedIds,
                                candidateItemIds: this.findMatchingItems(player, component.type, matchingItemCache).map(item => getItemId(item)).filter((id) => id !== undefined),
                            }),
                        };
                    }
                    const candidates = this.findMatchingItems(player, component.type, matchingItemCache)
                        .filter(item => {
                        const itemId = getItemId(item);
                        return itemId !== undefined && !reservedIds.has(itemId) && !(0, itemState_1.isItemProtected)(item);
                    })
                        .slice(0, consumedCount);
                    if (candidates.length < consumedCount) {
                        return {
                            failure: this.createSelectionFailure("itemUnavailable", {
                                slotIndex: i,
                                itemTypeOrGroup: component.type,
                                requestedItemIds: pinnedUsedIds,
                                candidateItemIds: this.findMatchingItems(player, component.type, matchingItemCache).map(item => getItemId(item)).filter((id) => id !== undefined),
                            }),
                        };
                    }
                    required.push(...candidates, ...usedItems);
                    consumed.push(...candidates);
                    for (const item of candidates) {
                        const itemId = getItemId(item);
                        if (itemId !== undefined) {
                            reservedIds.add(itemId);
                            nextConsumedIds.add(itemId);
                        }
                    }
                    continue;
                }
                if (component.consumedAmount <= 0 && pinnedToolIds.length > 0) {
                    const resolvedPinned = preReservedToolSelections.get(i);
                    if (!resolvedPinned || resolvedPinned.length < component.requiredAmount) {
                        return {
                            failure: this.createSelectionFailure("pinnedToolUnavailable", {
                                slotIndex: i,
                                itemTypeOrGroup: component.type,
                                requestedItemIds: pinnedToolIds,
                                candidateItemIds: this.findMatchingItems(player, component.type, matchingItemCache).map(item => getItemId(item)).filter((id) => id !== undefined),
                            }),
                        };
                    }
                    required.push(...resolvedPinned.slice(0, component.requiredAmount));
                    continue;
                }
                const candidates = this.findMatchingItems(player, component.type, matchingItemCache)
                    .filter(item => {
                    const itemId = getItemId(item);
                    return itemId !== undefined && !reservedIds.has(itemId) && !(0, itemState_1.isItemProtected)(item);
                })
                    .slice(0, component.requiredAmount);
                if (candidates.length < component.requiredAmount) {
                    return {
                        failure: this.createSelectionFailure("itemUnavailable", {
                            slotIndex: i,
                            itemTypeOrGroup: component.type,
                            requestedItemIds: pinnedToolIds,
                            candidateItemIds: this.findMatchingItems(player, component.type, matchingItemCache).map(item => getItemId(item)).filter((id) => id !== undefined),
                        }),
                    };
                }
                required.push(...candidates);
                const partitioned = (0, craftingSelection_1.partitionSelectedItems)(candidates, component.requiredAmount, component.consumedAmount);
                if (component.consumedAmount > 0) {
                    consumed.push(...partitioned.consumed);
                }
                for (const item of candidates) {
                    const itemId = getItemId(item);
                    if (itemId !== undefined) {
                        reservedIds.add(itemId);
                        if (partitioned.consumed.includes(item)) {
                            nextConsumedIds.add(itemId);
                        }
                    }
                }
            }
            return { value: { required, consumed, base, sessionConsumedIds: nextConsumedIds } };
        }
        resolveDismantleTargets(player, request) {
            if (request.requiredItemId !== undefined && request.targetItemIds.includes(request.requiredItemId))
                return;
            const nearby = this.findMatchingItems(player, request.itemType);
            const byId = new Map();
            for (const item of nearby) {
                const itemId = getItemId(item);
                if (itemId !== undefined) {
                    byId.set(itemId, item);
                }
            }
            const resolved = [];
            for (const itemId of request.targetItemIds) {
                const item = byId.get(itemId);
                if (!item || (0, itemState_1.isItemProtected)(item))
                    return;
                resolved.push(item);
            }
            return resolved;
        }
        async executeCraft(itemType, required, consumed, base) {
            const recipe = ItemDescriptions_1.itemDescriptions[itemType]?.recipe;
            if (!recipe)
                return;
            const staminaCost = (0, craftStamina_1.getCraftStaminaCost)(recipe.level);
            if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < staminaCost)
                return;
            if (this.isRemoteMultiplayerClient()) {
                const { promise } = this.requestApproval(requestId => {
                    const request = this.panel?.serializeCraftSelectionRequest(requestId);
                    if (!request)
                        return false;
                    this.debugLog(`Dispatching craft approval request ${requestId}.`, this.panel?.buildCraftRequestDiagnostics(request));
                    const packet = new BetterCraftingCraftRequestPacket();
                    packet.request = request;
                    packet.send();
                    return true;
                });
                const approved = await promise;
                if (!approved)
                    return;
            }
            if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < staminaCost)
                return;
            this.bypassIntercept = true;
            try {
                const requiredItems = required ? [...required] : undefined;
                const consumedItems = consumed ? [...consumed] : undefined;
                if (this.debugLoggingEnabled) {
                    this.debugLog("NormalCraftPayload", {
                        itemType,
                        requiredIds: (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item)),
                        consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item)),
                        baseId: base ? this.getItemId(base) : undefined,
                        inventoryBefore: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                    });
                }
                await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, requiredItems, consumedItems, base, undefined);
                if (this.debugLoggingEnabled) {
                    this.debugLog("NormalCraftPostExecute", {
                        itemType,
                        requiredIds: (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item)),
                        consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item)),
                        baseId: base ? this.getItemId(base) : undefined,
                        inventoryAfterExecute: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                    });
                }
                this.panel?.refreshVisibleCraftingViews(true);
                if (this.debugLoggingEnabled) {
                    this.debugLog("NormalCraftPostRefresh", {
                        itemType,
                        inventoryAfterRefresh: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                        panelSelectionState: this.panel?.buildCurrentNormalCraftSelectionState(),
                    });
                }
            }
            finally {
                this.bypassIntercept = false;
            }
        }
        waitForTurnEnd(timeoutMs = 10_000) {
            const player = localPlayer;
            if (!player?.event?.subscribeNext)
                return Promise.resolve();
            const hasDelay = player.hasDelay?.bind(player);
            const turnEndPromise = new Promise(resolve => {
                player.event.subscribeNext("turnEnd", () => {
                    const poll = () => {
                        if (this.bulkAbortController?.aborted || !hasDelay?.()) {
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
            let timeoutHandle;
            const timeoutPromise = new Promise(resolve => {
                timeoutHandle = setTimeout(() => {
                    if (this.bulkAbortController && !this.bulkAbortController.aborted) {
                        this.abortBulkCraft("turn_wait_timeout");
                    }
                    resolve();
                }, timeoutMs);
            });
            return Promise.race([turnEndPromise, abortPromise, timeoutPromise]).finally(() => {
                if (timeoutHandle !== undefined) {
                    clearTimeout(timeoutHandle);
                }
                if (this.bulkAbortController?.resolveWait) {
                    this.bulkAbortController.resolveWait = null;
                }
            });
        }
        waitForActionDelayClear(timeoutMs = 10_000) {
            const startedAt = Date.now();
            const player = localPlayer;
            const hasDelay = player?.hasDelay?.bind(player);
            return new Promise(resolve => {
                const poll = () => {
                    if (this.bulkAbortController?.aborted || !hasDelay?.()) {
                        resolve();
                    }
                    else if (Date.now() - startedAt >= timeoutMs) {
                        this.abortBulkCraft("action_delay_timeout");
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
        canUseForDismantle(requiredItem, leaveOneUse = false) {
            if (!requiredItem)
                return true;
            const perUseLoss = (0, itemState_1.getDismantleDurabilityLoss)(requiredItem, IAction_1.ActionType.Dismantle);
            if (perUseLoss <= 0)
                return true;
            return (0, itemState_1.canUseDurability)(requiredItem.durability, perUseLoss, leaveOneUse);
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
            let bulkRequestId;
            if (this.isRemoteMultiplayerClient()) {
                const { promise } = this.requestApproval(currentRequestId => {
                    bulkRequestId = currentRequestId;
                    const request = this.panel?.serializeBulkCraftRequest(currentRequestId, quantity);
                    if (!request)
                        return false;
                    this.debugLog(`Dispatching bulk approval request ${currentRequestId}.`, this.panel?.buildBulkRequestDiagnostics(request));
                    const packet = new BetterCraftingBulkCraftRequestPacket();
                    packet.request = request;
                    packet.send();
                    return true;
                });
                const approved = await promise;
                if (!approved)
                    return;
            }
            if (this.isBulkCrafting)
                return;
            const recipe = ItemDescriptions_1.itemDescriptions[itemType]?.recipe;
            if (!recipe)
                return;
            const staminaCost = (0, craftStamina_1.getCraftStaminaCost)(recipe.level);
            this.bulkAbortController = { aborted: false, reason: "", resolveWait: null };
            const cleanupHooks = this.registerBulkInterruptHooks();
            this.panel?.setBulkAbortCallback(() => {
                this.abortBulkCraft("user_stop");
                if (bulkRequestId !== undefined && this.isRemoteMultiplayerClient()) {
                    const abortPacket = new BetterCraftingAbortRequestPacket();
                    abortPacket.request = { requestId: bulkRequestId };
                    abortPacket.send();
                }
            });
            this.panel?.onBulkCraftStart(quantity);
            this.isBulkCrafting = true;
            this.bypassIntercept = true;
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
                    if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < staminaCost)
                        break;
                    const resolved = this.panel?.resolveForBulkCraft(itemType, excludedIds, sessionConsumedIds);
                    if (!resolved) {
                        const message = this.panel?.consumeLastBulkResolutionMessage();
                        if (message) {
                            this.abortBulkCraft("selection_invalid");
                            this.panel?.showMultiplayerMessage(message);
                            if (bulkRequestId !== undefined && this.isRemoteMultiplayerClient()) {
                                const abortPacket = new BetterCraftingAbortRequestPacket();
                                abortPacket.request = { requestId: bulkRequestId };
                                abortPacket.send();
                            }
                        }
                        break;
                    }
                    if (this.bulkAbortController.aborted)
                        break;
                    const turnEndPromise = this.waitForTurnEnd();
                    const requiredItems = [...resolved.required];
                    const consumedItems = [...resolved.consumed];
                    if (this.debugLoggingEnabled) {
                        this.debugLog("BulkCraftPayload", {
                            itemType,
                            iteration: i + 1,
                            requiredIds: (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item)),
                            consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item)),
                            baseId: resolved.base ? this.getItemId(resolved.base) : undefined,
                            inventoryBefore: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                        });
                    }
                    await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, requiredItems.length > 0 ? requiredItems : undefined, consumedItems.length > 0 ? consumedItems : undefined, resolved.base, undefined);
                    if (this.debugLoggingEnabled) {
                        this.debugLog("BulkCraftPostExecute", {
                            itemType,
                            iteration: i + 1,
                            inventoryAfterExecute: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                        });
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
                    this.panel?.refreshBulkCraftView(true, true, true);
                    await turnEndPromise;
                }
            }
            finally {
                cleanupHooks();
                this.bulkAbortController = null;
                this.panel?.setBulkAbortCallback(null);
                this.isBulkCrafting = false;
                this.bypassIntercept = false;
                this.panel?.onBulkCraftEnd();
            }
        }
        async executeDismantle(items, requiredItem) {
            let dismantleRequestId;
            if (this.isRemoteMultiplayerClient()) {
                const { promise } = this.requestApproval(requestId => {
                    dismantleRequestId = requestId;
                    const request = this.panel?.serializeDismantleRequest(requestId, items.length);
                    if (!request)
                        return false;
                    const packet = new BetterCraftingDismantleRequestPacket();
                    packet.request = request;
                    packet.send();
                    return true;
                });
                const approved = await promise;
                if (!approved)
                    return;
            }
            if (this.isBulkCrafting || items.length === 0)
                return;
            this.bulkAbortController = { aborted: false, reason: "", resolveWait: null };
            const cleanupHooks = this.registerBulkInterruptHooks();
            this.panel?.setBulkAbortCallback(() => {
                this.abortBulkCraft("user_stop");
                if (dismantleRequestId !== undefined && this.isRemoteMultiplayerClient()) {
                    const abortPacket = new BetterCraftingAbortRequestPacket();
                    abortPacket.request = { requestId: dismantleRequestId };
                    abortPacket.send();
                }
            });
            this.panel?.onBulkCraftStart(items.length, "Dismantling");
            this.isBulkCrafting = true;
            this.bypassIntercept = true;
            let activeRequiredItem = requiredItem;
            let stopAfterCurrent = false;
            try {
                for (let i = 0; i < items.length; i++) {
                    if (this.bulkAbortController.aborted)
                        break;
                    await this.waitForActionDelayClear();
                    if (this.bulkAbortController.aborted)
                        break;
                    if (!localPlayer?.island)
                        break;
                    if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < 1)
                        break;
                    const requiresRequiredItem = this.panel?.requiresDismantleRequiredItem() ?? false;
                    if (requiresRequiredItem) {
                        const resolvedRequiredItem = this.panel?.resolveDismantleRequiredSelection() ?? activeRequiredItem;
                        const preserveDurability = this.panel?.shouldPreserveDismantleRequiredDurability() ?? true;
                        if (!resolvedRequiredItem || !this.canUseForDismantle(resolvedRequiredItem, preserveDurability))
                            break;
                        stopAfterCurrent = activeRequiredItem !== undefined && resolvedRequiredItem !== activeRequiredItem;
                        activeRequiredItem = resolvedRequiredItem;
                    }
                    else {
                        activeRequiredItem = undefined;
                    }
                    const item = items[i];
                    if (!item)
                        break;
                    const turnEndPromise = this.waitForTurnEnd();
                    try {
                        await ActionExecutor_1.default.get(Dismantle_1.default).execute(localPlayer, item, activeRequiredItem);
                    }
                    catch (error) {
                        this.debugLog("Dismantle failed", error);
                        break;
                    }
                    this.panel?.setBulkProgress(i + 1, items.length, "Dismantling");
                    this.panel?.refreshDismantleView(true, true, true);
                    await turnEndPromise;
                    if (stopAfterCurrent)
                        break;
                }
            }
            finally {
                cleanupHooks();
                this.bulkAbortController = null;
                this.panel?.setBulkAbortCallback(null);
                this.isBulkCrafting = false;
                this.bypassIntercept = false;
                this.panel?.onBulkCraftEnd();
            }
        }
        processCraftRequest(connection, request) {
            this.debugLog(`Received craft approval request ${request.requestId}.`, {
                playerIdentifier: connection?.playerIdentifier,
                request,
            });
            const player = this.getPlayerFromConnection(connection);
            if (!player)
                return;
            const key = this.getPlayerKey(player);
            if (key === undefined)
                return;
            if (this.rejectLivePass(connection, { requestId: request.requestId, kind: "craft" }, key))
                return;
            const resolved = this.resolveCraftSelection(player, request);
            if (!resolved.value) {
                if (resolved.failure) {
                    this.logSelectionFailure("Craft request", request.requestId, resolved.failure);
                }
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "craft",
                    approved: false,
                    message: resolved.failure?.message ?? "Your crafting selection is no longer valid.",
                    selectionFailure: resolved.failure,
                });
                return;
            }
            this.serverCraftPasses.set(key, {
                actionType: IAction_1.ActionType.Craft,
                kind: "craft",
                itemType: request.itemType,
                remaining: 1,
                requestId: request.requestId,
                expiresAt: Date.now() + 30_000,
            });
            this.debugLog(`Granted craft pass ${request.requestId} to player ${key}.`, {
                playerIdentifier: connection?.playerIdentifier,
                playerKey: key,
                itemType: request.itemType,
            });
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "craft",
                approved: true,
                passCount: 1,
            });
        }
        processBulkCraftRequest(connection, request) {
            this.debugLog(`Received bulk craft approval request ${request.requestId}.`, {
                playerIdentifier: connection?.playerIdentifier,
                request,
            });
            const player = this.getPlayerFromConnection(connection);
            if (!player)
                return;
            const key = this.getPlayerKey(player);
            if (key === undefined)
                return;
            if (this.rejectLivePass(connection, { requestId: request.requestId, kind: "bulkCraft" }, key))
                return;
            if (!Number.isFinite(request.quantity) || !Number.isInteger(request.quantity) || request.quantity <= 0 || request.quantity > MAX_BULK_CRAFT_QUANTITY) {
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "bulkCraft",
                    approved: false,
                    message: `Bulk craft quantity must be between 1 and ${MAX_BULK_CRAFT_QUANTITY}.`,
                });
                return;
            }
            const recipe = ItemDescriptions_1.itemDescriptions[request.itemType]?.recipe;
            if (!recipe) {
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "bulkCraft",
                    approved: false,
                    message: "No recipe was found for that craft request.",
                });
                return;
            }
            let sessionConsumedIds = new Set();
            const matchingItemCache = new Map();
            for (let i = 0; i < request.quantity; i++) {
                const resolved = this.resolveBulkSelection(player, request, sessionConsumedIds, matchingItemCache);
                if (!resolved.value) {
                    if (resolved.failure) {
                        this.logSelectionFailure("Bulk craft request", request.requestId, resolved.failure);
                    }
                    this.sendApproval(connection, {
                        requestId: request.requestId,
                        kind: "bulkCraft",
                        approved: false,
                        message: resolved.failure?.message ?? "Your crafting selection is no longer valid.",
                        selectionFailure: resolved.failure,
                    });
                    return;
                }
                sessionConsumedIds = resolved.value.sessionConsumedIds;
            }
            this.serverCraftPasses.set(key, {
                actionType: IAction_1.ActionType.Craft,
                kind: "bulkCraft",
                itemType: request.itemType,
                remaining: request.quantity,
                requestId: request.requestId,
                expiresAt: Date.now() + 30_000 + (request.quantity * 2_000),
            });
            this.debugLog(`Granted bulk craft pass ${request.requestId} to player ${key}.`, {
                playerIdentifier: connection?.playerIdentifier,
                playerKey: key,
                itemType: request.itemType,
                remaining: request.quantity,
            });
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "bulkCraft",
                approved: true,
                passCount: request.quantity,
            });
        }
        processDismantleRequest(connection, request) {
            this.debugLog(`Received dismantle approval request ${request.requestId}.`, {
                playerIdentifier: connection?.playerIdentifier,
                request,
            });
            const player = this.getPlayerFromConnection(connection);
            if (!player)
                return;
            const key = this.getPlayerKey(player);
            if (key === undefined)
                return;
            if (this.rejectLivePass(connection, { requestId: request.requestId, kind: "dismantle" }, key))
                return;
            const dismantle = ItemDescriptions_1.itemDescriptions[request.itemType]?.dismantle;
            if (!dismantle) {
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "dismantle",
                    approved: false,
                    message: "No dismantle data was found for that item.",
                });
                return;
            }
            const targets = this.resolveDismantleTargets(player, request);
            if (!targets?.length) {
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "dismantle",
                    approved: false,
                    message: "Your dismantle targets are no longer valid.",
                });
                return;
            }
            this.serverCraftPasses.set(key, {
                actionType: IAction_1.ActionType.Dismantle,
                kind: "dismantle",
                itemType: request.itemType,
                remaining: targets.length,
                requestId: request.requestId,
                expiresAt: Date.now() + 30_000 + (targets.length * 2_000),
                targetItemIds: new Set(request.targetItemIds),
            });
            this.debugLog(`Granted dismantle pass ${request.requestId} to player ${key}.`, {
                playerIdentifier: connection?.playerIdentifier,
                playerKey: key,
                itemType: request.itemType,
                remaining: targets.length,
                targetItemIds: request.targetItemIds,
            });
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "dismantle",
                approved: true,
                passCount: targets.length,
            });
        }
        isVanillaBypassCraftRequested(actionType, actionApi) {
            if (actionType !== IAction_1.ActionType.Craft)
                return false;
            if (actionApi.executor !== localPlayer)
                return false;
            if (!this.isRemoteMultiplayerClient())
                return false;
            if (this.bypassIntercept)
                return false;
            return this.settings.activationMode === "holdHotkeyToBypass"
                && this.isActivationHotkeyHeld();
        }
        onPreExecuteAction(host, actionType, actionApi, args) {
            const serverResult = this.handleServerPreExecute(actionType, actionApi, args);
            if (serverResult !== undefined)
                return serverResult;
            return this.handleClientPreExecute(actionType, actionApi, args);
        }
        handleServerPreExecute(actionType, actionApi, args) {
            if (multiplayer?.isServer) {
                if (actionType === IAction_1.ActionType.Craft || actionType === IAction_1.ActionType.Dismantle) {
                    const executor = actionApi.executor;
                    if (executor !== localPlayer) {
                        const player = executor;
                        const playerKey = this.getPlayerKey(player);
                        const pass = playerKey === undefined ? undefined : this.serverCraftPasses.get(playerKey);
                        const permit = playerKey === undefined ? undefined : this.serverVanillaBypassPermits.get(playerKey);
                        const actionDetails = actionType === IAction_1.ActionType.Craft
                            ? this.getVanillaCraftActionDetails(args)
                            : undefined;
                        this.debugLog(`Evaluating remote ${IAction_1.ActionType[actionType]} action on server.`, {
                            playerIdentifier: this.getEntityIdentifier(player),
                            playerKey,
                            actionType,
                            itemType: args[0],
                            pass,
                            bypassPermit: permit,
                            actionDetails,
                            argsSummary: this.buildCraftArgsSummary(args),
                        });
                        if (actionType === IAction_1.ActionType.Craft && this.consumeVanillaBypassPermit(executor, args)) {
                            return;
                        }
                        if (this.consumeServerPass(executor, actionType, args)) {
                            return;
                        }
                        if (actionType === IAction_1.ActionType.Craft) {
                            this.reportBlockedRemoteCraft(player, "That vanilla craft could not be validated in multiplayer. Try again without bypass if it keeps happening.", {
                                playerIdentifier: this.getEntityIdentifier(player),
                                playerKey,
                                actionType,
                                itemType: args[0],
                                requestId: pass?.requestId ?? permit?.requestId,
                                actionDetails,
                                argsSummary: this.buildCraftArgsSummary(args),
                                pass: pass
                                    ? {
                                        kind: pass.kind,
                                        requestId: pass.requestId,
                                        remaining: pass.remaining,
                                        expiresAt: pass.expiresAt,
                                        itemType: pass.itemType,
                                    }
                                    : undefined,
                                bypassPermit: permit
                                    ? {
                                        requestId: permit.requestId,
                                        expiresAt: permit.expiresAt,
                                        itemType: permit.itemType,
                                    }
                                    : undefined,
                                reason: !actionDetails
                                    ? "actionArgsUnserializable"
                                    : pass
                                        ? pass.expiresAt < Date.now()
                                            ? "approvalGrantedButPassExpired"
                                            : "approvalGrantedButPassMismatch"
                                        : permit
                                            ? permit.expiresAt < Date.now()
                                                ? "bypassPermitExpired"
                                                : "bypassPermitMismatch"
                                            : "noApprovalRequest",
                            });
                        }
                        else {
                            this.reportBlockedRemoteCraft(player, "That dismantle action could not be validated in multiplayer. Try again if it keeps happening.", {
                                playerIdentifier: this.getEntityIdentifier(player),
                                playerKey,
                                actionType,
                                itemType: isItemArg(args[0]) ? args[0].type : undefined,
                                requestId: pass?.requestId,
                                argsSummary: this.buildCraftArgsSummary(args),
                                pass: pass
                                    ? {
                                        kind: pass.kind,
                                        requestId: pass.requestId,
                                        remaining: pass.remaining,
                                        expiresAt: pass.expiresAt,
                                        itemType: pass.itemType,
                                    }
                                    : undefined,
                                reason: pass ? "approvalGrantedButPassMismatch" : "dismantlePassMissing",
                            });
                        }
                        return false;
                    }
                }
            }
            return;
        }
        handleClientPreExecute(actionType, actionApi, args) {
            if (this.isVanillaBypassCraftRequested(actionType, actionApi)) {
                const queued = this.trySendVanillaBypassPermit(args);
                if (queued) {
                    this.debugLog("Intercepted vanilla bypass craft and blocked the original action pending approval.", {
                        itemType: args[0],
                        argsSummary: this.buildCraftArgsSummary(args),
                    });
                }
                return false;
            }
            if (!this.shouldOpenBetterCrafting())
                return;
            if (actionType === IAction_1.ActionType.Craft && actionApi.executor === localPlayer) {
                const itemType = args[0];
                if (!ItemDescriptions_1.itemDescriptions[itemType]?.recipe)
                    return;
                const panel = this.ensurePanel();
                if (panel) {
                    if (panel.isDismantleMode()) {
                        panel.hidePanel();
                    }
                    panel.updateRecipe(itemType);
                    panel.showPanel();
                }
                return false;
            }
            if (actionType === IAction_1.ActionType.Dismantle && actionApi.executor === localPlayer) {
                const item = args[0];
                if (!item)
                    return;
                if (!ItemDescriptions_1.itemDescriptions[item.type]?.dismantle)
                    return;
                const panel = this.ensurePanel();
                if (panel) {
                    if (!panel.isSameDismantleType(item.type)) {
                        panel.openDismantle(item);
                    }
                    panel.showPanel();
                }
                return false;
            }
        }
        onPostExecuteAction(host, actionType, actionApi, args) {
            if (actionType !== IAction_1.ActionType.Craft)
                return;
            const itemType = args[0];
            const requiredItems = Array.isArray(args[1]) ? args[1] : undefined;
            if (itemType === undefined || !requiredItems?.length)
                return;
            this.applyCraftReusableDurability(itemType, requiredItems);
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
        (0, EventManager_1.EventHandler)(EventBuses_1.EventBus.Actions, "postExecuteAction")
    ], BetterCrafting.prototype, "onPostExecuteAction", null);
    __decorate([
        Mod_1.default.instance()
    ], BetterCrafting, "INSTANCE", void 0);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7SUFpRUEsTUFBTSxnQkFBZ0IsR0FBd0M7UUFDMUQsY0FBYyxFQUFFLG9CQUFvQjtRQUNwQyxnQkFBZ0IsRUFBRSxPQUFPO1FBQ3pCLFdBQVcsRUFBRSxHQUFHO1FBQ2hCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFlBQVksRUFBRSxLQUFLO0tBQ3RCLENBQUM7SUFFRixNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQztJQUVwQyxNQUFNLGFBQWEsR0FBRyxhQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxDQUFDO0lBMEdoRSxTQUFTLFNBQVMsQ0FBQyxJQUFzQjtRQUNyQyxPQUFPLElBQUEsNEJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBVyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxTQUFTLGlCQUFpQjtRQUN0QixPQUFPLFdBQVcsQ0FBQyxDQUFDLENBQUUsV0FBbUIsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsYUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBRUQsU0FBUyxTQUFTLENBQUMsS0FBYztRQUM3QixPQUFPLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLE1BQU0sSUFBSSxLQUFLLENBQUM7SUFDMUUsQ0FBQztJQUVELFNBQVMsdUJBQXVCLENBQUMsSUFBOEI7UUFDM0QsT0FBTyxHQUFHLHFCQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFP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