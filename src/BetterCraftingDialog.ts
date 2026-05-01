import Component from "@wayward/game/ui/component/Component";
import Button from "@wayward/game/ui/component/Button";
import { CheckButton } from "@wayward/game/ui/component/CheckButton";
import Text from "@wayward/game/ui/component/Text";
import TranslationImpl from "@wayward/game/language/impl/TranslationImpl";
import { itemDescriptions } from "@wayward/game/game/item/ItemDescriptions";
import { ContainerSort, ItemType, ItemTypeGroup, RecipeLevel } from "@wayward/game/game/item/IItem";
import type { IDismantleDescription, IRecipe, IRecipeComponent } from "@wayward/game/game/item/IItem";
import ItemSort from "@wayward/game/game/item/ItemSort";
import { SkillType } from "@wayward/game/game/entity/skill/ISkills";
import type Item from "@wayward/game/game/item/Item";
import ItemManager from "@wayward/game/game/item/ItemManager";
import { Article } from "@wayward/game/language/ITranslation";
import { Quality } from "@wayward/game/game/IObject";
import { ActionType } from "@wayward/game/game/entity/action/IAction";
import { SortDirection } from "@wayward/game/save/ISaveManager";
import ItemComponent from "@wayward/game/ui/screen/screens/game/component/ItemComponent";
import { ItemComponentHandler } from "@wayward/game/ui/screen/screens/game/component/item/ItemComponentHandler";
import { HighlightType } from "@wayward/game/ui/util/IHighlight";
import type { HighlightSelector, IHighlight } from "@wayward/game/ui/util/IHighlight";
import { Stat } from "@wayward/game/game/entity/IStats";
import Log from "@wayward/utilities/Log";
import { appendInlineStat, createColoredListLine, createHelpBoxRow } from "./BetterCraftingDom";
import type { HelpBoxRowContent } from "./BetterCraftingDom";
import {
    buildCraftExecutionPayload,
    filterSelectableItems,
    getConsumedSelectionCount,
    getUsedSelectionCount,
    isSplitConsumption,
    partitionSelectedItems,
} from "./craftingSelection";
import { getCraftStaminaCost } from "./craftStamina";
import { getItemIdSafe, getItemIds } from "./itemIdentity";
import {
    getCraftDurabilityLoss,
    getDismantleDurabilityLoss,
    getRemainingDurabilityUses,
    isItemProtected,
} from "./itemState";
import type {
    IBulkCraftRequest,
    ICraftSelectionRequest,
    IDismantleRequest,
    ISelectionFailureDetails,
    ISelectionSlotIds,
} from "./multiplayer/BetterCraftingProtocol";

type CraftCallback = (itemType: ItemType, required: Item[] | undefined, consumed: Item[] | undefined, base: Item | undefined) => Promise<void>;
type BulkCraftCallback = (itemType: ItemType, quantity: number, excludedIds: Set<number>) => Promise<void>;
type DismantleCallback = (items: Item[], requiredItem?: Item) => Promise<void>;

export interface IBetterCraftingSettings {
    activationMode: "holdHotkeyToBypass" | "holdHotkeyToAccess";
    activationHotkey: "Shift" | "Control" | "Alt";
    closeHotkey: string;
    safeCrafting: boolean;
    debugLogging: boolean;
}

type SettingsAccessor = () => IBetterCraftingSettings;

interface ICraftExecutionDiagnostics {
    itemType: ItemType;
    requiredIds: number[];
    consumedIds: number[];
    baseId: number | undefined;
    slots: Array<{
        slotIndex: number;
        requiredAmount?: number;
        consumedAmount?: number;
        selectedIds: number[];
        consumedIds: number[];
        requiredIds: number[];
        splitConsumedIds?: number[];
        splitUsedIds?: number[];
    }>;
}

type SectionSemantic = "base" | "consumed" | "used" | "tool";
type SectionView = "normal" | "bulk" | "dismantle";
type SelectionReservationRole = "base" | "consumed" | "used" | "tool" | "required" | "target" | "excluded";

interface IExplicitSelection {
    itemIds: number[];
    sequence: number;
    role: SelectionReservationRole;
}

interface ISectionFilterState {
    filterText: string;
    sort: ContainerSort;
    sortDirection: SortDirection;
    debounceTimer: ReturnType<typeof setTimeout> | null;
}

interface IBulkLimitSnapshot {
    max: number;
    staminaMax: number;
    materialMax: number;
    durabilityMax: number;
}

interface INormalSplitSelection {
    consumed: Item[];
    used: Item[];
}

interface IBulkCraftSelection {
    required: Item[];
    consumed: Item[];
    base: Item | undefined;
    permanentlyConsumedIds: Set<number>;
    slotSelections: Map<number, Item[]>;
}

type BulkCandidateCache = Map<string, Item[]>;

interface IResolvedNormalCraftSelection {
    required: Item[];
    consumed: Item[];
    used: Item[];
    base: Item | undefined;
    slotSelections: Map<number, Item[]>;
}

type PanelMode = "craft" | "dismantle";
type HelpBoxId = "normal" | "bulk" | "dismantle";

// Quality enum value -> CSS color
const QUALITY_COLORS: Record<number, string> = {
    [Quality.None]:          "#e0d0b0",
    [Quality.Random]:        "#e0d0b0",
    [Quality.Superior]:      "#33ff99",
    [Quality.Remarkable]:    "#00b4ff",
    [Quality.Exceptional]:   "#ce5eff",
    [Quality.Mastercrafted]: "#ff8c00",
    [Quality.Relic]:         "#ffd700",
};

const SCREEN_THEME = {
    normal: {
        title: "#d4c89a",
        body: "#9a8860",
        accent: "#c0b080",
        strong: "#d4c89a",
        muted: "#7a6850",
        unsafe: "#c0b080",
    },
    bulk: {
        title: "#a8d0ef",
        body: "#8ab8d8",
        accent: "#c3def3",
        strong: "#c3def3",
        muted: "#78aace",
        unsafe: "#8ab8d8",
    },
    dismantle: {
        title: "#d79b86",
        body: "#e1b4a3",
        accent: "#f0c8bb",
        strong: "#f0c8bb",
        muted: "#c9826a",
        unsafe: "#d79b86",
    },
} as const;

const craftDebugLog = Log.warn("Better Crafting", "CraftDebug");

function getQualityColor(quality?: Quality): string {
    return QUALITY_COLORS[quality ?? Quality.None] ?? QUALITY_COLORS[Quality.None];
}

function getQualityName(quality?: Quality): string {
    if (quality === undefined || quality === Quality.None || quality === Quality.Random) return "";
    return Quality[quality] ?? "";
}

function qualitySortKey(quality?: Quality): number {
    const q = quality ?? Quality.None;
    if (q === Quality.None || q === Quality.Random) return 0;
    return q as number;
}

function getItemId(item: Item | undefined): number | undefined {
    return getItemIdSafe(item);
}

function toRoman(n: number): string {
    if (n <= 0) return String(n);
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
    let result = "";
    for (let i = 0; i < vals.length; i++) {
        while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
    }
    return result;
}

function getSectionCounterKey(slotIndex: number, semantic: SectionSemantic = "base"): string {
    return `${slotIndex}:${semantic}`;
}

const ROW_MIN_HEIGHT = 30;   // px
const ROW_PADDING_V   = 4;    // px top+bottom
const ROW_MARGIN      = 2;    // px top + 2px bottom
const SECTION_SORTS = [
    ContainerSort.Recent,
    ContainerSort.Name,
    ContainerSort.Weight,
    ContainerSort.Group,
    ContainerSort.Durability,
    ContainerSort.Quality,
    ContainerSort.Magical,
    ContainerSort.Decay,
    ContainerSort.Worth,
    ContainerSort.BestForCrafting,
] as const;

export { DEFAULT_CRAFT_STAMINA_COST, STAMINA_COST_PER_LEVEL } from "./craftStamina";

export default class BetterCraftingPanel extends Component {
    public itemType: number = 0;
    private panelMode: PanelMode = "craft";
    private tabBar!: HTMLDivElement;
    private closeBtn!: HTMLButtonElement;
    private craftFrame!: Component;
    private scrollContent: Component;
    private normalScrollInner!: Component;
    private bulkScrollInner!: Component;
    private _sectionResizeObserver?: ResizeObserver;
    private _sectionResizeRafId?: number;
    private recipe?: IRecipe;
    private dismantleDescription?: IDismantleDescription;
    private onCraftCallback: CraftCallback;
    private onBulkCraftCallback: BulkCraftCallback;
    private onDismantleCallback: DismantleCallback;
    private getSettings: SettingsAccessor;
    private craftBtn!: Button;
    private validationMsg?: Text;

    private selectedItems: Map<number, Item[]> = new Map();
    private splitSelectedItems: Map<number, INormalSplitSelection> = new Map();
    private normalRenderReservations: Map<number, SelectionReservationRole> = new Map();
    private explicitSelections: Map<string, IExplicitSelection> = new Map();
    private explicitSelectionSequence = 0;
    private sectionCounters: Map<string, Text> = new Map();
    private sectionFilterStates: Map<string, ISectionFilterState> = new Map();
    private pendingSectionReselectKeys: Set<string> = new Set();
    private pendingSortReselectKeys: Set<string> = new Set();

    /** IDs of items selected before last craft. null = first open. */
    private _pendingSelectionIds: Map<number, number[]> | null = null;
    private _pendingSplitSelectionIds: Map<number, { consumedIds: number[]; usedIds: number[] }> | null = null;

    // ── Tooltip state ─────────────────────────────────────────────────────────
    private bcTooltipEl: HTMLDivElement | null = null;
    private _hoveredItem: Item | null = null;
    private _hoveredDisplayName = "";
    private _hoveredMouseX = 0;
    private _hoveredMouseY = 0;
    private shiftHeld = false;

    // ── Inventory watching ────────────────────────────────────────────────────
    private _inventoryRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private _inventoryRefreshQueued = false;
    private _inventoryWatchHandlers: {
        onAdd: () => void;
        onRemove: () => void;
        onUpdate: () => void;
    } | null = null;

    // ── Tab state ─────────────────────────────────────────────────────────────
    private activeTab: "normal" | "bulk" = "normal";
    private normalTabBtn!: HTMLButtonElement;
    private bulkTabBtn!: HTMLButtonElement;
    private normalBody!: Component;
    private normalStaticContent!: Component;
    private normalFooter!: Component;
    private bulkBody!: Component;
    private bulkStaticContent!: Component;
    private bulkFooter!: Component;
    // ── Bulk crafting state ───────────────────────────────────────────────────
    /** Map<slotIndex, Set<itemId>> — excluded item IDs per ingredient slot. */
    private bulkExcludedIds: Map<number, Set<number>> = new Map();
    private bulkPreserveDurabilityBySlot: Map<number, boolean> = new Map();
    private bulkPinnedToolSelections: Map<number, Item[]> = new Map();
    private bulkPinnedUsedSelections: Map<number, Item[]> = new Map();
    /** Last itemType for which bulkExcludedIds was built — used to detect recipe changes. */
    private _lastBulkItemType: number = 0;
    private bulkQuantity: number = 1;
    private bulkQtyInputEl: HTMLInputElement | null = null;
    private bulkMaxLabel: HTMLSpanElement | null = null;
    private bulkCraftBtnEl: Button | null = null;
    private bulkSafeToggleEl: CheckButton | null = null;
    private bulkSafeToggleWrap: HTMLDivElement | null = null;
    private bulkScrollContent!: Component;
    private _bulkContentDirty = true;
    private bulkStopBtn: Button | null = null;
    private bulkQtyRow: HTMLElement | null = null;
    private bulkProgressEl: HTMLElement | null = null;
    private onBulkAbortCallback: (() => void) | null = null;
    private onPanelHideCallback: (() => void) | null = null;
    private bulkProgressVerb = "Crafting";
    private safeCraftingEnabled = true;
    private lastBulkResolutionMessage?: string;
    private destroyed = false;

    private dismantleExcludedIds = new Set<number>();
    private dismantleRequiredSelection?: Item;
    private dismantleSelectedItemType?: ItemType;
    private preserveDismantleRequiredDurability = true;
    private helpBoxExpanded: Record<HelpBoxId, boolean> = {
        normal: false,
        bulk: false,
        dismantle: false,
    };

    private get activationHotkey(): IBetterCraftingSettings["activationHotkey"] {
        return this.getSettings().activationHotkey;
    }

    private get closeHotkey(): string {
        return this.getSettings().closeHotkey;
    }

    private get debugLoggingEnabled(): boolean {
        return this.getSettings().debugLogging === true;
    }

    private getCurrentStamina(): number {
        return localPlayer ? (localPlayer as any).stat?.get?.(Stat.Stamina)?.value ?? 0 : 0;
    }

    public isSafeCraftingEnabled(): boolean {
        return this.safeCraftingEnabled;
    }

    public shouldPreserveDismantleRequiredDurability(): boolean {
        return this.preserveDismantleRequiredDurability;
    }

    public showMultiplayerMessage(message: string): void {
        this.showValidationError(message);
    }

    private debugLog(message: string, payload?: unknown): void {
        if (!this.debugLoggingEnabled) return;
        if (payload === undefined) {
            craftDebugLog(message);
        } else {
            craftDebugLog(message, payload);
        }
    }

    public consumeLastBulkResolutionMessage(): string | undefined {
        const message = this.lastBulkResolutionMessage;
        this.lastBulkResolutionMessage = undefined;
        return message;
    }

    private setSafeCraftingEnabled(enabled: boolean): void {
        this.safeCraftingEnabled = enabled;
        if (this.bulkSafeToggleEl) {
            this.bulkSafeToggleEl.setChecked(enabled, false);
        }

        const limits = this.computeBulkUiLimits();
        if (this.panelMode === "dismantle") {
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
            return;
        }

        if (this.activeTab === "bulk") {
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
        }
    }

    private resetSafeCraftingEnabled(): void {
        this.setSafeCraftingEnabled(true);
    }

    private getPanelScale(panelRect = this.element.getBoundingClientRect()): number {
        return this.element.offsetWidth > 0
            ? panelRect.width / this.element.offsetWidth
            : 1;
    }

    private anchorPanelToViewport(): { panelRect: DOMRect; scale: number; cssLeft: number; cssTop: number } {
        const panelRect = this.element.getBoundingClientRect();
        const scale = this.getPanelScale(panelRect);
        const cssLeft = panelRect.left / scale;
        const cssTop = panelRect.top / scale;

        this.style.set("transform", "none");
        this.element.style.left = `${cssLeft}px`;
        this.element.style.top = `${cssTop}px`;

        return { panelRect, scale, cssLeft, cssTop };
    }

