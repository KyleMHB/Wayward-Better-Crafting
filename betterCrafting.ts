import Mod from '@wayward/game/mod/Mod';
import BetterCraftingPanel, { STAMINA_COST_PER_LEVEL } from './src/BetterCraftingDialog';
import { EventHandler } from "@wayward/game/event/EventManager";
import { EventBus } from "@wayward/game/event/EventBuses";
import { ActionType } from "@wayward/game/game/entity/action/IAction";
import type { IActionHandlerApi } from "@wayward/game/game/entity/action/IAction";
import type Entity from "@wayward/game/game/entity/Entity";
import { ScreenId } from "@wayward/game/ui/screen/IScreen";
import ActionExecutor from "@wayward/game/game/entity/action/ActionExecutor";
import Craft from "@wayward/game/game/entity/action/actions/Craft";
import Dismantle from "@wayward/game/game/entity/action/actions/Dismantle";
import type Item from "@wayward/game/game/item/Item";
import ItemManager from "@wayward/game/game/item/ItemManager";
import { ItemType, ItemTypeGroup, RecipeLevel } from "@wayward/game/game/item/IItem";
import { itemDescriptions } from "@wayward/game/game/item/ItemDescriptions";
import { Stat } from "@wayward/game/game/entity/IStats";
import type { IStat } from "@wayward/game/game/entity/IStats";
import type { IStatChangeInfo } from "@wayward/game/game/entity/IEntity";
import type Player from "@wayward/game/game/entity/player/Player";
import Log from "@wayward/utilities/Log";
import type Tile from "@wayward/game/game/tile/Tile";
import ClientPacket from "@wayward/game/multiplayer/packets/ClientPacket";
import ServerPacket from "@wayward/game/multiplayer/packets/ServerPacket";
import TabMods from "@wayward/game/ui/screen/screens/menu/menus/options/TabMods";
import ChoiceList, { Choice } from "@wayward/game/ui/component/ChoiceList";
import { CheckButton } from "@wayward/game/ui/component/CheckButton";
import TranslationImpl from "@wayward/game/language/impl/TranslationImpl";
import {
    buildCraftExecutionPayload,
    filterSelectableItems,
    getConsumedSelectionCount,
    getUsedSelectionCount,
    isSplitConsumption,
    partitionSelectedItems,
} from "./src/craftingSelection";
import { getItemIdSafe } from "./src/itemIdentity";
import type {
    IBetterCraftingRequestStatus,
    IBulkActionAbortRequest,
    IBulkCraftRequest,
    ICraftApprovalResponse,
    ICraftSelectionRequest,
    IDismantleRequest,
    ISelectionFailureDetails,
    ISelectionSlotIds,
} from "./src/multiplayer/BetterCraftingProtocol";

type ActivationMode = "holdHotkeyToBypass" | "holdHotkeyToAccess";
type ActivationHotkey = "Shift" | "Control" | "Alt";

interface IBetterCraftingGlobalData {
    activationMode: ActivationMode;
    activationHotkey: ActivationHotkey;
    unsafeBulkCrafting: boolean;
    debugLogging: boolean;
}

const DEFAULT_SETTINGS: Readonly<IBetterCraftingGlobalData> = {
    activationMode: "holdHotkeyToBypass",
    activationHotkey: "Shift",
    unsafeBulkCrafting: false,
    debugLogging: false,
};

const craftDebugLog = Log.warn("Better Crafting", "CraftDebug");

interface IPendingApproval {
    resolve: (approved: boolean) => void;
    timeout: ReturnType<typeof setTimeout>;
}

interface IServerCraftPass {
    actionType: ActionType.Craft | ActionType.Dismantle;
    kind: ICraftApprovalResponse["kind"];
    itemType: ItemType;
    remaining: number;
    requestId: number;
    expiresAt: number;
    targetItemIds?: Set<number>;
}

interface IResolvedCraftSelection {
    required: Item[];
    consumed: Item[];
    base: Item | undefined;
}

interface IResolvedBulkSelection extends IResolvedCraftSelection {
    sessionConsumedIds: Set<number>;
}

interface ISelectionResolutionFailure extends ISelectionFailureDetails {
    message: string;
}

interface IResolutionResult<T> {
    value?: T;
    failure?: ISelectionResolutionFailure;
}

interface IPartitionedSelection {
    required: Item[];
    consumed: Item[];
}

function isItemProtected(item: Item): boolean {
    return (item as any).isProtected === true || (item as any).protected === true;
}

function getItemId(item: Item | undefined): number | undefined {
    return getItemIdSafe(item);
}

function getQualitySortKey(item: Item): number {
    return (item.quality ?? 0) as number;
}

function getItemIds(items: readonly Item[] | undefined, getId: (item: Item) => number | undefined): number[] {
    if (!items) return [];
    return items.map(item => getId(item)).filter((id): id is number => id !== undefined);
}

class BetterCraftingStatusPacket extends ClientPacket<void> {
    public status?: IBetterCraftingRequestStatus;

    public getDebugInfo(): string {
        return `BetterCraftingStatus:${this.status?.kind ?? "unknown"}:${this.status?.state ?? "unknown"}`;
    }

    public override isSyncCheckEnabled(): boolean {
        return false;
    }

    public process(): void {
        if (this.status) {
            BetterCrafting.INSTANCE?.handleMultiplayerStatus(this.status);
        }
    }

    protected override getIndexSize(): number {
        return 1;
    }

    protected override writeData(): void {
        this.writeIndexedObject(this.status);
    }

    protected override readData(): void {
        this.status = this.readIndexedObject() as IBetterCraftingRequestStatus | undefined;
    }
}

