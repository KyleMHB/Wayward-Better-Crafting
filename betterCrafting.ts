import Mod from '@wayward/game/mod/Mod';
import BetterCraftingPanel from './src/BetterCraftingDialog';
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
import { ItemType, ItemTypeGroup } from "@wayward/game/game/item/IItem";
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
import { getCraftStaminaCost } from "./src/craftStamina";
import { getItemIdSafe, getItemIds } from "./src/itemIdentity";
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
type CloseHotkey = string;

interface IBetterCraftingGlobalData {
    activationMode: ActivationMode;
    activationHotkey: ActivationHotkey;
    closeHotkey: CloseHotkey;
    safeCrafting: boolean;
    debugLogging: boolean;
}

const DEFAULT_SETTINGS: Readonly<IBetterCraftingGlobalData> = {
    activationMode: "holdHotkeyToBypass",
    activationHotkey: "Shift",
    closeHotkey: "c",
    safeCrafting: true,
    debugLogging: false,
};

const craftDebugLog = Log.warn("Better Crafting", "CraftDebug");

interface IPendingApproval {
    resolve: (approved: boolean) => void;
    timeout: ReturnType<typeof setTimeout>;
}

interface IPendingVanillaBypass {
    itemType: ItemType;
    requiredItems?: Item[];
    consumedItems?: Item[];
    baseItem?: Item;
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

interface IVanillaCraftBypassPermitRequest {
    requestId: number;
    itemType: ItemType;
    requiredItemIds: number[];
    consumedItemIds: number[];
    baseItemId?: number;
}

interface IServerVanillaCraftBypassPermit extends IVanillaCraftBypassPermitRequest {
    expiresAt: number;
}

interface IVanillaCraftActionDetails {
    itemType: ItemType;
    requiredItemIds: number[];
    consumedItemIds: number[];
    baseItemId?: number;
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

interface IServerCraftBlockDiagnostics {
    playerIdentifier?: string;
    playerKey?: number;
    actionType: ActionType.Craft | ActionType.Dismantle;
    itemType?: ItemType;
    requestId?: number;
    reason:
        | "noApprovalRequest"
        | "approvalGrantedButPassMissing"
        | "approvalGrantedButPassExpired"
        | "approvalGrantedButPassMismatch"
        | "bypassPermitMissing"
        | "bypassPermitExpired"
        | "bypassPermitMismatch"
        | "actionArgsUnserializable"
        | "dismantlePassMissing";
    pass?: {
        kind: ICraftApprovalResponse["kind"];
        requestId: number;
        remaining: number;
        expiresAt: number;
        itemType: ItemType;
    };
    bypassPermit?: {
        requestId: number;
        expiresAt: number;
        itemType: ItemType;
    };
    actionDetails?: IVanillaCraftActionDetails;
    argsSummary?: {
        itemType?: ItemType;
        requiredCount: number;
        consumedCount: number;
        hasBase: boolean;
    };
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

function getCurrentStamina(): number {
    return localPlayer ? (localPlayer as any).stat?.get?.(Stat.Stamina)?.value ?? 0 : 0;
}

function normalizeCloseHotkey(value: unknown): CloseHotkey | undefined {
    if (typeof value !== "string") return undefined;

    const normalized = value.trim();
    if (/^[a-z]$/i.test(normalized)) return normalized.toLowerCase();
    if (normalized === "Escape") return normalized;

    return undefined;
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

class BetterCraftingVanillaBypassPermitPacket extends ServerPacket {
    public request?: IVanillaCraftBypassPermitRequest;

    public getDebugInfo(): string {
        return `BetterCraftingVanillaBypassPermit:${this.request?.itemType ?? "unknown"}:${this.request?.requestId ?? 0}`;
    }

    public process(): void {
        if (this.request) {
            BetterCrafting.INSTANCE?.processVanillaBypassPermit(this.connection, this.request);
        }
    }

    protected override getIndexSize(): number {
        return 1;
    }

    protected override writeData(): void {
        this.writeIndexedObject(this.request);
    }

    protected override readData(): void {
        this.request = this.readIndexedObject() as IVanillaCraftBypassPermitRequest | undefined;
    }
}

const betterCraftingStatusPacketRegistration = Mod.register.packet(BetterCraftingStatusPacket);
const betterCraftingApprovalPacketRegistration = Mod.register.packet(BetterCraftingApprovalPacket);
const betterCraftingCraftRequestPacketRegistration = Mod.register.packet(BetterCraftingCraftRequestPacket);
const betterCraftingBulkCraftRequestPacketRegistration = Mod.register.packet(BetterCraftingBulkCraftRequestPacket);
const betterCraftingDismantleRequestPacketRegistration = Mod.register.packet(BetterCraftingDismantleRequestPacket);
const betterCraftingAbortRequestPacketRegistration = Mod.register.packet(BetterCraftingAbortRequestPacket);
const betterCraftingVanillaBypassPermitPacketRegistration = Mod.register.packet(BetterCraftingVanillaBypassPermitPacket);
void [
    betterCraftingStatusPacketRegistration,
    betterCraftingApprovalPacketRegistration,
    betterCraftingCraftRequestPacketRegistration,
    betterCraftingBulkCraftRequestPacketRegistration,
    betterCraftingDismantleRequestPacketRegistration,
    betterCraftingAbortRequestPacketRegistration,
    betterCraftingVanillaBypassPermitPacketRegistration,
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
    private bulkAbortController: {
        aborted: boolean;
        reason: string;
        /** Resolves the current waitForTurnEnd() abort-promise, unblocking the loop. */
        resolveWait: (() => void) | null;
    } | null = null;
    private nextMultiplayerRequestId = 1;
    private readonly pendingApprovals = new Map<number, IPendingApproval>();
    private readonly pendingVanillaBypasses = new Map<number, IPendingVanillaBypass>();
    /** Server-side: tracks granted action passes per player (keyed by player ID). */
    private readonly serverCraftPasses = new Map<number, IServerCraftPass>();
    /** Server-side: tracks one-shot vanilla bypass craft permits per player. */
    private readonly serverVanillaBypassPermits = new Map<number, IServerVanillaCraftBypassPermit>();

    // ── Mod lifecycle ─────────────────────────────────────────────────────────

    public override initializeGlobalData(data: unknown): IBetterCraftingGlobalData {
        return this.normalizeSettings(data);
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

            const closeHotkeyLabel = document.createElement("div");
            closeHotkeyLabel.textContent = "Close UI Hotkey";
            closeHotkeyLabel.style.marginTop = "12px";
            closeHotkeyLabel.style.marginBottom = "6px";
            container.appendChild(closeHotkeyLabel);

            const closeHotkeyChoices = new ChoiceList<Choice<CloseHotkey>>();
            const closeHotkeyValues: CloseHotkey[] = [
                "c", "x", "z", "q", "e", "r", "f", "g", "v", "b",
                "n", "m", "t", "y", "h", "j", "k", "l", "Escape",
            ];
            const closeHotkeyChoiceById = new Map<CloseHotkey, Choice<CloseHotkey>>();
            const closeHotkeyChoicesList = closeHotkeyValues.map(closeHotkey => {
                const choice = new Choice<CloseHotkey>(closeHotkey);
                choice.setText(TranslationImpl.generator(closeHotkey === "Escape" ? "Escape" : closeHotkey.toUpperCase()));
                closeHotkeyChoiceById.set(closeHotkey, choice);
                return choice;
            });
            closeHotkeyChoices.setChoices(...closeHotkeyChoicesList);
            closeHotkeyChoices.event.subscribe("choose", (_: unknown, choice?: Choice<CloseHotkey>) => {
                if (!choice) return;
                this.globalData.closeHotkey = choice.id;
            });
            closeHotkeyChoices.setRefreshMethod(() => closeHotkeyChoiceById.get(this.settings.closeHotkey) ?? closeHotkeyChoiceById.get(DEFAULT_SETTINGS.closeHotkey)!);
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
        this.clearPendingVanillaBypasses("mod_unload");
        this.serverCraftPasses.clear();
        this.serverVanillaBypassPermits.clear();
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
            closeHotkey: normalizeCloseHotkey(source.closeHotkey) ?? DEFAULT_SETTINGS.closeHotkey,
            safeCrafting: typeof source.safeCrafting === "boolean"
                ? source.safeCrafting
                : typeof (source as { unsafeBulkCrafting?: unknown }).unsafeBulkCrafting === "boolean"
                    ? !(source as { unsafeBulkCrafting: boolean }).unsafeBulkCrafting
                    : DEFAULT_SETTINGS.safeCrafting,
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

    private isTypingInEditableControl(target: EventTarget | null = document.activeElement): boolean {
        const element = target instanceof HTMLElement ? target : undefined;
        if (!element) return false;
        if (element.closest("input, textarea, select")) return true;

        const editable = element.closest("[contenteditable]");
        return editable instanceof HTMLElement && editable.isContentEditable;
    }

    private isActivationHotkeyHeld(): boolean {
        return this.shiftHeld;
    }

    private shouldOpenBetterCrafting(): boolean {
        if (this.bypassIntercept) return false;
        if (this.isTypingInEditableControl()) return false;
        if (this.isRemoteMultiplayerClient()) return true;

        return this.settings.activationMode === "holdHotkeyToBypass"
            ? !this.isActivationHotkeyHeld()
            : this.isActivationHotkeyHeld();
    }

    private shouldAbortForHealthLoss(stat: IStat, oldValue: number): boolean {
        if (stat.type !== Stat.Health || (stat.value ?? 0) >= oldValue) return false;
        if (!this.panel?.isSafeCraftingEnabled()) return false;

        return true;
    }

    private getItemId(item: Item | undefined): number | undefined {
        return getItemIdSafe(item);
    }

    private getCraftReusableItems(itemType: ItemType, requiredItems: readonly Item[] | undefined): Item[] {
        if (!requiredItems?.length) return [];

        const recipe = itemDescriptions[itemType]?.recipe;
        if (!recipe) return [];

        const reusable: Item[] = [];
        let requiredIndex = 0;

        for (const component of recipe.components) {
            const selectedItems = requiredItems.slice(requiredIndex, requiredIndex + component.requiredAmount);
            requiredIndex += component.requiredAmount;
            if (selectedItems.length < component.requiredAmount) break;
            if (!isSplitConsumption(component.requiredAmount, component.consumedAmount)) continue;

            reusable.push(...selectedItems.slice(getConsumedSelectionCount(component.requiredAmount, component.consumedAmount)));
        }

        return reusable;
    }

    private applyCraftReusableDurability(itemType: ItemType, requiredItems: readonly Item[] | undefined): void {
        const reusableItems = this.getCraftReusableItems(itemType, requiredItems);
        if (reusableItems.length === 0) return;

        for (const item of reusableItems) {
            const durabilityLoss = Math.max(0, item.getDamageModifier?.() ?? 0);
            if (durabilityLoss <= 0) continue;
            if ((item as any).isValid === false) continue;
            item.damage("betterCraftingSplitUse", durabilityLoss);
        }

        this.debugLog("Applied reusable craft durability.", {
            itemType,
            reusableIds: getItemIds(reusableItems, item => this.getItemId(item)),
        });
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
        if (this.isTypingInEditableControl(e.target)) return;
        if (this.isConfiguredHotkey(e.key)) this.shiftHeld = true;
    };

    private onKeyUp = (e: KeyboardEvent) => {
        if (this.isConfiguredHotkey(e.key)) this.shiftHeld = false;
    };

    private onBlur = () => {
        this.clearHeldHotkeyState();
    };

    private isRemoteMultiplayerClient(): boolean {
        return multiplayer?.isConnected === true && multiplayer.isClient;
    }

    private showMultiplayerMessage(message: string): void {
        this.panel?.showMultiplayerMessage(message);
    }

    private clearPendingApprovals(message?: string): void {
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

    private clearPendingVanillaBypasses(reason: string): void {
        if (this.pendingVanillaBypasses.size === 0) return;

        for (const requestId of this.pendingVanillaBypasses.keys()) {
            this.debugLog(`Cleared pending vanilla bypass ${requestId}.`, { requestId, reason });
        }

        this.pendingVanillaBypasses.clear();
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
                this.showMultiplayerMessage("The server did not respond in time. Please try again.");
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
                requiredIds: getItemIds(pendingBypass.requiredItems, item => this.getItemId(item)),
                consumedIds: getItemIds(pendingBypass.consumedItems, item => this.getItemId(item)),
                baseId: this.getItemId(pendingBypass.baseItem),
            });

            void this.replayApprovedVanillaBypass(pendingBypass, approval.requestId);
        }
    }

    /** Server-side: sends a craft approval/rejection response to the client. */
    private sendApproval(to: any, approval: ICraftApprovalResponse): void {
        this.debugLog(`Sending approval ${approval.requestId}: ${approval.approved ? "approved" : "rejected"}.`, approval);
        const packet = new BetterCraftingApprovalPacket();
        packet.approval = approval;
        packet.sendTo(to);
    }

    /** Server-side: sends a status update/error message to the client. */
    private sendStatus(to: any, status: IBetterCraftingRequestStatus): void {
        this.debugLog(`Sending status ${status.requestId}: ${status.kind}/${status.state}.`, status);
        const packet = new BetterCraftingStatusPacket();
        packet.status = status;
        packet.sendTo(to);
    }

    /** Client-side: handles error-only status messages from the server. */
    public handleMultiplayerStatus(status: IBetterCraftingRequestStatus): void {
        this.debugLog(`Received status ${status.requestId}: ${status.kind}/${status.state}.`, status);
        if (status.selectionFailure) {
            this.debugLog(`Status ${status.requestId} failure details:`, status.selectionFailure);
        }
        if (status.state === "error" && status.message) {
            this.showMultiplayerMessage(status.message);
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

    private getConnectionForPlayer(player: Player | undefined): any {
        const identifier = (player as any)?.identifier as string | undefined;
        if (!identifier || !multiplayer?.isServer) return;

        return multiplayer.getClients().find(connection => connection.playerIdentifier === identifier);
    }

    private buildCraftArgsSummary(args: any[]): IServerCraftBlockDiagnostics["argsSummary"] {
        return {
            itemType: args[0] as ItemType | undefined,
            requiredCount: Array.isArray(args[1]) ? args[1].length : 0,
            consumedCount: Array.isArray(args[2]) ? args[2].length : 0,
            hasBase: args[3] !== undefined,
        };
    }

    private reportBlockedRemoteCraft(
        player: Player | undefined,
        message: string,
        diagnostics: IServerCraftBlockDiagnostics,
    ): void {
        this.debugLog(`Blocked remote ${ActionType[diagnostics.actionType]} action: ${diagnostics.reason}.`, diagnostics);

        const connection = this.getConnectionForPlayer(player);
        if (!connection) {
            this.debugLog("Unable to send blocked craft status because no connection was found for the player.", diagnostics);
            return;
        }

        this.sendStatus(connection, {
            requestId: diagnostics.requestId ?? 0,
            kind: diagnostics.actionType === ActionType.Dismantle ? "dismantle" : "craft",
            state: "error",
            message,
        });
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

    public processVanillaBypassPermit(connection: any, request: IVanillaCraftBypassPermitRequest): void {
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

        const recipe = itemDescriptions[request.itemType]?.recipe;
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
            actionType: ActionType.Craft,
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

    private getVanillaCraftActionDetails(args: any[]): IVanillaCraftActionDetails | undefined {
        const itemType = args[0] as ItemType | undefined;
        if (itemType === undefined) return;

        const requiredItems = Array.isArray(args[1]) ? args[1] as Item[] : undefined;
        const consumedItems = Array.isArray(args[2]) ? args[2] as Item[] : undefined;
        const base = args[3] as Item | undefined;

        const requiredItemIds = getItemIds(requiredItems, item => this.getItemId(item));
        const consumedItemIds = getItemIds(consumedItems, item => this.getItemId(item));
        const baseItemId = this.getItemId(base);

        if ((requiredItems?.length ?? 0) !== requiredItemIds.length) return;
        if ((consumedItems?.length ?? 0) !== consumedItemIds.length) return;
        if (base !== undefined && baseItemId === undefined) return;

        return {
            itemType,
            requiredItemIds,
            consumedItemIds,
            baseItemId,
        };
    }

    private areNumberArraysEqual(left: readonly number[], right: readonly number[]): boolean {
        if (left.length !== right.length) return false;
        for (let i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) return false;
        }

        return true;
    }

    private consumeVanillaBypassPermit(executor: Entity, args: any[]): boolean {
        const key = this.getPlayerKey(executor as Player);
        if (key === undefined) return false;

        const permit = this.serverVanillaBypassPermits.get(key);
        if (!permit) {
            this.debugLog(`No vanilla bypass permit found for player ${key}.`, {
                playerIdentifier: (executor as any)?.identifier,
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

    private trySendVanillaBypassPermit(args: any[]): boolean {
        if (!this.isRemoteMultiplayerClient()) return false;

        const actionDetails = this.getVanillaCraftActionDetails(args);
        if (!actionDetails) {
            this.debugLog("Failed to serialize vanilla bypass permit from craft args.", args);
            this.showMultiplayerMessage("The selected vanilla craft could not be validated for multiplayer. Release the bypass hotkey and try again.");
            return false;
        }

        const itemType = args[0] as ItemType | undefined;
        if (itemType === undefined) return false;

        const requiredItems = Array.isArray(args[1]) ? [...args[1] as Item[]] : undefined;
        const consumedItems = Array.isArray(args[2]) ? [...args[2] as Item[]] : undefined;
        const baseItem = args[3] as Item | undefined;

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
                requiredIds: getItemIds(requiredItems, item => this.getItemId(item)),
                consumedIds: getItemIds(consumedItems, item => this.getItemId(item)),
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

    private async replayApprovedVanillaBypass(pendingBypass: IPendingVanillaBypass, requestId: number): Promise<void> {
        this.bypassIntercept = true;
        try {
            await ActionExecutor.get(Craft).execute(
                localPlayer,
                pendingBypass.itemType,
                pendingBypass.requiredItems ? [...pendingBypass.requiredItems] : undefined,
                pendingBypass.consumedItems ? [...pendingBypass.consumedItems] : undefined,
                pendingBypass.baseItem,
                undefined,
            );
        } finally {
            this.debugLog(`Finished replaying vanilla bypass ${requestId}.`, { requestId, itemType: pendingBypass.itemType });
            this.bypassIntercept = false;
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
        if (!pass) {
            this.debugLog(`No server pass found for player ${key}.`, {
                playerIdentifier: (executor as any)?.identifier,
                playerKey: key,
                actionType,
                argsSummary: this.buildCraftArgsSummary(args),
            });
            return false;
        }

        if (pass.actionType !== actionType) {
            this.debugLog(`Server pass action type mismatch for player ${key}.`, {
                playerIdentifier: (executor as any)?.identifier,
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

        if (actionType === ActionType.Craft) {
            if ((args[0] as ItemType | undefined) !== pass.itemType) {
                this.debugLog(`Server craft pass item type mismatch for player ${key}.`, {
                    playerIdentifier: (executor as any)?.identifier,
                    playerKey: key,
                    pass,
                    argsSummary: this.buildCraftArgsSummary(args),
                });
                return false;
            }
        } else if (actionType === ActionType.Dismantle) {
            const item = args[0] as Item | undefined;
            const itemId = getItemId(item);
            if (!item || item.type !== pass.itemType || itemId === undefined) {
                this.debugLog(`Server dismantle pass target mismatch for player ${key}.`, {
                    playerIdentifier: (executor as any)?.identifier,
                    playerKey: key,
                    pass,
                    itemType: item?.type,
                    itemId,
                });
                return false;
            }
            if (pass.targetItemIds && !pass.targetItemIds.has(itemId)) {
                this.debugLog(`Server dismantle pass item id mismatch for player ${key}.`, {
                    playerIdentifier: (executor as any)?.identifier,
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
            playerIdentifier: (executor as any)?.identifier,
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
                    this.settings.safeCrafting,
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
        const preReservedUsedSelections = new Map<number, Item[]>();
        const preReservedToolSelections = new Map<number, Item[]>();

        for (let i = 0; i < recipe.components.length; i++) {
            const component = recipe.components[i];
            if (isSplitConsumption(component.requiredAmount, component.consumedAmount)) {
                const pinnedUsedIds = pinnedUsedSelections.get(i) ?? [];
                if (pinnedUsedIds.length === 0) continue;

                const resolvedUsed = this.resolveSelectedItems(player, component.type, pinnedUsedIds, reservedIds, {
                    slotIndex: i,
                    failureReason: "pinnedToolUnavailable",
                });
                const usedCount = getUsedSelectionCount(component.requiredAmount, component.consumedAmount);
                if (resolvedUsed.value && resolvedUsed.value.length >= usedCount) {
                    preReservedUsedSelections.set(i, resolvedUsed.value.slice(0, usedCount));
                }
                continue;
            }

            if (component.consumedAmount > 0) continue;

            const pinnedToolIds = pinnedToolSelections.get(i) ?? [];
            if (pinnedToolIds.length === 0) continue;

            const resolvedPinned = this.resolveSelectedItems(player, component.type, pinnedToolIds, reservedIds, {
                slotIndex: i,
                failureReason: "pinnedToolUnavailable",
            });
            if (resolvedPinned.value && resolvedPinned.value.length >= component.requiredAmount) {
                preReservedToolSelections.set(i, resolvedPinned.value.slice(0, component.requiredAmount));
            }
        }

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
                const usedItems = preReservedUsedSelections.get(i);
                if (!usedItems || usedItems.length < usedCount) {
                    return {
                        failure: this.createSelectionFailure("pinnedToolUnavailable", {
                            slotIndex: i,
                            itemTypeOrGroup: component.type as number,
                            requestedItemIds: pinnedUsedIds,
                            candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                        }),
                    };
                }

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
                const resolvedPinned = preReservedToolSelections.get(i);
                if (!resolvedPinned || resolvedPinned.length < component.requiredAmount) {
                    return {
                        failure: this.createSelectionFailure("pinnedToolUnavailable", {
                            slotIndex: i,
                            itemTypeOrGroup: component.type as number,
                            requestedItemIds: pinnedToolIds,
                            candidateItemIds: this.findMatchingItems(player, component.type).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
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
        if (request.requiredItemId !== undefined && request.targetItemIds.includes(request.requiredItemId)) return;

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
        const recipe = itemDescriptions[itemType]?.recipe;
        if (!recipe) return;

        const staminaCost = getCraftStaminaCost(recipe.level);
        if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < staminaCost) return;

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

        if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < staminaCost) return;

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

    private getRemainingDurabilityUses(requiredItem: Item, perUseLoss: number, leaveOneUse: boolean): number {
        if (perUseLoss <= 0) return Number.MAX_SAFE_INTEGER;

        const durability = requiredItem.durability ?? 0;
        if (durability <= 0) return 0;

        const usableActions = Math.ceil(durability / perUseLoss);
        return Math.max(0, usableActions - (leaveOneUse ? 1 : 0));
    }

    private canUseForDismantle(requiredItem?: Item, leaveOneUse = false): boolean {
        if (!requiredItem) return true;

        const perUseLoss = Math.max(
            0,
            ((requiredItem.description as any)?.damageOnUse?.[ActionType.Dismantle] as number | undefined)
                ?? requiredItem.getDamageModifier?.()
                ?? 0,
        );

        if (perUseLoss <= 0) return true;
        return this.getRemainingDurabilityUses(requiredItem, perUseLoss, leaveOneUse) > 0;
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

        const staminaCost = getCraftStaminaCost(recipe.level);

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
                if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < staminaCost) break;

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

                if (this.panel?.isSafeCraftingEnabled() && getCurrentStamina() < 1) break;

                const requiresRequiredItem = this.panel?.requiresDismantleRequiredItem() ?? false;
                if (requiresRequiredItem) {
                    const resolvedRequiredItem = this.panel?.resolveDismantleRequiredSelection() ?? activeRequiredItem;
                    const preserveDurability = this.panel?.shouldPreserveDismantleRequiredDurability() ?? true;
                    if (!resolvedRequiredItem || !this.canUseForDismantle(resolvedRequiredItem, preserveDurability)) break;
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
        this.debugLog(`Received craft approval request ${request.requestId}.`, {
            playerIdentifier: connection?.playerIdentifier,
            request,
        });
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

    /**
     * Server-side: validates the bulk-craft request, grants N passes (one per
     * iteration), and sends an approval response. The client runs the bulk loop
     * locally; each iteration's ActionPacket consumes one pass.
     */
    public processBulkCraftRequest(connection: any, request: IBulkCraftRequest): void {
        this.debugLog(`Received bulk craft approval request ${request.requestId}.`, {
            playerIdentifier: connection?.playerIdentifier,
            request,
        });
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

    /**
     * Server-side: validates the dismantle request, grants N passes (one per
     * target), and sends an approval response.
     */
    public processDismantleRequest(connection: any, request: IDismantleRequest): void {
        this.debugLog(`Received dismantle approval request ${request.requestId}.`, {
            playerIdentifier: connection?.playerIdentifier,
            request,
        });
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

    private isVanillaBypassCraftRequested(actionType: ActionType, actionApi: IActionHandlerApi<Entity>): boolean {
        if (actionType !== ActionType.Craft) return false;
        if (actionApi.executor !== localPlayer) return false;
        if (!this.isRemoteMultiplayerClient()) return false;
        if (this.bypassIntercept) return false;

        return this.settings.activationMode === "holdHotkeyToBypass"
            && this.isActivationHotkeyHeld();
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
                    const player = executor as Player;
                    const playerKey = this.getPlayerKey(player);
                    const pass = playerKey === undefined ? undefined : this.serverCraftPasses.get(playerKey);
                    const permit = playerKey === undefined ? undefined : this.serverVanillaBypassPermits.get(playerKey);
                    const actionDetails = actionType === ActionType.Craft
                        ? this.getVanillaCraftActionDetails(args)
                        : undefined;
                    this.debugLog(`Evaluating remote ${ActionType[actionType]} action on server.`, {
                        playerIdentifier: (player as any)?.identifier,
                        playerKey,
                        actionType,
                        itemType: args[0] as ItemType | undefined,
                        pass,
                        bypassPermit: permit,
                        actionDetails,
                        argsSummary: this.buildCraftArgsSummary(args),
                    });
                    if (actionType === ActionType.Craft && this.consumeVanillaBypassPermit(executor, args)) {
                        return;
                    }
                    if (this.consumeServerPass(executor, actionType, args)) {
                        return; // Pass consumed — allow this mod-approved action through.
                    }
                    if (actionType === ActionType.Craft) {
                        this.reportBlockedRemoteCraft(player, "That vanilla craft could not be validated in multiplayer. Try again without bypass if it keeps happening.", {
                            playerIdentifier: (player as any)?.identifier,
                            playerKey,
                            actionType,
                            itemType: args[0] as ItemType | undefined,
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
                    } else {
                        this.reportBlockedRemoteCraft(player, "That dismantle action could not be validated in multiplayer. Try again if it keeps happening.", {
                            playerIdentifier: (player as any)?.identifier,
                            playerKey,
                            actionType,
                            itemType: (args[0] as Item | undefined)?.type,
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
                    itemType: args[0] as ItemType | undefined,
                    argsSummary: this.buildCraftArgsSummary(args),
                });
            }

            return false;
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

    @EventHandler(EventBus.Actions, "postExecuteAction")
    public onPostExecuteAction(
        host: any,
        actionType: ActionType,
        actionApi: IActionHandlerApi<Entity>,
        args: any[],
    ): void {
        if (actionType !== ActionType.Craft) return;

        const itemType = args[0] as ItemType | undefined;
        const requiredItems = Array.isArray(args[1]) ? args[1] as Item[] : undefined;
        if (itemType === undefined || !requiredItems?.length) return;

        this.applyCraftReusableDurability(itemType, requiredItems);
    }
}


