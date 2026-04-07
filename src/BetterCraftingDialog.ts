import Component from "@wayward/game/ui/component/Component";
import Button from "@wayward/game/ui/component/Button";
import { CheckButton } from "@wayward/game/ui/component/CheckButton";
import Text from "@wayward/game/ui/component/Text";
import TranslationImpl from "@wayward/game/language/impl/TranslationImpl";
import { itemDescriptions } from "@wayward/game/game/item/ItemDescriptions";
import { ItemType, ItemTypeGroup, RecipeLevel } from "@wayward/game/game/item/IItem";
import type { IRecipe, IRecipeComponent } from "@wayward/game/game/item/IItem";
import { SkillType } from "@wayward/game/game/entity/skill/ISkills";
import type Item from "@wayward/game/game/item/Item";
import ItemManager from "@wayward/game/game/item/ItemManager";
import { Article } from "@wayward/game/language/ITranslation";
import { Quality } from "@wayward/game/game/IObject";
import { ActionType } from "@wayward/game/game/entity/action/IAction";
import ItemComponent from "@wayward/game/ui/screen/screens/game/component/ItemComponent";
import { ItemComponentHandler } from "@wayward/game/ui/screen/screens/game/component/item/ItemComponentHandler";
import { HighlightType } from "@wayward/game/ui/util/IHighlight";
import type { HighlightSelector, IHighlight } from "@wayward/game/ui/util/IHighlight";
import { Stat } from "@wayward/game/game/entity/IStats";

type CraftCallback = (itemType: ItemType, tools: Item[] | undefined, consumed: Item[] | undefined, base: Item | undefined) => Promise<void>;
type BulkCraftCallback = (itemType: ItemType, quantity: number, excludedIds: Set<number>) => Promise<void>;

export interface ICraftDisplayResult {
    success: boolean;
    item?: Item;
    itemType: ItemType;
}

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