class BetterCraftingApprovalPacket extends ClientPacket<void> {
    public approval?: ICraftApprovalResponse;

    public getDebugInfo(): string {
        return `BetterCraftingApproval:${this.approval?.kind ?? "unknown"}:${this.approval?.approved ? "approved" : "rejected"}`;
    }

    public override isSyncCheckEnabled(): boolean {
        return false;
    }

    public process(): void {
        if (this.approval) {
            BetterCrafting.INSTANCE?.handleCraftApproval(this.approval);
        }
    }

    protected override getIndexSize(): number {
        return 1;
    }

    protected override writeData(): void {
        this.writeIndexedObject(this.approval);
    }

    protected override readData(): void {
        this.approval = this.readIndexedObject() as ICraftApprovalResponse | undefined;
    }
}

class BetterCraftingCraftRequestPacket extends ServerPacket {
    public request?: ICraftSelectionRequest;

    public getDebugInfo(): string {
        return `BetterCraftingCraftRequest:${this.request?.itemType ?? "unknown"}`;
    }

    public process(): void {
        if (this.request) {
            BetterCrafting.INSTANCE?.processCraftRequest(this.connection, this.request);
        }
    }

    protected override getIndexSize(): number {
        return 1;
    }

    protected override writeData(): void {
        this.writeIndexedObject(this.request);
    }

    protected override readData(): void {
        this.request = this.readIndexedObject() as ICraftSelectionRequest | undefined;
    }
}

class BetterCraftingBulkCraftRequestPacket extends ServerPacket {
    public request?: IBulkCraftRequest;

    public getDebugInfo(): string {
        return `BetterCraftingBulkCraftRequest:${this.request?.itemType ?? "unknown"}:${this.request?.quantity ?? 0}`;
    }

    public process(): void {
        if (this.request) {
            BetterCrafting.INSTANCE?.processBulkCraftRequest(this.connection, this.request);
        }
    }

    protected override getIndexSize(): number {
        return 1;
    }

    protected override writeData(): void {
        this.writeIndexedObject(this.request);
    }

    protected override readData(): void {
        this.request = this.readIndexedObject() as IBulkCraftRequest | undefined;
    }
}

class BetterCraftingDismantleRequestPacket extends ServerPacket {
    public request?: IDismantleRequest;

    public getDebugInfo(): string {
        return `BetterCraftingDismantleRequest:${this.request?.itemType ?? "unknown"}:${this.request?.targetItemIds.length ?? 0}`;
    }

    public process(): void {
        if (this.request) {
            BetterCrafting.INSTANCE?.processDismantleRequest(this.connection, this.request);
        }
    }

    protected override getIndexSize(): number {
        return 1;
    }

    protected override writeData(): void {
        this.writeIndexedObject(this.request);
    }

    protected override readData(): void {
        this.request = this.readIndexedObject() as IDismantleRequest | undefined;
    }
}

class BetterCraftingAbortRequestPacket extends ServerPacket {
    public request?: IBulkActionAbortRequest;

    public getDebugInfo(): string {
        return `BetterCraftingAbortRequest:${this.request?.requestId ?? 0}`;
    }

    public process(): void {
        if (this.request) {
            BetterCrafting.INSTANCE?.abortServerRequest(this.connection, this.request);
        }
    }

    protected override getIndexSize(): number {
        return 1;
    }

    protected override writeData(): void {
        this.writeIndexedObject(this.request);
    }

    protected override readData(): void {
        this.request = this.readIndexedObject() as IBulkActionAbortRequest | undefined;
    }
}

const betterCraftingStatusPacketRegistration = Mod.register.packet(BetterCraftingStatusPacket);
const betterCraftingApprovalPacketRegistration = Mod.register.packet(BetterCraftingApprovalPacket);
const betterCraftingCraftRequestPacketRegistration = Mod.register.packet(BetterCraftingCraftRequestPacket);
const betterCraftingBulkCraftRequestPacketRegistration = Mod.register.packet(BetterCraftingBulkCraftRequestPacket);
const betterCraftingDismantleRequestPacketRegistration = Mod.register.packet(BetterCraftingDismantleRequestPacket);
const betterCraftingAbortRequestPacketRegistration = Mod.register.packet(BetterCraftingAbortRequestPacket);
void [
    betterCraftingStatusPacketRegistration,
    betterCraftingApprovalPacketRegistration,
    betterCraftingCraftRequestPacketRegistration,
    betterCraftingBulkCraftRequestPacketRegistration,
    betterCraftingDismantleRequestPacketRegistration,
    betterCraftingAbortRequestPacketRegistration,
];

export default class BetterCrafting extends Mod {
    @Mod.instance<BetterCrafting>()
    public static readonly INSTANCE: BetterCrafting;

    @Mod.globalData<BetterCrafting>()
    public globalData!: IBetterCraftingGlobalData;

    public panel?: BetterCraftingPanel;

    public bypassIntercept = false;
    private shiftHeld = false;
    private isBulkCrafting = false;
    private legacyUnsafeCraftingSeed = false;
    private bulkAbortController: {
        aborted: boolean;
        reason: string;
        /** Resolves the current waitForTurnEnd() abort-promise, unblocking the loop. */
        resolveWait: (() => void) | null;
    } | null = null;
    private nextMultiplayerRequestId = 1;
    private readonly pendingApprovals = new Map<number, IPendingApproval>();
    /** Server-side: tracks granted action passes per player (keyed by player ID). */
    private readonly serverCraftPasses = new Map<number, IServerCraftPass>();

    // ── Mod lifecycle ─────────────────────────────────────────────────────────

