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
        findMatchingItems(player, type) {
            if (!player?.island)
                return [];
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
            return (0, craftingSelection_1.filterSelectableItems)(result, getItemId).sort((a, b) => getQualitySortKey(b) - getQualitySortKey(a));
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
            const candidates = this.findMatchingItems(player, type);
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
        resolveBulkSelection(player, request, sessionConsumedIds) {
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
                });
                if (resolvedPinned.value && resolvedPinned.value.length >= component.requiredAmount) {
                    preReservedToolSelections.set(i, resolvedPinned.value.slice(0, component.requiredAmount));
                }
            }
            let base;
            if (recipe.baseComponent !== undefined) {
                const baseCandidates = this.findMatchingItems(player, recipe.baseComponent)
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
                                candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id) => id !== undefined),
                            }),
                        };
                    }
                    const candidates = this.findMatchingItems(player, component.type)
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
                                candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id) => id !== undefined),
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
                                candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id) => id !== undefined),
                            }),
                        };
                    }
                    required.push(...resolvedPinned.slice(0, component.requiredAmount));
                    continue;
                }
                const candidates = this.findMatchingItems(player, component.type)
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
                            candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id) => id !== undefined),
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
            for (let i = 0; i < request.quantity; i++) {
                const resolved = this.resolveBulkSelection(player, request, sessionConsumedIds);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7SUFpRUEsTUFBTSxnQkFBZ0IsR0FBd0M7UUFDMUQsY0FBYyxFQUFFLG9CQUFvQjtRQUNwQyxnQkFBZ0IsRUFBRSxPQUFPO1FBQ3pCLFdBQVcsRUFBRSxHQUFHO1FBQ2hCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFlBQVksRUFBRSxLQUFLO0tBQ3RCLENBQUM7SUFFRixNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQztJQUVwQyxNQUFNLGFBQWEsR0FBRyxhQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxDQUFDO0lBd0doRSxTQUFTLFNBQVMsQ0FBQyxJQUFzQjtRQUNyQyxPQUFPLElBQUEsNEJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBVyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxTQUFTLGlCQUFpQjtRQUN0QixPQUFPLFdBQVcsQ0FBQyxDQUFDLENBQUUsV0FBbUIsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsYUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBRUQsU0FBUyxTQUFTLENBQUMsS0FBYztRQUM3QixPQUFPLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLE1BQU0sSUFBSSxLQUFLLENBQUM7SUFDMUUsQ0FBQztJQUVELFNBQVMsb0JBQW9CLENBQUMsS0FBYztRQUN4QyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVE7WUFBRSxPQUFPLFNBQVMsQ0FBQztRQUVoRCxNQUFNLFVBQVUs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