function getItemId(item: Item): number {
    return (item as any).id as number;
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

function isItemProtected(item: Item): boolean {
    return (item as any).isProtected === true || (item as any).protected === true;
}

// Task 2: Row is ~30% smaller than the original 42px.
// 42 * 0.70 ≈ 29 → use 30px for a clean value.
const ROW_MIN_HEIGHT = 30;   // px (was 42)
const ROW_PADDING_V   = 4;    // px top+bottom (was 8)
const ROW_MARGIN      = 2;    // px top + 2px bottom
const ROW_HEIGHT_PX   = ROW_MIN_HEIGHT + ROW_PADDING_V * 2 + ROW_MARGIN * 2; // ~42px total
const MAX_VISIBLE_ROWS = 5;

/**
 * Approximate stamina cost per craft, keyed by RecipeLevel.
 * Exported so betterCrafting.ts can use the same table for its loop guard.
 */
export const STAMINA_COST_PER_LEVEL: Partial<Record<RecipeLevel, number>> = {
    [RecipeLevel.Simple]:       2,
    [RecipeLevel.Intermediate]: 5,
    [RecipeLevel.Advanced]:    10,
    [RecipeLevel.Expert]:      16,
    [RecipeLevel.Master]:      25,
};

export default class BetterCraftingPanel extends Component {
    public itemType: number = 0;
    private scrollContent: Component;
    private recipe?: IRecipe;
    private onCraftCallback: CraftCallback;
    private onBulkCraftCallback: BulkCraftCallback;
    private craftBtn!: Button;
    private validationMsg?: Text;

    private selectedItems: Map<number, Item[]> = new Map();
    private sectionCounters: Map<number, Text> = new Map();

    /** IDs of items selected before last craft. null = first open. */
    private _pendingSelectionIds: Set<number> | null = null;

    // ── Tooltip state ─────────────────────────────────────────────────────────
    private bcTooltipEl: HTMLDivElement | null = null;
    private _hoveredItem: Item | null = null;
    private _hoveredDisplayName = "";
    private _hoveredMouseX = 0;
    private _hoveredMouseY = 0;
    private shiftHeld = false;

    // ── Resize observer for per-section item list heights ─────────────────────
    private _itemContainerEls: HTMLElement[] = [];
    private _resizeObserver: ResizeObserver | null = null;
    private _bodyEl: HTMLElement | null = null;
    private _outputCardEl: HTMLElement | null = null;

    // ── Tab state ─────────────────────────────────────────────────────────────
    private activeTab: "normal" | "bulk" = "normal";
    private normalTabBtn!: HTMLButtonElement;
    private bulkTabBtn!: HTMLButtonElement;
    private normalBody!: Component;
    private normalFooter!: Component;
    private bulkBody!: Component;
    private bulkFooter!: Component;
    private normalResultsEl!: HTMLDivElement;
    private bulkResultsEl!: HTMLDivElement;

    // ── Bulk crafting state ───────────────────────────────────────────────────
    /** Map<slotIndex, Set<itemId>> — excluded item IDs per ingredient slot. */
    private bulkExcludedIds: Map<number, Set<number>> = new Map();
    /** Last itemType for which bulkExcludedIds was built — used to detect recipe changes. */
    private _lastBulkItemType: number = 0;
    private bulkQuantity: number = 1;
    private bulkQtyInputEl: HTMLInputElement | null = null;
    private bulkMaxLabel: HTMLSpanElement | null = null;
    private bulkCraftBtnEl: Button | null = null;
    private bulkScrollContent!: Component;
    private _bulkItemContainerEls: HTMLElement[] = [];
    private _bulkOutputCardEl: HTMLElement | null = null;
    private _bulkBodyEl: HTMLElement | null = null;
    private _bulkContentDirty = true;
    private bulkStopBtn: Button | null = null;
    private bulkQtyRow: HTMLElement | null = null;
    private bulkProgressEl: HTMLElement | null = null;
    private onBulkAbortCallback: (() => void) | null = null;

    // ── Keyboard / window listeners ───────────────────────────────────────────
    private readonly _onShiftDown = (e: KeyboardEvent) => {
        if (e.key !== "Shift" || this.shiftHeld) return;
        this.shiftHeld = true;
        // Show tooltip immediately if mouse is already over a row.
        if (this._hoveredItem) {
            this.bcShowTooltip(this._hoveredItem, this._hoveredDisplayName, this._hoveredMouseX, this._hoveredMouseY);
        }
    };

    private readonly _onShiftUp = (e: KeyboardEvent) => {
        if (e.key !== "Shift") return;
        this.shiftHeld = false;
        this.bcHideTooltip();
    };

    private readonly _onBlur = () => {
        this.shiftHeld = false;
        this.bcHideTooltip();
    };

    public constructor(onCraft: CraftCallback, onBulkCraft: BulkCraftCallback) {
        super();
        this.onCraftCallback = onCraft;
        this.onBulkCraftCallback = onBulkCraft;

        // ── Global styles (injected once) ────────────────────────────────────
        const STYLE_ID = "better-crafting-styles";
        if (!document.getElementById(STYLE_ID)) {
            const styleEl = document.createElement("style");
            styleEl.id = STYLE_ID;
            styleEl.textContent = `
                /* ── Panel: never fade regardless of Wayward focus state ────── */
                .better-crafting-panel {
                    opacity: 1 !important;
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
                    background: #b09c5a !important;
                    color: #111111 !important;
                    font-weight: bold !important;
                    border: 1px solid #8c7b44 !important;
                    transition: background 0.2s;
                    opacity: 1 !important;
                }
                .better-crafting-craft-btn:hover {
                    background: #c5b272 !important;
                    border: 1px solid #c5b272 !important;
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

                /* ── Tab bar ─────────────────────────────────────────────────── */
                .bc-tab-bar {
                    display: flex;
                    flex-shrink: 0;
                    border-bottom: 1px solid var(--color-border, #554433);
                }
                .bc-tab-btn {
                    flex: 1;
                    padding: 6px 10px;
                    background: rgba(30,22,12,0.6);
                    color: #9a8860;
                    border: none;
                    border-bottom: 2px solid transparent;
                    cursor: pointer;
                    font-size: 0.92em;
                    font-family: inherit;
                    transition: color 0.15s, border-color 0.15s;
                }
                .bc-tab-btn:hover {
                    color: #d4c89a;
                }
                .bc-tab-btn.bc-tab-active {
                    color: #d4c89a;
                    border-bottom: 2px solid #b09c5a;
                    background: rgba(40,30,16,0.8);
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
                .bc-panel-bulk .bc-tab-btn.bc-tab-active {
                    color: #8ab8d8 !important;
                    border-bottom: 2px solid #3a82b8 !important;
                    background: rgba(16, 36, 58, 0.85) !important;
                }
                .bc-panel-bulk .bc-tab-btn:hover {
                    color: #a8d0ef !important;
                }
                /* Section borders */
                .bc-panel-bulk .bc-bulk-section {
                    border: 1px solid #1e3a58 !important;
                }
                /* Output card border */
                .bc-panel-bulk .bc-bulk-output-card {
                    border: 1px solid #1e3a58 !important;
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

                .bc-results-panel {
                    flex-shrink: 0;
                    margin: 0 10px 8px;
                    padding: 8px 10px;
                    border-top: 1px solid rgba(84, 68, 51, 0.7);
                    background: rgba(14, 10, 6, 0.72);
                    display: none;
                }
                .bc-results-title {
                    color: #c8bc8a;
                    font-size: 0.9em;
                    font-weight: bold;
                    letter-spacing: 0.04em;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                }
                .bc-results-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 3px 8px;
                    border-radius: 999px;
                    font-size: 0.88em;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .bc-results-status-success {
                    background: rgba(46, 125, 50, 0.22);
                    color: #8ce29a;
                    border: 1px solid rgba(46, 125, 50, 0.48);
                }
                .bc-results-status-failed {
                    background: rgba(156, 52, 52, 0.22);
                    color: #ff8d8d;
                    border: 1px solid rgba(156, 52, 52, 0.48);
                }
                .bc-results-summary-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .bc-results-summary-line {
                    font-size: 0.95em;
                    line-height: 1.35;
                }
                .bc-results-empty {
                    color: #9a8860;
                    font-size: 0.9em;
                }
                .bc-panel-bulk .bc-results-panel {
                    border-top-color: rgba(74, 143, 204, 0.45);
                    background: rgba(12, 22, 36, 0.62);
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

        this.style.set("width", "fit-content");
        this.style.set("min-width", "840px");
        this.style.set("max-width", "90vw");
        this.style.set("height", "max-content");
        this.style.set("max-height", "84vh");

        this.style.set("resize", "both");
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
            if (t.closest("button, .better-crafting-item-list, input, select")) return;
            const panelRect = this.element.getBoundingClientRect();
            if (e.clientX >= panelRect.right - 20 && e.clientY >= panelRect.bottom - 20) return;

            const scale = this.element.offsetWidth > 0
                ? panelRect.width / this.element.offsetWidth
                : 1;

            const cssLeft  = panelRect.left  / scale;
            const cssTop   = panelRect.top   / scale;
            const startX   = e.clientX;
            const startY   = e.clientY;

            this.style.set("transform", "none");
            this.element.style.left = `${cssLeft}px`;
            this.element.style.top  = `${cssTop}px`;

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
        const tabBar = document.createElement("div");
        tabBar.className = "bc-tab-bar";

        this.normalTabBtn = document.createElement("button");
        this.normalTabBtn.className = "bc-tab-btn bc-tab-active";
        this.normalTabBtn.textContent = "Normal Crafting";
        this.normalTabBtn.addEventListener("click", () => this.switchTab("normal"));

        this.bulkTabBtn = document.createElement("button");
        this.bulkTabBtn.className = "bc-tab-btn";
        this.bulkTabBtn.textContent = "Bulk Crafting";
        this.bulkTabBtn.addEventListener("click", () => this.switchTab("bulk"));

        tabBar.appendChild(this.normalTabBtn);
        tabBar.appendChild(this.bulkTabBtn);
        this.element.appendChild(tabBar);

        // ── Normal: Scrollable body ───────────────────────────────────────────
        this.normalBody = new Component();
        this.normalBody.classes.add("better-crafting-body", "dialog-content");
        this.normalBody.style.set("flex", "1 1 0");
        this.normalBody.style.set("min-height", "0");
        this.normalBody.style.set("overflow-y", "auto");
        this.normalBody.style.set("scrollbar-width", "thin");
        this.normalBody.style.set("scrollbar-color", "#888888 rgba(0,0,0,0.3)");
        this.normalBody.style.set("padding", "8px 10px");
        this._bodyEl = this.normalBody.element;
        this.append(this.normalBody);

        this.scrollContent = new Component();
        this.scrollContent.style.set("display", "flex");
        this.scrollContent.style.set("flex-wrap", "wrap");
        this.scrollContent.style.set("gap", "8px");
        this.scrollContent.style.set("align-items", "flex-start");
        this.normalBody.append(this.scrollContent);

        this.normalResultsEl = this.createResultsContainer();
        this.element.appendChild(this.normalResultsEl);

        // ── Normal: Footer ────────────────────────────────────────────────────
        this.normalFooter = new Component();
        this.normalFooter.classes.add("dialog-footer");
        this.normalFooter.style.set("padding", "8px 10px");
        this.normalFooter.style.set("border-top", "1px solid var(--color-border, #554433)");
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

        const cancelBtn = new Button();
        cancelBtn.classes.add("button-block");
        cancelBtn.setText(TranslationImpl.generator("Cancel"));
        cancelBtn.style.set("background", "rgba(60, 50, 40, 0.8)");
        cancelBtn.style.set("color", "#584848");
        cancelBtn.style.set("padding", "6px 14px");
        cancelBtn.event.subscribe("activate", () => this.hidePanel());
        this.normalFooter.append(cancelBtn);

        // ── Bulk: Scrollable body ─────────────────────────────────────────────
        this.bulkBody = new Component();
        this.bulkBody.classes.add("better-crafting-body", "dialog-content");
        this.bulkBody.style.set("flex", "1 1 0");
        this.bulkBody.style.set("min-height", "0");
        this.bulkBody.style.set("overflow-y", "auto");
        this.bulkBody.style.set("scrollbar-width", "thin");
        this.bulkBody.style.set("scrollbar-color", "#888888 rgba(0,0,0,0.3)");
        this.bulkBody.style.set("padding", "8px 10px");
        this.bulkBody.style.set("display", "none"); // hidden until tab switch
        this._bulkBodyEl = this.bulkBody.element;
        this.append(this.bulkBody);

        this.bulkScrollContent = new Component();
        this.bulkScrollContent.style.set("display", "flex");
        this.bulkScrollContent.style.set("flex-wrap", "wrap");
        this.bulkScrollContent.style.set("gap", "8px");
        this.bulkScrollContent.style.set("align-items", "flex-start");
        this.bulkBody.append(this.bulkScrollContent);

        this.bulkResultsEl = this.createResultsContainer();
        this.element.appendChild(this.bulkResultsEl);

        // ── Bulk: Footer ──────────────────────────────────────────────────────
        this.bulkFooter = new Component();
        this.bulkFooter.classes.add("dialog-footer");
        this.bulkFooter.style.set("padding", "8px 10px");
        this.bulkFooter.style.set("border-top", "1px solid var(--color-border, #554433)");
        this.bulkFooter.style.set("display", "none"); // hidden until tab switch
        this.bulkFooter.style.set("gap", "8px");
        this.bulkFooter.style.set("flex-shrink", "0");
        this.bulkFooter.style.set("justify-content", "flex-end");
        this.bulkFooter.style.set("align-items", "center");
        this.append(this.bulkFooter);

        // Quantity controls row inside bulk footer
        const qtyRow = document.createElement("div");
        qtyRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-right:auto;";

        const qtyLabel = document.createElement("span");
        qtyLabel.textContent = "Qty:";
        qtyLabel.style.cssText = "color:#9a8860;font-size:0.92em;";
        qtyRow.appendChild(qtyLabel);

        const minusBtn = document.createElement("button");
        minusBtn.className = "bc-qty-btn";
        minusBtn.textContent = "−";
        minusBtn.addEventListener("mousedown", (e: MouseEvent) => {
            e.preventDefault();
            const delta = e.ctrlKey ? 100 : e.shiftKey ? 10 : 1;
            this.adjustBulkQty(-delta);
        });
        qtyRow.appendChild(minusBtn);

        this.bulkQtyInputEl = document.createElement("input");
        this.bulkQtyInputEl.type = "number";
        this.bulkQtyInputEl.className = "bc-qty-input";
        this.bulkQtyInputEl.min = "1";
        this.bulkQtyInputEl.value = String(this.bulkQuantity);
        this.bulkQtyInputEl.addEventListener("change", () => {
            const v = parseInt(this.bulkQtyInputEl!.value, 10);
            if (!isNaN(v) && v >= 1) {
                const max = this.computeBulkMax();
                // Clamp to max regardless of whether max is 0; floor to 1 for display
                // (craft button is disabled when max === 0 via updateBulkCraftBtnState).
                this.bulkQuantity = max > 0 ? Math.min(v, max) : 1;
                if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
                this.updateBulkMaxDisplay();
                this.updateBulkCraftBtnState();
            } else {
                this.bulkQtyInputEl!.value = String(this.bulkQuantity);
            }
        });
        qtyRow.appendChild(this.bulkQtyInputEl);

        const plusBtn = document.createElement("button");
        plusBtn.className = "bc-qty-btn";
        plusBtn.textContent = "+";
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

        this.bulkCraftBtnEl = new Button();
        this.bulkCraftBtnEl.classes.add("button-block", "better-crafting-craft-btn", "bc-craft-disabled");
        this.bulkCraftBtnEl.setText(TranslationImpl.generator("Bulk Craft"));
        this.bulkCraftBtnEl.style.set("padding", "6px 14px");
        this.bulkCraftBtnEl.event.subscribe("activate", () => this.onBulkCraft());
        this.bulkFooter.append(this.bulkCraftBtnEl);

        const bulkCancelBtn = new Button();
        bulkCancelBtn.classes.add("button-block");
        bulkCancelBtn.setText(TranslationImpl.generator("Cancel"));
        bulkCancelBtn.style.set("background", "rgba(60, 50, 40, 0.8)");
        bulkCancelBtn.style.set("color", "#584848");
        bulkCancelBtn.style.set("padding", "6px 14px");
        bulkCancelBtn.event.subscribe("activate", () => this.hidePanel());
        this.bulkFooter.append(bulkCancelBtn);

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

        // ── Task 3: ResizeObserver — update per-section list heights on resize ─
        this._resizeObserver = new ResizeObserver(() => this._updateItemListHeights());
        this._resizeObserver.observe(this.element);
    }

    /** Call when the mod unloads to clean up listeners and observers. */
    public destroyListeners(): void {
        document.removeEventListener("keydown", this._onShiftDown);
        document.removeEventListener("keyup", this._onShiftUp);
        window.removeEventListener("blur", this._onBlur);
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        this.bcTooltipEl?.remove();
        this.bcTooltipEl = null;
    }

    // ── Tab switching ─────────────────────────────────────────────────────────

    private switchTab(tab: "normal" | "bulk"): void {
        if (this.activeTab === tab) {
            this.syncResultsVisibility();
            return;
        }
        this.activeTab = tab;

        if (tab === "normal") {
            this.normalTabBtn.classList.add("bc-tab-active");
            this.bulkTabBtn.classList.remove("bc-tab-active");
            this.normalBody.style.set("display", "");
            this.normalFooter.style.set("display", "flex");
            this.bulkBody.style.set("display", "none");
            this.bulkFooter.style.set("display", "none");
            // Remove blue theme when returning to normal tab.
            this.element.classList.remove("bc-panel-bulk");
            if (this._bodyEl) {
                this._bodyEl.style.flex = "1 1 0";
                this._bodyEl.style.minHeight = "0";
            }
        } else {
            this.bulkTabBtn.classList.add("bc-tab-active");
            this.normalTabBtn.classList.remove("bc-tab-active");
            this.normalBody.style.set("display", "none");
            this.normalFooter.style.set("display", "none");
            this.bulkBody.style.set("display", "");
            this.bulkFooter.style.set("display", "flex");
            // Apply blue theme when switching to bulk tab.
            this.element.classList.add("bc-panel-bulk");
            if (this._bulkBodyEl) {
                this._bulkBodyEl.style.flex = "1 1 0";
                this._bulkBodyEl.style.minHeight = "0";
            }
            // Rebuild bulk content if recipe changed since last visit.
            if (this._bulkContentDirty) {
                this.buildBulkContent();
            }
        }
        this.syncResultsVisibility();
        this._updateItemListHeights();
    }

    public showPanel() {
        // Always start on the single-craft tab regardless of which tab was active on close.
        this.switchTab("normal");

        this.style.set("width", "fit-content");
        this.element.style.height = "";

        if (this._bodyEl) {
            this._bodyEl.style.flex    = "1 1 auto";
            this._bodyEl.style.minHeight = "";
        }

        this.style.set("display", "flex");
        this.updateHighlights();

        requestAnimationFrame(() => {
            if (!this.element) return;

            const maxH    = Math.floor(window.innerHeight * 0.84);
            const natural = this.element.offsetHeight;
            if (natural > 40) {
                this.element.style.height = `${Math.min(natural, maxH)}px`;
            }

            if (this._bodyEl) {
                this._bodyEl.style.flex      = "1 1 0px";
                this._bodyEl.style.minHeight = "0";
            }
        });
    }

    public hidePanel() {
        // If a bulk craft is active, abort it before hiding.
        if (this.bulkCrafting) this.onBulkAbortCallback?.();
        // Reset exclusion state so the next open starts clean.
        this.bulkExcludedIds.clear();
        this._lastBulkItemType = 0;
        this.clearResults();
        this.style.set("display", "none");
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

    /** Swap UI to "in-progress" state: hide craft controls, show stop button and progress. */
    public onBulkCraftStart(total: number): void {
        if (this.bulkCraftBtnEl) this.bulkCraftBtnEl.style.set("display", "none");
        if (this.bulkQtyRow) this.bulkQtyRow.style.display = "none";
        if (this.bulkProgressEl) {
            this.bulkProgressEl.textContent = `Crafting 0 / ${total}`;
            this.bulkProgressEl.style.display = "";
        }
        if (this.bulkStopBtn) this.bulkStopBtn.style.set("display", "");
    }

    /** Update the progress label after each craft iteration. */
    public setBulkProgress(current: number, total: number): void {
        if (this.bulkProgressEl) {
            this.bulkProgressEl.textContent = `Crafting ${current} / ${total}`;
        }
    }

    /** Restore UI after bulk craft completes or is aborted. */
    public onBulkCraftEnd(): void {
        if (this.bulkStopBtn) this.bulkStopBtn.style.set("display", "none");
        if (this.bulkProgressEl) this.bulkProgressEl.style.display = "none";
        if (this.bulkCraftBtnEl) this.bulkCraftBtnEl.style.set("display", "");
        if (this.bulkQtyRow) this.bulkQtyRow.style.display = "";
        this._bulkContentDirty = true;
        if (this.panelVisible) this.buildBulkContent();
    }

    // ── Highlight helpers ─────────────────────────────────────────────────────

    private updateHighlights() {
        this.clearHighlights();
        if (!this.recipe) return;
        const selectors: HighlightSelector[] = [];
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
        if (selectors.length > 0) ui?.highlights?.start(this, { selectors } as IHighlight);
    }

    private clearHighlights() {
        ui?.highlights?.end(this);
    }

    // ── Recipe rendering ──────────────────────────────────────────────────────

    public updateRecipe(itemType: number, clearResults = true) {
        this.itemType = itemType;
        const pendingIds = this._pendingSelectionIds;
        this._pendingSelectionIds = null;

        this.selectedItems.clear();
        this.sectionCounters.clear();
        this._itemContainerEls = [];
        this._outputCardEl = null;
        this.scrollContent.dump();

        const desc = itemDescriptions[itemType as ItemType];
        this.recipe = desc?.recipe;

        // Mark bulk content dirty whenever recipe changes.
        this._bulkContentDirty = true;
        if (clearResults) this.clearResults();

        if (!this.recipe) {
            const noRecipe = new Text();
            noRecipe.setText(TranslationImpl.generator("No recipe found for this item."));
            noRecipe.style.set("color", "#ff6666");
            this.scrollContent.append(noRecipe);
            this.updateCraftButtonState();
            return;
        }

        // Pre-populate selections before building sections.
        if (this.recipe.baseComponent !== undefined) {
            const items = this.findMatchingItems(this.recipe.baseComponent);
            const pre = this.getPreSelectedItems(items, 1, pendingIds);
            if (pre.length) this.selectedItems.set(-1, pre);
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const component = this.recipe.components[i];
            const items = this.findMatchingItems(component.type);
            const pre = this.getPreSelectedItems(items, component.requiredAmount, pendingIds);
            if (pre.length) this.selectedItems.set(i, pre);
        }

        this.buildOutputCard(itemType as ItemType, this.recipe, false);
        if (this.recipe.baseComponent !== undefined) this.addBaseComponentSection(this.recipe.baseComponent);
        for (let i = 0; i < this.recipe.components.length; i++) this.addComponentSection(i, this.recipe.components[i]);

        this.updateCraftButtonState();

        // If currently on bulk tab, rebuild it immediately.
        if (this.activeTab === "bulk") {
            this.buildBulkContent();
        }

        this._updateItemListHeights();
    }

    // ── Pre-selection helper ──────────────────────────────────────────────────

    private getPreSelectedItems(items: Item[], maxCount: number, pendingIds: Set<number> | null): Item[] {
        if (pendingIds !== null) {
            const restored = items.filter(item => pendingIds.has(getItemId(item)));
            if (restored.length >= maxCount) return restored.slice(0, maxCount);
            // Some previously-selected items survive (e.g. tool slots) but not enough to fill
            // the requirement — supplement with other available items rather than returning short.
            if (restored.length > 0) {
                const restoredIds = new Set(restored.map(item => getItemId(item)));
                const extras = items.filter(item => !restoredIds.has(getItemId(item)));
                return [...restored, ...extras].slice(0, maxCount);
            }
        }
        return items.slice(0, maxCount);
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
                if ((this.selectedItems.get(i) || []).length < this.recipe.components[i].requiredAmount) {
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

    private updateCounter(slotIndex: number, maxSelect: number) {
        const counter = this.sectionCounters.get(slotIndex);
        if (!counter) return;
        const count = (this.selectedItems.get(slotIndex) || []).length;
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
        } catch { /* silent */ }
        row1.appendChild(iconHolder);

        const itemName = (() => {
            try { return fmt(ItemType[itemType] || `Item ${itemType}`); }
            catch { return `Item ${itemType}`; }
        })();
        const nameSpan = document.createElement("span");
        nameSpan.textContent = itemName;
        nameSpan.style.cssText = "color:#d4c89a;font-weight:600;font-size:1.2em;flex-shrink:0;";
        row1.appendChild(nameSpan);

        const inlineStat = (label: string, value: string) => {
            const s = document.createElement("span");
            s.style.cssText = "color:#9a8860;font-size:0.9em;white-space:nowrap;";
            s.innerHTML = `${label}: <span style="color:#c0b080">${value}</span>`;
            row1.appendChild(s);
        };

        inlineStat("Difficulty", fmt(RecipeLevel[recipe.level] ?? String(recipe.level)));
        inlineStat("Skill", fmt(SkillType[recipe.skill] ?? String(recipe.skill)));
        if (desc?.durability !== undefined) inlineStat("Durability", String(desc.durability));
        const w = desc?.weightRange
            ? `${desc.weightRange[0].toFixed(1)}–${desc.weightRange[1].toFixed(1)}`
            : desc?.weight !== undefined ? desc.weight.toFixed(1) : null;
        if (w) inlineStat("Weight", w);

        card.element.appendChild(row1);

        if (desc?.group && desc.group.length > 0) {
            const groupLine = document.createElement("div");
            groupLine.style.cssText = "font-size:0.85em;color:#9a8860;";
            const parts = desc.group.map(g => {
                const tierNum = (desc as any)?.tier?.[g] as number | undefined;
                const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                return `<span style="color:#c0b080">${fmt(ItemTypeGroup[g] || `Group ${g}`)}${tierStr}</span>`;
            });
            groupLine.innerHTML = `Groupings: ${parts.join(", ")}`;
            card.element.appendChild(groupLine);
        }

        if (desc?.use && desc.use.length > 0) {
            const useLine = document.createElement("div");
            useLine.style.cssText = "font-size:0.85em;color:#9a8860;";
            const parts = desc.use.map(u => {
                const tierNum = (desc as any)?.actionTier?.[u] as number | undefined;
                const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                return `<span style="color:#c0b080">${fmt(ActionType[u] || `Action ${u}`)}${tierStr}</span>`;
            });
            useLine.innerHTML = `Uses: ${parts.join(", ")}`;
            card.element.appendChild(useLine);
        }

        if (isBulk) {
            // Class used by the blue theme CSS selector.
            card.classes.add("bc-bulk-output-card");
            this._bulkOutputCardEl = card.element;
            this.bulkScrollContent.append(card);
        } else {
            const qualityNote = document.createElement("div");
            qualityNote.style.cssText = "font-size:0.85em;color:#7a6850;font-style:italic;";
            qualityNote.textContent = "Quality depends on your crafting skill level.";
            card.element.appendChild(qualityNote);
            this._outputCardEl = card.element;
            this.scrollContent.append(card);
        }
    }

    private addBaseComponentSection(baseType: ItemType | ItemTypeGroup) {
        const section = this.createSection();
        const labelRow = this.createLabelRow();

        const label = new Text();
        label.classes.add("better-crafting-heading");
        label.setText(TranslationImpl.generator(`Base: ${this.getTypeName(baseType)}`));
        label.style.set("font-weight", "bold");
        labelRow.append(label);

        const counter = new Text();
        counter.setText(TranslationImpl.generator("0/1"));
        counter.style.set("color", "#c8bc8a");
        counter.style.set("font-size", "0.9em");
        counter.style.set("margin-left", "8px");
        labelRow.append(counter);
        this.sectionCounters.set(-1, counter);
        section.append(labelRow);

        const itemsContainer = this.createItemsContainer();
        section.append(itemsContainer);

        const items = this.findMatchingItems(baseType);
        if (items.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            for (const item of items) this.addItemRow(itemsContainer, -1, item, 1);
        }
        this.updateCounter(-1, 1);
        this.scrollContent.append(section);
    }

    private addComponentSection(index: number, component: IRecipeComponent) {
        const section = this.createSection();
        const consumed  = component.consumedAmount > 0;
        const maxSelect = component.requiredAmount;
        const labelRow  = this.createLabelRow();

        const label = new Text();
        label.classes.add("better-crafting-heading");
        label.setText(TranslationImpl.generator(
            `${this.getTypeName(component.type)} \u00d7${maxSelect}${consumed ? " (consumed)" : " (tool)"}`
        ));
        label.style.set("font-weight", "bold");
        labelRow.append(label);

        const counter = new Text();
        counter.setText(TranslationImpl.generator(`0/${maxSelect}`));
        counter.style.set("color", "#c8bc8a");
        counter.style.set("font-size", "0.9em");
        counter.style.set("margin-left", "8px");
        labelRow.append(counter);
        this.sectionCounters.set(index, counter);
        section.append(labelRow);

        const itemsContainer = this.createItemsContainer();
        section.append(itemsContainer);

        const items = this.findMatchingItems(component.type);
        if (items.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            for (const item of items) this.addItemRow(itemsContainer, index, item, maxSelect);
        }
        this.updateCounter(index, maxSelect);
        this.scrollContent.append(section);
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    private createSection(): Component {
        const section = new Component();
        section.style.set("flex", "1 1 290px");
        section.style.set("min-width", "290px");
        section.style.set("max-width", "calc(50% - 4px)");
        section.style.set("box-sizing", "border-box");
        section.style.set("padding", "6px 8px");
        section.style.set("border", "1px solid var(--color-border, #554433)");
        section.style.set("border-radius", "3px");
        return section;
    }

    private createLabelRow(): Component {
        const row = new Component();
        row.style.set("display", "flex");
        row.style.set("justify-content", "space-between");
        row.style.set("align-items", "center");
        row.style.set("margin-bottom", "4px");
        row.style.set("padding", "4px 4px 4px 8px");
        return row;
    }

    private createItemsContainer(target: HTMLElement[] = this._itemContainerEls): Component {
        const container = new Component();
        container.classes.add("better-crafting-item-list");
        container.style.set("max-height", `${ROW_HEIGHT_PX * MAX_VISIBLE_ROWS}px`);
        container.style.set("overflow-y", "auto");
        container.style.set("overflow-x", "hidden");
        target.push(container.element);
        return container;
    }

    private makeFullWidthWrapper(): Component {
        const wrapper = new Component();
        wrapper.style.set("flex", "1 1 100%");
        wrapper.style.set("width", "100%");
        return wrapper;
    }

    private appendMissing(parent: Component) {
        const missing = new Text();
        missing.setText(TranslationImpl.generator("  \u2717 None in inventory"));
        missing.style.set("color", "#cc4444");
        missing.style.set("font-style", "italic");
        parent.append(missing);
    }

    // ── Dynamic item list heights ─────────────────────────────────────────────

    private _updateItemListHeights(): void {
        const isBulk = this.activeTab === "bulk";
        const containerEls  = isBulk ? this._bulkItemContainerEls : this._itemContainerEls;
        const bodyEl        = isBulk ? this._bulkBodyEl            : this._bodyEl;
        const outputCardEl  = isBulk ? this._bulkOutputCardEl      : this._outputCardEl;

        const n = containerEls.length;
        if (n === 0 || !this.element || !bodyEl) return;

        const panelH = this.element.getBoundingClientRect().height;
        if (panelH < 10) return;

        const FOOTER_AND_PADDING = 68;
        const TAB_BAR_H          = 34;
        const GAP                = 8;
        const SECTION_LABEL_H    = 38;
        const SECTION_BORDER_PAD = 14;

        const infoCardH    = outputCardEl ? outputCardEl.getBoundingClientRect().height : 0;
        const infoCardTotal = infoCardH > 0 ? infoCardH + GAP : 0;
        const bodyH        = panelH - FOOTER_AND_PADDING - TAB_BAR_H - infoCardTotal;

        const numGridRows  = Math.ceil(n / 2);
        const perGridRow   = Math.floor((bodyH - Math.max(0, numGridRows - 1) * GAP) / numGridRows);
        const listMaxH     = Math.max(ROW_HEIGHT_PX, perGridRow - SECTION_LABEL_H - SECTION_BORDER_PAD);

        for (const el of containerEls) {
            el.style.maxHeight = `${listMaxH}px`;
        }
    }

    // ── Item row ──────────────────────────────────────────────────────────────

    private addItemRow(parent: Component, slotIndex: number, item: Item, maxSelect: number) {
        const qualityColor   = getQualityColor(item.quality);
        const borderBase     = `1px solid ${qualityColor}33`;
        const borderHover    = `1px solid ${qualityColor}77`;
        const borderSelected = `1px solid ${qualityColor}`;

        const preSelected = (this.selectedItems.get(slotIndex) || []).indexOf(item) >= 0;

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");

        row.style.set("border",      preSelected ? borderSelected : borderBase);
        row.style.set("background",  preSelected ? "rgba(30, 255, 128, 0.1)" : "transparent");

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

            if ((this.selectedItems.get(slotIndex) || []).indexOf(item) < 0) {
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
                row.style.set("background", "transparent");
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
        } catch { /* silent */ }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

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
            const selected = this.selectedItems.get(slotIndex) || [];
            const idx = selected.indexOf(item);
            if (idx >= 0) {
                selected.splice(idx, 1);
                check.setChecked(false, false);
                row.style.set("background", "transparent");
                row.style.set("border", borderBase);
            } else {
                if (selected.length >= maxSelect) return;
                selected.push(item);
                check.setChecked(true, false);
                row.style.set("background", "rgba(30, 255, 128, 0.1)");
                row.style.set("border", borderSelected);
            }
            this.selectedItems.set(slotIndex, selected);
            this.updateCounter(slotIndex, maxSelect);
        });

        parent.append(row);
    }

    // ── Bulk content builders ─────────────────────────────────────────────────

    /**
     * Rebuilds the bulk tab content. Clears exclusion state for slots that no
     * longer have items, resets the quantity to 1, and redraws all sections.
     */
    private buildBulkContent(): void {
        this._bulkContentDirty = false;
        this._bulkItemContainerEls = [];
        this._bulkOutputCardEl = null;
        this.bulkScrollContent.dump();

        if (!this.recipe) {
            const noRecipe = new Text();
            noRecipe.setText(TranslationImpl.generator("No recipe found for this item."));
            noRecipe.style.set("color", "#ff6666");
            this.bulkScrollContent.append(noRecipe);
            this.updateBulkCraftBtnState();
            return;
        }

        // Only clear exclusions when the recipe actually changes — preserve them across
        // batches for the same recipe so the user doesn't have to re-exclude every time.
        if (this.itemType !== this._lastBulkItemType) {
            this.bulkExcludedIds.clear();
            this._lastBulkItemType = this.itemType;
        }

        this.buildOutputCard(this.itemType as ItemType, this.recipe, true);
        this.addBulkHelpBox();
        this.addBulkMaterialsHeader();

        if (this.recipe.baseComponent !== undefined) {
            this.addBulkComponentSection(-1, this.recipe.baseComponent, 1, false);
        }
        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            this.addBulkComponentSection(i, comp.type, comp.requiredAmount, comp.consumedAmount > 0);
        }

        this.bulkQuantity = 1;
        if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = "1";
        this.updateBulkMaxDisplay();
        this.updateBulkCraftBtnState();
        this._updateItemListHeights();
    }

    /**
     * Renders a static info callout explaining how bulk crafting works.
     * Placed between the output card and the ingredient sections.
     */
    private addBulkHelpBox(): void {
        const wrapper = document.createElement("div");
        wrapper.className = "bc-bulk-help-box";

        const title = document.createElement("div");
        title.className = "bc-bulk-help-title";
        title.textContent = "How Bulk Crafting Works";
        wrapper.appendChild(title);

        const rows: [string, string][] = [
            ["Turns", "Each craft uses one game turn — enemies act between iterations."],
            ["Exclude", "Click any ingredient below to <strong>exclude</strong> it. Excluded items are never consumed."],
            ["Protected", "<strong>Protected items</strong> are excluded automatically and cannot be toggled."],
            ["Quantity", "<strong>Shift+click ×10</strong> or <strong>Ctrl+click ×100</strong> on ± to adjust faster."],
        ];

        for (const [label, html] of rows) {
            const row = document.createElement("div");
            row.className = "bc-bulk-help-row";
            row.innerHTML = `<strong>${label}:</strong> ${html}`;
            wrapper.appendChild(row);
        }

        // Wrap in a full-width flex item so the grid doesn't collapse it.
        const container = this.makeFullWidthWrapper();
        container.element.appendChild(wrapper);
        this.bulkScrollContent.append(container);
    }

    /**
     * Renders a divider header labelling the ingredients grid with the
     * "click to exclude" call-to-action.
     */
    private addBulkMaterialsHeader(): void {
        const el = document.createElement("div");
        el.className = "bc-bulk-materials-header";
        el.textContent = "Materials — Click to Exclude";

        const container = this.makeFullWidthWrapper();
        container.element.appendChild(el);
        this.bulkScrollContent.append(container);
    }

    private addBulkComponentSection(
        slotIndex: number,
        type: ItemType | ItemTypeGroup,
        requiredAmount: number,
        consumed: boolean,
    ): void {
        const section = this.createSection();
        // Blue theme CSS selector targets this class on bulk sections.
        section.classes.add("bc-bulk-section");

        const labelRow = this.createLabelRow();
        const label = new Text();
        label.classes.add("better-crafting-heading");
        const prefix = slotIndex === -1 ? "Base: " : "";
        label.setText(TranslationImpl.generator(
            `${prefix}${this.getTypeName(type)} \u00d7${requiredAmount}${consumed ? " (consumed)" : " (tool)"}`
        ));
        label.style.set("font-weight", "bold");
        labelRow.append(label);
        section.append(labelRow);

        const itemsContainer = this.createItemsContainer(this._bulkItemContainerEls);
        section.append(itemsContainer);

        const items = this.findMatchingItems(type);
        if (items.length === 0) {
            this.appendMissing(itemsContainer);
        } else {
            if (!this.bulkExcludedIds.has(slotIndex)) {
                this.bulkExcludedIds.set(slotIndex, new Set<number>());
            }
            for (const item of items) {
                this.addBulkItemRow(itemsContainer, slotIndex, item);
            }
        }

        this.bulkScrollContent.append(section);
    }

    private addBulkItemRow(parent: Component, slotIndex: number, item: Item): void {
        const qualityColor = getQualityColor(item.quality);
        const itemId = getItemId(item);

        // Protected items are excluded by default and cannot be un-excluded.
        const autoExcluded = isItemProtected(item);
        if (autoExcluded) {
            const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set<number>();
            excludedSet.add(itemId);
            this.bulkExcludedIds.set(slotIndex, excludedSet);
        }

        const isExcluded = () => this.bulkExcludedIds.get(slotIndex)?.has(itemId) ?? false;

        const row = new Button();
        row.style.set("display", "flex");
        row.style.set("align-items", "center");
        row.style.set("padding", `${ROW_PADDING_V}px 6px`);
        row.style.set("min-height", `${ROW_MIN_HEIGHT}px`);
        row.style.set("width", "100%");
        row.style.set("margin", `${ROW_MARGIN}px 0`);
        row.style.set("cursor", autoExcluded ? "not-allowed" : "pointer");
        row.style.set("border-radius", "2px");
        row.style.set("box-sizing", "border-box");
        row.style.set("overflow", "visible");
        row.style.set("border", `1px solid ${qualityColor}33`);
        row.style.set("background", "transparent");

        if (autoExcluded) {
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
        } catch { /* silent */ }

        const nameText = new Text();
        nameText.setText(TranslationImpl.generator(displayName));
        nameText.style.set("color", qualityColor);
        nameText.style.set("flex", "1");
        nameText.style.set("font-size", "inherit");
        row.append(nameText);

        const exclIndicator = document.createElement("span");
        exclIndicator.style.cssText = "font-size:0.85em;margin-left:4px;color:#cc4444;flex-shrink:0;";
        exclIndicator.textContent = isExcluded() ? "✗" : "";
        row.element.appendChild(exclIndicator);

        if (!autoExcluded) {
            row.element.addEventListener("mouseenter", () => {
                if (!isExcluded()) {
                    row.style.set("background", "rgba(255, 255, 255, 0.05)");
                    row.style.set("border", `1px solid ${qualityColor}55`);
                }
            });
            row.element.addEventListener("mouseleave", () => {
                if (!isExcluded()) {
                    row.style.set("background", "transparent");
                    row.style.set("border", `1px solid ${qualityColor}33`);
                }
            });

            row.event.subscribe("activate", () => {
                const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set<number>();
                if (excludedSet.has(itemId)) {
                    excludedSet.delete(itemId);
                    row.classes.remove("bc-bulk-row-excluded");
                    exclIndicator.textContent = "";
                    row.style.set("background", "transparent");
                    row.style.set("border", `1px solid ${qualityColor}33`);
                } else {
                    excludedSet.add(itemId);
                    row.classes.add("bc-bulk-row-excluded");
                    exclIndicator.textContent = "✗";
                    row.style.set("background", "transparent");
                    row.style.set("border", `1px solid ${qualityColor}33`);
                }
                this.bulkExcludedIds.set(slotIndex, excludedSet);
                this.updateBulkMaxDisplay();
                this.updateBulkCraftBtnState();
            });
        }

        parent.append(row);
    }

    // ── Bulk quantity helpers ─────────────────────────────────────────────────

    /** Returns the stamina-based and material-based craft limits independently. */
    private computeBulkLimits(): { staminaMax: number; materialMax: number } {
        if (!this.recipe || !localPlayer?.island) return { staminaMax: 0, materialMax: 0 };

        const staminaCost = STAMINA_COST_PER_LEVEL[this.recipe.level as RecipeLevel] ?? 4;
        const currentStamina: number =
            (localPlayer as any).stat?.get?.(Stat.Stamina)?.value ?? 0;
        const staminaMax = staminaCost > 0 ? Math.floor(currentStamina / staminaCost) : 9999;

        let materialMax = 9999;

        // Base component (slot -1) — always consumed
        if (this.recipe.baseComponent !== undefined) {
            const excluded = this.bulkExcludedIds.get(-1) ?? new Set<number>();
            const available = this.findMatchingItems(this.recipe.baseComponent)
                .filter(item => !excluded.has(getItemId(item)));
            materialMax = Math.min(materialMax, available.length);
        }

        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            if (comp.consumedAmount <= 0) continue; // tool — not consumed
            const excluded = this.bulkExcludedIds.get(i) ?? new Set<number>();
            const available = this.findMatchingItems(comp.type)
                .filter(item => !excluded.has(getItemId(item)));
            const perCraft = comp.requiredAmount;
            if (perCraft <= 0) continue;
            materialMax = Math.min(materialMax, Math.floor(available.length / perCraft));
        }

        return { staminaMax, materialMax };
    }

    /**
     * Computes the maximum craftable quantity given current exclusions and
     * the player's current stamina. Returns 0 if not craftable at all.
     */
    private computeBulkMax(): number {
        const { staminaMax, materialMax } = this.computeBulkLimits();
        return Math.max(0, Math.min(staminaMax, materialMax));
    }

    private updateBulkMaxDisplay(): void {
        const { staminaMax, materialMax } = this.computeBulkLimits();
        const max = Math.max(0, Math.min(staminaMax, materialMax));
        if (this.bulkMaxLabel) {
            if (max > 0) {
                this.bulkMaxLabel.textContent = `(max ${max})`;
                this.bulkMaxLabel.style.color = "#7a6850";
            } else {
                this.bulkMaxLabel.textContent = (staminaMax === 0 && materialMax > 0)
                    ? "(insufficient stamina)"
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
        const max = this.computeBulkMax();
        let newQty = this.bulkQuantity + delta;
        // Clamp to [1, max] when max > 0; when max === 0, pin to 1 so + does nothing.
        const effectiveMax = max > 0 ? max : 1;
        if (newQty > effectiveMax) newQty = effectiveMax;
        if (newQty < 1) newQty = 1;
        this.bulkQuantity = newQty;
        if (this.bulkQtyInputEl) this.bulkQtyInputEl.value = String(this.bulkQuantity);
        this.updateBulkMaxDisplay();
        this.updateBulkCraftBtnState();
    }

    private updateBulkCraftBtnState(): void {
        if (!this.bulkCraftBtnEl) return;
        const max = this.computeBulkMax();
        const canCraft = max > 0 && this.bulkQuantity >= 1;
        if (canCraft) {
            this.bulkCraftBtnEl.classes.remove("bc-craft-disabled");
        } else {
            this.bulkCraftBtnEl.classes.add("bc-craft-disabled");
        }
    }

    // ── Bulk craft execution ──────────────────────────────────────────────────

    private bulkCrafting = false;

    private async onBulkCraft(): Promise<void> {
        if (this.bulkCrafting || !this.itemType || !this.recipe) return;
        const max = this.computeBulkMax();
        if (max <= 0 || this.bulkQuantity < 1) return;

        // Flatten all exclusion sets into a single set of item IDs.
        const flatExcluded = new Set<number>();
        for (const [, excludedSet] of this.bulkExcludedIds) {
            for (const id of excludedSet) flatExcluded.add(id);
        }

        this.bulkCrafting = true;
        try {
            await this.onBulkCraftCallback(
                this.itemType as ItemType,
                this.bulkQuantity,
                flatExcluded,
            );
            // Rebuild bulk content after crafting — materials have been consumed.
            this._bulkContentDirty = true;
            this.buildBulkContent();
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
    ): { tools: Item[]; consumed: Item[]; base: Item | undefined } | null {
        const recipe = itemDescriptions[itemType]?.recipe;
        if (!recipe) return null;

        const tools: Item[]    = [];
        const consumed: Item[] = [];
        let base: Item | undefined;

        // Resolve base component.
        if (recipe.baseComponent !== undefined) {
            const candidates = this.findMatchingItems(recipe.baseComponent)
                .filter(item => !excludedIds.has(getItemId(item)) && !isItemProtected(item));
            if (candidates.length === 0) return null;
            base = candidates[0];
        }

        // Resolve each ingredient slot.
        for (let i = 0; i < recipe.components.length; i++) {
            const comp = recipe.components[i];
            const candidates = this.findMatchingItems(comp.type)
                .filter(item => !excludedIds.has(getItemId(item)) && !isItemProtected(item));

            if (candidates.length < comp.requiredAmount) return null;

            const picked = candidates.slice(0, comp.requiredAmount);
            if (comp.consumedAmount > 0) {
                consumed.push(...picked);
            } else {
                tools.push(...picked);
            }
        }

        return { tools, consumed, base };
    }

    // ── Custom Tooltip (Task 1) ───────────────────────────────────────────────

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
                const durEl = document.createElement("span");
                durEl.style.cssText = "color:#9a8860;font-size:0.9em;";
                durEl.innerHTML = `Durability: <span style="color:#c0b080">${dur}/${durMax}</span>`;
                propsRow.appendChild(durEl);
            }
            const weightEl = document.createElement("span");
            weightEl.style.cssText = "color:#9a8860;font-size:0.9em;";
            weightEl.innerHTML = `Weight: <span style="color:#c0b080">${item.weight.toFixed(1)}</span>`;
            propsRow.appendChild(weightEl);
        } else if (desc) {
            if (desc.durability !== undefined) {
                const durEl = document.createElement("span");
                durEl.style.cssText = "color:#9a8860;font-size:0.9em;";
                durEl.innerHTML = `Durability: <span style="color:#5eff80">${desc.durability}</span>`;
                propsRow.appendChild(durEl);
            }
            const w = desc.weightRange ? `${desc.weightRange[0].toFixed(1)}–${desc.weightRange[1].toFixed(1)}` : desc.weight !== undefined ? desc.weight.toFixed(1) : null;
            if (w) {
                const weightEl = document.createElement("span");
                weightEl.style.cssText = "color:#9a8860;font-size:0.9em;";
                weightEl.innerHTML = `Weight: <span style="color:#c0b080">${w}</span>`;
                propsRow.appendChild(weightEl);
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

    public clearResults(): void {
        this.clearResultsContainer(this.normalResultsEl);
        this.clearResultsContainer(this.bulkResultsEl);
        this.syncResultsVisibility();
    }

    public showSingleCraftResult(result: ICraftDisplayResult): void {
        this.renderSingleCraftResult(this.normalResultsEl, result);
        this.activeTab = "normal";
        this.syncResultsVisibility();
    }

    public showBulkCraftResults(results: ICraftDisplayResult[]): void {
        this.renderBulkCraftResults(this.bulkResultsEl, results);
        this.syncResultsVisibility();
    }

    private createResultsContainer(): HTMLDivElement {
        const el = document.createElement("div");
        el.className = "bc-results-panel";
        return el;
    }

    private clearResultsContainer(el: HTMLDivElement): void {
        el.innerHTML = "";
        el.style.display = "none";
    }

    private syncResultsVisibility(): void {
        if (this.normalResultsEl) {
            this.normalResultsEl.style.display = this.activeTab === "normal" && this.normalResultsEl.childElementCount > 0
                ? ""
                : "none";
        }

        if (this.bulkResultsEl) {
            this.bulkResultsEl.style.display = this.activeTab === "bulk" && this.bulkResultsEl.childElementCount > 0
                ? ""
                : "none";
        }
    }

    private renderSingleCraftResult(el: HTMLDivElement, result: ICraftDisplayResult): void {
        el.innerHTML = "";
        el.appendChild(this.createResultsTitle("Craft Result"));

        const status = document.createElement("div");
        status.className = `bc-results-status ${result.success ? "bc-results-status-success" : "bc-results-status-failed"}`;
        status.textContent = result.success ? "Success" : "Failed";
        el.appendChild(status);

        if (result.item) {
            this.bcFillTooltipForItem(el, result.item.type, this.getDisplayName(result.item), result.item);
        } else {
            const msg = document.createElement("div");
            msg.className = "bc-results-empty";
            msg.textContent = `No ${this.formatEnumName(ItemType[result.itemType] || `Item ${result.itemType}`)} was crafted.`;
            el.appendChild(msg);
        }
    }

    private renderBulkCraftResults(el: HTMLDivElement, results: ICraftDisplayResult[]): void {
        el.innerHTML = "";
        el.appendChild(this.createResultsTitle("Craft Results"));

        const list = document.createElement("div");
        list.className = "bc-results-summary-list";
        const failures = results.filter(result => !result.success || !result.item).length;
        const counts = new Map<string, { count: number; color: string; sortKey: number }>();

        for (const result of results) {
            if (!result.success || !result.item) continue;

            const item = result.item;
            const name = this.getDisplayName(item);
            const existing = counts.get(name);
            if (existing) {
                existing.count++;
            } else {
                counts.set(name, {
                    count: 1,
                    color: getQualityColor(item.quality),
                    sortKey: qualitySortKey(item.quality),
                });
            }
        }

        const entries = [...counts.entries()]
            .sort(([, a], [, b]) => b.sortKey - a.sortKey || a.count - b.count);

        for (const [name, info] of entries) {
            const line = document.createElement("div");
            line.className = "bc-results-summary-line";
            line.style.color = info.color;
            line.textContent = `${info.count}x ${name}`;
            list.appendChild(line);
        }

        if (failures > 0) {
            const failedLine = document.createElement("div");
            failedLine.className = "bc-results-summary-line";
            failedLine.style.color = "#ff8d8d";
            failedLine.textContent = `${failures}x Failed crafts`;
            list.appendChild(failedLine);
        }

        if (list.childElementCount === 0) {
            const empty = document.createElement("div");
            empty.className = "bc-results-empty";
            empty.textContent = "No completed crafts were recorded.";
            list.appendChild(empty);
        }

        el.appendChild(list);
    }

    private createResultsTitle(text: string): HTMLElement {
        const title = document.createElement("div");
        title.className = "bc-results-title";
        title.textContent = text;
        return title;
    }

    private getDisplayName(item: Item): string {
        let displayName: string;
        try {
            displayName = this.toTitleCase(item.getName(Article.None).getString());
        } catch {
            displayName = this.formatEnumName(ItemType[item.type] || `Item ${item.type}`);
        }

        const qualityName = getQualityName(item.quality);
        if (qualityName) displayName = `${qualityName} ${displayName}`;

        return displayName;
    }

    // ── Data helpers ──────────────────────────────────────────────────────────

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

        return result.sort((a, b) => qualitySortKey(b.quality) - qualitySortKey(a.quality));
    }

    // ── Craft action ──────────────────────────────────────────────────────────

    private crafting = false;

    private async onCraft() {
        if (this.crafting || !this.itemType || !this.recipe) return;

        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
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

        const toolItems: Item[]    = [];
        const consumeItems: Item[] = [];
        for (let i = 0; i < this.recipe.components.length; i++) {
            const comp = this.recipe.components[i];
            (comp.consumedAmount > 0 ? consumeItems : toolItems).push(...(this.selectedItems.get(i) || []));
        }
        const baseItems = this.selectedItems.get(-1) || [];
        const baseComponent = baseItems[0] as Item | undefined;

        const pendingIds = new Set<number>();
        for (const [, items] of this.selectedItems) {
            for (const item of items) pendingIds.add(getItemId(item));
        }
        this._pendingSelectionIds = pendingIds;

        this.crafting = true;
        try {
            await this.onCraftCallback(this.itemType, toolItems, consumeItems, baseComponent);
            this.updateRecipe(this.itemType, false);
        } finally {
            this.crafting = false;
        }
    }

    private showValidationError(msg: string) {
        if (this.validationMsg) this.validationMsg.remove();
        this.validationMsg = new Text();
        this.validationMsg.setText(TranslationImpl.generator(msg));
        this.validationMsg.style.set("color", "#ff6666");
        this.validationMsg.style.set("padding", "6px 10px");
        this.validationMsg.style.set("margin-top", "4px");
        this.validationMsg.style.set("border-left", "3px solid #ff4444");
        this.validationMsg.style.set("background", "rgba(255,68,68,0.08)");
        this.scrollContent.append(this.validationMsg);
        setTimeout(() => { this.validationMsg?.remove(); this.validationMsg = undefined; }, 3000);
    }
}