    private getMinDimensionPx(property: "minWidth" | "minHeight", fallback: number): number {
        const computedValue = window.getComputedStyle(this.element)[property];
        const parsed = Number.parseFloat(computedValue);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private beginResize(direction: "right" | "bottom" | "corner", event: MouseEvent): void {
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();

        const { panelRect, scale } = this.anchorPanelToViewport();
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = panelRect.width / scale;
        const startHeight = panelRect.height / scale;
        const minWidth = this.getMinDimensionPx("minWidth", 280);
        const minHeight = this.getMinDimensionPx("minHeight", 200);

        this.element.style.width = `${startWidth}px`;
        this.element.style.height = `${startHeight}px`;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = (moveEvent.clientX - startX) / scale;
            const deltaY = (moveEvent.clientY - startY) / scale;

            if (direction === "right" || direction === "corner") {
                this.element.style.width = `${Math.max(minWidth, startWidth + deltaX)}px`;
            }

            if (direction === "bottom" || direction === "corner") {
                this.element.style.height = `${Math.max(minHeight, startHeight + deltaY)}px`;
            }
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    private isConfiguredHotkey(key: string): boolean {
        return key === this.activationHotkey;
    }

    private isConfiguredCloseHotkey(key: string): boolean {
        return key.toLowerCase() === this.closeHotkey.toLowerCase();
    }

    private isTypingInEditableControl(target: EventTarget | null): boolean {
        const element = target instanceof HTMLElement ? target : undefined;
        if (!element) return false;
        if (element.closest("input, textarea, select")) return true;

        const editable = element.closest("[contenteditable]");
        return editable instanceof HTMLElement && editable.isContentEditable;
    }

    private updateActivationHotkeyState(event?: KeyboardEvent): void {
        if (!event) {
            this.shiftHeld = false;
            return;
        }

        switch (this.activationHotkey) {
            case "Control":
                this.shiftHeld = event.ctrlKey;
                break;
            case "Alt":
                this.shiftHeld = event.altKey;
                break;
            case "Shift":
            default:
                this.shiftHeld = event.shiftKey;
                break;
        }
    }

    // ── Keyboard / window listeners ───────────────────────────────────────────
    private readonly _onShiftDown = (e: KeyboardEvent) => {
        if (this.isTypingInEditableControl(e.target)) return;

        if (this.panelVisible && this.isConfiguredCloseHotkey(e.key)) {
            this.hidePanel();
            return;
        }

        this.updateActivationHotkeyState(e);
        if (!this.isConfiguredHotkey(e.key) || !this.shiftHeld) return;
        // Show tooltip immediately if mouse is already over a row.
        if (this._hoveredItem) {
            this.bcShowTooltip(this._hoveredItem, this._hoveredDisplayName, this._hoveredMouseX, this._hoveredMouseY);
        }
    };

    private readonly _onShiftUp = (e: KeyboardEvent) => {
        this.updateActivationHotkeyState(e);
        if (this.isConfiguredHotkey(e.key)) {
            this.bcHideTooltip();
            return;
        }

        if (this.shiftHeld) return;
        this.bcHideTooltip();
    };

    private readonly _onBlur = () => {
        this.updateActivationHotkeyState();
        this.bcHideTooltip();
    };

    private bindTooltipRowHandlers(
        row: Button,
        item: Item,
        displayName: string,
        options?: {
            onEnter?: (event: MouseEvent) => void;
            onLeave?: () => void;
        },
    ): void {
        row.addEventListener("mouseenter", (event: MouseEvent) => {
            this._hoveredItem = item;
            this._hoveredDisplayName = displayName;
            this._hoveredMouseX = event.clientX;
            this._hoveredMouseY = event.clientY;
            options?.onEnter?.(event);

            if (this.shiftHeld) {
                this.bcShowTooltip(item, displayName, event.clientX, event.clientY);
            }
        });

        row.addEventListener("mousemove", (event: MouseEvent) => {
            this._hoveredMouseX = event.clientX;
            this._hoveredMouseY = event.clientY;
            if (this.shiftHeld && this.bcTooltipEl && this.bcTooltipEl.style.display !== "none") {
                this.bcPositionTooltip(event.clientX, event.clientY);
            }
        });

        row.addEventListener("mouseleave", () => {
            this._hoveredItem = null;
            this.bcHideTooltip();
            options?.onLeave?.();
        });
    }

    public constructor(
        onCraft: CraftCallback,
        onBulkCraft: BulkCraftCallback,
        onDismantle: DismantleCallback,
        getSettings: SettingsAccessor,
        initialSafeCrafting = true,
    ) {
        super();
        this.onCraftCallback = onCraft;
        this.onBulkCraftCallback = onBulkCraft;
        this.onDismantleCallback = onDismantle;
        this.getSettings = getSettings;
        this.safeCraftingEnabled = initialSafeCrafting;
        const buttonTheme = {
            craftFill: "#553c02",
            craftBorder: "#553c02",
            craftHover: "#765404",
            bulkFill: "#135695",
            bulkBorder: "#135695",
            bulkHover: "#055daa",
            dismantleFill: "#742504",
            dismantleBorder: "#742504",
            dismantleHover: "#9c3205",
            text: "#b4b4b4",
        } as const;

        // ── Global styles (injected once) ────────────────────────────────────
        const STYLE_ID = "better-crafting-styles";
        if (!document.getElementById(STYLE_ID)) {
            const styleEl = document.createElement("style");
            styleEl.id = STYLE_ID;
            styleEl.textContent = `
                /* ── Panel: never fade regardless of Wayward focus state ────── */
                .better-crafting-panel {
                    --bc-panel-accent: #8c7b44;
                    --bc-panel-accent-soft: rgba(140, 123, 68, 0.45);
                    opacity: 1 !important;
                    position: relative;
                    box-sizing: border-box;
                    border-style: solid !important;
                    border-width: 1px !important;
                    border-color: var(--bc-panel-accent) !important;
                }

                /* ── Title / headings: hardcoded warm-cream, won't dim ───────── */
                .better-crafting-title {
                    color: #d4c89a !important;
                }
                .better-crafting-heading {
                    color: #c8bc8a !important;
                }

                /* ── Craft button: gold theme ─────────────────────────────── */
                .better-crafting-craft-btn {
                    background: ${buttonTheme.craftFill} !important;
                    color: ${buttonTheme.text} !important;
                    font-weight: bold !important;
                    border: 1px solid ${buttonTheme.craftBorder} !important;
                    transition: background 0.2s;
                    opacity: 1 !important;
                }
                .better-crafting-craft-btn,
                .better-crafting-craft-btn * {
                    color: ${buttonTheme.text} !important;
                    -webkit-text-fill-color: ${buttonTheme.text} !important;
                }
                .better-crafting-craft-btn:hover {
                    background: ${buttonTheme.craftHover} !important;
                    border: 1px solid ${buttonTheme.craftHover} !important;
                }
                .better-crafting-craft-btn.bc-craft-disabled {
                    opacity: 0.35 !important;
                    pointer-events: none !important;
                }

                /* ── Item icon: hide decorative overlays and stat bars ───────── */
                .better-crafting-panel .item-component {
                    flex-shrink: 0 !important;
                    margin: 0 !important;
                }
                .better-crafting-panel .item-component-stat-bars-wrapper {
                    display: none !important;
                }
                .better-crafting-panel .item-component-icon-action,
                .better-crafting-panel .item-component-icon-equip,
                .better-crafting-panel .item-component-icon-magical,
                .better-crafting-panel .item-component-icon-protected,
                .better-crafting-panel .item-component-icon-target,
                .better-crafting-panel .item-component-icon-slotted {
                    display: none !important;
                }

                /* ── Item list scrollbar ─────────────────────────────────────── */
                .better-crafting-item-list {
                    scrollbar-width: thin;
                    scrollbar-color: #888888 rgba(0,0,0,0.3);
                }
                .bc-section-controls {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-wrap: wrap;
                    flex-shrink: 0;
                    padding: 0 4px 5px 8px;
                }
                .bc-section-filter,
                .bc-section-sort {
                    min-width: 0;
                    height: 22px;
                    box-sizing: border-box;
                    border: 1px solid #554433;
                    border-radius: 2px;
                    background: rgba(20,15,8,0.8);
                    color: #d4c89a;
                    font: inherit;
                    font-size: 0.82em;
                }
                .bc-section-filter {
                    flex: 1 1 96px;
                    padding: 1px 5px;
                }
                .bc-section-sort {
                    flex: 0 1 112px;
                    padding: 1px 3px;
                }
                .bc-section-direction {
                    width: 24px;
                    height: 22px;
                    padding: 0;
                    border: 1px solid #554433;
                    border-radius: 2px;
                    background: rgba(60,48,28,0.8);
                    color: #c8bc8a;
                    font: inherit;
                    line-height: 1;
                    cursor: pointer;
                }
                .bc-section-direction:hover {
                    background: rgba(80,64,36,0.9);
                    color: #d4c89a;
                }

                /* ── Section height cap (updated by ResizeObserver) ──────────── */
                .better-crafting-section {
                    max-height: var(--bc-section-height, 300px);
                }

                /* ── Tab bar ─────────────────────────────────────────────────── */
                .bc-tab-bar {
                    display: flex;
                    flex-shrink: 0;
                    width: 100%;
                    border-bottom: 1px solid var(--color-border, #554433);
                }
                .bc-header-bar {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    flex-shrink: 0;
                    padding: 8px 14px 0;
                }
                .bc-tab-btn {
                    flex: 1;
                    padding: 7px 12px;
                    border: none;
                    cursor: pointer;
                    font-size: 0.92em;
                    font-family: inherit;
                    transition: color 0.15s, border-color 0.15s, background 0.15s;
                }
                .bc-tab-normal {
                    background: rgba(40, 30, 16, 0.45);
                    color: #aa9766;
                    border-bottom: 2px solid rgba(176, 156, 90, 0.35);
                }
                .bc-tab-normal:hover {
                    color: #d4c89a;
                    background: rgba(52, 39, 22, 0.58);
                    border-bottom-color: rgba(196, 174, 106, 0.55);
                }
                .bc-tab-normal.bc-tab-active {
                    color: #e4d8a9;
                    border-bottom: 2px solid #c4ae6a;
                    background: rgba(64, 48, 26, 0.82);
                }
                .bc-tab-bulk {
                    background: rgba(16, 32, 48, 0.45);
                    color: #6f9fbe;
                    border: none;
                    border-bottom: 2px solid rgba(58, 130, 184, 0.35);
                }
                .bc-tab-bulk:hover {
                    color: #a8d0ef;
                    background: rgba(22, 43, 67, 0.58);
                    border-bottom-color: rgba(90, 158, 210, 0.55);
                }
                .bc-tab-bulk.bc-tab-active {
                    color: #c3def3;
                    border-bottom: 2px solid #5a9ed2;
                    background: rgba(24, 54, 90, 0.82);
                }
                .bc-panel-close {
                    position: absolute;
                    top: 0;
                    right: 5px;
                    z-index: 4;
                    width: 26px;
                    height: 26px;
                    padding: 0 2px;
                    border: 0;
                    background: transparent;
                    color: #ffffff;
                    font: inherit;
                    font-size: 1.7em;
                    font-weight: 400;
                    line-height: 1;
                    cursor: pointer;
                    transition: color 0.12s ease, opacity 0.12s ease;
                }
                .bc-panel-close:hover {
                    color: #ffffff;
                    opacity: 0.8;
                }
                .bc-craft-frame {
                    display: flex;
                    flex: 1 1 0;
                    flex-direction: column;
                    min-height: 0;
                    margin: 0 14px;
                    border: 1px solid var(--bc-panel-accent);
                    border-radius: 3px;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                .bc-panel-bulk .bc-craft-frame {
                    border-color: var(--bc-panel-accent) !important;
                }
                .bc-resize-handle {
                    position: absolute;
                    z-index: 2;
                    background: transparent;
                }
                .bc-resize-handle-right {
                    top: 0;
                    right: 0;
                    width: 10px;
                    height: calc(100% - 12px);
                    cursor: ew-resize;
                }
                .bc-resize-handle-bottom {
                    left: 0;
                    right: 12px;
                    bottom: 0;
                    height: 10px;
                    cursor: ns-resize;
                }
                .bc-resize-handle-corner {
                    right: 0;
                    bottom: 0;
                    width: 14px;
                    height: 14px;
                    cursor: nwse-resize;
                    background-image:
                        linear-gradient(135deg, transparent 0 50%, var(--bc-panel-accent-soft) 50% 56%, transparent 56% 100%),
                        linear-gradient(135deg, transparent 0 68%, var(--bc-panel-accent-soft) 68% 74%, transparent 74% 100%),
                        linear-gradient(135deg, transparent 0 86%, var(--bc-panel-accent) 86% 92%, transparent 92% 100%);
                    background-repeat: no-repeat;
                }

                /* ── Bulk item row: excluded state ────────────────────────────── */
                .bc-bulk-row-excluded {
                    opacity: 0.38 !important;
                    text-decoration: line-through !important;
                }

                /* ── Quantity controls ───────────────────────────────────────── */
                .bc-qty-input {
                    width: 48px;
                    text-align: center;
                    background: rgba(20,15,8,0.8);
                    color: #d4c89a;
                    border: 1px solid #554433;
                    border-radius: 2px;
                    padding: 2px 4px;
                    font-family: inherit;
                    font-size: 0.92em;
                    appearance: textfield;
                    -moz-appearance: textfield;
                }
                .bc-qty-input::-webkit-outer-spin-button,
                .bc-qty-input::-webkit-inner-spin-button {
                    appearance: none;
                    -webkit-appearance: none;
                    margin: 0;
                }
                .bc-qty-btn {
                    padding: 2px 8px;
                    background: rgba(60,48,28,0.8);
                    color: #c8bc8a;
                    border: 1px solid #554433;
                    border-radius: 2px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 1em;
                    line-height: 1;
                    user-select: none;
                }
                .bc-qty-btn:hover {
                    background: rgba(80,64,36,0.9);
                    color: #d4c89a;
                }

                /* ── Quantity modifier hint ──────────────────────────────────── */
                .bc-qty-hint {
                    font-size: 0.78em;
                    color: #6a7a8a;
                    white-space: nowrap;
                    user-select: none;
                    margin-left: 2px;
                }

                /* ── Bulk help / info box ────────────────────────────────────── */
                .bc-bulk-help-box {
                    flex: 1 1 100%;
                    width: 100%;
                    box-sizing: border-box;
                    padding: 8px 10px;
                    border-left: 3px solid #4a8fcc;
                    border-radius: 0 3px 3px 0;
                    background: rgba(16, 36, 58, 0.45);
                    font-size: 0.85em;
                    color: #8ab8d8;
                    line-height: 1.5;
                }
                .bc-bulk-help-box strong {
                    color: #a8d0ef;
                }
                .bc-bulk-help-title {
                    font-weight: bold;
                    color: #a8d0ef;
                    margin-bottom: 4px;
                }
                .bc-bulk-help-row {
                    margin: 2px 0;
                    padding-left: 10px;
                }
                .bc-help-box {
                    flex: 1 1 100%;
                    width: 100%;
                    box-sizing: border-box;
                    border: 1px solid var(--color-border, #554433);
                    border-radius: 3px;
                    background: rgba(30, 22, 12, 0.45);
                    overflow: hidden;
                }
                .bc-help-box-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    padding: 7px 10px;
                    border: 0;
                    background: transparent;
                    color: inherit;
                    font: inherit;
                    cursor: pointer;
                    text-align: left;
                }
                .bc-help-box-toggle:hover {
                    background: rgba(255, 255, 255, 0.04);
                }
                .bc-help-box-caret {
                    flex: 0 0 auto;
                    width: 1em;
                    color: #c8bc8a;
                    transition: transform 0.15s ease;
                }
                .bc-help-box.bc-help-box-expanded .bc-help-box-caret {
                    transform: rotate(90deg);
                }
                .bc-help-box-title {
                    flex: 1 1 auto;
                    font-weight: bold;
                    color: #d4c89a;
                    letter-spacing: 0.02em;
                }
                .bc-help-box-content {
                    padding: 0 10px 8px;
                    color: #c8bc8a;
                    line-height: 1.5;
                }
                .bc-help-box-content strong {
                    color: #d4c89a;
                }
                /* Materials section header */
                .bc-bulk-materials-header {
                    flex: 1 1 100%;
                    width: 100%;
                    box-sizing: border-box;
                    padding: 4px 2px 2px;
                    font-size: 0.88em;
                    font-weight: bold;
                    color: #78aace;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    border-bottom: 1px solid rgba(58, 130, 184, 0.3);
                    margin-bottom: 2px;
                }

                /* ── Blue theme: applied to panel root when bulk tab is active ── */
                /* Tab active indicator */
                /* Section borders */
                .bc-panel-bulk .bc-bulk-section {
                    border: 1px solid #1e3a58 !important;
                }
                /* Output card border */
                .bc-panel-bulk .bc-bulk-output-card {
                    border: 1px solid #1e3a58 !important;
                }
                .bc-panel-bulk .bc-bulk-output-card,
                .bc-panel-bulk .bc-bulk-output-card *,
                .bc-panel-bulk .bc-safe-toggle-wrap,
                .bc-panel-bulk .bc-safe-toggle-label,
                .bc-panel-bulk .bc-safe-toggle-info,
                .bc-panel-bulk .bc-safe-toggle-checkbox {
                    color: #8ab8d8 !important;
                }
                .bc-panel-bulk {
                    --bc-panel-accent: #3a82b8;
                    --bc-panel-accent-soft: rgba(58, 130, 184, 0.45);
                    border-color: var(--bc-panel-accent) !important;
                }
                /* Footer border */
                .bc-panel-bulk .dialog-footer {
                    border-top-color: #1e3a58 !important;
                }
                /* Headings */
                .bc-panel-bulk .better-crafting-heading {
                    color: #78aace !important;
                }
                /* Craft button blue tint */
                .bc-panel-bulk .better-crafting-craft-btn {
                    background: #1e5c8a !important;
                    border: 1px solid #164e78 !important;
                }
                .bc-panel-bulk .better-crafting-craft-btn:hover {
                    background: #2872a8 !important;
                    border: 1px solid #2872a8 !important;
                }
                /* Qty controls blue tint */
                .bc-panel-bulk .bc-qty-input {
                    background: rgba(10,22,38,0.85) !important;
                    color: #8ab8d8 !important;
                    border-color: #1e3a58 !important;
                    appearance: textfield !important;
                    -moz-appearance: textfield !important;
                    -webkit-appearance: none !important;
                }
                .bc-panel-bulk .bc-qty-input::-webkit-outer-spin-button,
                .bc-panel-bulk .bc-qty-input::-webkit-inner-spin-button {
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    margin: 0 !important;
                }
                .bc-panel-bulk .bc-qty-btn {
                    background: rgba(16,36,60,0.85) !important;
                    color: #78aace !important;
                    border-color: #1e3a58 !important;
                }
                .bc-panel-bulk .bc-qty-btn:hover {
                    background: rgba(24,54,90,0.9) !important;
                    color: #8ab8d8 !important;
                }
                /* Scrollbar blue tint */
                .bc-panel-bulk .better-crafting-item-list {
                    scrollbar-color: #3a6a9a rgba(0,0,0,0.3) !important;
                }
                .bc-panel-bulk .bc-section-filter,
                .bc-panel-bulk .bc-section-sort {
                    background: rgba(10,22,38,0.85) !important;
                    color: #8ab8d8 !important;
                    border-color: #1e3a58 !important;
                }
                .bc-panel-bulk .bc-section-direction {
                    background: rgba(16,36,60,0.85) !important;
                    color: #78aace !important;
                    border-color: #1e3a58 !important;
                }
                .bc-panel-bulk .bc-section-direction:hover {
                    background: rgba(24,54,90,0.9) !important;
                    color: #8ab8d8 !important;
                }
                .bc-panel-bulk .bc-help-box {
                    border-color: #1e3a58 !important;
                    background: linear-gradient(180deg, rgba(20, 43, 68, 0.58), rgba(12, 25, 39, 0.50)) !important;
                }
                .bc-panel-bulk .bc-help-box-title,
                .bc-panel-bulk .bc-help-box-caret {
                    color: #a8d0ef !important;
                }
                .bc-panel-bulk .bc-help-box-content {
                    color: #8ab8d8 !important;
                }
                .bc-panel-bulk .bc-help-box-toggle:hover {
                    background: rgba(106, 163, 212, 0.10) !important;
                }
                .bc-panel-bulk .bc-help-box-content strong {
                    color: #c3def3 !important;
                }
                .bc-panel-bulk .better-crafting-craft-btn {
                    background: ${buttonTheme.bulkFill} !important;
                    border: 1px solid ${buttonTheme.bulkBorder} !important;
                    color: ${buttonTheme.text} !important;
                }
                .bc-panel-bulk .better-crafting-craft-btn,
                .bc-panel-bulk .better-crafting-craft-btn * {
                    color: ${buttonTheme.text} !important;
                    -webkit-text-fill-color: ${buttonTheme.text} !important;
                }
                .bc-panel-bulk .better-crafting-craft-btn:hover {
                    background: ${buttonTheme.bulkHover} !important;
                    border: 1px solid ${buttonTheme.bulkHover} !important;
                    color: ${buttonTheme.text} !important;
                }

                .bc-panel-dismantle {
                    --bc-panel-accent: #6a3428;
                    --bc-panel-accent-soft: rgba(106, 52, 40, 0.45);
                    border-color: var(--bc-panel-accent) !important;
                }
                .bc-panel-dismantle .bc-header-bar {
                    min-height: 22px;
                    padding: 0 !important;
                }
                .bc-panel-dismantle .bc-craft-frame {
                    margin: 0 !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                }
                .bc-panel-dismantle .dialog-footer {
                    border-top-color: #5c2f24 !important;
                }
                .bc-panel-dismantle .better-crafting-body {
                    padding-top: 0 !important;
                }
                .bc-panel-dismantle .bc-panel-close {
                    top: 5px;
                    right: 6px;
                }
                .bc-panel-dismantle .better-crafting-heading,
                .bc-panel-dismantle .better-crafting-title,
                .bc-panel-dismantle .bc-dismantle-header-title {
                    color: #d79b86 !important;
                }
                .bc-panel-dismantle .bc-dismantle-output-title,
                .bc-panel-dismantle .bc-dismantle-section-title {
                    color: #c9826a !important;
                }
                .bc-panel-dismantle .better-crafting-section,
                .bc-panel-dismantle .bc-dismantle-header-card,
                .bc-panel-dismantle .bc-bulk-help-box,
                .bc-panel-dismantle .bc-bulk-materials-header {
                    border-color: #6a3428 !important;
                    background: linear-gradient(180deg, rgba(64, 24, 16, 0.60), rgba(36, 13, 9, 0.50)) !important;
                }
                .bc-panel-dismantle .bc-dismantle-header-card,
                .bc-panel-dismantle .bc-dismantle-header-card *,
                .bc-panel-dismantle .bc-safe-toggle-wrap,
                .bc-panel-dismantle .bc-safe-toggle-label,
                .bc-panel-dismantle .bc-safe-toggle-info,
                .bc-panel-dismantle .bc-safe-toggle-checkbox {
                    color: #d79b86 !important;
                }
                .bc-panel-dismantle .bc-help-box {
                    border-color: #6a3428 !important;
                    background: linear-gradient(180deg, rgba(64, 24, 16, 0.60), rgba(36, 13, 9, 0.50)) !important;
                }
                .bc-panel-dismantle .bc-help-box-title,
                .bc-panel-dismantle .bc-help-box-caret {
                    color: #d79b86 !important;
                }
                .bc-panel-dismantle .bc-help-box-content {
                    color: #e1b4a3 !important;
                }
                .bc-panel-dismantle .bc-help-box-toggle:hover {
                    background: rgba(215, 155, 134, 0.08) !important;
                }
                .bc-panel-dismantle .bc-help-box-content strong {
                    color: #f0c8bb !important;
                }
                .bc-panel-dismantle .better-crafting-craft-btn {
                    background: ${buttonTheme.dismantleFill} !important;
                    border: 1px solid ${buttonTheme.dismantleBorder} !important;
                    color: ${buttonTheme.text} !important;
                }
                .bc-panel-dismantle .better-crafting-craft-btn,
                .bc-panel-dismantle .better-crafting-craft-btn * {
                    color: ${buttonTheme.text} !important;
                    -webkit-text-fill-color: ${buttonTheme.text} !important;
                }
                .bc-panel-dismantle .better-crafting-craft-btn:hover {
                    background: ${buttonTheme.dismantleHover} !important;
                    border: 1px solid ${buttonTheme.dismantleHover} !important;
                    color: ${buttonTheme.text} !important;
                }
                .bc-panel-dismantle .bc-qty-input {
                    background: rgba(42,18,12,0.88) !important;
                    color: #e1b4a3 !important;
                    border-color: #6a3428 !important;
                }
                .bc-panel-dismantle .bc-qty-btn {
                    background: rgba(88,36,24,0.85) !important;
                    color: #e1b4a3 !important;
                    border-color: #6a3428 !important;
                }
                .bc-panel-dismantle .bc-qty-btn:hover {
                    background: rgba(112,48,32,0.9) !important;
                    color: #f0c2b0 !important;
                }
                .bc-panel-dismantle .better-crafting-item-list {
                    scrollbar-color: #8a4c3d rgba(0,0,0,0.3) !important;
                }
                .bc-dismantle-output-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px 8px;
                    align-items: flex-start;
                }
                .bc-dismantle-output-entry {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 0;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    color: #cbb5aa;
                    flex: 0 1 auto;
                    min-width: 0;
                }
                .bc-dismantle-output-entry .item-component {
                    transform: scale(0.82);
                    transform-origin: left center;
                }

            `;
            document.head.appendChild(styleEl);
        }

        // ── Panel shell ──────────────────────────────────────────────────────
        this.classes.add("dialog", "game-dialog-panel", "better-crafting-panel");
        this.style.set("position", "fixed");
        this.style.set("top", "12%");
        this.style.set("left", "50%");
        this.style.set("transform", "translateX(-50%)");

        this.style.set("width", "40vw");
        this.style.set("min-width", "280px");
        this.style.set("height", "60vh");
        this.style.set("min-height", "200px");

        this.style.set("overflow", "hidden");
        this.style.set("z-index", "1000");
        this.style.set("display", "none");
        this.style.set("flex-direction", "column");

        // ── Keyboard listeners ────────────────────────────────────────────────
        document.addEventListener("keydown", this._onShiftDown);
        document.addEventListener("keyup", this._onShiftUp);
        window.addEventListener("blur", this._onBlur);

        // ── Drag on entire panel background ──────────────────────────────────
        this.element.addEventListener("mousedown", (e: MouseEvent) => {
            if (e.button !== 0) return;
            const t = e.target as HTMLElement;
            if (t.closest("button, .better-crafting-item-list, input, select, .bc-resize-handle")) return;

            const { scale, cssLeft, cssTop } = this.anchorPanelToViewport();
            const startX   = e.clientX;
            const startY   = e.clientY;

            const onMouseMove = (ev: MouseEvent) => {
                this.element.style.left = `${cssLeft + (ev.clientX - startX) / scale}px`;
                this.element.style.top  = `${cssTop  + (ev.clientY - startY) / scale}px`;
            };
            const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup",  onMouseUp);
            };
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup",   onMouseUp);
        });

        // ── Tab bar ───────────────────────────────────────────────────────────
        const headerBar = document.createElement("div");
        headerBar.className = "bc-header-bar";

        const tabBar = document.createElement("div");
        tabBar.className = "bc-tab-bar";
        this.tabBar = tabBar;
        tabBar.style.flex = "1 1 auto";

        this.normalTabBtn = document.createElement("button");
        this.normalTabBtn.className = "bc-tab-btn bc-tab-normal bc-tab-active";
        this.normalTabBtn.textContent = "Normal Crafting";
        this.normalTabBtn.addEventListener("click", () => this.switchTab("normal"));

        this.bulkTabBtn = document.createElement("button");
        this.bulkTabBtn.className = "bc-tab-btn bc-tab-bulk";
        this.bulkTabBtn.textContent = "Bulk Crafting";
        this.bulkTabBtn.addEventListener("click", () => this.switchTab("bulk"));

        tabBar.appendChild(this.normalTabBtn);
        tabBar.appendChild(this.bulkTabBtn);
        headerBar.appendChild(tabBar);
        const closeBtn = document.createElement("button");
        closeBtn.className = "bc-panel-close";
        closeBtn.type = "button";
        closeBtn.innerHTML = "&times;";
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.title = "Close";
        closeBtn.addEventListener("click", () => this.hidePanel());
        this.closeBtn = closeBtn;
        headerBar.appendChild(closeBtn);
        this.element.appendChild(headerBar);

        this.craftFrame = new Component();
        this.craftFrame.classes.add("bc-craft-frame");
        this.append(this.craftFrame);

        const rightResizeHandle = document.createElement("div");
        rightResizeHandle.className = "bc-resize-handle bc-resize-handle-right";
        rightResizeHandle.addEventListener("mousedown", (e: MouseEvent) => this.beginResize("right", e));
        this.element.appendChild(rightResizeHandle);

        const bottomResizeHandle = document.createElement("div");
        bottomResizeHandle.className = "bc-resize-handle bc-resize-handle-bottom";
        bottomResizeHandle.addEventListener("mousedown", (e: MouseEvent) => this.beginResize("bottom", e));
        this.element.appendChild(bottomResizeHandle);

        const cornerResizeHandle = document.createElement("div");
        cornerResizeHandle.className = "bc-resize-handle bc-resize-handle-corner";
        cornerResizeHandle.addEventListener("mousedown", (e: MouseEvent) => this.beginResize("corner", e));
        this.element.appendChild(cornerResizeHandle);

        // ── Normal: Scrollable body ───────────────────────────────────────────
        this.normalBody = new Component();
        this.normalBody.classes.add("better-crafting-body");
        this.normalBody.style.set("display", "flex");
        this.normalBody.style.set("flex", "1 1 0");
        this.normalBody.style.set("flex-direction", "column");
        this.normalBody.style.set("min-height", "0");
        this.normalBody.style.set("overflow", "hidden");
        this.normalBody.style.set("padding", "8px 10px");
        this.normalBody.style.set("gap", "8px");
        this.craftFrame.append(this.normalBody);

        this.normalStaticContent = this.createStaticContentContainer();
        this.normalBody.append(this.normalStaticContent);

        [this.scrollContent, this.normalScrollInner] = this.createScrollPort();
        this.normalBody.append(this.scrollContent);

        // ── Normal: Footer ────────────────────────────────────────────────────
        this.normalFooter = new Component();
        this.normalFooter.classes.add("dialog-footer");
        this.normalFooter.style.set("padding", "8px 10px");
        this.normalFooter.style.set("display", "flex");
        this.normalFooter.style.set("gap", "6px");
        this.normalFooter.style.set("flex-shrink", "0");
        this.normalFooter.style.set("justify-content", "flex-end");
        this.normalFooter.style.set("align-items", "center");
        this.append(this.normalFooter);

        this.craftBtn = new Button();
        this.craftBtn.classes.add("button-block", "better-crafting-craft-btn", "bc-craft-disabled");
        this.craftBtn.setText(TranslationImpl.generator("Craft with Selected"));
        this.craftBtn.style.set("padding", "6px 14px");
        this.craftBtn.event.subscribe("activate", () => this.onCraft());
        this.normalFooter.append(this.craftBtn);

        // ── Bulk: Scrollable body ─────────────────────────────────────────────
        this.bulkBody = new Component();
        this.bulkBody.classes.add("better-crafting-body");
        this.bulkBody.style.set("flex", "1 1 0");
        this.bulkBody.style.set("flex-direction", "column");
        this.bulkBody.style.set("min-height", "0");
        this.bulkBody.style.set("overflow", "hidden");
        this.bulkBody.style.set("padding", "8px 10px");
        this.bulkBody.style.set("gap", "8px");
        this.bulkBody.style.set("display", "none");
        this.craftFrame.append(this.bulkBody);

        this.bulkStaticContent = this.createStaticContentContainer();
        this.bulkBody.append(this.bulkStaticContent);

        [this.bulkScrollContent, this.bulkScrollInner] = this.createScrollPort();
        this.bulkBody.append(this.bulkScrollContent);

        // ── Bulk: Footer ──────────────────────────────────────────────────────
        this.bulkFooter = new Component();
        this.bulkFooter.classes.add("dialog-footer");
        this.bulkFooter.style.set("padding", "8px 10px");
        this.bulkFooter.style.set("display", "none"); // hidden until tab switch
        this.bulkFooter.style.set("gap", "8px");
        this.bulkFooter.style.set("flex-shrink", "0");
        this.bulkFooter.style.set("justify-content", "flex-end");
        this.bulkFooter.style.set("align-items", "center");
        this.append(this.bulkFooter);

        // Quantity controls row inside bulk footer
        const qtyRow = document.createElement("div");
        qtyRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-right:auto;";

        const minusBtn = document.createElement("button");
        minusBtn.type = "button";
        minusBtn.className = "bc-qty-btn";
        minusBtn.textContent = "−";
        minusBtn.setAttribute("aria-label", "Decrease bulk quantity");
        minusBtn.addEventListener("mousedown", (e: MouseEvent) => {
            e.preventDefault();
            const delta = e.ctrlKey ? 100 : e.shiftKey ? 10 : 1;
            this.adjustBulkQty(-delta);
        });
        qtyRow.appendChild(minusBtn);

        this.bulkQtyInputEl = document.createElement("input");
        this.bulkQtyInputEl.type = "number";
        this.bulkQtyInputEl.className = "bc-qty-input";
        this.bulkQtyInputEl.setAttribute("aria-label", "Bulk quantity");
        this.bulkQtyInputEl.min = "1";
        this.bulkQtyInputEl.value = String(this.bulkQuantity);
        this.bulkQtyInputEl.addEventListener("change", () => {
            const v = parseInt(this.bulkQtyInputEl!.value, 10);
            if (!isNaN(v) && v >= 1) {
                const limits = this.computeBulkUiLimits();
                const max = limits.max;
                // Clamp to max regardless of whether max is 0; floor to 1 for display
                // (craft button is disabled when max === 0 via updateBulkCraftBtnState).
                this.bulkQuantity = max > 0 ? Math.min(v, max) : 1;
                if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
                this.updateBulkMaxDisplay(limits);
                this.updateBulkCraftBtnState(limits);
            } else {
                this.bulkQtyInputEl!.value = String(this.bulkQuantity);
            }
        });
        qtyRow.appendChild(this.bulkQtyInputEl);

        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "bc-qty-btn";
        plusBtn.textContent = "+";
        plusBtn.setAttribute("aria-label", "Increase bulk quantity");
        plusBtn.addEventListener("mousedown", (e: MouseEvent) => {
            e.preventDefault();
            const delta = e.ctrlKey ? 100 : e.shiftKey ? 10 : 1;
            this.adjustBulkQty(delta);
        });
        qtyRow.appendChild(plusBtn);

        this.bulkMaxLabel = document.createElement("span");
        this.bulkMaxLabel.style.cssText = "color:#7a6850;font-size:0.85em;margin-left:4px;";
        this.bulkMaxLabel.textContent = "";
        qtyRow.appendChild(this.bulkMaxLabel);

        // Modifier key hint so players know about Shift/Ctrl click on ± buttons.
        const qtyHint = document.createElement("span");
        qtyHint.className = "bc-qty-hint";
        qtyHint.textContent = "Shift ×10 | Ctrl ×100";
        qtyRow.appendChild(qtyHint);

        this.bulkQtyRow = qtyRow;
        this.bulkFooter.element.appendChild(qtyRow);

        // Progress label shown during active bulk craft, hidden otherwise.
        this.bulkProgressEl = document.createElement("span");
        this.bulkProgressEl.style.cssText = "color:#9a8860;font-size:0.92em;margin-right:auto;display:none;";
        this.bulkFooter.element.appendChild(this.bulkProgressEl);

        this.bulkSafeToggleWrap = this.createSafeToggle(toggle => {
            this.bulkSafeToggleEl = toggle;
        });
        this.bulkFooter.append(this.bulkSafeToggleWrap);

        this.bulkCraftBtnEl = new Button();
        this.bulkCraftBtnEl.classes.add("button-block", "better-crafting-craft-btn", "bc-craft-disabled");
        this.bulkCraftBtnEl.setText(TranslationImpl.generator("Bulk Craft"));
        this.bulkCraftBtnEl.style.set("padding", "6px 14px");
        this.bulkCraftBtnEl.event.subscribe("activate", () => this.onBulkCraft());
        this.bulkFooter.append(this.bulkCraftBtnEl);

        // Stop Crafting button — shown during active bulk craft, hidden by default.
        this.bulkStopBtn = new Button();
        this.bulkStopBtn.classes.add("button-block", "bc-stop-btn");
        this.bulkStopBtn.setText(TranslationImpl.generator("Stop Crafting"));
        this.bulkStopBtn.style.set("padding", "6px 14px");
        this.bulkStopBtn.style.set("background", "#993333");
        this.bulkStopBtn.style.set("color", "#fff");
        this.bulkStopBtn.style.set("display", "none");
        this.bulkStopBtn.event.subscribe("activate", () => this.onBulkAbortCallback?.());
        this.bulkFooter.append(this.bulkStopBtn);

        // ── Section height ResizeObserver ─────────────────────────────────────
        // Keeps --bc-section-height in sync with the visible scroll area so each
        // section box never overflows its fair share of the available height.
        // The rAF defer breaks the ResizeObserver loop: updating a CSS variable
        // that changes section max-height can cause scrollContent to resize again
        // in the same layout cycle, which the browser flags as a loop error.
        // Deferring to the next frame lets the current layout settle first.
        if (typeof ResizeObserver !== 'undefined') {
            this._sectionResizeObserver = new ResizeObserver(() => {
                if (this._sectionResizeRafId !== undefined) cancelAnimationFrame(this._sectionResizeRafId);
                this._sectionResizeRafId = requestAnimationFrame(() => {
                    this._sectionResizeRafId = undefined;
                    const h = this.activeTab === "normal"
                           ? this.scrollContent.element.clientHeight
                           : this.bulkScrollContent.element.clientHeight;
                    if (h > 0) {
                        this.element.style.setProperty('--bc-section-height', `${h}px`);
                    }
                });
            });
            this._sectionResizeObserver.observe(this.scrollContent.element);
            this._sectionResizeObserver.observe(this.bulkScrollContent.element);
        }
    }

    /** Call when the mod unloads to clean up listeners and observers. */
    public destroyListeners(): void {
        this.destroyed = true;
        document.removeEventListener("keydown", this._onShiftDown);
        document.removeEventListener("keyup", this._onShiftUp);
        window.removeEventListener("blur", this._onBlur);
        this._unsubscribeInventoryWatch();
        if (this._inventoryRefreshTimer !== null) {
            clearTimeout(this._inventoryRefreshTimer);
            this._inventoryRefreshTimer = null;
        }
        for (const state of this.sectionFilterStates.values()) {
            if (state.debounceTimer !== null) {
                clearTimeout(state.debounceTimer);
                state.debounceTimer = null;
            }
        }
        this._inventoryRefreshQueued = false;
        this.bcTooltipEl?.remove();
        this.bcTooltipEl = null;
        if (this._sectionResizeRafId !== undefined) {
            cancelAnimationFrame(this._sectionResizeRafId);
            this._sectionResizeRafId = undefined;
        }
        this._sectionResizeObserver?.disconnect();
        this._sectionResizeObserver = undefined;
    }

    private clearSectionFilterStates(): void {
        for (const state of this.sectionFilterStates.values()) {
            if (state.debounceTimer !== null) {
                clearTimeout(state.debounceTimer);
                state.debounceTimer = null;
            }
        }
        this.sectionFilterStates.clear();
    }

    private resetWindowSessionState(): void {
        this.selectedItems.clear();
        this.splitSelectedItems.clear();
        this._pendingSelectionIds = null;
        this._pendingSplitSelectionIds = null;
        this.explicitSelections.clear();
        this.normalRenderReservations.clear();
        this.sectionCounters.clear();
        this.pendingSectionReselectKeys.clear();
        this.pendingSortReselectKeys.clear();
        this.clearSectionFilterStates();

        this.bulkExcludedIds.clear();
        this.bulkPreserveDurabilityBySlot.clear();
        this.bulkPinnedToolSelections.clear();
        this.bulkPinnedUsedSelections.clear();
        this._lastBulkItemType = 0;
        this.bulkQuantity = 1;
        if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = "1";
        this._bulkContentDirty = true;
        this.lastBulkResolutionMessage = undefined;

        this.dismantleExcludedIds.clear();
        this.dismantleDescription = undefined;
        this.dismantleRequiredSelection = undefined;
        this.dismantleSelectedItemType = undefined;
        this.preserveDismantleRequiredDurability = true;
    }

    private canAccessElements(): boolean {
        return !this.destroyed && !!this.element?.isConnected;
    }

    // ── Inventory watching ────────────────────────────────────────────────────

    private _subscribeInventoryWatch(): void {
        if (this._inventoryWatchHandlers || !localPlayer) return;

        const onAdd    = () => this.scheduleInventoryRefresh();
        const onRemove = () => this.scheduleInventoryRefresh();
        const onUpdate = () => this.scheduleInventoryRefresh();

        localPlayer.event.subscribe("inventoryItemAdd",    onAdd);
        localPlayer.event.subscribe("inventoryItemRemove", onRemove);
        localPlayer.event.subscribe("inventoryItemUpdate", onUpdate);

        this._inventoryWatchHandlers = { onAdd, onRemove, onUpdate };
    }

    private _unsubscribeInventoryWatch(): void {
        if (!this._inventoryWatchHandlers || !localPlayer) return;
        const { onAdd, onRemove, onUpdate } = this._inventoryWatchHandlers;
        localPlayer.event.unsubscribe("inventoryItemAdd",    onAdd);
        localPlayer.event.unsubscribe("inventoryItemRemove", onRemove);
        localPlayer.event.unsubscribe("inventoryItemUpdate", onUpdate);
        this._inventoryWatchHandlers = null;
    }

    private scheduleInventoryRefresh(): void {
        if (this._inventoryRefreshTimer !== null) {
            clearTimeout(this._inventoryRefreshTimer);
        }
        this._inventoryRefreshTimer = setTimeout(() => {
            this._inventoryRefreshTimer = null;
            if (!this.panelVisible || !this.canAccessElements()) return;
            if (this.crafting || this.bulkCrafting) {
                this._inventoryRefreshQueued = true;
                return;
            }
            this.refreshVisibleCraftingViews(false);
        }, 200);
    }

    private flushQueuedInventoryRefresh(preserveScroll = false): void {
        if (!this._inventoryRefreshQueued || !this.panelVisible || !this.canAccessElements()) return;
        if (this.crafting || this.bulkCrafting) return;

        this._inventoryRefreshQueued = false;
        this.refreshVisibleCraftingViews(preserveScroll);
    }

    public isDismantleMode(): boolean {
        return this.panelMode === "dismantle";
    }

    public isSameDismantleType(itemType: ItemType): boolean {
        return this.panelMode === "dismantle" && this.dismantleSelectedItemType === itemType;
    }

    public requiresDismantleRequiredItem(): boolean {
        return this.dismantleDescription?.required !== undefined;
    }

    public resolveDismantleRequiredSelection(): Item | undefined {
        if (!this.dismantleDescription?.required) return this.dismantleRequiredSelection;

        const items = this.getFilteredSortedSectionItems("dismantle", -2, "tool", this.findMatchingItems(this.dismantleDescription.required));
        if (this.dismantleRequiredSelection && items.includes(this.dismantleRequiredSelection)) {
            return this.dismantleRequiredSelection;
        }

        return items[0];
    }

    private showSelectionChangedError(message = "Your selection changed. Please reselect the items and try again."): undefined {
        this.showMultiplayerMessage(message);
        return undefined;
    }

    private sanitizeSelectedItems(items: Array<Item | undefined>, candidates?: readonly Item[], maxCount?: number): Item[] {
        const candidateIds = candidates ? new Set(candidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined)) : undefined;
        const seenIds = new Set<number>();
        const sanitized: Item[] = [];

        for (const item of items) {
            const itemId = getItemId(item);
            if (!item || itemId === undefined || seenIds.has(itemId)) continue;
            if (candidateIds && !candidateIds.has(itemId)) continue;
            sanitized.push(item);
            seenIds.add(itemId);
            if (maxCount !== undefined && sanitized.length >= maxCount) break;
        }

        return sanitized;
    }