    public override initializeGlobalData(data: unknown): IBetterCraftingGlobalData {
        const normalized = this.normalizeSettings(data);
        this.legacyUnsafeCraftingSeed = normalized.unsafeBulkCrafting;
        normalized.unsafeBulkCrafting = false;
        return normalized;
    }

    public override onInitialize(): void {
        this.clearHeldHotkeyState();

        TabMods.registerModOptions(this.mod, component => {
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

            const activationChoices = new ChoiceList<Choice<ActivationMode>>();
            const bypassChoice = new Choice<ActivationMode>("holdHotkeyToBypass");
            bypassChoice.setText(TranslationImpl.generator("Hold Hotkey to Bypass"));
            const accessChoice = new Choice<ActivationMode>("holdHotkeyToAccess");
            accessChoice.setText(TranslationImpl.generator("Hold Hotkey to Access"));
            activationChoices.setChoices(bypassChoice, accessChoice);
            activationChoices.event.subscribe("choose", (_: unknown, choice?: Choice<ActivationMode>) => {
                if (!choice) return;
                this.globalData.activationMode = choice.id;
                this.clearHeldHotkeyState();
            });
            activationChoices.setRefreshMethod(() => activationChoices.get(this.settings.activationMode)!);
            activationChoices.refresh();
            container.appendChild(activationChoices.element);

            const hotkeyLabel = document.createElement("div");
            hotkeyLabel.textContent = "Activation Hotkey";
            hotkeyLabel.style.marginTop = "12px";
            hotkeyLabel.style.marginBottom = "6px";
            container.appendChild(hotkeyLabel);

            const hotkeyChoices = new ChoiceList<Choice<ActivationHotkey>>();
            const shiftChoice = new Choice<ActivationHotkey>("Shift");
            shiftChoice.setText(TranslationImpl.generator("Shift"));
            const controlChoice = new Choice<ActivationHotkey>("Control");
            controlChoice.setText(TranslationImpl.generator("Control"));
            const altChoice = new Choice<ActivationHotkey>("Alt");
            altChoice.setText(TranslationImpl.generator("Alt"));
            hotkeyChoices.setChoices(shiftChoice, controlChoice, altChoice);
            hotkeyChoices.event.subscribe("choose", (_: unknown, choice?: Choice<ActivationHotkey>) => {
                if (!choice) return;
                this.globalData.activationHotkey = choice.id;
                this.clearHeldHotkeyState();
            });
            hotkeyChoices.setRefreshMethod(() => hotkeyChoices.get(this.settings.activationHotkey)!);
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

            const diagnosticsToggle = new CheckButton();
            diagnosticsToggle.setChecked(this.settings.debugLogging, false);
            diagnosticsToggle.event.subscribe("toggle", (_: unknown, checked: boolean) => {
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

    public override onLoad(): void {
        document.addEventListener("keydown", this.onKeyDown);
        document.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
    }

    public override onUnload(): void {
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

    private get settings(): IBetterCraftingGlobalData {
        return this.globalData ?? DEFAULT_SETTINGS;
    }

    private normalizeSettings(data: unknown): IBetterCraftingGlobalData {
        const source = data && typeof data === "object" ? data as Partial<IBetterCraftingGlobalData> : {};

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

    private clearHeldHotkeyState(): void {
        this.shiftHeld = false;
    }

    private isConfiguredHotkey(key: string): boolean {
        return key === this.settings.activationHotkey;
    }

    private isActivationHotkeyHeld(): boolean {
        return this.shiftHeld;
    }

    private shouldOpenBetterCrafting(): boolean {
        if (this.bypassIntercept) return false;
        if (this.isRemoteMultiplayerClient()) return true;

        return this.settings.activationMode === "holdHotkeyToBypass"
            ? !this.isActivationHotkeyHeld()
            : this.isActivationHotkeyHeld();
    }

    private shouldAbortForHealthLoss(stat: IStat, oldValue: number): boolean {
        if (stat.type !== Stat.Health || (stat.value ?? 0) >= oldValue) return false;
        if (this.panel?.isUnsafeCraftingEnabled()) return false;

        return true;
    }

    private getItemId(item: Item): number | undefined {
        return getItemIdSafe(item);
    }

    private get debugLoggingEnabled(): boolean {
        return this.settings.debugLogging === true;
    }

    private debugLog(message: string, payload?: unknown): void {
        if (!this.debugLoggingEnabled) return;
        if (payload === undefined) {
            craftDebugLog(message);
        } else {
            craftDebugLog(message, payload);
        }
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (this.isConfiguredHotkey(e.key)) this.shiftHeld = true;
    };

    private onKeyUp = (e: KeyboardEvent) => {
        if (this.isConfiguredHotkey(e.key)) this.shiftHeld = false;
    };

    private onBlur = () => {
        this.clearHeldHotkeyState();
    };

    private consumeLegacyUnsafeCraftingSeed(): boolean {
        const seed = this.legacyUnsafeCraftingSeed;
        this.legacyUnsafeCraftingSeed = false;
        return seed;
    }

    private isRemoteMultiplayerClient(): boolean {
        return multiplayer?.isConnected === true && multiplayer.isClient;
    }

    private clearPendingApprovals(message?: string): void {
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

    private getTypeDebugName(type: ItemType | ItemTypeGroup | number | undefined): string {
        if (type === undefined) return "unknown";
        if (ItemManager.isGroup(type)) {
            return ItemTypeGroup[type as ItemTypeGroup] ?? `Group ${type}`;
        }

        return ItemType[type as ItemType] ?? `Item ${type}`;
    }

    private formatSelectionFailureMessage(details: ISelectionFailureDetails): string {
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

    private logSelectionFailure(context: string, requestId: number, details: ISelectionResolutionFailure): void {
        this.debugLog(`${context} rejected (${requestId}): ${details.reason}.`, {
            requestId,
            reason: details.reason,
            slotIndex: details.slotIndex,
            itemTypeOrGroup: details.itemTypeOrGroup,
            requestedItemIds: details.requestedItemIds,
            candidateItemIds: details.candidateItemIds,
        });
    }

    private createSelectionFailure(
        reason: ISelectionFailureDetails["reason"],
        options: Omit<ISelectionResolutionFailure, "reason" | "message">,
    ): ISelectionResolutionFailure {
        const details: ISelectionFailureDetails = { reason, ...options };
        return {
            ...details,
            message: this.formatSelectionFailureMessage(details),
        };
    }

    // ── Multiplayer approval system ──────────────────────────────────────────

    /**
     * Sends a request packet to the server and waits for approval before the
     * client may execute the action locally. Returns true if the server approved.
     */
    private requestApproval(buildAndSend: (requestId: number) => boolean | void): { requestId: number; promise: Promise<boolean> } {
        const requestId = this.nextMultiplayerRequestId++;
        this.debugLog(`Created approval request ${requestId}.`);
        const promise = new Promise<boolean>(resolve => {
            const timeout = setTimeout(() => {
                if (!this.pendingApprovals.has(requestId)) return;

                this.pendingApprovals.delete(requestId);
                this.debugLog(`Approval request ${requestId} timed out.`);
                this.panel?.showMultiplayerMessage("The server did not respond in time. Please try again.");
                resolve(false);
            }, 10_000);

            this.pendingApprovals.set(requestId, { resolve, timeout });

            // Safety timeout — server must respond within 10 seconds.
            
        });

        let sent: boolean | void;
        try {
            sent = buildAndSend(requestId);
        } catch (error) {
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
        } else {
            this.debugLog(`Dispatched approval request ${requestId}.`);
        }
        return { requestId, promise };
    }

    /** Client-side handler for the server's approval/rejection response. */
    public handleCraftApproval(approval: ICraftApprovalResponse): void {
        const pending = this.pendingApprovals.get(approval.requestId);
        if (!pending) return;

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

    /** Server-side: sends a craft approval/rejection response to the client. */
    private sendApproval(to: any, approval: ICraftApprovalResponse): void {
        const packet = new BetterCraftingApprovalPacket();
        packet.approval = approval;
        packet.sendTo(to);
    }

    /** Client-side: handles error-only status messages from the server. */
    public handleMultiplayerStatus(status: IBetterCraftingRequestStatus): void {
        if (status.selectionFailure) {
            this.debugLog(`Status ${status.requestId} failure details:`, status.selectionFailure);
        }
        if (status.state === "error" && status.message) {
            this.panel?.showMultiplayerMessage(status.message);
        }
    }

    private getPlayerKey(player: Player | undefined): number | undefined {
        return player ? ((player as any).id as number | undefined) : undefined;
    }

    private getPlayerFromConnection(connection: any): Player | undefined {
        const identifier = connection?.playerIdentifier as string | undefined;
        if (!identifier) return;

        return game.playerManager.getByIdentifier(identifier);
    }

    /** Server-side: revokes remaining passes when the client aborts a bulk operation. */
    public abortServerRequest(connection: any, request: IBulkActionAbortRequest): void {
        const player = this.getPlayerFromConnection(connection);
        const key = this.getPlayerKey(player);
        if (key === undefined) return;

        const pass = this.serverCraftPasses.get(key);
        if (pass && pass.requestId === request.requestId) {
            this.serverCraftPasses.delete(key);
        }
    }

    /**
     * Server-side: checks whether the executor has a valid pass for the given
     * action type, consumes one pass credit, and returns true if allowed.
     */
    private consumeServerPass(executor: Entity, actionType: ActionType, args: any[]): boolean {
        const key = this.getPlayerKey(executor as Player);
        if (key === undefined) return false;

        const pass = this.serverCraftPasses.get(key);
        if (!pass) return false;

        if (pass.actionType !== actionType) return false;
        if (pass.expiresAt < Date.now()) {
            this.debugLog(`Pass expired for player ${key}.`);
            this.serverCraftPasses.delete(key);
            return false;
        }

        if (actionType === ActionType.Craft) {
            if ((args[0] as ItemType | undefined) !== pass.itemType) return false;
        } else if (actionType === ActionType.Dismantle) {
            const item = args[0] as Item | undefined;
            const itemId = getItemId(item);
            if (!item || item.type !== pass.itemType || itemId === undefined) return false;
            if (pass.targetItemIds && !pass.targetItemIds.has(itemId)) return false;
            pass.targetItemIds?.delete(itemId);
        }

        pass.remaining--;
        if (pass.remaining <= 0) {
            this.serverCraftPasses.delete(key);
        }

        return true;
    }

    // ── Panel management ──────────────────────────────────────────────────────

    private ensurePanel(): BetterCraftingPanel | undefined {
        if (!this.panel) {
            const gameScreen = ui?.screens?.get(ScreenId.Game);
            if (gameScreen) {
                this.panel = new BetterCraftingPanel(
                    async (itemType, required, consumed, base) => {
                        await this.executeCraft(itemType, required, consumed, base);
                    },
                    async (itemType, quantity, excludedIds) => {
                        await this.executeBulkCraft(itemType, quantity, excludedIds);
                    },
                    async (items, requiredItem) => {
                        await this.executeDismantle(items, requiredItem);
                    },
                    () => this.settings,
                    this.consumeLegacyUnsafeCraftingSeed(),
                );
                this.panel.setPanelHideCallback(() => {
                    this.clearPendingApprovals();
                });
                gameScreen.append(this.panel);
            }
        }
        return this.panel;
    }

    private findMatchingItems(player: Player, type: ItemType | ItemTypeGroup): Item[] {
        if (!player?.island) return [];

        const items = player.island.items;
        const subContainerOpts = { includeSubContainers: true as true };
        const result: Item[] = ItemManager.isGroup(type)
            ? items.getItemsInContainerByGroup(player, type as ItemTypeGroup, subContainerOpts)
            : items.getItemsInContainerByType(player, type as ItemType, subContainerOpts);

        for (const container of items.getAdjacentContainers(player)) {
            const adjacentItems = ItemManager.isGroup(type)
                ? items.getItemsInContainerByGroup(container, type as ItemTypeGroup, subContainerOpts)
                : items.getItemsInContainerByType(container, type as ItemType, subContainerOpts);

            for (const item of adjacentItems) {
                if (!result.includes(item)) {
                    result.push(item);
                }
            }
        }

        return filterSelectableItems(result, getItemId).sort((a, b) => getQualitySortKey(b) - getQualitySortKey(a));
    }

    private buildRecipeInventorySnapshot(player: Player, itemType: ItemType): Record<string, unknown> {
        const recipe = itemDescriptions[itemType]?.recipe;
        if (!recipe) return { itemType, recipe: "missing" };

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

    private buildSlotSelectionMap(selections: ISelectionSlotIds[]): Map<number, number[]> {
        const result = new Map<number, number[]>();
        for (const selection of selections) {
            result.set(selection.slotIndex, [...selection.itemIds]);
        }

        return result;
    }

    private resolveSelectedItems(
        player: Player,
        type: ItemType | ItemTypeGroup,
        itemIds: readonly number[],
        reservedIds: Set<number>,
        options: {
            slotIndex?: number;
            failureReason?: ISelectionFailureDetails["reason"];
        } = {},
    ): IResolutionResult<Item[]> {
        const candidates = this.findMatchingItems(player, type);
        const candidateItemIds = candidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined);
        const byId = new Map<number, Item>();
        for (const item of candidates) {
            const id = getItemId(item);
            if (id !== undefined && !byId.has(id)) {
                byId.set(id, item);
            }
        }

        const resolved: Item[] = [];
        for (const itemId of itemIds) {
            if (reservedIds.has(itemId)) {
                return {
                    failure: this.createSelectionFailure("duplicateSelection", {
                        slotIndex: options.slotIndex,
                        itemTypeOrGroup: type as number,
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
                        itemTypeOrGroup: type as number,
                        requestedItemIds: [...itemIds],
                        candidateItemIds,
                    }),
                };
            }
            if (isItemProtected(item)) {
                return {
                    failure: this.createSelectionFailure("itemProtected", {
                        slotIndex: options.slotIndex,
                        itemTypeOrGroup: type as number,
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

    private resolveCraftSelection(player: Player, request: ICraftSelectionRequest): IResolutionResult<IResolvedCraftSelection> {
        const recipe = itemDescriptions[request.itemType]?.recipe;
        if (!recipe) {
            return {
                failure: this.createSelectionFailure("itemUnavailable", {
                    requestedItemIds: [],
                    candidateItemIds: [],
                }),
            };
        }

        const slotSelections = this.buildSlotSelectionMap(request.slotSelections);
        const reservedIds = new Set<number>();
        const resolvedSelections: Item[][] = [];

        for (let i = 0; i < recipe.components.length; i++) {
            const component = recipe.components[i];
            const selectedIds = slotSelections.get(i) ?? [];
            if (selectedIds.length < component.requiredAmount) {
                return {
                    failure: this.createSelectionFailure("missingSelection", {
                        slotIndex: i,
                        itemTypeOrGroup: component.type as number,
                        requestedItemIds: selectedIds,
                        candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
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

        let base: Item | undefined;
        if (recipe.baseComponent !== undefined) {
            if (request.baseItemId === undefined) {
                return {
                    failure: this.createSelectionFailure("missingSelection", {
                        slotIndex: -1,
                        itemTypeOrGroup: recipe.baseComponent as number,
                        candidateItemIds: this.findMatchingItems(player, recipe.baseComponent).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                    }),
                };
            }

            const resolvedBase = this.resolveSelectedItems(player, recipe.baseComponent, [request.baseItemId], reservedIds, {
                slotIndex: -1,
                failureReason: "baseUnavailable",
            });
            if (!resolvedBase.value?.length) return { failure: resolvedBase.failure };
            base = resolvedBase.value[0];
        }

        const payload = buildCraftExecutionPayload(resolvedSelections, (_, slotIndex) => {
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
                    ? partitionSelectedItems(selection.itemIds, component.requiredAmount, component.consumedAmount).consumed
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

    private partitionComponentSelection(requiredAmount: number, consumedAmount: number, items: readonly Item[]): IPartitionedSelection {
        return partitionSelectedItems(items, requiredAmount, consumedAmount);
    }

    private resolveBulkSelection(
        player: Player,
        request: IBulkCraftRequest,
        sessionConsumedIds: ReadonlySet<number>,
    ): IResolutionResult<IResolvedBulkSelection> {
        const recipe = itemDescriptions[request.itemType]?.recipe;
        if (!recipe) {
            return {
                failure: this.createSelectionFailure("itemUnavailable", {
                    requestedItemIds: [],
                    candidateItemIds: [],
                }),
            };
        }

        const reservedIds = new Set<number>(request.excludedIds);
        for (const itemId of sessionConsumedIds) {
            reservedIds.add(itemId);
        }

        const pinnedToolSelections = this.buildSlotSelectionMap(request.pinnedToolSelections);
        const pinnedUsedSelections = this.buildSlotSelectionMap(request.pinnedUsedSelections ?? []);
        const required: Item[] = [];
        const consumed: Item[] = [];
        const nextConsumedIds = new Set<number>(sessionConsumedIds);

        let base: Item | undefined;
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
                        itemTypeOrGroup: recipe.baseComponent as number,
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
            if (isSplitConsumption(component.requiredAmount, component.consumedAmount) && pinnedUsedIds.length > 0) {
                const usedCount = getUsedSelectionCount(component.requiredAmount, component.consumedAmount);
                const consumedCount = getConsumedSelectionCount(component.requiredAmount, component.consumedAmount);
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
                            itemTypeOrGroup: component.type as number,
                            requestedItemIds: pinnedUsedIds,
                            candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
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
                            itemTypeOrGroup: component.type as number,
                            requestedItemIds: pinnedToolIds,
                            candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                        }),
                    };
                }

            required.push(...candidates);
            const partitioned = partitionSelectedItems(candidates, component.requiredAmount, component.consumedAmount);
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

    private resolveDismantleTargets(player: Player, request: IDismantleRequest): Item[] | undefined {
        const nearby = this.findMatchingItems(player, request.itemType);
        const byId = new Map<number, Item>();
        for (const item of nearby) {
            const itemId = getItemId(item);
            if (itemId !== undefined) {
                byId.set(itemId, item);
            }
        }

        const resolved: Item[] = [];
        for (const itemId of request.targetItemIds) {
            const item = byId.get(itemId);
            if (!item || isItemProtected(item)) return;
            resolved.push(item);
        }

        return resolved;
    }

    // ── Craft execution ───────────────────────────────────────────────────────

    /**
     * Single craft — requests server approval on MP clients, then executes the
     * vanilla Craft action locally so Wayward's normal multiplayer sync handles
     * the ActionPacket. The server's permanent block will consume a pass credit.
     */
    private async executeCraft(
        itemType: ItemType,
        required: Item[] | undefined,
        consumed: Item[] | undefined,
        base: Item | undefined,
    ): Promise<void> {
        if (this.isRemoteMultiplayerClient()) {
            const { promise } = this.requestApproval(requestId => {
                const request = this.panel?.serializeCraftSelectionRequest(requestId);
                if (!request) return false;
                this.debugLog(`Dispatching craft approval request ${requestId}.`, this.panel?.buildCraftRequestDiagnostics(request));
                const packet = new BetterCraftingCraftRequestPacket();
                packet.request = request;
                packet.send();
                return true;
            });
            const approved = await promise;
            if (!approved) return;
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
            await ActionExecutor.get(Craft).execute(
                localPlayer,
                itemType,
                requiredItems,
                consumedItems,
                base,
                undefined,
            );
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
        } finally {
            this.bypassIntercept = false;
        }
    }

    /**
     * Races two promises:
     *
     * turnEndPromise — resolves after turnEnd fires AND hasDelay() clears.
     *   Subscribes to turnEnd BEFORE execute() (required — turnEnd fires
     *   synchronously inside execute() during passTurn, so subscribing after
     *   would miss it and hang forever). Once turnEnd fires, polls hasDelay()
     *   via requestAnimationFrame at ~60fps until the real-time action delay
     *   expires. RAF fires continuously regardless of TurnMode, so it detects
     *   the delay clearing even in Manual mode where tickEnd does not fire.
     *
     * abortPromise — resolves immediately if already aborted, or whenever
     *   abortBulkCraft() is called. This unblocks the loop when the action is
     *   rejected ("can't do that yet") and turnEnd never fires — the stop button
     *   and damage events trigger this path. Movement unblocks via turnEnd
     *   (movement passes a turn), so it works either way.
     *
     * MUST be called BEFORE execute().
     */
    private waitForTurnEnd(): Promise<void> {
        const turnEndPromise = new Promise<void>(resolve => {
            localPlayer.event.subscribeNext("turnEnd", () => {
                const poll = () => {
                    if (this.bulkAbortController?.aborted || !(localPlayer as any).hasDelay?.()) {
                        resolve();
                    } else {
                        requestAnimationFrame(poll);
                    }
                };
                requestAnimationFrame(poll);
            });
        });

        const abortPromise = new Promise<void>(resolve => {
            const ctrl = this.bulkAbortController;
            if (!ctrl) { resolve(); return; }
            if (ctrl.aborted) { resolve(); return; } // fast path: already aborted
            ctrl.resolveWait = resolve;
        });

        return Promise.race([turnEndPromise, abortPromise]);
    }

    private waitForActionDelayClear(): Promise<void> {
        return new Promise<void>(resolve => {
            const poll = () => {
                if (this.bulkAbortController?.aborted || !(localPlayer as any)?.hasDelay?.()) {
                    resolve();
                } else {
                    requestAnimationFrame(poll);
                }
            };

            poll();
        });
    }

    private abortBulkCraft(reason: string): void {
        if (this.bulkAbortController) {
            this.bulkAbortController.aborted = true;
            this.bulkAbortController.reason = reason;
            // Unblock any pending waitForTurnEnd() — critical for the stop button,
            // which cannot cause a turnEnd event the way player movement can.
            this.bulkAbortController.resolveWait?.();
            this.bulkAbortController.resolveWait = null;
        }
    }

    private canUseForDismantle(requiredItem?: Item): boolean {
        if (!requiredItem) return true;

        const perUseLoss = Math.max(
            0,
            ((requiredItem.description as any)?.damageOnUse?.[ActionType.Dismantle] as number | undefined)
                ?? requiredItem.getDamageModifier?.()
                ?? 0,
        );

        if (perUseLoss <= 0) return true;
        return (requiredItem.durability ?? 0) >= perUseLoss;
    }

    /**
     * Subscribes to movement and damage events to abort the bulk craft.
     * Returns a cleanup function that unsubscribes all handlers.
     */
    private registerBulkInterruptHooks(): () => void {
        const moveHandler = (_: any, fromTile: Tile, toTile: Tile) => {
            if (fromTile !== toTile) this.abortBulkCraft("movement");
        };

        const statHandler = (_: any, stat: IStat, oldValue: number, _info: IStatChangeInfo) => {
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

    /**
     * Bulk craft loop — executes N vanilla Craft actions sequentially,
     * each advancing one game turn. Enemies may act between iterations;
     * stamina and materials are re-checked before every craft.
     *
     * bypassIntercept is held true for the entire duration so our
     * preExecuteAction hook does not re-open the dialog mid-batch.
     *
     * The loop can be interrupted by: stop button, player movement,
     * HP loss (damage), or closing the crafting dialog (Escape).
     */
    private async executeBulkCraft(
        itemType: ItemType,
        quantity: number,
        excludedIds: Set<number>,
    ): Promise<void> {
        // Remote MP clients request approval + passes from the server, then
        // fall through to the same local bulk loop the host uses.
        let bulkRequestId: number | undefined;
        if (this.isRemoteMultiplayerClient()) {
            const { promise } = this.requestApproval(currentRequestId => {
                bulkRequestId = currentRequestId;
                const request = this.panel?.serializeBulkCraftRequest(currentRequestId, quantity);
                if (!request) return false;
                this.debugLog(`Dispatching bulk approval request ${currentRequestId}.`, this.panel?.buildBulkRequestDiagnostics(request));
                const packet = new BetterCraftingBulkCraftRequestPacket();
                packet.request = request;
                packet.send();
                return true;
            });
            const approved = await promise;
            if (!approved) return;
        }

        if (this.isBulkCrafting) return;

        const recipe = itemDescriptions[itemType]?.recipe;
        if (!recipe) return;

        const staminaCost = STAMINA_COST_PER_LEVEL[recipe.level as RecipeLevel] ?? 4;

        // Set up abort controller and interrupt hooks.
        this.bulkAbortController = { aborted: false, reason: "", resolveWait: null };
        const cleanupHooks = this.registerBulkInterruptHooks();
        this.panel?.setBulkAbortCallback(() => {
            this.abortBulkCraft("user_stop");
            // Tell server to revoke remaining passes so stale ActionPackets are blocked.
            if (bulkRequestId !== undefined && this.isRemoteMultiplayerClient()) {
                const abortPacket = new BetterCraftingAbortRequestPacket();
                abortPacket.request = { requestId: bulkRequestId };
                abortPacket.send();
            }
        });
        this.panel?.onBulkCraftStart(quantity);

        this.isBulkCrafting = true;
        this.bypassIntercept = true;
        // Accumulate IDs of items resolved as consumed each iteration. Passed to
        // resolveForBulkCraft so items the game engine hasn't physically removed yet
        // are not re-picked on the next iteration (prevents phantom under-consumption).
        const sessionConsumedIds = new Set<number>();
        try {
            for (let i = 0; i < quantity; i++) {
                if (this.bulkAbortController.aborted) break;

                // Never begin the next craft while the previous one is still in real-time delay.
                await this.waitForActionDelayClear();
                if (this.bulkAbortController.aborted) break;

                // Player / island null-guard.
                if (!localPlayer?.island) break;

                // Stamina pre-check.
                const currentStamina: number =
                    (localPlayer as any).stat?.get?.(Stat.Stamina)?.value ?? 0;
                if (!this.panel?.isUnsafeCraftingEnabled() && currentStamina < staminaCost) break;

                // Re-resolve items — prior crafts consume materials.
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

                // Check abort again (events may have fired during resolve).
                if (this.bulkAbortController.aborted) break;

                // Subscribe to turnEnd BEFORE execute — it fires synchronously
                // inside execute(), so subscribing after would miss it.
                const turnEndPromise = this.waitForTurnEnd();

                // One vanilla Craft action.
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
                await ActionExecutor.get(Craft).execute(
                    localPlayer,
                    itemType,
                    requiredItems.length > 0 ? requiredItems : undefined,
                    consumedItems.length > 0 ? consumedItems : undefined,
                    resolved.base,
                    undefined,
                );
                this.debugLog("BulkCraftPostExecute", {
                    itemType,
                    iteration: i + 1,
                    inventoryAfterExecute: localPlayer ? this.buildRecipeInventorySnapshot(localPlayer, itemType) : undefined,
                });

                // Track consumed IDs to guard against re-picking before game state updates.
                for (const item of resolved.consumed) {
                    const id = this.getItemId(item);
                    if (id !== undefined) sessionConsumedIds.add(id);
                }
                if (resolved.base) {
                    const id = this.getItemId(resolved.base);
                    if (id !== undefined) sessionConsumedIds.add(id);
                }

                // Update progress counter immediately after the craft completes.
                this.panel?.setBulkProgress(i + 1, quantity);
                this.panel?.refreshBulkCraftView(true, true, true);

                // Wait for turnEnd + one RAF (~16ms) before next iteration.
                await turnEndPromise;
            }
        } finally {
            cleanupHooks();
            this.bulkAbortController = null;
            this.panel?.setBulkAbortCallback(null);
            this.isBulkCrafting = false;
            this.bypassIntercept = false;
            this.panel?.onBulkCraftEnd();
        }
    }

    private async executeDismantle(items: Item[], requiredItem?: Item): Promise<void> {
        let dismantleRequestId: number | undefined;
        if (this.isRemoteMultiplayerClient()) {
            const { promise } = this.requestApproval(requestId => {
                dismantleRequestId = requestId;
                const request = this.panel?.serializeDismantleRequest(requestId, items.length);
                if (!request) return false;
                const packet = new BetterCraftingDismantleRequestPacket();
                packet.request = request;
                packet.send();
                return true;
            });
            const approved = await promise;
            if (!approved) return;
        }

        if (this.isBulkCrafting || items.length === 0) return;

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
                if (this.bulkAbortController.aborted) break;

                await this.waitForActionDelayClear();
                if (this.bulkAbortController.aborted) break;
                if (!localPlayer?.island) break;

                const requiresRequiredItem = this.panel?.requiresDismantleRequiredItem() ?? false;
                if (requiresRequiredItem) {
                    const resolvedRequiredItem = this.panel?.resolveDismantleRequiredSelection() ?? activeRequiredItem;
                    if (!resolvedRequiredItem || !this.canUseForDismantle(resolvedRequiredItem)) break;
                    stopAfterCurrent = activeRequiredItem !== undefined && resolvedRequiredItem !== activeRequiredItem;
                    activeRequiredItem = resolvedRequiredItem;
                } else {
                    activeRequiredItem = undefined;
                }

                const item = items[i];
                if (!item) break;

                const turnEndPromise = this.waitForTurnEnd();

                try {
                    await ActionExecutor.get(Dismantle).execute(
                        localPlayer,
                        item,
                        activeRequiredItem,
                    );
                } catch (error) {
                    this.debugLog("Dismantle failed", error);
                    break;
                }

                this.panel?.setBulkProgress(i + 1, items.length, "Dismantling");
                this.panel?.refreshDismantleView(true, true, true);
                await turnEndPromise;
                if (stopAfterCurrent) break;
            }
        } finally {
            cleanupHooks();
            this.bulkAbortController = null;
            this.panel?.setBulkAbortCallback(null);
            this.isBulkCrafting = false;
            this.bypassIntercept = false;
            this.panel?.onBulkCraftEnd();
        }
    }

    /**
     * Server-side: validates the client's single-craft selection, grants one
     * pass so the client's upcoming ActionPacket is allowed through the
     * permanent block, and sends an approval response.
     */
    public processCraftRequest(connection: any, request: ICraftSelectionRequest): void {
        const player = this.getPlayerFromConnection(connection);
        if (!player) return;

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
        if (key === undefined) return;

        this.serverCraftPasses.set(key, {
            actionType: ActionType.Craft,
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

    /**
     * Server-side: validates the bulk-craft request, grants N passes (one per
     * iteration), and sends an approval response. The client runs the bulk loop
     * locally; each iteration's ActionPacket consumes one pass.
     */
    public processBulkCraftRequest(connection: any, request: IBulkCraftRequest): void {
        const player = this.getPlayerFromConnection(connection);
        if (!player) return;

        const recipe = itemDescriptions[request.itemType]?.recipe;
        if (!recipe) {
            this.sendApproval(connection, {
                requestId: request.requestId,
                kind: "bulkCraft",
                approved: false,
                message: "No recipe was found for that craft request.",
            });
            return;
        }

        // Light validation: ensure at least the first iteration can resolve.
        const sessionConsumedIds = new Set<number>();
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
        if (key === undefined) return;

        this.serverCraftPasses.set(key, {
            actionType: ActionType.Craft,
            kind: "bulkCraft",
            itemType: request.itemType,
            remaining: request.quantity,
            requestId: request.requestId,
            // Scale timeout: 30s base + 2s per craft iteration.
            expiresAt: Date.now() + 30_000 + (request.quantity * 2_000),
        });

        this.sendApproval(connection, {
            requestId: request.requestId,
            kind: "bulkCraft",
            approved: true,
            passCount: request.quantity,
        });
    }

    /**
     * Server-side: validates the dismantle request, grants N passes (one per
     * target), and sends an approval response.
     */
    public processDismantleRequest(connection: any, request: IDismantleRequest): void {
        const player = this.getPlayerFromConnection(connection);
        if (!player) return;

        const dismantle = itemDescriptions[request.itemType]?.dismantle;
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
        if (key === undefined) return;

        this.serverCraftPasses.set(key, {
            actionType: ActionType.Dismantle,
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

    // ── Action interception ───────────────────────────────────────────────────

    @EventHandler(EventBus.Actions, "preExecuteAction")
    public onPreExecuteAction(
        host: any,
        actionType: ActionType,
        actionApi: IActionHandlerApi<Entity>,
        args: any[],
    ): false | void {
        // ── Server-side: permanent block for remote players' Craft/Dismantle ──
        // Blocks stale vanilla ActionPackets that race ahead of the mod's
        // interception on the client. Approved actions consume a pass credit
        // granted by processCraftRequest / processBulkCraftRequest / processDismantleRequest.
        if (multiplayer?.isServer) {
            if (actionType === ActionType.Craft || actionType === ActionType.Dismantle) {
                const executor = actionApi.executor;
                if (executor !== localPlayer) {
                    if (this.consumeServerPass(executor, actionType, args)) {
                        return; // Pass consumed — allow this mod-approved action through.
                    }
                    return false;
                }
            }
        }

        if (!this.shouldOpenBetterCrafting()) return;

        if (actionType === ActionType.Craft && actionApi.executor === localPlayer) {
            const itemType = args[0] as number;
            if (!itemDescriptions[itemType]?.recipe) return;

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

        if (actionType === ActionType.Dismantle && actionApi.executor === localPlayer) {
            const item = args[0] as Item | undefined;
            if (!item) return;
            if (!itemDescriptions[item.type]?.dismantle) return;

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


