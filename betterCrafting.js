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
        waitForTurnEnd(timeoutMs = 10_000) {
            const player = localPlayer;
            if (!player?.event?.subscribeNext)
                return Promise.resolve();
            const turnEndPromise = new Promise(resolve => {
                player.event.subscribeNext("turnEnd", () => {
                    const poll = () => {
                        if (this.bulkAbortController?.aborted || !localPlayer?.hasDelay?.()) {
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
            return new Promise(resolve => {
                const poll = () => {
                    if (this.bulkAbortController?.aborted || !localPlayer?.hasDelay?.()) {
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
            if (!Number.isFinite(request.quantity) || !Number.isInteger(request.quantity) || request.quantity <= 0 || request.quantity > 9999) {
                this.sendApproval(connection, {
                    requestId: request.requestId,
                    kind: "bulkCraft",
                    approved: false,
                    message: "Invalid bulk craft quantity.",
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7SUFpRUEsTUFBTSxnQkFBZ0IsR0FBd0M7UUFDMUQsY0FBYyxFQUFFLG9CQUFvQjtRQUNwQyxnQkFBZ0IsRUFBRSxPQUFPO1FBQ3pCLFdBQVcsRUFBRSxHQUFHO1FBQ2hCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFlBQVksRUFBRSxLQUFLO0tBQ3RCLENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRyxhQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxDQUFDO0lBd0doRSxTQUFTLFNBQVMsQ0FBQyxJQUFzQjtRQUNyQyxPQUFPLElBQUEsNEJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBVyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxTQUFTLGlCQUFpQjtRQUN0QixPQUFPLFdBQVcsQ0FBQyxDQUFDLENBQUUsV0FBbUIsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsYUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBRUQsU0FBUyxvQkFBb0IsQ0FBQyxLQUFjO1FBQ3hDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtZQUFFLE9BQU8sU0FBUyxDQUFDO1FBRWhELE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNoQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1lBQUUsT0FBTyxVQUFVLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDakUsSUFBSSxVQUFVLEtBQUssUUFBUTtZQUFFLE9BQU8sVUFB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