    private getReservationRoleLabel(role: SelectionReservationRole): string {
        switch (role) {
            case "base": return "Base";
            case "consumed": return "Consumed";
            case "used": return "Used";
            case "tool": return "Tool";
            case "required": return "Required";
            case "target": return "Target";
            case "excluded": return "Excluded";
        }
    }

    private reserveItemsForRole(reservations: Map<number, SelectionReservationRole>, items: readonly Item[], role: SelectionReservationRole): void {
        for (const item of items) {
            const itemId = getItemId(item);
            if (itemId !== undefined && !reservations.has(itemId)) {
                reservations.set(itemId, role);
            }
        }
    }

    private getReservationConflict(reservations: ReadonlyMap<number, SelectionReservationRole>, item: Item, currentRole: SelectionReservationRole): SelectionReservationRole | undefined {
        const itemId = getItemId(item);
        if (itemId === undefined) return undefined;

        const reservedRole = reservations.get(itemId);
        return reservedRole !== undefined && reservedRole !== currentRole ? reservedRole : undefined;
    }

    private filterUnreservedItems(
        items: readonly Item[],
        reservations: ReadonlyMap<number, SelectionReservationRole>,
        currentRole?: SelectionReservationRole,
    ): Item[] {
        return items.filter(item => {
            const itemId = getItemId(item);
            if (itemId === undefined) return true;
            const reservedRole = reservations.get(itemId);
            return reservedRole === undefined || reservedRole === currentRole;
        });
    }

    private repairSelectedItemsForRole(
        selectedItems: readonly Item[],
        candidates: readonly Item[],
        maxCount: number,
        reservations: ReadonlyMap<number, SelectionReservationRole>,
        role: SelectionReservationRole,
        forceTopVisible = false,
    ): Item[] {
        const selectableCandidates = this.filterUnreservedItems(candidates, reservations, role);
        if (forceTopVisible) return selectableCandidates.slice(0, maxCount);

        const candidateValidSelection = this.sanitizeSelectedItems([...selectedItems], candidates, maxCount);
        const repairedSelection = this.sanitizeSelectedItems([...selectedItems], selectableCandidates, maxCount);
        if (repairedSelection.length < candidateValidSelection.length) {
            return this.supplementSelectedItems(repairedSelection, selectableCandidates, maxCount);
        }

        return repairedSelection;
    }

    private hasDuplicateItemIds(items: readonly Item[]): boolean {
        return this.hasDuplicateIds(items.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
    }

    private hasDuplicateIds(itemIds: readonly number[]): boolean {
        const seenIds = new Set<number>();
        for (const itemId of itemIds) {
            if (seenIds.has(itemId)) return true;
            seenIds.add(itemId);
        }

        return false;
    }

    private supplementSelectedItems(selectedItems: Item[], candidates: readonly Item[], maxCount: number): Item[] {
        if (selectedItems.length >= maxCount) return selectedItems.slice(0, maxCount);

        const selectedIds = new Set(selectedItems.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
        const supplemented = [...selectedItems];

        for (const item of candidates) {
            const itemId = getItemId(item);
            if (itemId !== undefined && selectedIds.has(itemId)) continue;

            supplemented.push(item);
            if (itemId !== undefined) selectedIds.add(itemId);
            if (supplemented.length >= maxCount) break;
        }

        return supplemented;
    }

    private getSelectionFailureMessage(details: ISelectionFailureDetails): string {
        const slotLabel = details.slotIndex === -1
            ? "base component"
            : details.slotIndex !== undefined
                ? `${this.getTypeName(details.itemTypeOrGroup as ItemType | ItemTypeGroup)} slot`
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

    private setBulkResolutionFailure(details: ISelectionFailureDetails): void {
        this.lastBulkResolutionMessage = this.getSelectionFailureMessage(details);
    }

    public buildCraftRequestDiagnostics(request: ICraftSelectionRequest): Record<string, unknown> {
        return {
            requestId: request.requestId,
            itemType: request.itemType,
            slots: this.recipe?.components.map((component, slotIndex) => ({
                slotIndex,
                requiredAmount: component.requiredAmount,
                selectedIds: request.slotSelections.find(selection => selection.slotIndex === slotIndex)?.itemIds ?? [],
                candidateIds: getItemIds(this.findMatchingItems(component.type), item => getItemId(item)),
            })) ?? [],
            base: this.recipe?.baseComponent === undefined
                ? undefined
                : {
                    selectedId: request.baseItemId,
                    candidateIds: getItemIds(this.findMatchingItems(this.recipe.baseComponent), item => getItemId(item)),
                },
        };
    }

    public buildCraftExecutionDiagnostics(
        itemType: ItemType,
        slotSelections: Iterable<readonly Item[]>,
        base: Item | undefined,
    ): ICraftExecutionDiagnostics {
        const slots = [...slotSelections].map((items, slotIndex) => {
            const component = this.recipe?.components[slotIndex];
            const consumedItems = component
                ? partitionSelectedItems(items, component.requiredAmount, component.consumedAmount).consumed
                : [];
            const splitSelection = this.splitSelectedItems.get(slotIndex);

            return {
                slotIndex,
                requiredAmount: component?.requiredAmount,
                consumedAmount: component?.consumedAmount,
                selectedIds: getItemIds(items, item => getItemId(item)),
                consumedIds: getItemIds(consumedItems, item => getItemId(item)),
                requiredIds: getItemIds(items, item => getItemId(item)),
                splitConsumedIds: getItemIds(splitSelection?.consumed, item => getItemId(item)),
                splitUsedIds: getItemIds(splitSelection?.used, item => getItemId(item)),
            };
        });

        const payload = buildCraftExecutionPayload([...slotSelections], (_, slotIndex) => {
            const component = this.recipe?.components[slotIndex];
            return {
                requiredAmount: component?.requiredAmount ?? 0,
                consumedAmount: component?.consumedAmount ?? 0,
            };
        });

        return {
            itemType,
            requiredIds: getItemIds(payload.required, item => getItemId(item)),
            consumedIds: getItemIds(payload.consumed, item => getItemId(item)),
            baseId: getItemId(base),
            slots,
        };
    }

    public buildCurrentNormalCraftSelectionState(): Record<string, unknown> {
        return {
            itemType: this.itemType,
            slots: this.recipe?.components.map((component, slotIndex) => ({
                slotIndex,
                requiredAmount: component.requiredAmount,
                consumedAmount: component.consumedAmount,
                selectedIds: getItemIds(this.selectedItems.get(slotIndex), item => getItemId(item)),
                consumedIds: getItemIds(this.splitSelectedItems.get(slotIndex)?.consumed, item => getItemId(item)),
                usedIds: getItemIds(this.splitSelectedItems.get(slotIndex)?.used, item => getItemId(item)),
            })) ?? [],
            baseIds: getItemIds(this.selectedItems.get(-1), item => getItemId(item)),
        };
    }

    public buildBulkRequestDiagnostics(request: IBulkCraftRequest): Record<string, unknown> {
        return {
            requestId: request.requestId,
            itemType: request.itemType,
            quantity: request.quantity,
            excludedIds: request.excludedIds,
            pinnedToolSelections: request.pinnedToolSelections.map(selection => ({
                slotIndex: selection.slotIndex,
                itemIds: selection.itemIds,
                candidateIds: this.recipe?.components[selection.slotIndex]
                    ? getItemIds(this.findMatchingItems(this.recipe.components[selection.slotIndex].type), item => getItemId(item))
                    : [],
            })),
            pinnedUsedSelections: (request.pinnedUsedSelections ?? []).map(selection => ({
                slotIndex: selection.slotIndex,
                itemIds: selection.itemIds,
                candidateIds: this.recipe?.components[selection.slotIndex]
                    ? getItemIds(this.findMatchingItems(this.recipe.components[selection.slotIndex].type), item => getItemId(item))
                    : [],
            })),
        };
    }

    private serializeSlotSelection(slotIndex: number, type: ItemType | ItemTypeGroup, requiredAmount: number): ISelectionSlotIds | undefined {
        const component = this.recipe?.components[slotIndex];
        const candidates = component && this.isSplitComponent(component)
            ? this.mergeVisibleSplitCandidates(slotIndex, this.findMatchingItems(type))
            : this.getFilteredSortedSectionItems(
                "normal",
                slotIndex,
                component && component.consumedAmount <= 0 ? "tool" : "consumed",
                this.findMatchingItems(type),
            );
        const resolved = component
            ? this.resolveComponentSelection(slotIndex, component, candidates, requiredAmount)
            : undefined;
        if (!resolved) return undefined;

        return {
            slotIndex,
            itemIds: getItemIds(resolved.items, item => getItemId(item)),
        };
    }

    public serializeCraftSelectionRequest(requestId: number): ICraftSelectionRequest | undefined {
        this.debugLog("SerializeCraftSelectionRequest", {
            requestId,
            itemType: this.itemType,
            selectedState: this.buildCurrentNormalCraftSelectionState(),
        });
        if (!this.itemType || !this.recipe) return undefined;

        const slotSelections: ISelectionSlotIds[] = [];
        for (let i = 0; i < this.recipe.components.length; i++) {
            const selection = this.serializeSlotSelection(i, this.recipe.components[i].type, this.recipe.components[i].requiredAmount);
            if (!selection) return undefined;
            slotSelections.push(selection);
        }

        let baseItemId: number | undefined;
        if (this.recipe.baseComponent !== undefined) {
            const baseCandidates = this.getFilteredSortedSectionItems("normal", -1, "base", this.findMatchingItems(this.recipe.baseComponent));
            const sanitizedBase = this.sanitizeSelectedItems(this.selectedItems.get(-1) ?? [], baseCandidates, 1);
            const selectedBase = sanitizedBase[0];
            baseItemId = getItemId(selectedBase);
            if (baseItemId === undefined) {
                return this.showSelectionChangedError(this.getSelectionFailureMessage({
                    reason: "baseUnavailable",
                    slotIndex: -1,
                    itemTypeOrGroup: this.recipe.baseComponent as number,
                    candidateItemIds: baseCandidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                }));
            }
            this.selectedItems.set(-1, [selectedBase]);
        }

        const selectedIdsForRequest: number[] = [];
        for (const selection of slotSelections) {
            selectedIdsForRequest.push(...selection.itemIds);
        }
        if (baseItemId !== undefined) selectedIdsForRequest.push(baseItemId);
        if (this.hasDuplicateIds(selectedIdsForRequest)) {
            return this.showSelectionChangedError(this.getSelectionFailureMessage({ reason: "duplicateSelection" }));
        }

        return {
            requestId,
            itemType: this.itemType,
            slotSelections,
            baseItemId,
        };
    }

    private resolveCurrentCraftSelection(): IResolvedNormalCraftSelection | undefined {
        if (!this.itemType || !this.recipe) return undefined;

        const slotSelections = new Map<number, Item[]>();

        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            const candidates = this.isSplitComponent(component)
                ? this.mergeVisibleSplitCandidates(i, this.findMatchingItems(component.type))
                : this.getFilteredSortedSectionItems(
                    "normal",
                    i,
                    component.consumedAmount <= 0 ? "tool" : "consumed",
                    this.findMatchingItems(component.type),
                );
            const resolved = this.resolveComponentSelection(i, component, candidates, component.requiredAmount);
            if (!resolved) return undefined;
            slotSelections.set(i, resolved.items);
        }

        let base: Item | undefined;
        if (this.recipe.baseComponent !== undefined) {
            const baseCandidates = this.getFilteredSortedSectionItems("normal", -1, "base", this.findMatchingItems(this.recipe.baseComponent));
            const sanitizedBase = this.sanitizeSelectedItems(this.selectedItems.get(-1) ?? [], baseCandidates, 1);
            base = sanitizedBase[0];
            if (!base) {
                return this.showSelectionChangedError(this.getSelectionFailureMessage({
                    reason: "baseUnavailable",
                    slotIndex: -1,
                    itemTypeOrGroup: this.recipe.baseComponent as number,
                    candidateItemIds: baseCandidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                }));
            }

            this.selectedItems.set(-1, [base]);
        }

        const orderedSelections = this.recipe.components.map((_, slotIndex) => slotSelections.get(slotIndex) ?? []);
        const payload = buildCraftExecutionPayload(orderedSelections, (_, slotIndex) => ({
            requiredAmount: this.recipe?.components[slotIndex].requiredAmount ?? 0,
            consumedAmount: this.recipe?.components[slotIndex].consumedAmount ?? 0,
        }));
        if (this.hasDuplicateItemIds(base ? [...payload.required, base] : payload.required)) {
            return this.showSelectionChangedError(this.getSelectionFailureMessage({ reason: "duplicateSelection" }));
        }
        const diagnostics = this.buildCraftExecutionDiagnostics(this.itemType, orderedSelections, base);
        this.debugLog("NormalCraftResolved", diagnostics);

        return {
            required: payload.required,
            consumed: payload.consumed,
            used: payload.used,
            base,
            slotSelections,
        };
    }

    public serializeBulkCraftRequest(requestId: number, quantity: number): IBulkCraftRequest | undefined {
        this.debugLog("SerializeBulkCraftRequest", {
            requestId,
            quantity,
            itemType: this.itemType,
            pinnedToolSelections: [...this.bulkPinnedToolSelections.entries()].map(([slotIndex, items]) => ({
                slotIndex,
                itemIds: getItemIds(items, item => getItemId(item)),
            })),
            pinnedUsedSelections: [...this.bulkPinnedUsedSelections.entries()].map(([slotIndex, items]) => ({
                slotIndex,
                itemIds: getItemIds(items, item => getItemId(item)),
            })),
        });
        if (!this.itemType || !this.recipe) return undefined;

        const excludedIds = [...this.getBulkExcludedIds()];
        if (!this.prepareBulkPinnedSelections(new Set<number>(excludedIds))) return this.showSelectionChangedError();

        for (const [slotIndex, items] of this.bulkPinnedToolSelections) {
            const component = this.recipe.components[slotIndex];
            if (!component) continue;

            const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, "tool", this.findMatchingItems(component.type));
            const sanitized = this.sanitizeSelectedItems(items, candidates, component.requiredAmount);
            if (sanitized.length < component.requiredAmount) return this.showSelectionChangedError();
            this.bulkPinnedToolSelections.set(slotIndex, sanitized);
        }

        for (const [slotIndex, items] of this.bulkPinnedUsedSelections) {
            const component = this.recipe.components[slotIndex];
            if (!component) continue;

            const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, "used", this.findMatchingItems(component.type)).filter(candidate => {
                const candidateId = getItemId(candidate);
                return candidateId === undefined || !(this.bulkExcludedIds.get(slotIndex)?.has(candidateId) ?? false);
            });
            const sanitized = this.sanitizeSelectedItems(items, candidates, getUsedSelectionCount(component.requiredAmount, component.consumedAmount));
            if (sanitized.length < getUsedSelectionCount(component.requiredAmount, component.consumedAmount)) return this.showSelectionChangedError();
            this.bulkPinnedUsedSelections.set(slotIndex, sanitized);
        }

        return {
            requestId,
            itemType: this.itemType,
            quantity,
            excludedIds,
            pinnedToolSelections: [...this.bulkPinnedToolSelections.entries()].map(([slotIndex, items]) => ({
                slotIndex,
                itemIds: items.map(getItemId).filter((id): id is number => id !== undefined),
            })),
            pinnedUsedSelections: [...this.bulkPinnedUsedSelections.entries()].map(([slotIndex, items]) => ({
                slotIndex,
                itemIds: items.map(getItemId).filter((id): id is number => id !== undefined),
            })),
            unsafeCrafting: !this.safeCraftingEnabled,
        };
    }

    public serializeDismantleRequest(requestId: number, quantity: number): IDismantleRequest | undefined {
        this.debugLog("SerializeDismantleRequest", {
            requestId,
            quantity,
            itemType: this.dismantleSelectedItemType,
            excludedIds: [...this.dismantleExcludedIds],
            requiredSelectionId: getItemId(this.dismantleRequiredSelection),
        });
        if (!this.dismantleSelectedItemType || !this.dismantleDescription) return undefined;

        const targets = this.sanitizeSelectedItems(this.getIncludedDismantleItems().slice(0, quantity), this.findMatchingItems(this.dismantleSelectedItemType), quantity);
        const targetItemIds = targets.map(getItemId).filter((id): id is number => id !== undefined);
        if (targetItemIds.length === 0) return this.showSelectionChangedError();

        let requiredItemId: number | undefined;
        if (this.dismantleRequiredSelection) {
            const requiredCandidates = this.dismantleDescription.required
                ? this.getFilteredSortedSectionItems("dismantle", -2, "tool", this.findMatchingItems(this.dismantleDescription.required))
                : undefined;
            const sanitizedRequired = this.sanitizeSelectedItems([this.dismantleRequiredSelection], requiredCandidates, 1);
            const requiredItem = sanitizedRequired[0];
            requiredItemId = getItemId(requiredItem);
            if (requiredItemId === undefined) return this.showSelectionChangedError();
            if (targetItemIds.includes(requiredItemId)) {
                return this.showSelectionChangedError(this.getSelectionFailureMessage({ reason: "duplicateSelection" }));
            }
            this.dismantleRequiredSelection = requiredItem;
        }

        return {
            requestId,
            itemType: this.dismantleSelectedItemType,
            targetItemIds,
            requiredItemId,
        };
    }

    public openDismantle(item: Item): void {
        const itemType = item.type as ItemType;
        const dismantle = itemDescriptions[itemType]?.dismantle;
        if (!dismantle) return;

        if (this.panelMode === "dismantle" && this.dismantleSelectedItemType === itemType) {
            return;
        }

        this.panelMode = "dismantle";
        this.dismantleSelectedItemType = itemType;
        this.dismantleDescription = dismantle;
        this.bulkQuantity = 1;
        this.dismantleExcludedIds.clear();
        this.dismantleRequiredSelection = undefined;
        this.preserveDismantleRequiredDurability = true;
        this.resetSafeCraftingEnabled();
        this.buildDismantleContent();
    }

    private applyPanelModeLayout(): void {
        if (!this.canAccessElements()) return;

        if (this.panelMode === "dismantle") {
            this.tabBar.style.display = "none";
            this.closeBtn.style.display = "";
            this.normalBody.style.set("display", "none");
            this.normalFooter.style.set("display", "none");
            this.bulkBody.style.set("display", "flex");
            this.bulkFooter.style.set("display", "flex");
            this.element.classList.remove("bc-panel-bulk");
            this.element.classList.add("bc-panel-dismantle");
            this.bulkCraftBtnEl?.setText(TranslationImpl.generator("Dismantle"));
            return;
        }

        this.tabBar.style.display = "";
        this.closeBtn.style.display = "";
        this.element.classList.remove("bc-panel-dismantle");
        this.bulkCraftBtnEl?.setText(TranslationImpl.generator("Bulk Craft"));
        if (this.activeTab === "bulk") {
            this.normalBody.style.set("display", "none");
            this.normalFooter.style.set("display", "none");
            this.bulkBody.style.set("display", "flex");
            this.bulkFooter.style.set("display", "flex");
            this.element.classList.add("bc-panel-bulk");
        } else {
            this.normalBody.style.set("display", "flex");
            this.normalFooter.style.set("display", "flex");
            this.bulkBody.style.set("display", "none");
            this.bulkFooter.style.set("display", "none");
            this.element.classList.remove("bc-panel-bulk");
        }
    }

    // ── Tab switching ─────────────────────────────────────────────────────────

    private switchTab(tab: "normal" | "bulk"): void {
        if (this.panelMode === "dismantle") return;
        if (this.activeTab === tab) {
            return;
        }
        this.activeTab = tab;

        if (tab === "normal") {
            this.normalTabBtn.classList.add("bc-tab-active");
            this.bulkTabBtn.classList.remove("bc-tab-active");
            this.normalBody.style.set("display", "flex");
            this.normalFooter.style.set("display", "flex");
            this.bulkBody.style.set("display", "none");
            this.bulkFooter.style.set("display", "none");
            this.element.classList.remove("bc-panel-bulk");
        } else {
            this.bulkTabBtn.classList.add("bc-tab-active");
            this.normalTabBtn.classList.remove("bc-tab-active");
            this.normalBody.style.set("display", "none");
            this.normalFooter.style.set("display", "none");
            this.bulkBody.style.set("display", "flex");
            this.bulkFooter.style.set("display", "flex");
            this.element.classList.add("bc-panel-bulk");
            if (this._bulkContentDirty) {
                this.buildBulkContent();
            }
        }
    }

    public showPanel() {
        const wasVisible = this.panelVisible;

        if (!wasVisible) {
            this.clearSectionFilterStates();
            if (this.panelMode === "craft") {
                this.switchTab("normal");
            }
            this._subscribeInventoryWatch();
        }

        this.applyPanelModeLayout();
        this.style.set("display", "flex");
        this.updateHighlights();
    }

