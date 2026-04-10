var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@wayward/game/mod/Mod", "./src/BetterCraftingDialog", "@wayward/game/event/EventManager", "@wayward/game/event/EventBuses", "@wayward/game/game/entity/action/IAction", "@wayward/game/ui/screen/IScreen", "@wayward/game/game/entity/action/ActionExecutor", "@wayward/game/game/entity/action/actions/Craft", "@wayward/game/game/entity/action/actions/Dismantle", "@wayward/game/game/item/ItemManager", "@wayward/game/game/item/IItem", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/entity/IStats", "@wayward/utilities/Log", "@wayward/game/multiplayer/packets/ClientPacket", "@wayward/game/multiplayer/packets/ServerPacket", "@wayward/game/ui/screen/screens/menu/menus/options/TabMods", "@wayward/game/ui/component/ChoiceList", "@wayward/game/ui/component/CheckButton", "@wayward/game/language/impl/TranslationImpl", "./src/craftingSelection", "./src/itemIdentity"], function (require, exports, Mod_1, BetterCraftingDialog_1, EventManager_1, EventBuses_1, IAction_1, IScreen_1, ActionExecutor_1, Craft_1, Dismantle_1, ItemManager_1, IItem_1, ItemDescriptions_1, IStats_1, Log_1, ClientPacket_1, ServerPacket_1, TabMods_1, ChoiceList_1, CheckButton_1, TranslationImpl_1, craftingSelection_1, itemIdentity_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const DEFAULT_SETTINGS = {
        activationMode: "holdHotkeyToBypass",
        activationHotkey: "Shift",
        unsafeBulkCrafting: false,
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
    function getItemIds(items, getId) {
        if (!items)
            return [];
        return items.map(item => getId(item)).filter((id) => id !== undefined);
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
    const betterCraftingStatusPacketRegistration = Mod_1.default.register.packet(BetterCraftingStatusPacket);
    const betterCraftingApprovalPacketRegistration = Mod_1.default.register.packet(BetterCraftingApprovalPacket);
    const betterCraftingCraftRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingCraftRequestPacket);
    const betterCraftingBulkCraftRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingBulkCraftRequestPacket);
    const betterCraftingDismantleRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingDismantleRequestPacket);
    const betterCraftingAbortRequestPacketRegistration = Mod_1.default.register.packet(BetterCraftingAbortRequestPacket);
    void [
        betterCraftingStatusPacketRegistration,
        betterCraftingApprovalPacketRegistration,
        betterCraftingCraftRequestPacketRegistration,
        betterCraftingBulkCraftRequestPacketRegistration,
        betterCraftingDismantleRequestPacketRegistration,
        betterCraftingAbortRequestPacketRegistration,
    ];
    class BetterCrafting extends Mod_1.default {
        constructor() {
            super(...arguments);
            this.bypassIntercept = false;
            this.shiftHeld = false;
            this.isBulkCrafting = false;
            this.legacyUnsafeCraftingSeed = false;
            this.bulkAbortController = null;
            this.nextMultiplayerRequestId = 1;
            this.pendingApprovals = new Map();
            this.serverCraftPasses = new Map();
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
            const normalized = this.normalizeSettings(data);
            this.legacyUnsafeCraftingSeed = normalized.unsafeBulkCrafting;
            normalized.unsafeBulkCrafting = false;
            return normalized;
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
            this.serverCraftPasses.clear();
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
        isActivationHotkeyHeld() {
            return this.shiftHeld;
        }
        shouldOpenBetterCrafting() {
            if (this.bypassIntercept)
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
            if (this.panel?.isUnsafeCraftingEnabled())
                return false;
            return true;
        }
        getItemId(item) {
            return (0, itemIdentity_1.getItemIdSafe)(item);
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
        consumeLegacyUnsafeCraftingSeed() {
            const seed = this.legacyUnsafeCraftingSeed;
            this.legacyUnsafeCraftingSeed = false;
            return seed;
        }
        isRemoteMultiplayerClient() {
            return multiplayer?.isConnected === true && multiplayer.isClient;
        }
        clearPendingApprovals(message) {
            for (const [requestId, pending] of this.pendingApprovals) {
                clearTimeout(pending.timeout);
                pending.resolve(false);
                this.debugLog(`Cleared pending approval ${requestId}.`);
            }
            this.pendingApprovals.clear();
            if (message) {
                this.panel?.showMultiplayerMessage(message);
            }
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
                    this.panel?.showMultiplayerMessage("The server did not respond in time. Please try again.");
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
                    this.panel?.showMultiplayerMessage("Your selection changed. Please reselect the items and try again.");
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
                    this.panel?.showMultiplayerMessage("Your selection changed. Please reselect the items and try again.");
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
                this.panel?.showMultiplayerMessage(approval.message);
            }
            pending.resolve(approval.approved);
        }
        sendApproval(to, approval) {
            const packet = new BetterCraftingApprovalPacket();
            packet.approval = approval;
            packet.sendTo(to);
        }
        handleMultiplayerStatus(status) {
            if (status.selectionFailure) {
                this.debugLog(`Status ${status.requestId} failure details:`, status.selectionFailure);
            }
            if (status.state === "error" && status.message) {
                this.panel?.showMultiplayerMessage(status.message);
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
        consumeServerPass(executor, actionType, args) {
            const key = this.getPlayerKey(executor);
            if (key === undefined)
                return false;
            const pass = this.serverCraftPasses.get(key);
            if (!pass)
                return false;
            if (pass.actionType !== actionType)
                return false;
            if (pass.expiresAt < Date.now()) {
                this.debugLog(`Pass expired for player ${key}.`);
                this.serverCraftPasses.delete(key);
                return false;
            }
            if (actionType === IAction_1.ActionType.Craft) {
                if (args[0] !== pass.itemType)
                    return false;
            }
            else if (actionType === IAction_1.ActionType.Dismantle) {
                const item = args[0];
                const itemId = getItemId(item);
                if (!item || item.type !== pass.itemType || itemId === undefined)
                    return false;
                if (pass.targetItemIds && !pass.targetItemIds.has(itemId))
                    return false;
                pass.targetItemIds?.delete(itemId);
            }
            pass.remaining--;
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
                    }, () => this.settings, this.consumeLegacyUnsafeCraftingSeed());
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
                        matchingIds: getItemIds(this.findMatchingItems(player, recipe.baseComponent), item => this.getItemId(item)),
                    },
                slots: recipe.components.map((component, slotIndex) => ({
                    slotIndex,
                    type: component.type,
                    requiredAmount: component.requiredAmount,
                    consumedAmount: component.consumedAmount,
                    matchingIds: getItemIds(this.findMatchingItems(player, component.type), item => this.getItemId(item)),
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
                    const resolvedPinned = this.resolveSelectedItems(player, component.type, pinnedToolIds, reservedIds, {
                        slotIndex: i,
                        failureReason: "pinnedToolUnavailable",
                    });
                    if (!resolvedPinned.value || resolvedPinned.value.length < component.requiredAmount) {
                        return { failure: resolvedPinned.failure };
                    }
                    required.push(...resolvedPinned.value.slice(0, component.requiredAmount));
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
            this.bypassIntercept = true;
            try {
                const requiredItems = required ? [...required] : undefined;
                const consumedItems = consumed ? [...consumed] : undefined;
                this.debugLog("NormalCraftPayload", {
                    itemType,
                    requiredIds: getItemIds(requiredItems, item => this.getItemId(item)),
                    consumedIds: getItemIds(consumedItems, item => this.getItemId(item)),
                    baseId: base ? this.getItemId(base) : undefined,
                    inventoryBefore: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                });
                await ActionExecutor_1.default.get(Craft_1.default).execute(localPlayer, itemType, requiredItems, consumedItems, base, undefined);
                this.debugLog("NormalCraftPostExecute", {
                    itemType,
                    requiredIds: getItemIds(requiredItems, item => this.getItemId(item)),
                    consumedIds: getItemIds(consumedItems, item => this.getItemId(item)),
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
        canUseForDismantle(requiredItem) {
            if (!requiredItem)
                return true;
            const perUseLoss = Math.max(0, requiredItem.description?.damageOnUse?.[IAction_1.ActionType.Dismantle]
                ?? requiredItem.getDamageModifier?.()
                ?? 0);
            if (perUseLoss <= 0)
                return true;
            return (requiredItem.durability ?? 0) >= perUseLoss;
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
            const staminaCost = BetterCraftingDialog_1.STAMINA_COST_PER_LEVEL[recipe.level] ?? 4;
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
                    const currentStamina = localPlayer.stat?.get?.(IStats_1.Stat.Stamina)?.value ?? 0;
                    if (!this.panel?.isUnsafeCraftingEnabled() && currentStamina < staminaCost)
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
                        requiredIds: getItemIds(requiredItems, item => this.getItemId(item)),
                        consumedIds: getItemIds(consumedItems, item => this.getItemId(item)),
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
                    const requiresRequiredItem = this.panel?.requiresDismantleRequiredItem() ?? false;
                    if (requiresRequiredItem) {
                        const resolvedRequiredItem = this.panel?.resolveDismantleRequiredSelection() ?? activeRequiredItem;
                        if (!resolvedRequiredItem || !this.canUseForDismantle(resolvedRequiredItem))
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
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "craft",
                approved: true,
                passCount: 1,
            });
        }
        processBulkCraftRequest(connection, request) {
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
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "bulkCraft",
                approved: true,
                passCount: request.quantity,
            });
        }
        processDismantleRequest(connection, request) {
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
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "dismantle",
                approved: true,
                passCount: targets.length,
            });
        }
        onPreExecuteAction(host, actionType, actionApi, args) {
            if (multiplayer?.isServer) {
                if (actionType === IAction_1.ActionType.Craft || actionType === IAction_1.ActionType.Dismantle) {
                    const executor = actionApi.executor;
                    if (executor !== localPlayer) {
                        if (this.consumeServerPass(executor, actionType, args)) {
                            return;
                        }
                        return false;
                    }
                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmV0dGVyQ3JhZnRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZXR0ZXJDcmFmdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7SUF5REEsTUFBTSxnQkFBZ0IsR0FBd0M7UUFDMUQsY0FBYyxFQUFFLG9CQUFvQjtRQUNwQyxnQkFBZ0IsRUFBRSxPQUFPO1FBQ3pCLGtCQUFrQixFQUFFLEtBQUs7UUFDekIsWUFBWSxFQUFFLEtBQUs7S0FDdEIsQ0FBQztJQUVGLE1BQU0sYUFBYSxHQUFHLGFBQUcsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsWUFBWSxDQUFDLENBQUM7SUF5Q2hFLFNBQVMsZUFBZSxDQUFDLElBQVU7UUFDL0IsT0FBUSxJQUFZLENBQUMsV0FBVyxLQUFLLElBQUksSUFBSyxJQUFZLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQztJQUNsRixDQUFDO0lBRUQsU0FBUyxTQUFTLENBQUMsSUFBc0I7UUFDckMsT0FBTyxJQUFBLDRCQUFhLEVBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBVTtRQUNqQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQVcsQ0FBQztJQUN6QyxDQUFDO0lBRUQsU0FBUyxVQUFVLENBQUMsS0FBa0MsRUFBRSxLQUF5QztRQUM3RixJQUFJLENBQUMsS0FBSztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3RCLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBZ0IsRUFBRSxDQUFDLEVBQUUsS0FBSyxTQUFTLENBQUMsQ0FBQztJQUN6RixDQUFDO0lBRUQsTUFBTSwwQkFBMkIsU0FBUSxzQkFBa0I7UUFHaEQsWUFBWTtZQUNmLE9BQU8sd0JBQXdCLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFB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