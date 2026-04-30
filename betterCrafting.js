var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@wayward/game/mod/Mod", "./src/BetterCraftingDialog", "@wayward/game/event/EventManager", "@wayward/game/event/EventBuses", "@wayward/game/game/entity/action/IAction", "@wayward/game/ui/screen/IScreen", "@wayward/game/game/entity/action/ActionExecutor", "@wayward/game/game/entity/action/actions/Craft", "@wayward/game/game/entity/action/actions/Dismantle", "@wayward/game/game/item/ItemManager", "@wayward/game/game/item/IItem", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/entity/IStats", "@wayward/utilities/Log", "@wayward/game/multiplayer/packets/ClientPacket", "@wayward/game/multiplayer/packets/ServerPacket", "@wayward/game/ui/screen/screens/menu/menus/options/TabMods", "@wayward/game/ui/component/ChoiceList", "@wayward/game/ui/component/CheckButton", "@wayward/game/language/impl/TranslationImpl", "./src/craftingSelection", "./src/craftStamina", "./src/itemIdentity"], function (require, exports, Mod_1, BetterCraftingDialog_1, EventManager_1, EventBuses_1, IAction_1, IScreen_1, ActionExecutor_1, Craft_1, Dismantle_1, ItemManager_1, IItem_1, ItemDescriptions_1, IStats_1, Log_1, ClientPacket_1, ServerPacket_1, TabMods_1, ChoiceList_1, CheckButton_1, TranslationImpl_1, craftingSelection_1, craftStamina_1, itemIdentity_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const DEFAULT_SETTINGS = {
        activationMode: "holdHotkeyToBypass",
        activationHotkey: "Shift",
        closeHotkey: "c",
        safeCrafting: true,
        debugLogging: false,
    };
    const craftDebugLog = Log_1.default.warn("Better Crafting", "CraftDebug");
    function isItemProtected(item) {
        return item.isProtected === true || item.protected === true;
    }
    function getItemId(item) {
        return (0, itemIdentity_1.getItemIdSafe)(item);
    }
    function getQualitySortKey(item) {
        return (item.quality ?? 0);
    }
    function getCurrentStamina() {
        return localPlayer ? localPlayer.stat?.get?.(IStats_1.Stat.Stamina)?.value ?? 0 : 0;
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
                closeHotkeyChoices.event.subscribe("choose", (_, choice) => {
                    if (!choice)
                        return;
                    this.globalData.closeHotkey = choice.id;
                });
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
                diagnosticsToggle.event.subscribe("toggle", (_, checked) => {
                    this.globalData.debugLogging = checked;
                });
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
            const identifier = player?.identifier;
            if (!identifier || !multiplayer?.isServer)
                return;
            return multiplayer.getClients().find(connection => connection.playerIdentifier === identifier);
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
                    playerIdentifier: executor?.identifier,
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
                    playerIdentifier: executor?.identifier,
                    playerKey: key,
                    actionType,
                    argsSummary: this.buildCraftArgsSummary(args),
                });
                return false;
            }
            if (pass.actionType !== actionType) {
                this.debugLog(`Server pass action type mismatch for player ${key}.`, {
                    playerIdentifier: executor?.identifier,
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
                        playerIdentifier: executor?.identifier,
                        playerKey: key,
                        pass,
                        argsSummary: this.buildCraftArgsSummary(args),
                    });
                    return false;
                }
            }
            else if (actionType === IAction_1.ActionType.Dismantle) {
                const item = args[0];
                const itemId = getItemId(item);
                if (!item || item.type !== pass.itemType || itemId === undefined) {
                    this.debugLog(`Server dismantle pass target mismatch for player ${key}.`, {
                        playerIdentifier: executor?.identifier,
                        playerKey: key,
                        pass,
                        itemType: item?.type,
                        itemId,
                    });
                    return false;
                }
                if (pass.targetItemIds && !pass.targetItemIds.has(itemId)) {
                    this.debugLog(`Server dismantle pass item id mismatch for player ${key}.`, {
                        playerIdentifier: executor?.identifier,
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
                playerIdentifier: executor?.identifier,
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
            const result = ItemManager_1.default.isGroup(type)
                ? items.getItemsInContainerByGroup(player, type, subContainerOpts)
                : items.getItemsInContainerByType(player, type, subContainerOpts);
            for (const container of items.getAdjacentContainers(player)) {
                const adjacentItems = ItemManager_1.default.isGroup(type)
                    ? items.getItemsInContainerByGroup(container, type, subContainerOpts)
                    : items.getItemsInContainerByType(container, type, subContainerOpts);
                for (const item of adjacentItems) {
                    if (!result.includes(item)) {
                        result.push(item);
                    }
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
                if (isItemProtected(item)) {
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
            const preReservedToolSelections = new Map();
            for (let i = 0; i < recipe.components.length; i++) {
                const component = recipe.components[i];
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
                    return itemId !== undefined && !reservedIds.has(itemId) && !isItemProtected(item);
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
                    const resolvedUsed = this.resolveSelectedItems(player, component.type, pinnedUsedIds, reservedIds, {
                        slotIndex: i,
                        failureReason: "pinnedToolUnavailable",
                    });
                    if (!resolvedUsed.value || resolvedUsed.value.length < usedCount) {
                        return { failure: resolvedUsed.failure };
                    }
                    const usedItems = resolvedUsed.value.slice(0, usedCount);
                    const candidates = this.findMatchingItems(player, component.type)
                        .filter(item => {
                        const itemId = getItemId(item);
                        return itemId !== undefined && !reservedIds.has(itemId) && !isItemProtected(item);
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
                    return itemId !== undefined && !reservedIds.has(itemId) && !isItemProtected(item);
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
                if (!item || isItemProtected(item))
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
                this.debugLog("NormalCraftPayload", {
                    itemType,
                    requiredIds: (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item)),
                    consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item)),
                    baseId: base ? this.getItemId(base) : undefined,
                    inventoryBefore: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                });
                await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, requiredItems, consumedItems, base, undefined);
                this.debugLog("NormalCraftPostExecute", {
                    itemType,
                    requiredIds: (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item)),
                    consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item)),
                    baseId: base ? this.getItemId(base) : undefined,
                    inventoryAfterExecute: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                });
                this.panel?.refreshVisibleCraftingViews(true);
                this.debugLog("NormalCraftPostRefresh", {
                    itemType,
                    inventoryAfterRefresh: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                    panelSelectionState: this.panel?.buildCurrentNormalCraftSelectionState(),
                });
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
        getRemainingDurabilityUses(requiredItem, perUseLoss, leaveOneUse) {
            if (perUseLoss <= 0)
                return Number.MAX_SAFE_INTEGER;
            const durability = requiredItem.durability ?? 0;
            if (durability <= 0)
                return 0;
            const usableActions = Math.ceil(durability / perUseLoss);
            return Math.max(0, usableActions - (leaveOneUse ? 1 : 0));
        }
        canUseForDismantle(requiredItem, leaveOneUse = false) {
            if (!requiredItem)
                return true;
            const perUseLoss = Math.max(0, requiredItem.description?.damageOnUse?.[IAction_1.ActionType.Dismantle]
                ?? requiredItem.getDamageModifier?.()
                ?? 0);
            if (perUseLoss <= 0)
                return true;
            return this.getRemainingDurabilityUses(requiredItem, perUseLoss, leaveOneUse) > 0;
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
                    this.debugLog("BulkCraftPayload", {
                        itemType,
                        iteration: i + 1,
                        requiredIds: (0, itemIdentity_1.getItemIds)(requiredItems, item => this.getItemId(item)),
                        consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => this.getItemId(item)),
                        baseId: resolved.base ? this.getItemId(resolved.base) : undefined,
                        inventoryBefore: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                    });
                    await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, requiredItems.length > 0 ? requiredItems : undefined, consumedItems.length > 0 ? consumedItems : undefined, resolved.base, undefined);
                    this.debugLog("BulkCraftPostExecute", {
                        itemType,
                        iteration: i + 1,
                        inventoryAfterExecute: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                    });
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
            const key = this.getPlayerKey(player);
            if (key === undefined)
                return;
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
            const sessionConsumedIds = new Set();
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
            const key = this.getPlayerKey(player);
            if (key === undefined)
                return;
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
            const key = this.getPlayerKey(player);
            if (key === undefined)
                return;
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
                            playerIdentifier: player?.identifier,
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
                                playerIdentifier: player?.identifier,
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
                                playerIdentifier: player?.identifier,
                                playerKey,
                                actionType,
                                itemType: args[0]?.type,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7SUE0REEsTUFBTSxnQkFBZ0IsR0FBd0M7UUFDMUQsY0FBYyxFQUFFLG9CQUFvQjtRQUNwQyxnQkFBZ0IsRUFBRSxPQUFPO1FBQ3pCLFdBQVcsRUFBRSxHQUFHO1FBQ2hCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFlBQVksRUFBRSxLQUFLO0tBQ3RCLENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRyxhQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxDQUFDO0lBd0doRSxTQUFTLGVBQWUsQ0FBQyxJQUFVO1FBQy9CLE9BQVEsSUFBWSxDQUFDLFdBQVcsS0FBSyxJQUFJLElBQUssSUFBWSxDQUFDLFNBQVMsS0FBSyxJQUFJLENBQUM7SUFDbEYsQ0FBQztJQUVELFNBQVMsU0FBUyxDQUFDLElBQXNCO1FBQ3JDLE9BQU8sSUFBQSw0QkFBYSxFQUFDLElBQUksQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQVU7UUFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFXLENBQUM7SUFDekMsQ0FBQztJQUVELFNBQVMsaUJBQWlCO1FBQ3RCLE9BQU8sV0FBVyxDQUFDLENBQUMsQ0FBRSxXQUFtQixDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxhQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7SUFFRCxTQUFTLG9CQUFvQixDQUFDLEtBQWM7UUFDeEMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1lBQUUsT0FBTyxTQUFTLENBQUM7UUFFaEQsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2hDLElB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