    public hidePanel() {
        // If a bulk craft is active, abort it before hiding.
        if (this.bulkCrafting) this.onBulkAbortCallback?.();
        this.onPanelHideCallback?.();
        // Stop watching inventory — no point refreshing a hidden dialog.
        this._unsubscribeInventoryWatch();
        if (this._inventoryRefreshTimer !== null) {
            clearTimeout(this._inventoryRefreshTimer);
            this._inventoryRefreshTimer = null;
        }
        this.resetWindowSessionState();
        this.resetSafeCraftingEnabled();
        this.resetHelpBoxStates();
        this.panelMode = "craft";
        this.applyPanelModeLayout();
        this.style.set("display", "none");
        this._inventoryRefreshQueued = false;
        this.clearHighlights();
        this.bcHideTooltip();
    }

    public get panelVisible(): boolean {
        return this.element?.style.display !== "none";
    }

    // ── Bulk craft lifecycle (called by betterCrafting.ts) ────────────────────

    public setBulkAbortCallback(cb: (() => void) | null): void {
        this.onBulkAbortCallback = cb;
    }

    public setPanelHideCallback(cb: (() => void) | null): void {
        this.onPanelHideCallback = cb;
    }

    /** Swap UI to "in-progress" state: hide craft controls, show stop button and progress. */
    public onBulkCraftStart(total: number, verb = "Crafting"): void {
        this.bulkProgressVerb = verb;
        if (this.bulkCraftBtnEl) this.bulkCraftBtnEl.style.set("display", "none");
        if (this.bulkSafeToggleWrap) this.bulkSafeToggleWrap.style.display = "none";
        if (this.bulkQtyRow) this.bulkQtyRow.style.display = "none";
        if (this.bulkProgressEl) {
            this.bulkProgressEl.textContent = `${verb} 0 / ${total}`;
            this.bulkProgressEl.style.display = "";
        }
        if (this.bulkStopBtn) this.bulkStopBtn.style.set("display", "");
    }

    /** Update the progress label after each craft iteration. */
    public setBulkProgress(current: number, total: number, verb = this.bulkProgressVerb): void {
        if (this.bulkProgressEl) {
            this.bulkProgressEl.textContent = `${verb} ${current} / ${total}`;
        }
    }

    /** Restore UI after bulk craft completes or is aborted. */
    public onBulkCraftEnd(): void {
        if (this.bulkStopBtn) this.bulkStopBtn.style.set("display", "none");
        if (this.bulkProgressEl) this.bulkProgressEl.style.display = "none";
        if (this.bulkCraftBtnEl) this.bulkCraftBtnEl.style.set("display", "");
        if (this.bulkSafeToggleWrap) this.bulkSafeToggleWrap.style.display = "";
        if (this.bulkQtyRow) this.bulkQtyRow.style.display = "";
        this._bulkContentDirty = true;
        this.flushQueuedInventoryRefresh(false);
    }

    // ── Highlight helpers ─────────────────────────────────────────────────────

    private updateHighlights() {
        this.clearHighlights();
        const selectors: HighlightSelector[] = [];
        if (this.panelMode === "dismantle") {
            if (this.dismantleSelectedItemType !== undefined) {
                selectors.push([HighlightType.ItemType, this.dismantleSelectedItemType]);
            }
            if (this.dismantleDescription?.required !== undefined) {
                selectors.push([HighlightType.ItemGroup, this.dismantleDescription.required]);
            }
        } else if (this.recipe) {
            for (const component of this.recipe.components) {
                selectors.push(ItemManager.isGroup(component.type)
                    ? [HighlightType.ItemGroup, component.type]
                    : [HighlightType.ItemType, component.type]);
            }
            if (this.recipe.baseComponent !== undefined) {
                selectors.push(ItemManager.isGroup(this.recipe.baseComponent)
                    ? [HighlightType.ItemGroup, this.recipe.baseComponent]
                    : [HighlightType.ItemType, this.recipe.baseComponent]);
            }
        }
        if (selectors.length > 0) ui?.highlights?.start(this, { selectors } as IHighlight);
    }

    private clearHighlights() {
        ui?.highlights?.end(this);
    }

    // ── Recipe rendering ──────────────────────────────────────────────────────

    public updateRecipe(itemType: number, clearResults = true, preserveScroll = false) {
        this.panelMode = "craft";
        this.applyPanelModeLayout();
        this.itemType = itemType;
        const pendingIds = clearResults ? this._pendingSelectionIds : (this._pendingSelectionIds ?? this.collectCurrentNormalSelectionIds());
        const pendingSplitIds = clearResults ? this._pendingSplitSelectionIds : (this._pendingSplitSelectionIds ?? this.collectCurrentSplitSelectionIds());
        this._pendingSelectionIds = null;
        this._pendingSplitSelectionIds = null;

        this.selectedItems.clear();
        this.splitSelectedItems.clear();

        const desc = itemDescriptions[itemType as ItemType];
        this.recipe = desc?.recipe;

        // Mark bulk content dirty whenever recipe changes.
        this._bulkContentDirty = true;
        if (!this.recipe) {
            const noRecipe = new Text();
            noRecipe.setText(TranslationImpl.generator("No recipe found for this item."));
            noRecipe.style.set("color", "#ff6666");
            this.normalScrollInner.append(noRecipe);
            this.updateCraftButtonState();
            return;
        }

        // Pre-populate selections before building sections.
        if (this.recipe!.baseComponent !== undefined) {
            const items = this.findMatchingItems(this.recipe.baseComponent);
            const pre = this.getPreSelectedItems(items, 1, pendingIds?.get(-1));
            if (pre.length) this.selectedItems.set(-1, pre);
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            const items = this.findMatchingItems(component.type);
            if (this.isSplitComponent(component)) {
                const repairedSplit = this.repairSplitSelection(i, component, items, pendingSplitIds?.get(i));
                if (repairedSplit.consumed.length || repairedSplit.used.length) {
                    this.setSplitSelection(i, repairedSplit.consumed, repairedSplit.used);
                }
                continue;
            }

            const pre = this.getPreSelectedItems(items, component.requiredAmount, pendingIds?.get(i));
            if (pre.length) {
                this.clearSplitSelection(i);
                this.selectedItems.set(i, pre);
            }
        }

        this.rebuildNormalContent(preserveScroll);

        // If currently on bulk tab, rebuild it immediately.
        if (this.activeTab === "bulk") {
            this.buildBulkContent(preserveScroll, true);
        }
    }

    public refreshNormalCraftView(preserveScroll = true, preserveSelections = true): void {
        if (this.itemType === undefined) return;

        if (preserveSelections) {
            this._pendingSelectionIds = this.collectCurrentNormalSelectionIds();
            this._pendingSplitSelectionIds = this.collectCurrentSplitSelectionIds();
        }

        this.updateRecipe(this.itemType, !preserveSelections, preserveScroll);
    }

    public refreshBulkCraftView(preserveScroll = true, preserveQuantity = true, preserveSelections = true): void {
        if (!this.recipe) return;

        if (!preserveSelections) {
            this.bulkExcludedIds.clear();
            this.bulkPreserveDurabilityBySlot.clear();
            this.bulkPinnedToolSelections.clear();
            this.bulkPinnedUsedSelections.clear();
        }

        this._bulkContentDirty = true;
        this.buildBulkContent(preserveScroll, preserveQuantity);
    }

    public refreshDismantleView(preserveScroll = true, preserveQuantity = true, preserveSelections = true): void {
        this.debugLog("RefreshDismantleView", {
            preserveScroll,
            preserveQuantity,
            preserveSelections,
            itemType: this.dismantleSelectedItemType,
        });
        if (!preserveSelections) {
            this.dismantleExcludedIds.clear();
            this.dismantleRequiredSelection = undefined;
        }

        this.buildDismantleContent(preserveScroll);
        if (!preserveQuantity) {
            this.bulkQuantity = 1;
            if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = "1";
            const limits = this.computeBulkUiLimits();
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
        }
    }

    public refreshVisibleCraftingViews(preserveScroll = true): void {
        this.debugLog("RefreshVisibleCraftingViews", {
            preserveScroll,
            panelMode: this.panelMode,
            activeTab: this.activeTab,
            itemType: this.itemType,
            dismantleItemType: this.dismantleSelectedItemType,
        });
        if (this.panelMode === "dismantle") {
            this.refreshDismantleView(preserveScroll, true, true);
            return;
        }

        this.refreshNormalCraftView(preserveScroll, true);
        if (this.activeTab !== "bulk" && this.bulkCrafting) {
            this.refreshBulkCraftView(preserveScroll, true, true);
        }
    }

    private rebuildNormalContent(preserveScroll = false): void {
        this.debugLog("BuildNormalContent", {
            preserveScroll,
            itemType: this.itemType,
            hasRecipe: this.recipe !== undefined,
        });
        const scrollTop = preserveScroll ? this.scrollContent.element.scrollTop : 0;
        const scrollLeft = preserveScroll ? this.scrollContent.element.scrollLeft : 0;

        this.sectionCounters.clear();
        this.normalizeNormalSelectionsForRender();
        this.normalStaticContent.dump();
        this.normalScrollInner.dump();

        if (!this.recipe) {
            const noRecipe = new Text();
            noRecipe.setText(TranslationImpl.generator("No recipe found for this item."));
            noRecipe.style.set("color", "#ff6666");
            this.normalScrollInner.append(noRecipe);
            this.updateCraftButtonState();
            this.restoreScrollPosition(this.scrollContent, scrollTop, scrollLeft, preserveScroll);
            return;
        }

        this.buildOutputCard(this.itemType as ItemType, this.recipe, false);
        this.addNormalHelpBox();
        if (this.recipe.baseComponent !== undefined) this.addBaseComponentSection(this.recipe.baseComponent);
        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            if (component.consumedAmount > 0) {
                this.addComponentSection(i, component, "consumed");
            }
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            if (this.isSplitComponent(component)) {
                this.addComponentSection(i, component, "used");
            }
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            if (component.consumedAmount <= 0) {
                this.addComponentSection(i, component, "tool");
            }
        }

        this.updateCraftButtonState();
        this.restoreScrollPosition(this.scrollContent, scrollTop, scrollLeft, preserveScroll);
    }

    private restoreScrollPosition(port: Component, scrollTop: number, scrollLeft = 0, preserveScroll = false): void {
        if (!preserveScroll) return;
        requestAnimationFrame(() => {
            if (!this.canAccessElements() || !port.element?.isConnected) return;
            port.element.scrollTop = scrollTop;
            port.element.scrollLeft = scrollLeft;
        });
    }

    // ── Pre-selection helper ──────────────────────────────────────────────────

    private getItemsByOrderedIds(items: readonly Item[], orderedIds?: readonly number[], maxCount?: number): Item[] {
        if (!orderedIds?.length) return [];

        const candidateMap = new Map<number, Item>();
        for (const item of items) {
            const itemId = getItemId(item);
            if (itemId !== undefined && !candidateMap.has(itemId)) {
                candidateMap.set(itemId, item);
            }
        }

        const orderedItems: Item[] = [];
        for (const itemId of orderedIds) {
            const item = candidateMap.get(itemId);
            if (!item) continue;
            orderedItems.push(item);
            if (maxCount !== undefined && orderedItems.length >= maxCount) break;
        }

        return orderedItems;
    }

    private mergeVisibleSplitCandidates(slotIndex: number, items: readonly Item[]): Item[] {
        const merged: Item[] = [];
        const seenIds = new Set<number>();
        for (const item of [
            ...this.getFilteredSortedSectionItems("normal", slotIndex, "consumed", items),
            ...this.getFilteredSortedSectionItems("normal", slotIndex, "used", items),
        ]) {
            const itemId = getItemId(item);
            if (itemId === undefined || seenIds.has(itemId)) continue;
            seenIds.add(itemId);
            merged.push(item);
        }

        return merged;
    }

    private getPreSelectedItems(items: Item[], maxCount: number, pendingIds?: readonly number[] | null): Item[] {
        if (pendingIds?.length) {
            const restored = this.getItemsByOrderedIds(items, pendingIds, maxCount);
            if (restored.length >= maxCount) return restored.slice(0, maxCount);
            // Some previously-selected items survive (e.g. tool slots) but not enough to fill
            // the requirement — supplement with other available items rather than returning short.
            if (restored.length > 0) {
                const restoredIds = new Set(restored.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
                const extras = items.filter(item => {
                    const itemId = getItemId(item);
                    return itemId === undefined || !restoredIds.has(itemId);
                });
                return [...restored, ...extras].slice(0, maxCount);
            }
        }
        return items.slice(0, maxCount);
    }

    private isSplitComponent(component: IRecipeComponent): boolean {
        return isSplitConsumption(component.requiredAmount, component.consumedAmount);
    }

    private getSplitSelection(slotIndex: number): INormalSplitSelection {
        return this.splitSelectedItems.get(slotIndex) ?? { consumed: [], used: [] };
    }

    private setSplitSelection(slotIndex: number, consumed: Item[], used: Item[]): void {
        const nextSelection = { consumed: [...consumed], used: [...used] };
        this.splitSelectedItems.set(slotIndex, nextSelection);
        this.selectedItems.set(slotIndex, [...nextSelection.consumed, ...nextSelection.used]);
    }

    private clearSplitSelection(slotIndex: number): void {
        this.splitSelectedItems.delete(slotIndex);
    }

    private collectCurrentSplitSelectionIds(): Map<number, { consumedIds: number[]; usedIds: number[] }> {
        const pending = new Map<number, { consumedIds: number[]; usedIds: number[] }>();
        for (const [slotIndex, selection] of this.splitSelectedItems) {
            pending.set(slotIndex, {
                consumedIds: selection.consumed.map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                usedIds: selection.used.map(item => getItemId(item)).filter((id): id is number => id !== undefined),
            });
        }

        return pending;
    }

    private repairSplitSelection(
        slotIndex: number,
        component: IRecipeComponent,
        candidates: readonly Item[],
        pendingSplitIds?: { consumedIds: number[]; usedIds: number[] },
    ): INormalSplitSelection {
        const consumedCount = getConsumedSelectionCount(component.requiredAmount, component.consumedAmount);
        const usedCount = getUsedSelectionCount(component.requiredAmount, component.consumedAmount);
        const current = pendingSplitIds
            ? {
                consumed: this.getItemsByOrderedIds(candidates, pendingSplitIds.consumedIds),
                used: this.getItemsByOrderedIds(candidates, pendingSplitIds.usedIds),
            }
            : this.getSplitSelection(slotIndex);

        const used = this.sanitizeSelectedItems(current.used, candidates, usedCount);
        const repairedUsed = this.supplementSelectedItems(used, candidates, usedCount);
        const repairedUsedIds = new Set(repairedUsed.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
        const consumedCandidates = candidates.filter(item => {
            const itemId = getItemId(item);
            return itemId === undefined || !repairedUsedIds.has(itemId);
        });
        const consumed = this.sanitizeSelectedItems(current.consumed, consumedCandidates, consumedCount);
        const repairedConsumed = this.supplementSelectedItems(consumed, consumedCandidates, consumedCount);

        return {
            consumed: repairedConsumed,
            used: repairedUsed,
        };
    }

    private normalizeNormalSelectionsForRender(): void {
        if (!this.recipe) return;

        const repairRole = (
            slotIndex: number,
            semantic: SectionSemantic,
            role: SelectionReservationRole,
            current: readonly Item[],
            candidates: readonly Item[],
            maxCount: number,
        ): Item[] => {
            const forceTopVisible = this.shouldReselectSection("normal", slotIndex, semantic)
                || this.shouldReselectSectionForSort("normal", slotIndex, semantic);
            const repaired = this.repairSelectedItemsForRole(current, candidates, maxCount, this.normalRenderReservations, role, forceTopVisible);
            this.clearSectionReselect("normal", slotIndex, semantic);
            this.clearSectionSortReselect("normal", slotIndex, semantic);
            this.pruneExplicitSelection("normal", slotIndex, semantic, repaired);
            this.reserveItemsForRole(this.normalRenderReservations, repaired, role);
            return repaired;
        };

        const normalPrefix = `normal:${this.itemType ?? 0}:`;
        const explicitEntries = [...this.explicitSelections.entries()].filter(([key]) => key.startsWith(normalPrefix));
        this.normalRenderReservations = this.collectExplicitReservations(explicitEntries);

        if (this.recipe.baseComponent !== undefined) {
            const candidates = this.getFilteredSortedSectionItems("normal", -1, "base", this.findMatchingItems(this.recipe.baseComponent));
            this.selectedItems.set(-1, repairRole(-1, "base", "base", this.selectedItems.get(-1) ?? [], candidates, 1));
        }

        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            if (!this.isSplitComponent(component)) continue;

            const splitSelection = this.getSplitSelection(i);
            const candidates = this.getFilteredSortedSectionItems("normal", i, "used", this.findMatchingItems(component.type));
            const used = repairRole(i, "used", "used", splitSelection.used, candidates, getUsedSelectionCount(component.requiredAmount, component.consumedAmount));
            this.setSplitSelection(i, splitSelection.consumed, used);
        }

        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            if (component.consumedAmount > 0) continue;

            const candidates = this.getFilteredSortedSectionItems("normal", i, "tool", this.findMatchingItems(component.type));
            this.clearSplitSelection(i);
            this.selectedItems.set(i, repairRole(i, "tool", "tool", this.selectedItems.get(i) ?? [], candidates, component.requiredAmount));
        }

        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            if (component.consumedAmount <= 0) continue;

            const candidates = this.getFilteredSortedSectionItems("normal", i, "consumed", this.findMatchingItems(component.type));
            if (this.isSplitComponent(component)) {
                const splitSelection = this.getSplitSelection(i);
                const consumed = repairRole(i, "consumed", "consumed", splitSelection.consumed, candidates, getConsumedSelectionCount(component.requiredAmount, component.consumedAmount));
                this.setSplitSelection(i, consumed, splitSelection.used);
                continue;
            }

            this.clearSplitSelection(i);
            this.selectedItems.set(i, repairRole(i, "consumed", "consumed", this.selectedItems.get(i) ?? [], candidates, component.requiredAmount));
        }
    }

    private reportSelectionUnavailable(
        slotIndex: number,
        type: ItemType | ItemTypeGroup,
        requestedItems: readonly Item[],
        candidates: readonly Item[],
    ): undefined {
        return this.showSelectionChangedError(this.getSelectionFailureMessage({
            reason: "itemUnavailable",
            slotIndex,
            itemTypeOrGroup: type as number,
            requestedItemIds: getItemIds(requestedItems, item => getItemId(item)),
            candidateItemIds: getItemIds(candidates, item => getItemId(item)),
        }));
    }

    private resolveComponentSelection(
        slotIndex: number,
        component: IRecipeComponent,
        candidates: readonly Item[],
        requiredAmount: number,
        pendingSplitIds?: { consumedIds: number[]; usedIds: number[] },
        writeBack = true,
    ): { items: Item[]; split?: INormalSplitSelection } | undefined {
        if (this.isSplitComponent(component)) {
            const repairedSplit = this.repairSplitSelection(slotIndex, component, candidates, pendingSplitIds);
            const repairedItems = [...repairedSplit.consumed, ...repairedSplit.used];
            if (repairedSplit.consumed.length < getConsumedSelectionCount(component.requiredAmount, component.consumedAmount)
                || repairedSplit.used.length < getUsedSelectionCount(component.requiredAmount, component.consumedAmount)) {
                return this.reportSelectionUnavailable(slotIndex, component.type, repairedItems, candidates);
            }

            if (writeBack) this.setSplitSelection(slotIndex, repairedSplit.consumed, repairedSplit.used);
            return { items: repairedItems, split: repairedSplit };
        }

        const repairedItems = this.sanitizeSelectedItems(this.selectedItems.get(slotIndex) ?? [], candidates, requiredAmount);
        if (repairedItems.length < requiredAmount) {
            return this.reportSelectionUnavailable(slotIndex, component.type, repairedItems, candidates);
        }

        if (writeBack) {
            this.clearSplitSelection(slotIndex);
            this.selectedItems.set(slotIndex, repairedItems);
        }

        return { items: repairedItems };
    }

    private collectCurrentNormalSelectionIds(): Map<number, number[]> {
        const pendingIds = new Map<number, number[]>();
        for (const [slotIndex, items] of this.selectedItems) {
            const orderedIds: number[] = [];
            for (const item of items) {
                const itemId = getItemId(item);
                if (itemId !== undefined) {
                    orderedIds.push(itemId);
                }
            }

            if (orderedIds.length > 0) {
                pendingIds.set(slotIndex, orderedIds);
            }
        }

        return pendingIds;
    }

    // ── Text formatting ───────────────────────────────────────────────────────

    private toTitleCase(str: string): string {
        return str.replace(/\b\w/g, c => c.toUpperCase());
    }

    private formatEnumName(name: string): string {
        return this.toTitleCase(name.replace(/([a-z])([A-Z])/g, "$1 $2"));
    }

    // ── Craft button state ────────────────────────────────────────────────────

    private updateCraftButtonState(): void {
        if (!this.craftBtn) return;
        let met = true;
        if (this.recipe) {
            for (let i = 0; i < this.recipe.components.length; i++) {
                const component = this.recipe.components[i];
                if (this.isSplitComponent(component)) {
                    const splitSelection = this.getSplitSelection(i);
                    if (splitSelection.consumed.length < getConsumedSelectionCount(component.requiredAmount, component.consumedAmount)
                        || splitSelection.used.length < getUsedSelectionCount(component.requiredAmount, component.consumedAmount)) {
                        met = false;
                        break;
                    }
                    continue;
                }

                if ((this.selectedItems.get(i) || []).length < component.requiredAmount) {
                    met = false; break;
                }
            }
            if (met && this.recipe.baseComponent !== undefined) {
                if ((this.selectedItems.get(-1) || []).length < 1) met = false;
            }
        } else {
            met = false;
        }
        if (met) {
            this.craftBtn.classes.remove("bc-craft-disabled");
        } else {
            this.craftBtn.classes.add("bc-craft-disabled");
        }
    }

    // ── Counter updates ───────────────────────────────────────────────────────

    private getSelectedCountForSection(slotIndex: number, semantic: SectionSemantic): number {
        const component = this.recipe?.components[slotIndex];
        const split = component ? this.isSplitComponent(component) : false;
        if (split && semantic === "consumed") {
            return this.getSplitSelection(slotIndex).consumed.length;
        }
        if (split && semantic === "used") {
            return this.getSplitSelection(slotIndex).used.length;
        }

        return (this.selectedItems.get(slotIndex) || []).length;
    }

    private updateCounter(slotIndex: number, maxSelect: number, semantic: SectionSemantic = "base") {
        const counter = this.sectionCounters.get(getSectionCounterKey(slotIndex, semantic));
        if (!counter) return;
        const count = this.getSelectedCountForSection(slotIndex, semantic);
        counter.setText(TranslationImpl.generator(`${count}/${maxSelect}`));
        counter.style.set("color", count >= maxSelect ? "#33ff99" : "#c8bc8a");
        this.updateCraftButtonState();
    }

    // ── Section builders ──────────────────────────────────────────────────────

    private buildOutputCard(itemType: ItemType, recipe: IRecipe, isBulk: boolean): void {
        const desc = itemDescriptions[itemType];
        const fmt  = (s: string) => this.formatEnumName(s);

        const card = new Component();
        card.style.set("flex", "1 1 100%");
        card.style.set("width", "100%");
        card.style.set("box-sizing", "border-box");
        card.style.set("padding", "6px 6px");
        card.style.set("border", "1px solid var(--color-border, #554433)");
        card.style.set("border-radius", "3px");
        card.style.set("display", "flex");
        card.style.set("flex-direction", "column");
        card.style.set("gap", "4px");

        const row1 = document.createElement("div");
        row1.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;";

        const iconHolder = document.createElement("div");
        iconHolder.style.cssText = "flex-shrink:0;display:flex;";
        try {
            const handler = new ItemComponentHandler({ getItemType: () => itemType, noDrag: true });
            const iconComp = ItemComponent.create(handler);
            if (iconComp) iconHolder.appendChild(iconComp.element);
        } catch (error) {
            this.debugLog("Failed to create output card item icon.", { itemType, error });
        }
        row1.appendChild(iconHolder);

        const itemName = (() => {
            try { return fmt(ItemType[itemType] || `Item ${itemType}`); }
            catch { return `Item ${itemType}`; }
        })();
        const nameSpan = document.createElement("span");
        nameSpan.textContent = itemName;
        const cardTheme = isBulk ? SCREEN_THEME.bulk : SCREEN_THEME.normal;
        nameSpan.style.cssText = `color:${cardTheme.title};font-weight:600;font-size:1.2em;flex-shrink:0;`;
        row1.appendChild(nameSpan);

        const inlineStat = (label: string, value: string) =>
            appendInlineStat(row1, label, value, cardTheme.accent, `color:${cardTheme.body};font-size:0.9em;white-space:nowrap;`);

        inlineStat("Difficulty", fmt(RecipeLevel[recipe.level] ?? String(recipe.level)));
        inlineStat("Skill", fmt(SkillType[recipe.skill] ?? String(recipe.skill)));
        if (desc?.durability !== undefined) inlineStat("Durability", String(desc.durability));
        const w = desc?.weightRange
            ? `${desc.weightRange[0].toFixed(1)}–${desc.weightRange[1].toFixed(1)}`
            : desc?.weight !== undefined ? desc.weight.toFixed(1) : null;
        if (w) inlineStat("Weight", w);

        card.element.appendChild(row1);

        if (desc?.group && desc.group.length > 0) {
            const parts = desc.group.map(g => {
                const tierNum = (desc as any)?.tier?.[g] as number | undefined;
                const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                return `${fmt(ItemTypeGroup[g] || `Group ${g}`)}${tierStr}`;
            });
            const groupLine = createColoredListLine("Groupings", parts, cardTheme.accent, `font-size:0.85em;color:${cardTheme.body};`);
            card.element.appendChild(groupLine);
        }

        if (desc?.use && desc.use.length > 0) {
            const parts = desc.use.map(u => {
                const tierNum = (desc as any)?.actionTier?.[u] as number | undefined;
                const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                return `${fmt(ActionType[u] || `Action ${u}`)}${tierStr}`;
            });
            const useLine = createColoredListLine("Uses", parts, cardTheme.accent, `font-size:0.85em;color:${cardTheme.body};`);
            card.element.appendChild(useLine);
        }

        if (isBulk) {
            // Class used by the blue theme CSS selector.
            card.classes.add("bc-bulk-output-card");
            this.bulkStaticContent.append(card);
        } else {
            const qualityNote = document.createElement("div");
            qualityNote.style.cssText = "font-size:0.85em;color:#7a6850;font-style:italic;";
            qualityNote.textContent = "Quality depends on your crafting skill level.";
            card.element.appendChild(qualityNote);
            this.normalStaticContent.append(card);
        }
    }

    private getSemanticTooltip(semantic: Exclude<SectionSemantic, "base">): { title: string; lines: string[] } {
        switch (semantic) {
            case "consumed":
                return {
                    title: "Consumed",
                    lines: [
                        "Consumed items are destroyed when you complete this action.",
                        "You must choose the exact items that will be consumed.",
                    ],
                };
            case "used":
                return {
                    title: "Used",
                    lines: [
                        "Used items are required for this action but are not consumed.",
                        "They remain after the action and lose durability as normal.",
                    ],
                };
            case "tool":
            default:
                return {
                    title: "Tool",
                    lines: [
                        "Tool items are required for this action and are not consumed.",
                        "They remain after the action and lose durability as normal.",
                    ],
                };
        }
    }

    private appendSectionHeader(
        labelRow: Component,
        titleText: string,
        availableCount: number | string,
        semantic: SectionSemantic,
    ): void {
        const left = document.createElement("div");
        left.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;";

        const title = document.createElement("span");
        title.textContent = titleText;
        title.style.cssText = "font-weight:bold;";
        left.appendChild(title);

        if (semantic !== "base") {
            const semanticWrap = document.createElement("span");
            semanticWrap.style.cssText = "display:inline-flex;align-items:center;gap:2px;color:#c8bc8a;font-size:0.92em;";

            const semanticLabel = document.createElement("span");
            semanticLabel.textContent = semantic.charAt(0).toUpperCase() + semantic.slice(1);
            semanticWrap.appendChild(semanticLabel);

            const tooltip = this.getSemanticTooltip(semantic);
            semanticWrap.appendChild(this.createInfoIcon(tooltip.title, tooltip.lines));
            left.appendChild(semanticWrap);
        }

        const available = document.createElement("span");
        available.textContent = typeof availableCount === "number" ? `(${availableCount} available)` : `(${availableCount})`;
        available.style.cssText = "color:#c8bc8a;font-size:0.92em;";
        left.appendChild(available);

        labelRow.element.appendChild(left);
    }

    private addBaseComponentSection(baseType: ItemType | ItemTypeGroup) {
        const section = this.createSection();
        const labelRow = this.createLabelRow();

        const items = this.findMatchingItems(baseType);
        const visibleItems = this.getFilteredSortedSectionItems("normal", -1, "base", items);
        this.appendSectionHeader(labelRow, `Base: ${this.getTypeName(baseType)}`, this.formatAvailableCount(visibleItems.length, items.length), "base");

        const counter = new Text();
        counter.setText(TranslationImpl.generator(`${this.getSelectedCountForSection(-1, "base")}/1`));
        counter.style.set("color", "#c8bc8a");
        counter.style.set("font-size", "0.9em");
        counter.style.set("margin-left", "8px");
        labelRow.append(counter);
        this.sectionCounters.set(getSectionCounterKey(-1, "base"), counter);
        section.append(labelRow);
        this.appendSectionControls(section, "normal", -1, "base", () => this.rebuildNormalContent(true));

        const itemsContainer = this.createItemsContainer();
        section.append(itemsContainer);
        if (visibleItems.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            for (const item of visibleItems) this.addItemRow(itemsContainer, -1, item, 1);
        }
        this.updateCounter(-1, 1, "base");
        this.normalScrollInner.append(section);
    }

    private addComponentSection(index: number, component: IRecipeComponent, semantic: SectionSemantic) {
        const section = this.createSection();
        const labelRow  = this.createLabelRow();
        const split = this.isSplitComponent(component);
        const maxSelect = semantic === "used"
            ? getUsedSelectionCount(component.requiredAmount, component.consumedAmount)
            : semantic === "consumed"
                ? getConsumedSelectionCount(component.requiredAmount, component.consumedAmount)
                : component.requiredAmount;
        const items = this.findMatchingItems(component.type);
        const sortedVisibleItems = this.getFilteredSortedSectionItems("normal", index, semantic, items);
        const visibleItems = sortedVisibleItems;
        const totalAvailableCount = items.length;

        this.appendSectionHeader(labelRow, `${this.getTypeName(component.type)} ×${maxSelect}`, this.formatAvailableCount(visibleItems.length, totalAvailableCount), semantic);

        const counter = new Text();
        counter.setText(TranslationImpl.generator(`${this.getSelectedCountForSection(index, semantic)}/${maxSelect}`));
        counter.style.set("color", "#c8bc8a");
        counter.style.set("font-size", "0.9em");
        counter.style.set("margin-left", "8px");
        labelRow.append(counter);
        this.sectionCounters.set(getSectionCounterKey(index, semantic), counter);
        section.append(labelRow);
        this.appendSectionControls(section, "normal", index, semantic, () => this.rebuildNormalContent(true));

        const itemsContainer = this.createItemsContainer();
        section.append(itemsContainer);
        if (visibleItems.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            if (split && (semantic === "consumed" || semantic === "used")) {
                for (const item of visibleItems) this.addSplitItemRow(itemsContainer, index, item, maxSelect, semantic);
            } else {
                for (const item of visibleItems) this.addItemRow(itemsContainer, index, item, maxSelect);
            }
        }
        this.updateCounter(index, maxSelect, semantic);
        this.normalScrollInner.append(section);
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    /** Flex-shrink-0 container that holds the output card and other static header content. */
    private createStaticContentContainer(): Component {
        const c = new Component();
        c.style.set("display", "flex");
        c.style.set("flex-wrap", "wrap");
        c.style.set("gap", "8px");
        c.style.set("align-items", "flex-start");
        c.style.set("flex", "0 0 auto");
        c.style.set("min-height", "0");
        return c;
    }

    /**
     * Creates a scroll viewport + flex-wrap inner container pair.
     * The viewport fills remaining flex space and scrolls; the inner container
     * uses min-height:100% so align-content:stretch distributes section height.
     */
    private createScrollPort(): [viewport: Component, inner: Component] {
        const viewport = new Component();
        viewport.style.set("display", "block");
        viewport.style.set("flex", "1 1 0");
        viewport.style.set("min-height", "0");
        viewport.style.set("overflow-y", "auto");
        viewport.style.set("overflow-x", "hidden");
        viewport.style.set("scrollbar-width", "thin");
        viewport.style.set("scrollbar-color", "#888888 rgba(0,0,0,0.3)");

        const inner = new Component();
        inner.style.set("display", "flex");
        inner.style.set("flex-wrap", "wrap");
        inner.style.set("gap", "8px");
        inner.style.set("align-items", "stretch");
        inner.style.set("align-content", "stretch");
        inner.style.set("min-height", "100%");
        viewport.append(inner);

        return [viewport, inner];
    }

    private createSection(): Component {
        const section = new Component();
        section.classes.add("better-crafting-section");
        section.style.set("display", "flex");
        section.style.set("flex-direction", "column");
        section.style.set("min-height", "0");
        section.style.set("flex", "1 1 320px");
        section.style.set("min-width", "290px");
        section.style.set("max-width", "420px");
        section.style.set("box-sizing", "border-box");
        section.style.set("padding", "6px 8px");
        section.style.set("border", "1px solid var(--color-border, #554433)");
        section.style.set("border-radius", "3px");
        return section;
    }

    private createLabelRow(): Component {
        const row = new Component();
        row.style.set("display", "flex");
        row.style.set("flex-shrink", "0");
        row.style.set("justify-content", "space-between");
        row.style.set("align-items", "center");
        row.style.set("margin-bottom", "4px");
        row.style.set("padding", "4px 4px 4px 8px");
        return row;
    }

    private createItemsContainer(): Component {
        const container = new Component();
        container.classes.add("better-crafting-item-list");
        container.style.set("flex", "1 1 0");
        container.style.set("overflow-y", "auto");
        container.style.set("min-height", "0");
        return container;
    }

    private makeFullWidthWrapper(): Component {
        const wrapper = new Component();
        wrapper.style.set("flex", "1 1 100%");
        wrapper.style.set("width", "100%");
        return wrapper;
    }

    private createSafeToggle(assignToggle: (toggle: CheckButton) => void): HTMLDivElement {
        const wrapper = document.createElement("div");
        wrapper.classList.add("bc-safe-toggle-wrap");
        wrapper.style.cssText = "display:flex;align-items:center;gap:4px;margin-right:4px;background:transparent;padding:0;border:0;";

        const label = document.createElement("span");
        label.classList.add("bc-safe-toggle-label");
        label.textContent = "Safe";
        label.style.cssText = "font-weight:bold;color:inherit;";
        wrapper.appendChild(label);

        const toggle = new CheckButton();
        toggle.element.classList.add("bc-safe-toggle-checkbox");
        toggle.setChecked(this.safeCraftingEnabled, false);
        toggle.style.set("background", "transparent");
        toggle.style.set("background-color", "transparent");
        toggle.style.set("border", "none");
        toggle.style.set("box-shadow", "none");
        toggle.style.set("padding", "0");
        toggle.style.set("margin", "0");
        toggle.event.subscribe("toggle", (_: unknown, checked: boolean) => {
            this.setSafeCraftingEnabled(checked);
        });
        assignToggle(toggle);
        wrapper.appendChild(toggle.element);

        const info = this.createInfoIcon("Safe", [
            "Block low-stamina crafting and bulk damage aborts for this screen.",
            "Turn this off to ignore stamina limits and keep going after taking damage.",
        ]);
        info.classList.add("bc-safe-toggle-info");
        wrapper.appendChild(info);

        return wrapper;
    }

    private appendMissing(parent: Component) {
        const missing = new Text();
        missing.setText(TranslationImpl.generator("  \u2717 None in inventory"));
        missing.style.set("color", "#cc4444");
        missing.style.set("font-style", "italic");
        parent.append(missing);
    }

    // ── Item row ──────────────────────────────────────────────────────────────

    private addItemRow(parent: Component, slotIndex: number, item: Item, maxSelect: number) {
        const qualityColor   = getQualityColor(item.quality);
        const borderBase     = `1px solid ${qualityColor}33`;
        const borderHover    = `1px solid ${qualityColor}77`;
        const borderSelected = `1px solid ${qualityColor}`;

        const preSelected = (this.selectedItems.get(slotIndex) || []).indexOf(item) >= 0;
        const component = slotIndex >= 0 ? this.recipe?.components[slotIndex] : undefined;
        const semantic: SectionSemantic = slotIndex === -1
            ? "base"
            : component && component.consumedAmount <= 0
                ? "tool"
                : "consumed";
        const conflictRole = this.getReservationConflict(this.normalRenderReservations, item, semantic);
        const disabled = conflictRole !== undefined;

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", disabled ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");

        row.style.set("border",      preSelected ? borderSelected : borderBase);
        row.style.set("background",  preSelected ? "rgba(30, 255, 128, 0.1)" : disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
        if (disabled) row.style.set("opacity", "0.7");

        const qualityName = getQualityName(item.quality);
        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        row.addEventListener("mouseenter", (e: MouseEvent) => {
            this._hoveredItem = item;
            this._hoveredDisplayName = displayName;
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;

            if ((this.selectedItems.get(slotIndex) || []).indexOf(item) < 0 && !disabled) {
                row.style.set("background", "rgba(255, 255, 255, 0.05)");
                row.style.set("border", borderHover);
            }

            if (this.shiftHeld) {
                this.bcShowTooltip(item, displayName, e.clientX, e.clientY);
            }
        });

        row.addEventListener("mousemove", (e: MouseEvent) => {
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;
            if (this.shiftHeld && this.bcTooltipEl && this.bcTooltipEl.style.display !== "none") {
                this.bcPositionTooltip(e.clientX, e.clientY);
            }
        });

        row.addEventListener("mouseleave", () => {
            this._hoveredItem = null;
            this.bcHideTooltip();

            if ((this.selectedItems.get(slotIndex) || []).indexOf(item) < 0) {
                row.style.set("background", disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
                row.style.set("border", borderBase);
            }
        });

        try {
            const handler = new ItemComponentHandler({
                getItem:        () => item,
                getItemType:    () => item.type,
                getItemQuality: () => item.quality,
                noDrag: true,
            });
            const itemComp = ItemComponent.create(handler);
            if (itemComp) {
                itemComp.style.set("flex-shrink", "0");
                itemComp.style.set("margin-right", "5px");
                row.append(itemComp);
            }
        } catch (error) {
            this.debugLog("Failed to create normal selection item icon.", { itemId: getItemId(item), itemType: item.type, error });
        }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

        if (component && component.consumedAmount <= 0) {
            this.appendRemainingUsesHint(row.element, item, getCraftDurabilityLoss(item), false);
        }

        if (conflictRole !== undefined) {
            const disabledText = document.createElement("span");
            disabledText.textContent = this.getReservationRoleLabel(conflictRole);
            disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
            row.element.appendChild(disabledText);
        }

        const check = new CheckButton();
        check.style.set("pointer-events",   "none");
        check.style.set("margin-left",      "4px");
        check.style.set("flex-shrink",      "0");
        check.style.set("background",       "transparent");
        check.style.set("background-color", "transparent");
        check.style.set("border",           "none");
        check.style.set("box-shadow",       "none");
        check.style.set("padding",          "0");
        if (preSelected) check.setChecked(true, false);
        row.append(check);

        row.event.subscribe("activate", () => {
            if (disabled) return;
            const selected = this.selectedItems.get(slotIndex) || [];
            const idx = selected.indexOf(item);
            if (idx >= 0) {
                selected.splice(idx, 1);
            } else {
                if (selected.length >= maxSelect) {
                    if (maxSelect !== 1 || selected.length === 0) return;
                    selected.splice(0, selected.length, item);
                } else {
                    selected.unshift(item);
                }
            }
            this.selectedItems.set(slotIndex, selected);
            this.setExplicitSelection("normal", slotIndex, semantic, semantic === "tool" ? "tool" : semantic === "base" ? "base" : "consumed", selected);
            this.rebuildNormalContent(false);
        });

        parent.append(row);
    }

    private addSplitItemRow(parent: Component, slotIndex: number, item: Item, maxSelect: number, semantic: "consumed" | "used") {
        const qualityColor = getQualityColor(item.quality);
        const borderBase = `1px solid ${qualityColor}33`;
        const borderHover = `1px solid ${qualityColor}77`;
        const borderSelected = `1px solid ${qualityColor}`;
        const splitSelection = this.getSplitSelection(slotIndex);
        const selectedItems = semantic === "consumed" ? splitSelection.consumed : splitSelection.used;
        const otherItems = semantic === "consumed" ? splitSelection.used : splitSelection.consumed;
        const itemId = getItemId(item);
        const isSelected = selectedItems.includes(item);
        const conflictRole = this.getReservationConflict(this.normalRenderReservations, item, semantic);
        const otherRole = otherItems.some(other => getItemId(other) === itemId)
            ? semantic === "consumed" ? "used" : "consumed"
            : undefined;
        const disabledRole = conflictRole ?? otherRole;
        const disabled = disabledRole !== undefined;

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", disabled ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");
        row.style.set("border", isSelected ? borderSelected : borderBase);
        row.style.set("background", isSelected ? "rgba(30, 255, 128, 0.1)" : disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
        if (disabled) row.style.set("opacity", "0.7");

        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }
        const qualityName = getQualityName(item.quality);
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        row.addEventListener("mouseenter", (e: MouseEvent) => {
            this._hoveredItem = item;
            this._hoveredDisplayName = displayName;
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;

            if (!isSelected && !disabled) {
                row.style.set("background", "rgba(255, 255, 255, 0.05)");
                row.style.set("border", borderHover);
            }

            if (this.shiftHeld) {
                this.bcShowTooltip(item, displayName, e.clientX, e.clientY);
            }
        });

        row.addEventListener("mousemove", (e: MouseEvent) => {
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;
            if (this.shiftHeld && this.bcTooltipEl && this.bcTooltipEl.style.display !== "none") {
                this.bcPositionTooltip(e.clientX, e.clientY);
            }
        });

        row.addEventListener("mouseleave", () => {
            this._hoveredItem = null;
            this.bcHideTooltip();
            if (!isSelected) {
                row.style.set("background", disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
                row.style.set("border", borderBase);
            }
        });

        try {
            const handler = new ItemComponentHandler({
                getItem: () => item,
                getItemType: () => item.type,
                getItemQuality: () => item.quality,
                noDrag: true,
            });
            const itemComp = ItemComponent.create(handler);
            if (itemComp) {
                itemComp.style.set("flex-shrink", "0");
                itemComp.style.set("margin-right", "5px");
                row.append(itemComp);
            }
        } catch (error) {
            this.debugLog("Failed to create split selection item icon.", { itemId: getItemId(item), itemType: item.type, error });
        }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

        if (semantic === "used" && !disabled) {
            this.appendRemainingUsesHint(row.element, item, getCraftDurabilityLoss(item), false);
        }

        if (disabledRole !== undefined) {
            const disabledText = document.createElement("span");
            disabledText.textContent = this.getReservationRoleLabel(disabledRole);
            disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
            row.element.appendChild(disabledText);
        }

        const check = new CheckButton();
        check.style.set("pointer-events", "none");
        check.style.set("margin-left", "4px");
        check.style.set("flex-shrink", "0");
        check.style.set("background", "transparent");
        check.style.set("background-color", "transparent");
        check.style.set("border", "none");
        check.style.set("box-shadow", "none");
        check.style.set("padding", "0");
        if (isSelected) check.setChecked(true, false);
        row.append(check);

        row.event.subscribe("activate", () => {
            if (disabled) return;

            const nextSelection = this.getSplitSelection(slotIndex);
            const target = semantic === "consumed" ? [...nextSelection.consumed] : [...nextSelection.used];
            const existingIndex = target.indexOf(item);
            if (existingIndex >= 0) {
                target.splice(existingIndex, 1);
            } else {
                if (target.length >= maxSelect) {
                    if (maxSelect !== 1 || target.length === 0) return;
                    target.splice(0, target.length, item);
                } else {
                    target.unshift(item);
                }
            }

            if (semantic === "consumed") {
                this.setSplitSelection(slotIndex, target, nextSelection.used);
                this.setExplicitSelection("normal", slotIndex, "consumed", "consumed", target);
                this.updateCounter(slotIndex, maxSelect, "consumed");
            } else {
                this.setSplitSelection(slotIndex, nextSelection.consumed, target);
                this.setExplicitSelection("normal", slotIndex, "used", "used", target);
                this.updateCounter(slotIndex, maxSelect, "used");
            }

            this.rebuildNormalContent(false);
        });

        parent.append(row);
    }

    // ── Bulk content builders ─────────────────────────────────────────────────

    /**
     * Rebuilds the bulk tab content. Clears exclusion state for slots that no
     * longer have items, resets the quantity to 1, and redraws all sections.
     */
    private buildBulkContent(preserveScroll = false, preserveQuantity = false): void {
        this.debugLog("BuildBulkContent", {
            preserveScroll,
            preserveQuantity,
            itemType: this.itemType,
            hasRecipe: this.recipe !== undefined,
            bulkQuantity: this.bulkQuantity,
        });
        const scrollTop = preserveScroll ? this.bulkScrollContent.element.scrollTop : 0;
        const scrollLeft = preserveScroll ? this.bulkScrollContent.element.scrollLeft : 0;
        this._bulkContentDirty = false;
        this.bulkStaticContent.dump();
        this.bulkScrollInner.dump();

        if (!this.recipe) {
            const noRecipe = new Text();
            noRecipe.setText(TranslationImpl.generator("No recipe found for this item."));
            noRecipe.style.set("color", "#ff6666");
            this.bulkScrollInner.append(noRecipe);
            this.updateBulkCraftBtnState(this.computeBulkUiLimits());
            this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
            return;
        }

        // Only clear exclusions when the recipe actually changes — preserve them across
        // batches for the same recipe so the user doesn't have to re-exclude every time.
        if (this.itemType !== this._lastBulkItemType) {
            this.bulkExcludedIds.clear();
            this.bulkPreserveDurabilityBySlot.clear();
            this.bulkPinnedToolSelections.clear();
            this.bulkPinnedUsedSelections.clear();
            this._lastBulkItemType = this.itemType;
        }
        this.normalizeBulkSelectionsForRender();

        this.buildOutputCard(this.itemType as ItemType, this.recipe, true);
        this.addBulkHelpBox();
        this.addBulkMaterialsHeader();

        if (this.recipe!.baseComponent !== undefined) {
            this.addBulkComponentSection(-1, this.recipe.baseComponent, 1, "tool");
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            if (comp.consumedAmount > 0) {
                this.addBulkComponentSection(i, comp.type, getConsumedSelectionCount(comp.requiredAmount, comp.consumedAmount), "consumed");
            }
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            if (this.isSplitComponent(comp)) {
                this.addBulkComponentSection(i, comp.type, getUsedSelectionCount(comp.requiredAmount, comp.consumedAmount), "used");
            }
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            if (comp.consumedAmount <= 0) {
                this.addBulkComponentSection(i, comp.type, comp.requiredAmount, "tool");
            }
        }

        if (!preserveQuantity) {
            this.bulkQuantity = 1;
            if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = "1";
        }
        const limits = this.computeBulkUiLimits();
        this.updateBulkMaxDisplay(limits);
        this.updateBulkCraftBtnState(limits);
        this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
    }

    private buildDismantleContent(preserveScroll = false): void {
        this.debugLog("BuildDismantleContent", {
            preserveScroll,
            itemType: this.dismantleSelectedItemType,
            hasDismantle: this.dismantleDescription !== undefined,
            bulkQuantity: this.bulkQuantity,
        });
        const scrollTop = preserveScroll ? this.bulkScrollContent.element.scrollTop : 0;
        const scrollLeft = preserveScroll ? this.bulkScrollContent.element.scrollLeft : 0;
        this.bulkStaticContent.dump();
        this.bulkScrollInner.dump();

        const itemType = this.dismantleSelectedItemType;
        const dismantle = this.dismantleDescription;
        if (!itemType || !dismantle) {
            const noDismantle = new Text();
            noDismantle.setText(TranslationImpl.generator("No dismantle data found for this item."));
            noDismantle.style.set("color", "#ff6666");
            this.bulkScrollInner.append(noDismantle);
            this.updateBulkCraftBtnState(this.computeBulkUiLimits());
            this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
            return;
        }

        this.buildDismantleHeaderCard(itemType, dismantle);
        this.addDismantleHelpBox();
        this.addDismantleTargetSection(itemType);
        if (dismantle.required !== undefined) {
            this.addDismantleRequiredSection(dismantle.required);
        }

        const limits = this.computeBulkUiLimits();
        this.bulkQuantity = Math.max(1, Math.min(this.bulkQuantity, limits.max || 1));
        if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
        this.updateBulkMaxDisplay(limits);
        this.updateBulkCraftBtnState(limits);
        this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
    }

    private buildDismantleHeaderCard(itemType: ItemType, dismantle: IDismantleDescription): void {
        const theme = SCREEN_THEME.dismantle;
        const card = new Component();
        card.classes.add("bc-dismantle-header-card");
        card.style.set("flex", "1 1 100%");
        card.style.set("width", "100%");
        card.style.set("box-sizing", "border-box");
        card.style.set("padding", "8px");
        card.style.set("border", "1px solid var(--color-border, #554433)");
        card.style.set("border-radius", "3px");
        card.style.set("display", "flex");
        card.style.set("flex-direction", "column");
        card.style.set("gap", "8px");

        const headerRow = document.createElement("div");
        headerRow.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;";

        const iconHolder = document.createElement("div");
        iconHolder.style.cssText = "flex-shrink:0;display:flex;";
        try {
            const handler = new ItemComponentHandler({ getItemType: () => itemType, noDrag: true });
            const iconComp = ItemComponent.create(handler);
            if (iconComp) iconHolder.appendChild(iconComp.element);
        } catch (error) {
            if (this.debugLoggingEnabled) {
                console.error("[Better Crafting] Failed to create dismantle item icon", error);
            }
        }
        headerRow.appendChild(iconHolder);

        const title = document.createElement("div");
        title.className = "bc-dismantle-header-title";
        title.textContent = this.formatEnumName(ItemType[itemType] || `Item ${itemType}`);
        title.style.cssText = `font-size:1.2em;font-weight:600;color:${theme.title};`;
        headerRow.appendChild(title);
        card.element.appendChild(headerRow);

        const outputTitle = document.createElement("div");
        outputTitle.className = "bc-dismantle-output-title";
        outputTitle.textContent = "Produces";
        outputTitle.style.cssText = `font-size:0.92em;font-weight:600;color:${theme.body};`;
        card.element.appendChild(outputTitle);

        const outputList = document.createElement("div");
        outputList.className = "bc-dismantle-output-list";

        for (const output of dismantle.items) {
            const row = document.createElement("div");
            row.className = "bc-dismantle-output-entry";

            try {
                const handler = new ItemComponentHandler({ getItemType: () => output.type, noDrag: true });
                const iconComp = ItemComponent.create(handler);
                if (iconComp) {
                    iconComp.style.set("flex-shrink", "0");
                    row.appendChild(iconComp.element);
                }
        } catch (error) {
            if (this.debugLoggingEnabled) {
                console.error("[Better Crafting] Failed to create dismantle output icon", error);
            }
        }

            const label = document.createElement("span");
            label.textContent = `${output.amount}x ${this.formatEnumName(ItemType[output.type] || `Item ${output.type}`)}`;
            label.style.color = theme.accent;
            row.appendChild(label);
            outputList.appendChild(row);
        }

        card.element.appendChild(outputList);
        this.bulkStaticContent.append(card);
    }

    private addDismantleHelpBox(): void {
        this.addHelpBox("dismantle", "How This Works", [
            ["Consumed", "Selected targets are dismantled and consumed by the action."],
            ["Used", "Required items are needed for the action but are not consumed."],
            ["Tool", "Tool rows stay after the action and lose durability as normal."],
            ["Safe", "Safe blocks low-stamina dismantling and damage-based bulk aborts for this screen."],
            ["Protect", "Protect keeps one durability on the required row instead of letting it break."],
            ["Hotkey", `Current hotkey: ${this.getCurrentHotkeyText()}. ${this.getActivationModeText()}`],
        ]);
    }

    private addDismantleRequiredSection(required: ItemTypeGroup): void {
        const section = this.createSection();
        const labelRow = this.createLabelRow();

        const items = this.findMatchingItems(required);
        const visibleItems = this.getFilteredSortedSectionItems("dismantle", -2, "tool", items);
        const selectableItems = this.getSelectableDismantleRequiredItems(visibleItems);
        if (this.shouldReselectSection("dismantle", -2, "tool") || this.shouldReselectSectionForSort("dismantle", -2, "tool")) {
            this.dismantleRequiredSelection = selectableItems[0];
            this.clearSectionReselect("dismantle", -2, "tool");
            this.clearSectionSortReselect("dismantle", -2, "tool");
        } else if (!this.dismantleRequiredSelection || !selectableItems.includes(this.dismantleRequiredSelection)) {
            this.dismantleRequiredSelection = undefined;
        }

        this.appendSectionHeader(labelRow, this.getTypeName(required), this.formatAvailableCount(visibleItems.length, items.length), "tool");
        this.appendDismantleDurabilityControls(labelRow);
        section.append(labelRow);
        this.appendSectionControls(section, "dismantle", -2, "tool", () => this.buildDismantleContent(true));

        const itemsContainer = this.createItemsContainer();
        section.append(itemsContainer);
        if (visibleItems.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            for (const item of visibleItems) {
                this.addDismantleRequiredRow(itemsContainer, item);
            }
        }

        this.bulkScrollInner.append(section);
    }

    private addDismantleTargetSection(itemType: ItemType): void {
        const section = this.createSection();
        const labelRow = this.createLabelRow();
        const items = this.findMatchingItems(itemType);
        const visibleItems = this.getFilteredSortedSectionItems("dismantle", -1, "consumed", items);
        if (this.shouldReselectSection("dismantle", -1, "consumed")) {
            const eligibleVisibleItems = visibleItems.filter(item => !isItemProtected(item) && !this.isReservedDismantleRequiredItem(item));
            const includedIds = new Set(eligibleVisibleItems.slice(0, this.bulkQuantity).map(item => getItemId(item)).filter((id): id is number => id !== undefined));
            this.dismantleExcludedIds.clear();
            for (const item of items) {
                const itemId = getItemId(item);
                if (itemId === undefined) continue;
                if (isItemProtected(item) || this.isReservedDismantleRequiredItem(item) || !includedIds.has(itemId)) {
                    this.dismantleExcludedIds.add(itemId);
                }
            }
            this.clearSectionReselect("dismantle", -1, "consumed");
        }

        this.appendSectionHeader(labelRow, this.getTypeName(itemType), this.formatAvailableCount(visibleItems.length, items.length), "consumed");
        section.append(labelRow);
        this.appendSectionControls(section, "dismantle", -1, "consumed", () => this.buildDismantleContent(true));

        const itemsContainer = this.createItemsContainer();
        section.append(itemsContainer);
        if (visibleItems.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            for (const item of visibleItems) {
                this.addDismantleTargetRow(itemsContainer, item);
            }
        }

        this.bulkScrollInner.append(section);
    }

    private addDismantleRequiredRow(parent: Component, item: Item): void {
        const qualityColor = getQualityColor(item.quality);
        const selected = () => this.dismantleRequiredSelection === item;
        const disabled = this.isIncludedDismantleTargetItem(item) && !selected();
        const borderBase = `1px solid ${qualityColor}33`;
        const borderHover = `1px solid ${qualityColor}77`;
        const borderSelected = `1px solid ${qualityColor}`;

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", disabled ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");
        row.style.set("border", selected() ? borderSelected : borderBase);
        row.style.set("background", selected() ? "rgba(156, 74, 53, 0.14)" : disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
        if (disabled) row.style.set("opacity", "0.7");

        const qualityName = getQualityName(item.quality);
        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        this.bindTooltipRowHandlers(row, item, displayName, {
            onEnter: () => {
                if (!selected() && !disabled) {
                    row.style.set("background", "rgba(255, 255, 255, 0.05)");
                    row.style.set("border", borderHover);
                }
            },
            onLeave: () => {
                if (!selected()) {
                    row.style.set("background", disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
                    row.style.set("border", borderBase);
                }
            },
        });

        try {
            const handler = new ItemComponentHandler({
                getItem:        () => item,
                getItemType:    () => item.type,
                getItemQuality: () => item.quality,
                noDrag: true,
            });
            const itemComp = ItemComponent.create(handler);
            if (itemComp) {
                itemComp.style.set("flex-shrink", "0");
                itemComp.style.set("margin-right", "5px");
                row.append(itemComp);
            }
        } catch (error) {
            if (this.debugLoggingEnabled) {
                console.error("[Better Crafting] Failed to create dismantle required row icon", error);
            }
        }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

        this.appendRemainingUsesHint(row.element, item, getDismantleDurabilityLoss(item, ActionType.Dismantle), this.preserveDismantleRequiredDurability);

        if (disabled) {
            const disabledText = document.createElement("span");
            disabledText.textContent = this.getReservationRoleLabel("target");
            disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
            row.element.appendChild(disabledText);
        }

        const check = new CheckButton();
        check.style.set("pointer-events", "none");
        check.style.set("margin-left", "4px");
        check.style.set("flex-shrink", "0");
        check.style.set("background", "transparent");
        check.style.set("background-color", "transparent");
        check.style.set("border", "none");
        check.style.set("box-shadow", "none");
        check.style.set("padding", "0");
        if (selected()) check.setChecked(true, false);
        row.append(check);

        row.event.subscribe("activate", () => {
            if (disabled) return;
            if (this.dismantleRequiredSelection === item) return;
            this.dismantleRequiredSelection = item;
            this.buildDismantleContent(false);
        });

        parent.append(row);
    }

    private appendBulkDurabilityControls(labelRow: Component, slotIndex: number): void {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex;align-items:center;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;background:transparent;padding:0;border:0;";

        const label = document.createElement("span");
        label.textContent = "Protect?";
        label.style.cssText = "font-weight:bold;color:inherit;";
        wrapper.appendChild(label);

        const protect = new CheckButton();
        protect.setChecked(this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true, false);
        protect.style.set("background", "transparent");
        protect.style.set("background-color", "transparent");
        protect.style.set("border", "none");
        protect.style.set("box-shadow", "none");
        protect.style.set("padding", "0");
        protect.style.set("margin", "0");
        protect.event.subscribe("toggle", (_: unknown, checked: boolean) => {
            this.bulkPreserveDurabilityBySlot.set(slotIndex, checked);
            const limits = this.computeBulkUiLimits();
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
            this.buildBulkContent(false, true);
        });
        wrapper.appendChild(protect.element);
        wrapper.appendChild(this.createInfoIcon("Protect?", [
            "Keep one durability on the row's item instead of fully using it.",
            "Used and tool rows show the resulting remaining uses.",
        ]));

        labelRow.element.appendChild(wrapper);
    }

    private appendDismantleDurabilityControls(labelRow: Component): void {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex;align-items:center;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;background:transparent;padding:0;border:0;";

        const label = document.createElement("span");
        label.textContent = "Protect?";
        label.style.cssText = "font-weight:bold;color:inherit;";
        wrapper.appendChild(label);

        const protect = new CheckButton();
        protect.setChecked(this.preserveDismantleRequiredDurability, false);
        protect.style.set("background", "transparent");
        protect.style.set("background-color", "transparent");
        protect.style.set("border", "none");
        protect.style.set("box-shadow", "none");
        protect.style.set("padding", "0");
        protect.style.set("margin", "0");
        protect.event.subscribe("toggle", (_: unknown, checked: boolean) => {
            this.preserveDismantleRequiredDurability = checked;
            const limits = this.computeBulkUiLimits();
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
            this.buildDismantleContent(false);
        });
        wrapper.appendChild(protect.element);
        wrapper.appendChild(this.createInfoIcon("Protect?", [
            "Keep one durability on the required item instead of fully using it.",
            "Required rows show the resulting remaining uses.",
        ]));

        labelRow.element.appendChild(wrapper);
    }

    private getMaxUsesText(item: Item, perUseLoss: number, protect: boolean): string {
        if (perUseLoss <= 0) return "";
        const maxUses = getRemainingDurabilityUses(item.durability, perUseLoss, protect);
        if (maxUses >= Number.MAX_SAFE_INTEGER || maxUses <= 0) return "";
        return `uses remaining ${maxUses}`;
    }

    private appendRemainingUsesHint(parent: HTMLElement, item: Item, perUseLoss: number, protect: boolean): void {
        const text = this.getMaxUsesText(item, perUseLoss, protect);
        if (!text) return;

        const hint = document.createElement("span");
        hint.style.cssText = "color:#7a6850;font-size:0.8em;margin-left:6px;white-space:nowrap;";
        hint.textContent = text;
        parent.appendChild(hint);
    }

    private addDismantleTargetRow(parent: Component, item: Item): void {
        const itemId = getItemId(item);
        const qualityColor = getQualityColor(item.quality);
        const lockedByRequired = this.isReservedDismantleRequiredItem(item);
        const locked = isItemProtected(item) || lockedByRequired;
        if (locked && itemId !== undefined) this.dismantleExcludedIds.add(itemId);

        const row = this.createSelectionRow(item, qualityColor, locked);
        const indicator = document.createElement("span");
        indicator.style.cssText = "font-size:0.85em;margin-left:4px;color:#cc4444;flex-shrink:0;";
        row.element.appendChild(indicator);

        const sync = () => {
            const excluded = locked || (itemId !== undefined && this.dismantleExcludedIds.has(itemId));
            this.applySelectionRowState(row.element, !excluded, qualityColor);
            indicator.textContent = lockedByRequired ? this.getReservationRoleLabel("required") : excluded ? "✕" : "";
            if (excluded) {
                row.classes.add("bc-bulk-row-excluded");
            } else {
                row.classes.remove("bc-bulk-row-excluded");
            }
        };

        sync();

        if (!locked) {
            row.event.subscribe("activate", () => {
                if (itemId !== undefined && this.dismantleExcludedIds.has(itemId)) {
                    this.dismantleExcludedIds.delete(itemId);
                } else {
                    if (itemId !== undefined) {
                        this.dismantleExcludedIds.add(itemId);
                    }
                }
                const max = this.computeDismantleMax();
                if (max > 0 && this.bulkQuantity > max) {
                    this.bulkQuantity = max;
                    if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
                }
                sync();
                const limits = this.computeBulkUiLimits();
                this.updateBulkMaxDisplay(limits);
                this.updateBulkCraftBtnState(limits);
            });
        }

        parent.append(row);
    }

    private createSelectionRow(item: Item, qualityColor: string, locked: boolean): Button {
        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", locked ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");

        if (locked) {
            const badge = document.createElement("span");
            badge.textContent = "🔒";
            badge.style.cssText = "font-size:0.75em;margin-right:4px;opacity:0.6;";
            row.element.appendChild(badge);
        }

        try {
            const handler = new ItemComponentHandler({
                getItem: () => item,
                getItemType: () => item.type,
                getItemQuality: () => item.quality,
                noDrag: true,
            });
            const itemComp = ItemComponent.create(handler);
            if (itemComp) {
                itemComp.style.set("flex-shrink", "0");
                itemComp.style.set("margin-right", "5px");
                row.append(itemComp);
            }
        } catch (error) {
            if (this.debugLoggingEnabled) {
                console.error("[Better Crafting] Failed to create selection row icon", error);
            }
        }

        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }
        const qualityName = getQualityName(item.quality);
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        this.bindTooltipRowHandlers(row, item, displayName);

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        row.append(nameText);

        return row;
    }

    private applySelectionRowState(element: HTMLElement, selected: boolean, qualityColor: string): void {
        element.style.border = selected ? `1px solid ${qualityColor}` : `1px solid ${qualityColor}33`;
        element.style.background = selected ? "rgba(156, 74, 53, 0.14)" : "transparent";
    }

    private getCurrentHotkeyText(): string {
        return this.activationHotkey;
    }

    private getActivationModeText(): string {
        return this.getSettings().activationMode === "holdHotkeyToBypass"
            ? "Hold hotkey to bypass Better Crafting UI."
            : "Hold hotkey to access Better Crafting UI.";
    }

    private resetHelpBoxStates(): void {
        this.helpBoxExpanded.normal = false;
        this.helpBoxExpanded.bulk = false;
        this.helpBoxExpanded.dismantle = false;
    }

    private addHelpBox(mode: HelpBoxId, titleText: string, rows: ReadonlyArray<readonly [label: string, content: HelpBoxRowContent]>): void {
        const container = this.makeFullWidthWrapper();

        const wrapper = document.createElement("div");
        wrapper.className = `bc-help-box ${this.helpBoxExpanded[mode] ? "bc-help-box-expanded" : "bc-help-box-collapsed"}`;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "bc-help-box-toggle";
        toggle.setAttribute("aria-expanded", String(this.helpBoxExpanded[mode]));

        const caret = document.createElement("span");
        caret.className = "bc-help-box-caret";
        caret.textContent = ">";
        toggle.appendChild(caret);

        const title = document.createElement("span");
        title.className = "bc-help-box-title";
        title.textContent = titleText;
        toggle.appendChild(title);

        const content = document.createElement("div");
        content.className = "bc-help-box-content";
        content.style.display = this.helpBoxExpanded[mode] ? "" : "none";

        for (const [label, rowContent] of rows) {
            content.appendChild(createHelpBoxRow(label, rowContent));
        }

        toggle.addEventListener("click", () => {
            const expanded = !this.helpBoxExpanded[mode];
            this.helpBoxExpanded[mode] = expanded;
            wrapper.classList.toggle("bc-help-box-expanded", expanded);
            wrapper.classList.toggle("bc-help-box-collapsed", !expanded);
            toggle.setAttribute("aria-expanded", String(expanded));
            content.style.display = expanded ? "" : "none";
        });

        wrapper.appendChild(toggle);
        wrapper.appendChild(content);
        container.element.appendChild(wrapper);
        if (mode === "normal") {
            this.normalStaticContent.append(container);
        } else {
            this.bulkStaticContent.append(container);
        }
    }

    private addNormalHelpBox(): void {
        this.addHelpBox("normal", "How This Works", [
            ["Consumed", "Consumed items are destroyed when you complete the craft."],
            ["Used", "Used items are required for the craft but are not consumed."],
            ["Tool", "Tool rows stay after the craft and lose durability as normal."],
            ["Safe", "Safe blocks low-stamina crafting for this screen. Turn it off to ignore stamina limits."],
            ["Quality", "Result quality depends on your crafting skill."],
            ["Hotkey", `Current hotkey: ${this.getCurrentHotkeyText()}. ${this.getActivationModeText()}`],
        ]);
    }

    /**
     * Renders a static info callout explaining how bulk crafting works.
     * Placed between the output card and the ingredient sections.
     */
    private addBulkHelpBox(): void {
        this.addHelpBox("bulk", "How This Works", [
            ["Consumed", "Consumed items are destroyed when the craft completes."],
            ["Used", "Used items are required for the craft but are not consumed."],
            ["Tool", "Tool rows stay after the craft and lose durability as normal."],
            ["Safe", "Safe blocks low-stamina crafting and damage-based bulk aborts for this screen."],
            ["Protect", "Protect keeps one durability on used and tool rows instead of letting them break."],
            ["Hotkey", `Current hotkey: ${this.getCurrentHotkeyText()}. ${this.getActivationModeText()}`],
        ]);
    }

    /**
     * Renders a divider header labelling the ingredients grid with the
     * "click to exclude" call-to-action.
     */
    private addBulkMaterialsHeader(): void {
        const el = document.createElement("div");
        el.className = "bc-bulk-materials-header";
        el.textContent = "Materials - Click to Exclude";

        const container = this.makeFullWidthWrapper();
        container.element.appendChild(el);
        this.bulkStaticContent.append(container);
    }

    private addBulkComponentSection(
        slotIndex: number,
        type: ItemType | ItemTypeGroup,
        requiredAmount: number,
        semantic: "consumed" | "used" | "tool",
    ): void {
        const section = this.createSection();
        // Blue theme CSS selector targets this class on bulk sections.
        section.classes.add("bc-bulk-section");

        const labelRow = this.createLabelRow();
        const prefix = slotIndex === -1 ? "Base: " : "";
        const items = this.findMatchingItems(type);
        const sectionSemantic: SectionSemantic = slotIndex === -1 ? "base" : semantic;
        const sortedVisibleItems = this.getFilteredSortedSectionItems("bulk", slotIndex, sectionSemantic, items);
        const reservedNonconsumedIds = this.getBulkReservedNonconsumedIds();
        const isConsumedSide = sectionSemantic === "base" || semantic === "consumed";
        const visibleItems = sortedVisibleItems;
        const availableCount = items.filter(item => {
            const itemId = getItemId(item);
            const excludedIds = this.bulkExcludedIds.get(slotIndex) ?? new Set<number>();
            if (semantic === "used") {
                return itemId === undefined || !excludedIds.has(itemId);
            }

            if (isConsumedSide) {
                return itemId === undefined || (!excludedIds.has(itemId) && !reservedNonconsumedIds.has(itemId));
            }

            return true;
        }).length;
        this.appendSectionHeader(labelRow, `${prefix}${this.getTypeName(type)} ×${requiredAmount}`, this.formatAvailableCount(visibleItems.length, availableCount), sectionSemantic);
        if ((semantic === "tool" || semantic === "used") && slotIndex >= 0) {
            this.appendBulkDurabilityControls(labelRow, slotIndex);
        }
        section.append(labelRow);
        this.appendSectionControls(section, "bulk", slotIndex, sectionSemantic, () => this.buildBulkContent(true, true));

        const itemsContainer = this.createItemsContainer();
        section.append(itemsContainer);
        if (visibleItems.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            if (!this.bulkExcludedIds.has(slotIndex)) {
                this.bulkExcludedIds.set(slotIndex, new Set<number>());
            }
            for (const item of visibleItems) {
                if (semantic === "consumed" || slotIndex < 0) {
                    this.addBulkItemRow(itemsContainer, slotIndex, item);
                } else if (semantic === "used") {
                    this.addBulkUsedRow(itemsContainer, slotIndex, item, requiredAmount);
                } else {
                    this.addBulkToolRow(itemsContainer, slotIndex, item, requiredAmount);
                }
            }
        }

        this.bulkScrollInner.append(section);
    }

    private getBulkReservedNonconsumedIds(): Set<number> {
        const reservedIds = new Set<number>();
        const addSelectionIds = (selections: Map<number, Item[]>): void => {
            for (const [, items] of selections) {
                for (const item of items) {
                    const itemId = getItemId(item);
                    if (itemId !== undefined) reservedIds.add(itemId);
                }
            }
        };

        addSelectionIds(this.bulkPinnedUsedSelections);
        addSelectionIds(this.bulkPinnedToolSelections);
        return reservedIds;
    }

    private getBulkReservedNonconsumedRole(item: Item, currentRole?: SelectionReservationRole): SelectionReservationRole | undefined {
        const itemId = getItemId(item);
        if (itemId === undefined) return undefined;

        for (const [, items] of this.bulkPinnedUsedSelections) {
            if (items.some(selected => getItemId(selected) === itemId)) {
                return currentRole === "used" ? undefined : "used";
            }
        }

        for (const [, items] of this.bulkPinnedToolSelections) {
            if (items.some(selected => getItemId(selected) === itemId)) {
                return currentRole === "tool" ? undefined : "tool";
            }
        }

        return undefined;
    }

    private normalizeBulkSelectionsForRender(): void {
        if (!this.recipe) return;

        const bulkPrefix = `bulk:${this.itemType ?? 0}:`;
        const explicitEntries = [...this.explicitSelections.entries()].filter(([key]) => key.startsWith(bulkPrefix));
        const reservations = this.collectExplicitReservations(explicitEntries);
        const repairBulkRole = (
            slotIndex: number,
            type: ItemType | ItemTypeGroup,
            semantic: "used" | "tool",
            current: readonly Item[],
            maxCount: number,
        ): Item[] => {
            const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, semantic, this.findMatchingItems(type)).filter(item => {
                const itemId = getItemId(item);
                return itemId !== undefined
                    && !isItemProtected(item)
                    && (semantic !== "used" || !(this.bulkExcludedIds.get(slotIndex)?.has(itemId) ?? false));
            });
            const forceTopVisible = current.length === 0
                || this.shouldReselectSection("bulk", slotIndex, semantic)
                || this.shouldReselectSectionForSort("bulk", slotIndex, semantic);
            const repaired = this.repairSelectedItemsForRole(current, candidates, maxCount, reservations, semantic, forceTopVisible);
            this.clearSectionReselect("bulk", slotIndex, semantic);
            this.clearSectionSortReselect("bulk", slotIndex, semantic);
            this.pruneExplicitSelection("bulk", slotIndex, semantic, repaired);
            this.reserveItemsForRole(reservations, repaired, semantic);
            return repaired;
        };

        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            if (!this.isSplitComponent(comp)) continue;

            this.bulkPinnedUsedSelections.set(
                i,
                repairBulkRole(i, comp.type, "used", this.bulkPinnedUsedSelections.get(i) ?? [], getUsedSelectionCount(comp.requiredAmount, comp.consumedAmount)),
            );
        }

        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            if (comp.consumedAmount > 0) continue;

            this.bulkPinnedToolSelections.set(
                i,
                repairBulkRole(i, comp.type, "tool", this.bulkPinnedToolSelections.get(i) ?? [], comp.requiredAmount),
            );
        }
    }

    private addBulkItemRow(parent: Component, slotIndex: number, item: Item): void {
        const qualityColor = getQualityColor(item.quality);
        const itemId = getItemId(item);
        const reservedRole = this.getBulkReservedNonconsumedRole(item);

        // Protected items are excluded by default and cannot be un-excluded.
        const autoExcluded = isItemProtected(item);
        if (autoExcluded) {
            const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set<number>();
            if (itemId !== undefined) {
                excludedSet.add(itemId);
            }
            this.bulkExcludedIds.set(slotIndex, excludedSet);
        }

        const isReservedSelection = () => reservedRole !== undefined;
        const isExcluded = () => itemId !== undefined && ((this.bulkExcludedIds.get(slotIndex)?.has(itemId) ?? false) || isReservedSelection());

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", autoExcluded || isReservedSelection() ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");
        row.style.set("border", `1px solid ${qualityColor}33`);
        row.style.set("background", "transparent");

        if (autoExcluded || isReservedSelection()) {
            row.classes.add("bc-bulk-row-excluded");
        }

        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }
        const qualityName = getQualityName(item.quality);
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        if (autoExcluded) {
            const badge = document.createElement("span");
            badge.textContent = "🔒";
            badge.style.cssText = "font-size:0.75em;margin-right:4px;opacity:0.6;";
            row.element.appendChild(badge);
        }

        try {
            const handler = new ItemComponentHandler({
                getItem:        () => item,
                getItemType:    () => item.type,
                getItemQuality: () => item.quality,
                noDrag: true,
            });
            const itemComp = ItemComponent.create(handler);
            if (itemComp) {
                itemComp.style.set("flex-shrink", "0");
                itemComp.style.set("margin-right", "5px");
                row.append(itemComp);
            }
        } catch (error) {
            this.debugLog("Failed to create bulk consumed item icon.", { itemId: getItemId(item), itemType: item.type, error });
        }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

        const exclIndicator = document.createElement("span");
        exclIndicator.style.cssText = "font-size:0.85em;margin-left:4px;color:#cc4444;flex-shrink:0;";
        exclIndicator.textContent = reservedRole !== undefined ? this.getReservationRoleLabel(reservedRole) : isExcluded() ? "✗" : "";
        row.element.appendChild(exclIndicator);

        this.bindTooltipRowHandlers(row, item, displayName, !autoExcluded && !isReservedSelection()
            ? {
                onEnter: () => {
                    if (!isExcluded()) {
                        row.style.set("background", "rgba(255, 255, 255, 0.05)");
                        row.style.set("border", `1px solid ${qualityColor}55`);
                    }
                },
                onLeave: () => {
                    if (!isExcluded()) {
                        row.style.set("background", "transparent");
                        row.style.set("border", `1px solid ${qualityColor}33`);
                    }
                },
            }
            : undefined);

        if (!autoExcluded && !isReservedSelection()) {
            row.event.subscribe("activate", () => {
                const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set<number>();
                if (itemId !== undefined && excludedSet.has(itemId)) {
                    excludedSet.delete(itemId);
                    row.classes.remove("bc-bulk-row-excluded");
                    exclIndicator.textContent = "";
                    row.style.set("background", "transparent");
                    row.style.set("border", `1px solid ${qualityColor}33`);
                } else {
                    if (itemId !== undefined) {
                        excludedSet.add(itemId);
                    }
                    row.classes.add("bc-bulk-row-excluded");
                    exclIndicator.textContent = "✗";
                    row.style.set("background", "transparent");
                    row.style.set("border", `1px solid ${qualityColor}33`);
                }
                this.bulkExcludedIds.set(slotIndex, excludedSet);
                this.buildBulkContent(false, true);
            });
        }

        parent.append(row);
    }

    private addBulkUsedRow(parent: Component, slotIndex: number, item: Item, maxSelect: number): void {
        const qualityColor = getQualityColor(item.quality);
        const itemId = getItemId(item);
        const excludedIds = this.bulkExcludedIds.get(slotIndex) ?? new Set<number>();
        const isSelected = () => (this.bulkPinnedUsedSelections.get(slotIndex) ?? []).some(entry => getItemId(entry) === itemId);
        const reservedRole = this.getBulkReservedNonconsumedRole(item, "used");
        const isDisabled = () => itemId !== undefined && (excludedIds.has(itemId) || reservedRole !== undefined);
        const preSelected = isSelected();

        const borderBase = `1px solid ${qualityColor}33`;
        const borderHover = `1px solid ${qualityColor}77`;
        const borderSelected = `1px solid ${qualityColor}`;

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", isDisabled() ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");
        row.style.set("border", preSelected ? borderSelected : borderBase);
        row.style.set("background", preSelected ? "rgba(30, 255, 128, 0.1)" : isDisabled() ? "rgba(255, 80, 80, 0.05)" : "transparent");
        if (isDisabled()) row.style.set("opacity", "0.7");

        const qualityName = getQualityName(item.quality);
        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        row.addEventListener("mouseenter", (e: MouseEvent) => {
            this._hoveredItem = item;
            this._hoveredDisplayName = displayName;
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;

            if (!isSelected() && !isDisabled()) {
                row.style.set("background", "rgba(255, 255, 255, 0.05)");
                row.style.set("border", borderHover);
            }

            if (this.shiftHeld) {
                this.bcShowTooltip(item, displayName, e.clientX, e.clientY);
            }
        });

        row.addEventListener("mousemove", (e: MouseEvent) => {
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;
            if (this.shiftHeld && this.bcTooltipEl && this.bcTooltipEl.style.display !== "none") {
                this.bcPositionTooltip(e.clientX, e.clientY);
            }
        });

        row.addEventListener("mouseleave", () => {
            this._hoveredItem = null;
            this.bcHideTooltip();
            if (!isSelected()) {
                row.style.set("background", isDisabled() ? "rgba(255, 80, 80, 0.05)" : "transparent");
                row.style.set("border", borderBase);
            }
        });

        try {
            const handler = new ItemComponentHandler({
                getItem: () => item,
                getItemType: () => item.type,
                getItemQuality: () => item.quality,
                noDrag: true,
            });
            const itemComp = ItemComponent.create(handler);
            if (itemComp) {
                itemComp.style.set("flex-shrink", "0");
                itemComp.style.set("margin-right", "5px");
                row.append(itemComp);
            }
        } catch (error) {
            this.debugLog("Failed to create bulk used item icon.", { itemId: getItemId(item), itemType: item.type, error });
        }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

        if (!isDisabled()) {
            this.appendRemainingUsesHint(row.element, item, getCraftDurabilityLoss(item), this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true);
        }

        if (isDisabled()) {
            const disabledText = document.createElement("span");
            disabledText.textContent = reservedRole !== undefined ? this.getReservationRoleLabel(reservedRole) : "Excluded";
            disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
            row.element.appendChild(disabledText);
        }

        const check = new CheckButton();
        check.style.set("pointer-events", "none");
        check.style.set("margin-left", "4px");
        check.style.set("flex-shrink", "0");
        check.style.set("background", "transparent");
        check.style.set("background-color", "transparent");
        check.style.set("border", "none");
        check.style.set("box-shadow", "none");
        check.style.set("padding", "0");
        if (preSelected) check.setChecked(true, false);
        row.append(check);

        row.event.subscribe("activate", () => {
            if (isDisabled()) return;

            const selected = this.bulkPinnedUsedSelections.get(slotIndex) ?? [];
            const idx = selected.findIndex(entry => getItemId(entry) === itemId);
            if (idx >= 0) {
                selected.splice(idx, 1);
            } else {
                if (selected.length >= maxSelect) {
                    if (maxSelect !== 1 || selected.length === 0) return;
                    selected.splice(0, selected.length, item);
                } else {
                    selected.unshift(item);
                }
            }

            this.bulkPinnedUsedSelections.set(slotIndex, [...selected]);
            this.setExplicitSelection("bulk", slotIndex, "used", "used", selected);
            this.buildBulkContent(false, true);
        });

        parent.append(row);
    }

    private addBulkToolRow(parent: Component, slotIndex: number, item: Item, maxSelect: number): void {
        const qualityColor = getQualityColor(item.quality);
        const itemId = getItemId(item);
        const isSelected = () => (this.bulkPinnedToolSelections.get(slotIndex) ?? []).some(entry => getItemId(entry) === itemId);
        const reservedRole = this.getBulkReservedNonconsumedRole(item, "tool");
        const isDisabled = () => reservedRole !== undefined;
        const preSelected = isSelected();

        const borderBase = `1px solid ${qualityColor}33`;
        const borderHover = `1px solid ${qualityColor}77`;
        const borderSelected = `1px solid ${qualityColor}`;

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", isDisabled() ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");
        row.style.set("border", preSelected ? borderSelected : borderBase);
        row.style.set("background", preSelected ? "rgba(30, 255, 128, 0.1)" : isDisabled() ? "rgba(255, 80, 80, 0.05)" : "transparent");
        if (isDisabled()) row.style.set("opacity", "0.7");

        const qualityName = getQualityName(item.quality);
        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        row.addEventListener("mouseenter", (e: MouseEvent) => {
            this._hoveredItem = item;
            this._hoveredDisplayName = displayName;
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;

            if (!isSelected() && !isDisabled()) {
                row.style.set("background", "rgba(255, 255, 255, 0.05)");
                row.style.set("border", borderHover);
            }

            if (this.shiftHeld) {
                this.bcShowTooltip(item, displayName, e.clientX, e.clientY);
            }
        });

        row.addEventListener("mousemove", (e: MouseEvent) => {
            this._hoveredMouseX = e.clientX;
            this._hoveredMouseY = e.clientY;
            if (this.shiftHeld && this.bcTooltipEl && this.bcTooltipEl.style.display !== "none") {
                this.bcPositionTooltip(e.clientX, e.clientY);
            }
        });

        row.addEventListener("mouseleave", () => {
            this._hoveredItem = null;
            this.bcHideTooltip();

            if (!isSelected()) {
                row.style.set("background", isDisabled() ? "rgba(255, 80, 80, 0.05)" : "transparent");
                row.style.set("border", borderBase);
            }
        });

        try {
            const handler = new ItemComponentHandler({
                getItem:        () => item,
                getItemType:    () => item.type,
                getItemQuality: () => item.quality,
                noDrag: true,
            });
            const itemComp = ItemComponent.create(handler);
            if (itemComp) {
                itemComp.style.set("flex-shrink", "0");
                itemComp.style.set("margin-right", "5px");
                row.append(itemComp);
            }
        } catch (error) {
            this.debugLog("Failed to create bulk tool item icon.", { itemId: getItemId(item), itemType: item.type, error });
        }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

        this.appendRemainingUsesHint(row.element, item, getCraftDurabilityLoss(item), this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true);

        if (reservedRole !== undefined) {
            const disabledText = document.createElement("span");
            disabledText.textContent = this.getReservationRoleLabel(reservedRole);
            disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
            row.element.appendChild(disabledText);
        }

        const check = new CheckButton();
        check.style.set("pointer-events", "none");
        check.style.set("margin-left", "4px");
        check.style.set("flex-shrink", "0");
        check.style.set("background", "transparent");
        check.style.set("background-color", "transparent");
        check.style.set("border", "none");
        check.style.set("box-shadow", "none");
        check.style.set("padding", "0");
        if (preSelected) check.setChecked(true, false);
        row.append(check);

        row.event.subscribe("activate", () => {
            if (isDisabled()) return;
            const selected = this.bulkPinnedToolSelections.get(slotIndex) ?? [];
            const idx = selected.findIndex(entry => getItemId(entry) === itemId);
            if (idx >= 0) {
                selected.splice(idx, 1);
                check.setChecked(false, false);
                row.style.set("background", "transparent");
                row.style.set("border", borderBase);
            } else {
                if (selected.length >= maxSelect) {
                    if (maxSelect !== 1 || selected.length === 0) return;
                    selected.splice(0, selected.length, item);
                } else {
                    selected.unshift(item);
                    check.setChecked(true, false);
                    row.style.set("background", "rgba(30, 255, 128, 0.1)");
                    row.style.set("border", borderSelected);
                }
            }
            this.bulkPinnedToolSelections.set(slotIndex, selected);
            this.setExplicitSelection("bulk", slotIndex, "tool", "tool", selected);
            this.buildBulkContent(false, true);
        });

        parent.append(row);
    }

    // ── Bulk quantity helpers ─────────────────────────────────────────────────

    private computeBulkDurabilityMaxFromSelection(selection: IBulkCraftSelection): number {
        if (!this.recipe) return 0;

        let durabilityMax = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            const items = selection.slotSelections.get(i) ?? [];
            const preserveDurability = this.bulkPreserveDurabilityBySlot.get(i) !== false;
            const durabilityItems = this.isSplitComponent(comp)
                ? items.slice(getConsumedSelectionCount(comp.requiredAmount, comp.consumedAmount))
                : comp.consumedAmount <= 0
                    ? items
                    : [];
            for (const item of durabilityItems) {
                durabilityMax = Math.min(
                    durabilityMax,
                    getRemainingDurabilityUses(item.durability, getCraftDurabilityLoss(item), preserveDurability),
                );
            }
        }

        return durabilityMax;
    }

    private prepareBulkPinnedSelections(excludedIds: Set<number>): boolean {
        if (!this.recipe) return false;

        const selection = this.resolveBulkCraftSelection(this.itemType as ItemType, excludedIds);
        if (!selection) return false;

        this.bulkPinnedToolSelections.clear();
        this.bulkPinnedUsedSelections.clear();
        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            const items = selection.slotSelections.get(i) ?? [];
            if (this.isSplitComponent(comp)) {
                const usedCount = getUsedSelectionCount(comp.requiredAmount, comp.consumedAmount);
                const usedItems = items.slice(getConsumedSelectionCount(comp.requiredAmount, comp.consumedAmount));
                if (usedItems.length < usedCount) return false;
                this.bulkPinnedUsedSelections.set(i, [...usedItems]);
                continue;
            }

            if (comp.consumedAmount > 0) continue;
            if (items.length < comp.requiredAmount) return false;
            this.bulkPinnedToolSelections.set(i, [...items]);
        }

        return true;
    }

    /** Returns the stamina-based, material-based, and durability-based craft limits independently. */
    private computeBulkLimits(): { staminaMax: number; materialMax: number; durabilityMax: number } {
        if (!this.recipe || !localPlayer?.island) return { staminaMax: 0, materialMax: 0, durabilityMax: 0 };

        const staminaCost = getCraftStaminaCost(this.recipe.level);
        const currentStamina = this.getCurrentStamina();
        const staminaMax = !this.safeCraftingEnabled
            ? Number.MAX_SAFE_INTEGER
            : staminaCost > 0 ? Math.floor(currentStamina / staminaCost) : 9999;

        let materialMax = 0;
        let durabilityMax = Number.MAX_SAFE_INTEGER;
        const excludedIds = this.getBulkExcludedIds();
        const permanentlyConsumedIds = new Set<number>();
        const materialIterationCap = this.safeCraftingEnabled
            ? Math.max(1, Math.min(9999, staminaMax))
            : 9999;
        const candidateCache = this.createBulkCandidateCache();

        for (let i = 0; i < materialIterationCap; i++) {
            const selection = this.resolveBulkCraftSelection(this.itemType as ItemType, excludedIds, permanentlyConsumedIds, candidateCache);
            if (!selection) break;

            if (i === 0) {
                durabilityMax = this.computeBulkDurabilityMaxFromSelection(selection);
            }

            for (const id of selection.permanentlyConsumedIds) {
                permanentlyConsumedIds.add(id);
            }

            materialMax++;
        }

        if (materialMax === 0) durabilityMax = 0;
        return { staminaMax, materialMax, durabilityMax };
    }

    /**
     * Computes the maximum craftable quantity given current exclusions and
     * the player's current stamina. Returns 0 if not craftable at all.
     */
    private computeBulkMax(): number {
        if (this.panelMode === "dismantle") {
            return this.computeDismantleMax();
        }
        return this.computeBulkUiLimits().max;
    }

    private computeBulkUiLimits(): IBulkLimitSnapshot {
        if (this.panelMode === "dismantle") {
            const materialMax = this.getIncludedDismantleItems().length;
            const staminaMax = this.computeDismantleStaminaMax();
            const durabilityMax = !this.dismantleRequiredSelection
                ? Number.MAX_SAFE_INTEGER
                : getRemainingDurabilityUses(
                    this.dismantleRequiredSelection.durability,
                    getDismantleDurabilityLoss(this.dismantleRequiredSelection, ActionType.Dismantle),
                    this.preserveDismantleRequiredDurability,
                );

            return {
                max: Math.max(0, Math.min(materialMax, staminaMax, durabilityMax)),
                staminaMax,
                materialMax,
                durabilityMax,
            };
        }

        const { staminaMax, materialMax, durabilityMax } = this.computeBulkLimits();
        return {
            staminaMax,
            materialMax,
            durabilityMax,
            max: Math.max(0, Math.min(staminaMax, materialMax, durabilityMax)),
        };
    }

    private computeDismantleStaminaMax(): number {
        if (!this.safeCraftingEnabled) return Number.MAX_SAFE_INTEGER;

        const currentStamina = this.getCurrentStamina();

        return Math.max(0, Math.floor(currentStamina));
    }

    private computeDismantleMax(): number {
        if (!this.dismantleSelectedItemType || !this.dismantleDescription) return 0;
        if (this.dismantleDescription.required !== undefined && !this.dismantleRequiredSelection) return 0;

        const targetMax = this.getIncludedDismantleItems().length;
        const staminaMax = this.computeDismantleStaminaMax();
        const durabilityMax = !this.dismantleRequiredSelection
            ? Number.MAX_SAFE_INTEGER
            : getRemainingDurabilityUses(
                this.dismantleRequiredSelection.durability,
                getDismantleDurabilityLoss(this.dismantleRequiredSelection, ActionType.Dismantle),
                this.preserveDismantleRequiredDurability,
            );

        return Math.max(0, Math.min(targetMax, staminaMax, durabilityMax));
    }

    private hasDismantleDurabilityLimit(): boolean {
        if (!this.dismantleRequiredSelection) return false;
        const perUseLoss = getDismantleDurabilityLoss(this.dismantleRequiredSelection, ActionType.Dismantle);
        return getRemainingDurabilityUses(
            this.dismantleRequiredSelection.durability,
            perUseLoss,
            this.preserveDismantleRequiredDurability,
        ) === 0;
    }

    private hasDismantleStaminaLimit(): boolean {
        return this.safeCraftingEnabled
            && this.computeDismantleStaminaMax() === 0
            && this.getIncludedDismantleItems().length > 0;
    }

    private isReservedDismantleRequiredItem(item: Item): boolean {
        const requiredItem = this.dismantleRequiredSelection;
        if (!requiredItem) return false;

        const itemId = getItemId(item);
        const requiredItemId = getItemId(requiredItem);
        if (itemId !== undefined && requiredItemId !== undefined) {
            return itemId === requiredItemId;
        }

        return item === requiredItem;
    }

    private getSelectableDismantleRequiredItems(visibleItems: readonly Item[]): Item[] {
        const currentSelection = this.dismantleRequiredSelection;
        if (!currentSelection || !visibleItems.includes(currentSelection)) {
            return [...visibleItems];
        }

        return visibleItems.filter(item => item === currentSelection || !this.isIncludedDismantleTargetItem(item));
    }

    private getIncludedDismantleTargetIds(): Set<number> {
        const includedIds = new Set<number>();
        if (!this.dismantleSelectedItemType) return includedIds;

        for (const item of this.findMatchingItems(this.dismantleSelectedItemType)) {
            const itemId = getItemId(item);
            if (itemId !== undefined && !this.dismantleExcludedIds.has(itemId) && !isItemProtected(item)) {
                includedIds.add(itemId);
            }
        }

        return includedIds;
    }

    private isIncludedDismantleTargetItem(item: Item): boolean {
        const itemId = getItemId(item);
        return itemId !== undefined
            && this.getIncludedDismantleTargetIds().has(itemId);
    }

    private getIncludedDismantleItems(): Item[] {
        if (!this.dismantleSelectedItemType) return [];
        return this.getFilteredSortedSectionItems("dismantle", -1, "consumed", this.findMatchingItems(this.dismantleSelectedItemType)).filter(item => {
            const itemId = getItemId(item);
            return !this.isReservedDismantleRequiredItem(item)
                && !isItemProtected(item)
                && (itemId === undefined || !this.dismantleExcludedIds.has(itemId));
        });
    }

    private updateBulkMaxDisplay(limits = this.computeBulkUiLimits()): void {
        if (this.panelMode === "dismantle") {
            const max = limits.max;
            if (this.bulkMaxLabel) {
                if (max > 0) {
                    this.bulkMaxLabel.textContent = `(max ${max})`;
                    this.bulkMaxLabel.style.color = "#9f7768";
                } else {
                    this.bulkMaxLabel.textContent = this.dismantleDescription?.required !== undefined && !this.dismantleRequiredSelection
                        ? "(select required item)"
                        : this.hasDismantleStaminaLimit()
                            ? "(insufficient stamina)"
                        : this.hasDismantleDurabilityLimit()
                            ? "(protected item durability limit)"
                        : "(no eligible items)";
                    this.bulkMaxLabel.style.color = "#cc4444";
                }
            }
            if (max > 0 && this.bulkQuantity > max) {
                this.bulkQuantity = max;
                if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
            }
            return;
        }

        const { staminaMax, materialMax, durabilityMax, max } = limits;
        if (this.bulkMaxLabel) {
            if (max > 0) {
                this.bulkMaxLabel.textContent = `(max ${max})`;
                this.bulkMaxLabel.style.color = "#7a6850";
            } else {
                this.bulkMaxLabel.textContent = (this.safeCraftingEnabled && staminaMax === 0 && materialMax > 0)
                    ? "(insufficient stamina)"
                    : (this.hasIncompleteBulkToolSelection() && materialMax > 0)
                        ? "(select tools)"
                    : (durabilityMax === 0 && materialMax > 0)
                        ? "(protected item durability limit)"
                    : "(not enough materials)";
                this.bulkMaxLabel.style.color = "#cc4444";
            }
        }
        // Clamp qty to max when max decreased
        if (max > 0 && this.bulkQuantity > max) {
            this.bulkQuantity = max;
            if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
        }
    }

    private adjustBulkQty(delta: number): void {
        const limits = this.computeBulkUiLimits();
        const max = limits.max;
        let newQty = this.bulkQuantity + delta;
        // Clamp to [1, max] when max > 0; when max === 0, pin to 1 so + does nothing.
        const effectiveMax = max > 0 ? max : 1;
        if (newQty > effectiveMax) newQty = effectiveMax;
        if (newQty < 1) newQty = 1;
        this.bulkQuantity = newQty;
        if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
        this.updateBulkMaxDisplay(limits);
        this.updateBulkCraftBtnState(limits);
    }

    private updateBulkCraftBtnState(limits = this.computeBulkUiLimits()): void {
        if (!this.bulkCraftBtnEl) return;
        const canCraft = limits.max > 0 && this.bulkQuantity >= 1;
        if (canCraft) {
            this.bulkCraftBtnEl.classes.remove("bc-craft-disabled");
        } else {
            this.bulkCraftBtnEl.classes.add("bc-craft-disabled");
        }
    }

    // ── Bulk craft execution ──────────────────────────────────────────────────

    private bulkCrafting = false;

    private hasIncompleteBulkToolSelection(): boolean {
        if (!this.recipe) return false;

        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            const expectedCount = this.isSplitComponent(comp)
                ? getUsedSelectionCount(comp.requiredAmount, comp.consumedAmount)
                : comp.consumedAmount <= 0
                    ? comp.requiredAmount
                    : 0;
            if (expectedCount === 0) continue;

            const selected = this.isSplitComponent(comp)
                ? (this.bulkPinnedUsedSelections.get(i) ?? [])
                : (this.bulkPinnedToolSelections.get(i) ?? []);
            if (selected.length < expectedCount) {
                return true;
            }
        }

        return false;
    }

    private async onBulkCraft(): Promise<void> {
        if (this.panelMode === "dismantle") {
            if (this.bulkCrafting || !this.dismantleSelectedItemType || !this.dismantleDescription) return;
            const max = this.computeDismantleMax();
            if (max <= 0 || this.bulkQuantity < 1) return;

            const targets = this.getIncludedDismantleItems().slice(0, this.bulkQuantity);
            if (targets.length === 0) return;

            this.bulkCrafting = true;
            try {
                await this.onDismantleCallback(targets, this.dismantleRequiredSelection);
                this.scheduleInventoryRefresh();
            } finally {
                this.bulkCrafting = false;
            }
            return;
        }

        if (this.bulkCrafting || !this.itemType || !this.recipe) return;
        const max = this.computeBulkMax();
        if (max <= 0 || this.bulkQuantity < 1) return;

        const flatExcluded = this.getBulkExcludedIds();
        if (!this.prepareBulkPinnedSelections(flatExcluded)) return;

        this.bulkCrafting = true;
        try {
            await this.onBulkCraftCallback(
                this.itemType as ItemType,
                this.bulkQuantity,
                flatExcluded,
            );
            this._bulkContentDirty = true;
        } finally {
            this.bulkCrafting = false;
        }
    }

    /**
     * Called by betterCrafting.ts's executeBulkCraft each loop iteration.
     * Re-resolves non-excluded items for all component slots and returns them,
     * or null if requirements cannot be met.
     *
     * The returned `tools` and `consumed` arrays are already partitioned.
     * Excluded items are skipped every iteration (handles Protected items and
     * user exclusions). Returns null to abort the batch when materials run out.
     */
    public resolveForBulkCraft(
        itemType: ItemType,
        excludedIds: Set<number>,
        sessionConsumedIds?: ReadonlySet<number>,
    ): { required: Item[]; consumed: Item[]; base: Item | undefined } | null {
        this.lastBulkResolutionMessage = undefined;
        // Merge user-excluded IDs with items already consumed this bulk session
        // to prevent re-picking items the game engine hasn't physically removed yet.
        const effectiveExcluded = sessionConsumedIds?.size
            ? new Set([...excludedIds, ...sessionConsumedIds])
            : excludedIds;
        const selection = this.resolveBulkCraftSelection(itemType, effectiveExcluded);
        if (!selection) return null;

        return {
            required: selection.required,
            consumed: selection.consumed,
            base: selection.base,
        };
    }

    // ── Custom Tooltip (Task 1) ───────────────────────────────────────────────

    private getBulkExcludedIds(): Set<number> {
        const excludedIds = new Set<number>();
        for (const [, excludedSet] of this.bulkExcludedIds) {
            for (const id of excludedSet) excludedIds.add(id);
        }

        return excludedIds;
    }

    private resolveBulkCraftSelection(
        itemType: ItemType,
        excludedIds: ReadonlySet<number>,
        permanentlyConsumedIds: ReadonlySet<number> = new Set<number>(),
        candidateCache = this.createBulkCandidateCache(),
    ): IBulkCraftSelection | null {
        this.lastBulkResolutionMessage = undefined;
        const recipe = itemDescriptions[itemType]?.recipe;
        if (!recipe) return null;

        const reservedIds = new Set<number>(permanentlyConsumedIds);
        const newlyConsumedIds = new Set<number>();
        const slotSelections = new Map<number, Item[]>();
        const preReservedUsedSelections = new Map<number, Item[]>();
        const preReservedToolSelections = new Map<number, Item[]>();
        let base: Item | undefined;

        const reserveItem = (item: Item, permanentlyConsumed: boolean): boolean => {
            const itemId = getItemId(item);
            if (itemId === undefined) return false;
            if (reservedIds.has(itemId)) return false;

            reservedIds.add(itemId);
            if (permanentlyConsumed) newlyConsumedIds.add(itemId);
            return true;
        };

        for (let i = 0; i < recipe.components.length; i++) {
            const comp = recipe.components[i];
            if (this.isSplitComponent(comp)) {
                const usedCount = getUsedSelectionCount(comp.requiredAmount, comp.consumedAmount);
                const pinnedUsed = this.bulkPinnedUsedSelections.get(i) ?? [];
                if (pinnedUsed.length === 0) continue;

                const pinnedUsedIds = pinnedUsed.map(item => getItemId(item)).filter((id): id is number => id !== undefined);
                const candidates = this.getBulkCachedCandidates(candidateCache, comp.type, i, "used").filter(item => {
                    const itemId = getItemId(item);
                    return itemId !== undefined
                        && !excludedIds.has(itemId)
                        && !reservedIds.has(itemId)
                        && !isItemProtected(item);
                });
                const candidateMap = new Map<number, Item>();
                for (const candidate of candidates) {
                    const candidateId = getItemId(candidate);
                    if (candidateId !== undefined && !candidateMap.has(candidateId)) candidateMap.set(candidateId, candidate);
                }

                const resolvedUsed: Item[] = [];
                for (const itemId of pinnedUsedIds) {
                    const candidate = candidateMap.get(itemId);
                    if (!candidate) break;
                    reservedIds.add(itemId);
                    resolvedUsed.push(candidate);
                    if (resolvedUsed.length >= usedCount) break;
                }

                if (resolvedUsed.length >= usedCount) {
                    preReservedUsedSelections.set(i, resolvedUsed);
                }
                continue;
            }

            if (comp.consumedAmount > 0) continue;

            const pinned = this.bulkPinnedToolSelections.get(i) ?? [];
            if (pinned.length === 0) continue;

            const pinnedIds = pinned.map(item => getItemId(item)).filter((id): id is number => id !== undefined);
            const candidates = this.getBulkCachedCandidates(candidateCache, comp.type, i, "tool").filter(item => {
                const itemId = getItemId(item);
                return itemId !== undefined
                    && !excludedIds.has(itemId)
                    && !reservedIds.has(itemId)
                    && !isItemProtected(item);
            });
            const candidateMap = new Map<number, Item>();
            for (const candidate of candidates) {
                const candidateId = getItemId(candidate);
                if (candidateId !== undefined && !candidateMap.has(candidateId)) candidateMap.set(candidateId, candidate);
            }

            const resolvedPinned: Item[] = [];
            for (const itemId of pinnedIds) {
                const candidate = candidateMap.get(itemId);
                if (!candidate) break;
                reservedIds.add(itemId);
                resolvedPinned.push(candidate);
                if (resolvedPinned.length >= comp.requiredAmount) break;
            }

            if (resolvedPinned.length >= comp.requiredAmount) {
                preReservedToolSelections.set(i, resolvedPinned);
            }
        }

        if (recipe.baseComponent !== undefined) {
            const candidates = this.findBulkCandidates(recipe.baseComponent, excludedIds, reservedIds, -1, "base", candidateCache);
            if (candidates.length === 0) return null;

            base = candidates[0];
            if (!reserveItem(base, true)) return null;
        }

        for (let i = 0; i < recipe.components.length; i++) {
            const comp = recipe.components[i];
            if (this.isSplitComponent(comp)) {
                const usedCount = getUsedSelectionCount(comp.requiredAmount, comp.consumedAmount);
                const consumedCount = getConsumedSelectionCount(comp.requiredAmount, comp.consumedAmount);
                const resolvedUsed = preReservedUsedSelections.get(i) ?? [];
                if (resolvedUsed.length < usedCount) {
                    this.setBulkResolutionFailure({
                        reason: "pinnedToolUnavailable",
                        slotIndex: i,
                        itemTypeOrGroup: comp.type as number,
                        requestedItemIds: (this.bulkPinnedUsedSelections.get(i) ?? []).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                        candidateItemIds: this.findMatchingItems(comp.type).map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                    });
                    return null;
                }

                const consumedCandidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, i, "consumed", candidateCache);
                if (consumedCandidates.length < consumedCount) return null;
                const pickedConsumed = consumedCandidates.slice(0, consumedCount);
                for (const item of pickedConsumed) {
                    if (!reserveItem(item, true)) return null;
                }

                slotSelections.set(i, [...pickedConsumed, ...resolvedUsed]);
                continue;
            }

            if (comp.consumedAmount <= 0) continue;
            const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, i, "consumed", candidateCache);
            if (candidates.length < comp.requiredAmount) return null;

            const picked = candidates.slice(0, comp.requiredAmount);
            if (picked.length < comp.requiredAmount) return null;
            const partitioned = partitionSelectedItems(picked, comp.requiredAmount, comp.consumedAmount);
            const consumedIds = new Set(partitioned.consumed.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
            for (const item of partitioned.required) {
                const itemId = getItemId(item);
                if (!reserveItem(item, itemId !== undefined && consumedIds.has(itemId))) return null;
            }

            slotSelections.set(i, partitioned.required);
        }

        const toolSlots = recipe.components
            .map((comp, index) => comp.consumedAmount <= 0 ? index : -1)
            .filter((index): index is number => index >= 0);

        const pickToolItemsForSlot = (
            slotIndex: number,
            orderedCandidates: Item[],
            startIndex: number,
            requiredAmount: number,
            picked: Item[],
            nextToolSlotIndex: number,
        ): boolean => {
            if (picked.length >= requiredAmount) {
                slotSelections.set(slotIndex, [...picked]);
                const resolved = resolveToolSlots(nextToolSlotIndex);
                if (resolved) return true;
                slotSelections.delete(slotIndex);
                return false;
            }

            const remainingNeeded = requiredAmount - picked.length;
            for (let i = startIndex; i <= orderedCandidates.length - remainingNeeded; i++) {
                const candidate = orderedCandidates[i];
                const candidateId = getItemId(candidate);
                if (candidateId === undefined || reservedIds.has(candidateId)) continue;

                reservedIds.add(candidateId);
                picked.push(candidate);
                if (pickToolItemsForSlot(slotIndex, orderedCandidates, i + 1, requiredAmount, picked, nextToolSlotIndex)) {
                    return true;
                }
                picked.pop();
                reservedIds.delete(candidateId);
            }

            return false;
        };

        const resolveToolSlots = (toolSlotPosition: number): boolean => {
            if (toolSlotPosition >= toolSlots.length) return true;

            const slotIndex = toolSlots[toolSlotPosition];
            const comp = recipe.components[slotIndex];
            const preReserved = preReservedToolSelections.get(slotIndex);
            if (preReserved) {
                slotSelections.set(slotIndex, preReserved);
                return resolveToolSlots(toolSlotPosition + 1);
            }

            const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, slotIndex, "tool", candidateCache);
            if (candidates.length < comp.requiredAmount) return false;

            const pinned = this.bulkPinnedToolSelections.get(slotIndex) ?? [];
            if (pinned.length > 0) {
                const pinnedIds = pinned.map(item => getItemId(item)).filter((id): id is number => id !== undefined);
                const candidateMap = new Map<number, Item>();
                for (const candidate of candidates) {
                    const candidateId = getItemId(candidate);
                    if (candidateId !== undefined && !candidateMap.has(candidateId)) {
                        candidateMap.set(candidateId, candidate);
                    }
                }

                const resolvedPinned: Item[] = [];
                for (const itemId of pinnedIds) {
                    const candidate = candidateMap.get(itemId);
                    if (!candidate || reservedIds.has(itemId)) {
                        this.setBulkResolutionFailure({
                            reason: "pinnedToolUnavailable",
                            slotIndex,
                            itemTypeOrGroup: comp.type as number,
                            requestedItemIds: pinnedIds,
                            candidateItemIds: candidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                        });
                        return false;
                    }

                    reservedIds.add(itemId);
                    resolvedPinned.push(candidate);
                    if (resolvedPinned.length >= comp.requiredAmount) break;
                }

                if (resolvedPinned.length < comp.requiredAmount) {
                    this.setBulkResolutionFailure({
                        reason: "pinnedToolUnavailable",
                        slotIndex,
                        itemTypeOrGroup: comp.type as number,
                        requestedItemIds: pinnedIds,
                        candidateItemIds: candidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined),
                    });
                    return false;
                }

                slotSelections.set(slotIndex, resolvedPinned);
                return resolveToolSlots(toolSlotPosition + 1);
            }

            const orderedCandidates = this.getBulkToolCandidateOrder(slotIndex, candidates);
            return pickToolItemsForSlot(slotIndex, orderedCandidates, 0, comp.requiredAmount, [], toolSlotPosition + 1);
        };

        if (!resolveToolSlots(0)) return null;

        const required: Item[] = [];
        const consumed: Item[] = [];
        for (let i = 0; i < recipe.components.length; i++) {
            const comp = recipe.components[i];
            const picked = slotSelections.get(i) ?? [];
            const partitioned = partitionSelectedItems(picked, comp.requiredAmount, comp.consumedAmount);
            consumed.push(...partitioned.consumed);
            required.push(...partitioned.required);
        }

        return {
            required,
            consumed,
            base,
            permanentlyConsumedIds: newlyConsumedIds,
            slotSelections,
        };
    }

    private getBulkToolCandidateOrder(slotIndex: number, candidates: Item[]): Item[] {
        const pinned = this.bulkPinnedToolSelections.get(slotIndex) ?? [];
        const ordered: Item[] = [];
        const seenIds = new Set<number>();
        const candidateIds = new Set(candidates.map(item => getItemId(item)).filter((id): id is number => id !== undefined));

        for (const item of pinned) {
            const itemId = getItemId(item);
            if (itemId !== undefined && candidateIds.has(itemId) && !seenIds.has(itemId)) {
                ordered.push(item);
                seenIds.add(itemId);
            }
        }

        for (const item of candidates) {
            const itemId = getItemId(item);
            if (itemId === undefined) continue;
            if (seenIds.has(itemId)) continue;
            ordered.push(item);
            seenIds.add(itemId);
        }

        return ordered;
    }

    private findBulkCandidates(
        type: ItemType | ItemTypeGroup,
        excludedIds: ReadonlySet<number>,
        reservedIds: ReadonlySet<number>,
        slotIndex: number,
        semantic: SectionSemantic,
        candidateCache = this.createBulkCandidateCache(),
    ): Item[] {
        return this.getBulkCachedCandidates(candidateCache, type, slotIndex, semantic).filter(item => {
            const itemId = getItemId(item);
            return itemId !== undefined
                && !excludedIds.has(itemId)
                && !reservedIds.has(itemId)
                && !isItemProtected(item);
        });
    }

    private createBulkCandidateCache(): BulkCandidateCache {
        return new Map<string, Item[]>();
    }

    private getBulkCachedCandidates(
        cache: BulkCandidateCache,
        type: ItemType | ItemTypeGroup,
        slotIndex: number,
        semantic: SectionSemantic,
    ): Item[] {
        const key = `${slotIndex}:${semantic}:${type}`;
        const cached = cache.get(key);
        if (cached) return cached;

        const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, semantic, this.findMatchingItems(type));
        cache.set(key, candidates);
        return candidates;
    }

    private bcGetOrCreateTooltip(): HTMLDivElement {
        if (!this.bcTooltipEl) {
            const el = document.createElement("div");
            el.id = "better-crafting-tooltip";
            el.style.cssText = [
                "position:fixed",
                "z-index:3000",
                "display:none",
                "background:rgba(18,13,8,0.96)",
                "border:1px solid rgba(180,140,60,0.55)",
                "border-radius:4px",
                "padding:8px 10px",
                "min-width:190px",
                "max-width:270px",
                "line-height:1.4",
                "pointer-events:none",
                "box-shadow:0 4px 14px rgba(0,0,0,0.6)",
                "font-family:inherit",
            ].join(";");
            document.body.appendChild(el);
            this.bcTooltipEl = el;
        }
        return this.bcTooltipEl;
    }

    private bcShowTooltip(item: Item, displayName: string, mouseX: number, mouseY: number): void {
        const el = this.bcGetOrCreateTooltip();
        el.style.fontSize = window.getComputedStyle(this.element).fontSize;
        el.style.borderColor = getQualityColor(item.quality);
        this.bcFillTooltipForItem(el, item.type, displayName, item);
        el.style.display = "block";
        this.bcPositionTooltip(mouseX, mouseY);
    }

    private bcShowTextTooltip(title: string, lines: string[], mouseX: number, mouseY: number): void {
        const el = this.bcGetOrCreateTooltip();
        el.style.fontSize = window.getComputedStyle(this.element).fontSize;
        el.style.borderColor = "rgba(180,140,60,0.55)";
        this.bcFillTooltipForText(el, title, lines);
        el.style.display = "block";
        this.bcPositionTooltip(mouseX, mouseY);
    }

    private bcHideTooltip(): void {
        if (this.bcTooltipEl) this.bcTooltipEl.style.display = "none";
    }

    private bcPositionTooltip(mouseX: number, mouseY: number): void {
        const el = this.bcTooltipEl;
        if (!el) return;
        const W = el.offsetWidth  || 220;
        const H = el.offsetHeight || 100;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const GAP = 14;
        let left = mouseX + GAP;
        let top  = mouseY - 8;
        if (left + W > vw - 8) left = mouseX - W - GAP;
        if (top  + H > vh - 8) top  = vh - H - 8;
        if (top  < 8)          top  = 8;
        el.style.left = `${left}px`;
        el.style.top  = `${top}px`;
    }

    private bcFillTooltipForItem(el: HTMLDivElement, itemType: ItemType, displayName: string, item?: Item): void {
        el.innerHTML = "";
        this.bcAppendTooltipContent(el, itemType, displayName, item);
    }

    private bcFillTooltipForText(el: HTMLDivElement, title: string, lines: string[]): void {
        el.innerHTML = "";

        const titleEl = document.createElement("div");
        titleEl.textContent = title;
        titleEl.style.cssText = "color:#d8c79a;font-weight:bold;font-size:1.02em;margin-bottom:4px;";
        el.appendChild(titleEl);

        for (const line of lines) {
            const row = document.createElement("div");
            row.textContent = line;
            row.style.cssText = "color:#e0d0b0;font-size:0.92em;line-height:1.4;";
            el.appendChild(row);
        }
    }

    private createInfoIcon(title: string, lines: string[]): HTMLButtonElement {
        const icon = document.createElement("button");
        icon.type = "button";
        icon.textContent = "(i)";
        icon.title = title;
        icon.setAttribute("aria-label", title);
        icon.style.cssText = [
            "display:inline-flex",
            "align-items:center",
            "justify-content:center",
            "margin-left:2px",
            "padding:0",
            "border:0",
            "background:transparent",
            "color:#c0b080",
            "font:inherit",
            "font-size:0.8em",
            "line-height:1",
            "cursor:help",
            "user-select:none",
        ].join(";");

        let tooltipTimer: number | null = null;
        let lastMouseX = 0;
        let lastMouseY = 0;
        const clearTimer = () => {
            if (tooltipTimer !== null) {
                clearTimeout(tooltipTimer);
                tooltipTimer = null;
            }
        };

        icon.addEventListener("mouseenter", (e: MouseEvent) => {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            clearTimer();
            tooltipTimer = window.setTimeout(() => {
                tooltipTimer = null;
                this.bcShowTextTooltip(title, lines, lastMouseX, lastMouseY);
            }, 250);
        });

        icon.addEventListener("mousemove", (e: MouseEvent) => {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            if (this.bcTooltipEl && this.bcTooltipEl.style.display !== "none") {
                this.bcPositionTooltip(lastMouseX, lastMouseY);
            }
        });

        icon.addEventListener("mouseleave", () => {
            clearTimer();
            this.bcHideTooltip();
        });

        icon.addEventListener("mousedown", (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
        });
        icon.addEventListener("click", (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
        });

        return icon;
    }

    private bcAppendTooltipContent(el: HTMLElement, itemType: ItemType, displayName: string, item?: Item): void {
        const desc  = itemDescriptions[itemType as ItemType];
        const color = item ? getQualityColor(item.quality) : "#e0d0b0";
        const fmt   = (s: string) => this.formatEnumName(s);

        const header = document.createElement("div");
        header.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px;";

        const nameEl = document.createElement("span");
        nameEl.textContent = displayName;
        nameEl.style.cssText = `color:${color};font-weight:bold;font-size:1.1em;`;
        header.appendChild(nameEl);

        const categoryText = desc?.group?.[0] !== undefined
            ? fmt(ItemTypeGroup[desc.group[0]] || "")
            : fmt(ItemType[itemType] || "");
        if (categoryText) {
            const catEl = document.createElement("span");
            catEl.textContent = categoryText;
            catEl.style.cssText = "color:#9a8860;font-size:0.9em;white-space:nowrap;";
            header.appendChild(catEl);
        }
        el.appendChild(header);

        const propsRow = document.createElement("div");
        propsRow.style.cssText = "display:flex;gap:14px;margin-bottom:5px;";

        if (item) {
            const dur    = item.durability;
            const durMax = item.durabilityMax;
            if (durMax > 0) {
                appendInlineStat(propsRow, "Durability", `${dur}/${durMax}`, "#c0b080", "color:#9a8860;font-size:0.9em;");
            }
            appendInlineStat(propsRow, "Weight", item.weight.toFixed(1), "#c0b080", "color:#9a8860;font-size:0.9em;");
        } else if (desc) {
            if (desc.durability !== undefined) {
                appendInlineStat(propsRow, "Durability", String(desc.durability), "#5eff80", "color:#9a8860;font-size:0.9em;");
            }
            const w = desc.weightRange ? `${desc.weightRange[0].toFixed(1)}–${desc.weightRange[1].toFixed(1)}` : desc.weight !== undefined ? desc.weight.toFixed(1) : null;
            if (w) {
                appendInlineStat(propsRow, "Weight", w, "#c0b080", "color:#9a8860;font-size:0.9em;");
            }
        }
        if (propsRow.childElementCount > 0) el.appendChild(propsRow);

        const groups = desc?.group;
        if (groups && groups.length > 0) {
            el.appendChild(this.bcTooltipDivider());
            const gh = document.createElement("div");
            gh.textContent = "Groupings";
            gh.style.cssText = "color:#9a8860;font-size:0.9em;font-weight:bold;margin-bottom:2px;";
            el.appendChild(gh);
            for (const g of groups) {
                const tierNum = (desc as any)?.tier?.[g] as number | undefined;
                const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                const ge = document.createElement("div");
                ge.textContent = `\u2022 ${fmt(ItemTypeGroup[g] || `Group ${g}`)}${tierStr}`;
                ge.style.cssText = "color:#c0b080;font-size:0.9em;padding-left:4px;";
                el.appendChild(ge);
            }
        }

        const uses = desc?.use;
        if (uses && uses.length > 0) {
            el.appendChild(this.bcTooltipDivider());
            const uh = document.createElement("div");
            uh.textContent = "Uses";
            uh.style.cssText = "color:#9a8860;font-size:0.9em;font-weight:bold;margin-bottom:2px;";
            el.appendChild(uh);
            for (const u of uses) {
                const tierNum = (desc as any)?.actionTier?.[u] as number | undefined;
                const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                const ue = document.createElement("div");
                ue.textContent = `\u2022 ${fmt(ActionType[u] || `Action ${u}`)}${tierStr}`;
                ue.style.cssText = "color:#c0b080;font-size:0.9em;padding-left:4px;";
                el.appendChild(ue);
            }
        }
    }

    private bcTooltipDivider(): HTMLElement {
        const div = document.createElement("div");
        div.style.cssText = "height:1px;background:rgba(180,140,60,0.28);margin:5px 0;";
        return div;
    }

    // ── Data helpers ──────────────────────────────────────────────────────────

    private getSectionStateKey(view: SectionView, slotIndex: number, semantic: SectionSemantic): string {
        const activeItemType = view === "dismantle" ? this.dismantleSelectedItemType ?? 0 : this.itemType ?? 0;
        return `${view}:${activeItemType}:${slotIndex}:${semantic}`;
    }

    private getExplicitSelectionKey(view: SectionView, slotIndex: number, semantic: SectionSemantic): string {
        return this.getSectionStateKey(view, slotIndex, semantic);
    }

    private setExplicitSelection(view: SectionView, slotIndex: number, semantic: SectionSemantic, role: SelectionReservationRole, items: readonly Item[]): void {
        const itemIds = items.map(item => getItemId(item)).filter((id): id is number => id !== undefined);
        const key = this.getExplicitSelectionKey(view, slotIndex, semantic);
        if (itemIds.length === 0) {
            this.explicitSelections.delete(key);
            return;
        }

        this.explicitSelections.set(key, {
            itemIds,
            role,
            sequence: ++this.explicitSelectionSequence,
        });
    }

    private pruneExplicitSelection(view: SectionView, slotIndex: number, semantic: SectionSemantic, selectedItems: readonly Item[]): void {
        const key = this.getExplicitSelectionKey(view, slotIndex, semantic);
        const explicit = this.explicitSelections.get(key);
        if (!explicit) return;

        const selectedIds = new Set(selectedItems.map(item => getItemId(item)).filter((id): id is number => id !== undefined));
        const itemIds = explicit.itemIds.filter(itemId => selectedIds.has(itemId));
        if (itemIds.length === 0) {
            this.explicitSelections.delete(key);
            return;
        }

        explicit.itemIds = itemIds;
    }

    private collectExplicitReservations(entries: Array<[string, IExplicitSelection]>): Map<number, SelectionReservationRole> {
        const reservations = new Map<number, SelectionReservationRole>();
        const ordered = [...entries].sort((a, b) => b[1].sequence - a[1].sequence);
        for (const [, explicit] of ordered) {
            for (const itemId of explicit.itemIds) {
                if (!reservations.has(itemId)) {
                    reservations.set(itemId, explicit.role);
                }
            }
        }

        return reservations;
    }

    private getDefaultSectionSortDirection(sort: ContainerSort): SortDirection {
        return sort === ContainerSort.Quality
            ? SortDirection.Descending
            : SortDirection.Ascending;
    }

    private getSectionFilterState(view: SectionView, slotIndex: number, semantic: SectionSemantic): ISectionFilterState {
        const key = this.getSectionStateKey(view, slotIndex, semantic);
        let state = this.sectionFilterStates.get(key);
        if (!state) {
            state = {
                filterText: "",
                sort: ContainerSort.BestForCrafting,
                sortDirection: this.getDefaultSectionSortDirection(ContainerSort.BestForCrafting),
                debounceTimer: null,
            };
            this.sectionFilterStates.set(key, state);
        }

        return state;
    }

    private shouldReselectSection(view: SectionView, slotIndex: number, semantic: SectionSemantic): boolean {
        return this.pendingSectionReselectKeys.has(this.getSectionStateKey(view, slotIndex, semantic));
    }

    private clearSectionReselect(view: SectionView, slotIndex: number, semantic: SectionSemantic): void {
        this.pendingSectionReselectKeys.delete(this.getSectionStateKey(view, slotIndex, semantic));
    }

    private shouldReselectSectionForSort(view: SectionView, slotIndex: number, semantic: SectionSemantic): boolean {
        return this.pendingSortReselectKeys.has(this.getSectionStateKey(view, slotIndex, semantic));
    }

    private clearSectionSortReselect(view: SectionView, slotIndex: number, semantic: SectionSemantic): void {
        this.pendingSortReselectKeys.delete(this.getSectionStateKey(view, slotIndex, semantic));
    }

    private shouldSortReselectSection(view: SectionView, slotIndex: number, semantic: SectionSemantic): boolean {
        return view === "normal"
            || (view === "bulk" && slotIndex >= 0 && (semantic === "used" || semantic === "tool"))
            || (view === "dismantle" && slotIndex === -2 && semantic === "tool");
    }

    private getItemDisplayName(item: Item): string {
        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }

        const qualityName = getQualityName(item.quality);
        return qualityName ? `${qualityName} ${displayName}` : displayName;
    }

    private getFilteredSortedSectionItems(
        view: SectionView,
        slotIndex: number,
        semantic: SectionSemantic,
        items: readonly Item[],
    ): Item[] {
        const state = this.getSectionFilterState(view, slotIndex, semantic);
        const filterText = state.filterText.trim().toLocaleLowerCase();
        const visible = filterText
            ? items.filter(item => this.getItemDisplayName(item).toLocaleLowerCase().includes(filterText))
            : [...items];
        const sorter = ItemSort.createSorter(state.sort, state.sortDirection);

        return visible.sort((a, b) => {
            const sorted = state.sort === ContainerSort.Quality
                ? state.sortDirection === SortDirection.Descending
                    ? qualitySortKey(b.quality) - qualitySortKey(a.quality)
                    : qualitySortKey(a.quality) - qualitySortKey(b.quality)
                : sorter(a, b);
            if (sorted !== 0) return sorted;

            return (getItemId(a) ?? Number.MAX_SAFE_INTEGER) - (getItemId(b) ?? Number.MAX_SAFE_INTEGER);
        });
    }

    private formatAvailableCount(visibleCount: number, totalCount: number): string {
        return visibleCount === totalCount
            ? `${totalCount} available`
            : `${visibleCount}/${totalCount} visible`;
    }

    private appendSectionControls(
        section: Component,
        view: SectionView,
        slotIndex: number,
        semantic: SectionSemantic,
        rebuild: () => void,
    ): void {
        const state = this.getSectionFilterState(view, slotIndex, semantic);
        const key = this.getSectionStateKey(view, slotIndex, semantic);
        const controls = document.createElement("div");
        controls.className = "bc-section-controls";

        const filter = document.createElement("input");
        filter.className = "bc-section-filter";
        filter.type = "search";
        filter.placeholder = "Filter";
        filter.value = state.filterText;
        filter.addEventListener("input", () => {
            state.filterText = filter.value;
            if (state.debounceTimer !== null) clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => {
                state.debounceTimer = null;
                this.pendingSectionReselectKeys.add(key);
                rebuild();
            }, 180);
        });
        controls.appendChild(filter);

        const sort = document.createElement("select");
        sort.className = "bc-section-sort";
        for (const sortOption of SECTION_SORTS) {
            const option = document.createElement("option");
            option.value = String(sortOption);
            option.textContent = this.formatEnumName(ContainerSort[sortOption]);
            option.selected = state.sort === sortOption;
            sort.appendChild(option);
        }
        sort.addEventListener("change", () => {
            const selectedSort = Number(sort.value) as ContainerSort;
            state.sort = selectedSort;
            state.sortDirection = this.getDefaultSectionSortDirection(selectedSort);
            if (this.shouldSortReselectSection(view, slotIndex, semantic)) {
                this.pendingSortReselectKeys.add(key);
            }
            rebuild();
        });
        controls.appendChild(sort);

        const direction = document.createElement("button");
        direction.type = "button";
        direction.className = "bc-section-direction";
        direction.title = "Sort direction";
        direction.setAttribute("aria-label", "Sort direction");
        direction.textContent = "↕";
        direction.addEventListener("click", () => {
            state.sortDirection = state.sortDirection === SortDirection.Descending
                ? SortDirection.Ascending
                : SortDirection.Descending;
            rebuild();
        });
        controls.appendChild(direction);

        section.element.appendChild(controls);
    }

    private getTypeName(type: ItemType | ItemTypeGroup): string {
        if (ItemManager.isGroup(type)) {
            return this.formatEnumName(ItemTypeGroup[type] || `Group ${type}`);
        }
        return this.formatEnumName(ItemType[type] || `Item ${type}`);
    }

    private findMatchingItems(type: ItemType | ItemTypeGroup): Item[] {
        if (!localPlayer) return [];
        const items = localPlayer.island.items;
        const subContainerOpts = { includeSubContainers: true as true };

        const result: Item[] = ItemManager.isGroup(type)
            ? items.getItemsInContainerByGroup(localPlayer, type as ItemTypeGroup, subContainerOpts)
            : items.getItemsInContainerByType(localPlayer, type as ItemType, subContainerOpts);

        const adjacentContainers = items.getAdjacentContainers(localPlayer);
        for (const container of adjacentContainers) {
            const adjacentItems: Item[] = ItemManager.isGroup(type)
                ? items.getItemsInContainerByGroup(container, type as ItemTypeGroup, subContainerOpts)
                : items.getItemsInContainerByType(container, type as ItemType, subContainerOpts);
            for (const item of adjacentItems) {
                if (!result.includes(item)) result.push(item);
            }
        }

        return filterSelectableItems(result, getItemId).sort((a, b) => qualitySortKey(b.quality) - qualitySortKey(a.quality));
    }

    // ── Craft action ──────────────────────────────────────────────────────────

    private crafting = false;

    private async onCraft() {
        if (this.crafting || !this.itemType || !this.recipe) return;

        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            if (this.isSplitComponent(comp)) {
                const splitSelection = this.getSplitSelection(i);
                const consumedCount = getConsumedSelectionCount(comp.requiredAmount, comp.consumedAmount);
                const usedCount = getUsedSelectionCount(comp.requiredAmount, comp.consumedAmount);
                if (splitSelection.consumed.length < consumedCount) {
                    this.showValidationError(`Select ${consumedCount} consumed ${this.getTypeName(comp.type)} (have ${splitSelection.consumed.length})`);
                    return;
                }
                if (splitSelection.used.length < usedCount) {
                    this.showValidationError(`Select ${usedCount} used ${this.getTypeName(comp.type)} (have ${splitSelection.used.length})`);
                    return;
                }
                continue;
            }
            const sel  = this.selectedItems.get(i) || [];
            if (sel.length < comp.requiredAmount) {
                this.showValidationError(`Select ${comp.requiredAmount} ${this.getTypeName(comp.type)} (have ${sel.length})`);
                return;
            }
        }
        if (this.recipe.baseComponent !== undefined && (this.selectedItems.get(-1) || []).length < 1) {
            this.showValidationError(`Select a base component: ${this.getTypeName(this.recipe.baseComponent)}`);
            return;
        }

        this.debugLog("NormalCraftPreResolve", this.buildCurrentNormalCraftSelectionState());
        const resolvedSelection = this.resolveCurrentCraftSelection();
        if (!resolvedSelection) return;

        const staminaCost = getCraftStaminaCost(this.recipe.level);
        const currentStamina = this.getCurrentStamina();
        if (this.safeCraftingEnabled && currentStamina < staminaCost) {
            this.showValidationError(`Need ${staminaCost} stamina to craft (have ${currentStamina})`);
            return;
        }

        this._pendingSelectionIds = this.collectCurrentNormalSelectionIds();
        this._pendingSplitSelectionIds = this.collectCurrentSplitSelectionIds();

        this.crafting = true;
        try {
            const orderedSelections = this.recipe.components.map((_, slotIndex) => resolvedSelection.slotSelections.get(slotIndex) ?? []);
            this.debugLog("NormalCraftExecuteStart", this.buildCraftExecutionDiagnostics(this.itemType, orderedSelections, resolvedSelection.base));
            await this.onCraftCallback(
                this.itemType,
                resolvedSelection.required.length > 0 ? resolvedSelection.required : undefined,
                resolvedSelection.consumed.length > 0 ? resolvedSelection.consumed : undefined,
                resolvedSelection.base,
            );
            this.scheduleInventoryRefresh();
        } finally {
            this.crafting = false;
            this.flushQueuedInventoryRefresh();
        }
    }

    private showValidationError(msg: string) {
        if (!this.canAccessElements()) return;
        if (this.validationMsg) this.validationMsg.remove();
        this.validationMsg = new Text();
        this.validationMsg.setText(TranslationImpl.generator(msg));
        this.validationMsg.style.set("color", "#ff6666");
        this.validationMsg.style.set("padding", "6px 10px");
        this.validationMsg.style.set("margin-top", "4px");
        this.validationMsg.style.set("border-left", "3px solid #ff4444");
        this.validationMsg.style.set("background", "rgba(255,68,68,0.08)");
        this.normalScrollInner.append(this.validationMsg);
        setTimeout(() => {
            if (!this.canAccessElements()) return;
            this.validationMsg?.remove();
            this.validationMsg = undefined;
        }, 3000);
    }
}

