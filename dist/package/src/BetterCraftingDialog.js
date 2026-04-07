var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "@wayward/game/ui/component/Component", "@wayward/game/ui/component/Button", "@wayward/game/ui/component/CheckButton", "@wayward/game/ui/component/Text", "@wayward/game/language/impl/TranslationImpl", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/item/IItem", "@wayward/game/game/entity/skill/ISkills", "@wayward/game/game/item/ItemManager", "@wayward/game/language/ITranslation", "@wayward/game/game/IObject", "@wayward/game/game/entity/action/IAction", "@wayward/game/ui/screen/screens/game/component/ItemComponent", "@wayward/game/ui/screen/screens/game/component/item/ItemComponentHandler", "@wayward/game/ui/util/IHighlight", "@wayward/game/game/entity/IStats"], function (require, exports, Component_1, Button_1, CheckButton_1, Text_1, TranslationImpl_1, ItemDescriptions_1, IItem_1, ISkills_1, ItemManager_1, ITranslation_1, IObject_1, IAction_1, ItemComponent_1, ItemComponentHandler_1, IHighlight_1, IStats_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.STAMINA_COST_PER_LEVEL = void 0;
    Component_1 = __importDefault(Component_1);
    Button_1 = __importDefault(Button_1);
    Text_1 = __importDefault(Text_1);
    TranslationImpl_1 = __importDefault(TranslationImpl_1);
    ItemManager_1 = __importDefault(ItemManager_1);
    ItemComponent_1 = __importDefault(ItemComponent_1);
    const QUALITY_COLORS = {
        [IObject_1.Quality.None]: "#e0d0b0",
        [IObject_1.Quality.Random]: "#e0d0b0",
        [IObject_1.Quality.Superior]: "#33ff99",
        [IObject_1.Quality.Remarkable]: "#00b4ff",
        [IObject_1.Quality.Exceptional]: "#ce5eff",
        [IObject_1.Quality.Mastercrafted]: "#ff8c00",
        [IObject_1.Quality.Relic]: "#ffd700",
    };
    function getQualityColor(quality) {
        return QUALITY_COLORS[quality ?? IObject_1.Quality.None] ?? QUALITY_COLORS[IObject_1.Quality.None];
    }
    function getQualityName(quality) {
        if (quality === undefined || quality === IObject_1.Quality.None || quality === IObject_1.Quality.Random)
            return "";
        return IObject_1.Quality[quality] ?? "";
    }
    function qualitySortKey(quality) {
        const q = quality ?? IObject_1.Quality.None;
        if (q === IObject_1.Quality.None || q === IObject_1.Quality.Random)
            return 0;
        return q;
    }
    function getItemId(item) {
        return item.id;
    }
    function toRoman(n) {
        if (n <= 0)
            return String(n);
        const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
        let result = "";
        for (let i = 0; i < vals.length; i++) {
            while (n >= vals[i]) {
                result += syms[i];
                n -= vals[i];
            }
        }
        return result;
    }
    function isItemProtected(item) {
        return item.isProtected === true || item.protected === true;
    }
    const ROW_MIN_HEIGHT = 30;
    const ROW_PADDING_V = 4;
    const ROW_MARGIN = 2;
    exports.STAMINA_COST_PER_LEVEL = {
        [IItem_1.RecipeLevel.Simple]: 2,
        [IItem_1.RecipeLevel.Intermediate]: 5,
        [IItem_1.RecipeLevel.Advanced]: 10,
        [IItem_1.RecipeLevel.Expert]: 16,
        [IItem_1.RecipeLevel.Master]: 25,
    };
    class BetterCraftingPanel extends Component_1.default {
        get activationHotkey() {
            return this.getSettings().activationHotkey;
        }
        isConfiguredHotkey(key) {
            return key === this.activationHotkey;
        }
        updateActivationHotkeyState(event) {
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
        constructor(onCraft, onBulkCraft, getSettings) {
            super();
            this.itemType = 0;
            this.selectedItems = new Map();
            this.sectionCounters = new Map();
            this._pendingSelectionIds = null;
            this.bcTooltipEl = null;
            this._hoveredItem = null;
            this._hoveredDisplayName = "";
            this._hoveredMouseX = 0;
            this._hoveredMouseY = 0;
            this.shiftHeld = false;
            this._inventoryRefreshTimer = null;
            this._inventoryWatchHandlers = null;
            this.activeTab = "normal";
            this.bulkExcludedIds = new Map();
            this._lastBulkItemType = 0;
            this.bulkQuantity = 1;
            this.bulkQtyInputEl = null;
            this.bulkMaxLabel = null;
            this.bulkCraftBtnEl = null;
            this._bulkContentDirty = true;
            this.bulkStopBtn = null;
            this.bulkQtyRow = null;
            this.bulkProgressEl = null;
            this.onBulkAbortCallback = null;
            this._onShiftDown = (e) => {
                this.updateActivationHotkeyState(e);
                if (!this.isConfiguredHotkey(e.key) || !this.shiftHeld)
                    return;
                if (this._hoveredItem) {
                    this.bcShowTooltip(this._hoveredItem, this._hoveredDisplayName, this._hoveredMouseX, this._hoveredMouseY);
                }
            };
            this._onShiftUp = (e) => {
                this.updateActivationHotkeyState(e);
                if (this.isConfiguredHotkey(e.key)) {
                    this.bcHideTooltip();
                    return;
                }
                if (this.shiftHeld)
                    return;
                this.bcHideTooltip();
            };
            this._onBlur = () => {
                this.updateActivationHotkeyState();
                this.bcHideTooltip();
            };
            this.bulkCrafting = false;
            this.crafting = false;
            this.onCraftCallback = onCraft;
            this.onBulkCraftCallback = onBulkCraft;
            this.getSettings = getSettings;
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

                /* ── Section height cap (updated by ResizeObserver) ──────────── */
                .better-crafting-section {
                    max-height: var(--bc-section-height, 300px);
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
            this.classes.add("dialog", "game-dialog-panel", "better-crafting-panel");
            this.style.set("position", "fixed");
            this.style.set("top", "12%");
            this.style.set("left", "50%");
            this.style.set("transform", "translateX(-50%)");
            this.style.set("width", "20vw");
            this.style.set("min-width", "280px");
            this.style.set("height", "40vh");
            this.style.set("min-height", "200px");
            this.style.set("resize", "both");
            this.style.set("overflow", "hidden");
            this.style.set("z-index", "1000");
            this.style.set("display", "none");
            this.style.set("flex-direction", "column");
            document.addEventListener("keydown", this._onShiftDown);
            document.addEventListener("keyup", this._onShiftUp);
            window.addEventListener("blur", this._onBlur);
            this.element.addEventListener("mousedown", (e) => {
                if (e.button !== 0)
                    return;
                const t = e.target;
                if (t.closest("button, .better-crafting-item-list, input, select"))
                    return;
                const panelRect = this.element.getBoundingClientRect();
                if (e.clientX >= panelRect.right - 20 && e.clientY >= panelRect.bottom - 20)
                    return;
                const scale = this.element.offsetWidth > 0
                    ? panelRect.width / this.element.offsetWidth
                    : 1;
                const cssLeft = panelRect.left / scale;
                const cssTop = panelRect.top / scale;
                const startX = e.clientX;
                const startY = e.clientY;
                this.style.set("transform", "none");
                this.element.style.left = `${cssLeft}px`;
                this.element.style.top = `${cssTop}px`;
                const onMouseMove = (ev) => {
                    this.element.style.left = `${cssLeft + (ev.clientX - startX) / scale}px`;
                    this.element.style.top = `${cssTop + (ev.clientY - startY) / scale}px`;
                };
                const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                };
                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            });
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
            this.normalBody = new Component_1.default();
            this.normalBody.classes.add("better-crafting-body");
            this.normalBody.style.set("display", "flex");
            this.normalBody.style.set("flex", "1 1 0");
            this.normalBody.style.set("flex-direction", "column");
            this.normalBody.style.set("min-height", "0");
            this.normalBody.style.set("overflow", "hidden");
            this.normalBody.style.set("padding", "8px 10px");
            this.append(this.normalBody);
            this.normalStaticContent = new Component_1.default();
            this.normalStaticContent.style.set("display", "flex");
            this.normalStaticContent.style.set("flex-wrap", "wrap");
            this.normalStaticContent.style.set("gap", "8px");
            this.normalStaticContent.style.set("align-items", "flex-start");
            this.normalStaticContent.style.set("flex", "0 0 auto");
            this.normalStaticContent.style.set("min-height", "0");
            this.normalBody.append(this.normalStaticContent);
            this.scrollContent = new Component_1.default();
            this.scrollContent.style.set("display", "block");
            this.scrollContent.style.set("flex", "1 1 0");
            this.scrollContent.style.set("min-height", "0");
            this.scrollContent.style.set("overflow-y", "auto");
            this.scrollContent.style.set("overflow-x", "hidden");
            this.scrollContent.style.set("scrollbar-width", "thin");
            this.scrollContent.style.set("scrollbar-color", "#888888 rgba(0,0,0,0.3)");
            this.normalBody.append(this.scrollContent);
            this.normalScrollInner = new Component_1.default();
            this.normalScrollInner.style.set("display", "flex");
            this.normalScrollInner.style.set("flex-wrap", "wrap");
            this.normalScrollInner.style.set("gap", "8px");
            this.normalScrollInner.style.set("align-items", "stretch");
            this.normalScrollInner.style.set("align-content", "stretch");
            this.normalScrollInner.style.set("min-height", "100%");
            this.scrollContent.append(this.normalScrollInner);
            this.normalResultsEl = this.createResultsContainer();
            this.element.appendChild(this.normalResultsEl);
            this.normalFooter = new Component_1.default();
            this.normalFooter.classes.add("dialog-footer");
            this.normalFooter.style.set("padding", "8px 10px");
            this.normalFooter.style.set("border-top", "1px solid var(--color-border, #554433)");
            this.normalFooter.style.set("display", "flex");
            this.normalFooter.style.set("gap", "6px");
            this.normalFooter.style.set("flex-shrink", "0");
            this.normalFooter.style.set("justify-content", "flex-end");
            this.normalFooter.style.set("align-items", "center");
            this.append(this.normalFooter);
            this.craftBtn = new Button_1.default();
            this.craftBtn.classes.add("button-block", "better-crafting-craft-btn", "bc-craft-disabled");
            this.craftBtn.setText(TranslationImpl_1.default.generator("Craft with Selected"));
            this.craftBtn.style.set("padding", "6px 14px");
            this.craftBtn.event.subscribe("activate", () => this.onCraft());
            this.normalFooter.append(this.craftBtn);
            const cancelBtn = new Button_1.default();
            cancelBtn.classes.add("button-block");
            cancelBtn.setText(TranslationImpl_1.default.generator("Cancel"));
            cancelBtn.style.set("background", "rgba(60, 50, 40, 0.8)");
            cancelBtn.style.set("color", "#584848");
            cancelBtn.style.set("padding", "6px 14px");
            cancelBtn.event.subscribe("activate", () => this.hidePanel());
            this.normalFooter.append(cancelBtn);
            this.bulkBody = new Component_1.default();
            this.bulkBody.classes.add("better-crafting-body");
            this.bulkBody.style.set("display", "flex");
            this.bulkBody.style.set("flex", "1 1 0");
            this.bulkBody.style.set("flex-direction", "column");
            this.bulkBody.style.set("min-height", "0");
            this.bulkBody.style.set("overflow", "hidden");
            this.bulkBody.style.set("padding", "8px 10px");
            this.bulkBody.style.set("display", "none");
            this.append(this.bulkBody);
            this.bulkStaticContent = new Component_1.default();
            this.bulkStaticContent.style.set("display", "flex");
            this.bulkStaticContent.style.set("flex-wrap", "wrap");
            this.bulkStaticContent.style.set("gap", "8px");
            this.bulkStaticContent.style.set("align-items", "flex-start");
            this.bulkStaticContent.style.set("flex", "0 0 auto");
            this.bulkStaticContent.style.set("min-height", "0");
            this.bulkBody.append(this.bulkStaticContent);
            this.bulkScrollContent = new Component_1.default();
            this.bulkScrollContent.style.set("display", "block");
            this.bulkScrollContent.style.set("flex", "1 1 0");
            this.bulkScrollContent.style.set("min-height", "0");
            this.bulkScrollContent.style.set("overflow-y", "auto");
            this.bulkScrollContent.style.set("overflow-x", "hidden");
            this.bulkScrollContent.style.set("scrollbar-width", "thin");
            this.bulkScrollContent.style.set("scrollbar-color", "#888888 rgba(0,0,0,0.3)");
            this.bulkBody.append(this.bulkScrollContent);
            this.bulkScrollInner = new Component_1.default();
            this.bulkScrollInner.style.set("display", "flex");
            this.bulkScrollInner.style.set("flex-wrap", "wrap");
            this.bulkScrollInner.style.set("gap", "8px");
            this.bulkScrollInner.style.set("align-items", "stretch");
            this.bulkScrollInner.style.set("align-content", "stretch");
            this.bulkScrollInner.style.set("min-height", "100%");
            this.bulkScrollContent.append(this.bulkScrollInner);
            this.bulkResultsEl = this.createResultsContainer();
            this.element.appendChild(this.bulkResultsEl);
            this.bulkFooter = new Component_1.default();
            this.bulkFooter.classes.add("dialog-footer");
            this.bulkFooter.style.set("padding", "8px 10px");
            this.bulkFooter.style.set("border-top", "1px solid var(--color-border, #554433)");
            this.bulkFooter.style.set("display", "none");
            this.bulkFooter.style.set("gap", "8px");
            this.bulkFooter.style.set("flex-shrink", "0");
            this.bulkFooter.style.set("justify-content", "flex-end");
            this.bulkFooter.style.set("align-items", "center");
            this.append(this.bulkFooter);
            const qtyRow = document.createElement("div");
            qtyRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-right:auto;";
            const minusBtn = document.createElement("button");
            minusBtn.className = "bc-qty-btn";
            minusBtn.textContent = "−";
            minusBtn.addEventListener("mousedown", (e) => {
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
                const v = parseInt(this.bulkQtyInputEl.value, 10);
                if (!isNaN(v) && v >= 1) {
                    const max = this.computeBulkMax();
                    this.bulkQuantity = max > 0 ? Math.min(v, max) : 1;
                    if (this.bulkQtyInputEl)
                        this.bulkQtyInputEl.value = String(this.bulkQuantity);
                    this.updateBulkMaxDisplay();
                    this.updateBulkCraftBtnState();
                }
                else {
                    this.bulkQtyInputEl.value = String(this.bulkQuantity);
                }
            });
            qtyRow.appendChild(this.bulkQtyInputEl);
            const plusBtn = document.createElement("button");
            plusBtn.className = "bc-qty-btn";
            plusBtn.textContent = "+";
            plusBtn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const delta = e.ctrlKey ? 100 : e.shiftKey ? 10 : 1;
                this.adjustBulkQty(delta);
            });
            qtyRow.appendChild(plusBtn);
            this.bulkMaxLabel = document.createElement("span");
            this.bulkMaxLabel.style.cssText = "color:#7a6850;font-size:0.85em;margin-left:4px;";
            this.bulkMaxLabel.textContent = "";
            qtyRow.appendChild(this.bulkMaxLabel);
            const qtyHint = document.createElement("span");
            qtyHint.className = "bc-qty-hint";
            qtyHint.textContent = "Shift ×10 | Ctrl ×100";
            qtyRow.appendChild(qtyHint);
            this.bulkQtyRow = qtyRow;
            this.bulkFooter.element.appendChild(qtyRow);
            this.bulkProgressEl = document.createElement("span");
            this.bulkProgressEl.style.cssText = "color:#9a8860;font-size:0.92em;margin-right:auto;display:none;";
            this.bulkFooter.element.appendChild(this.bulkProgressEl);
            this.bulkCraftBtnEl = new Button_1.default();
            this.bulkCraftBtnEl.classes.add("button-block", "better-crafting-craft-btn", "bc-craft-disabled");
            this.bulkCraftBtnEl.setText(TranslationImpl_1.default.generator("Bulk Craft"));
            this.bulkCraftBtnEl.style.set("padding", "6px 14px");
            this.bulkCraftBtnEl.event.subscribe("activate", () => this.onBulkCraft());
            this.bulkFooter.append(this.bulkCraftBtnEl);
            const bulkCancelBtn = new Button_1.default();
            bulkCancelBtn.classes.add("button-block");
            bulkCancelBtn.setText(TranslationImpl_1.default.generator("Cancel"));
            bulkCancelBtn.style.set("background", "rgba(60, 50, 40, 0.8)");
            bulkCancelBtn.style.set("color", "#584848");
            bulkCancelBtn.style.set("padding", "6px 14px");
            bulkCancelBtn.event.subscribe("activate", () => this.hidePanel());
            this.bulkFooter.append(bulkCancelBtn);
            this.bulkStopBtn = new Button_1.default();
            this.bulkStopBtn.classes.add("button-block", "bc-stop-btn");
            this.bulkStopBtn.setText(TranslationImpl_1.default.generator("Stop Crafting"));
            this.bulkStopBtn.style.set("padding", "6px 14px");
            this.bulkStopBtn.style.set("background", "#993333");
            this.bulkStopBtn.style.set("color", "#fff");
            this.bulkStopBtn.style.set("display", "none");
            this.bulkStopBtn.event.subscribe("activate", () => this.onBulkAbortCallback?.());
            this.bulkFooter.append(this.bulkStopBtn);
            if (typeof ResizeObserver !== 'undefined') {
                this._sectionResizeObserver = new ResizeObserver(() => {
                    if (this._sectionResizeRafId !== undefined)
                        cancelAnimationFrame(this._sectionResizeRafId);
                    this._sectionResizeRafId = requestAnimationFrame(() => {
                        this._sectionResizeRafId = undefined;
                        const h = this.scrollContent.element.clientHeight
                            || this.bulkScrollContent.element.clientHeight;
                        if (h > 0) {
                            this.element.style.setProperty('--bc-section-height', `${h}px`);
                        }
                    });
                });
                this._sectionResizeObserver.observe(this.scrollContent.element);
                this._sectionResizeObserver.observe(this.bulkScrollContent.element);
            }
        }
        destroyListeners() {
            document.removeEventListener("keydown", this._onShiftDown);
            document.removeEventListener("keyup", this._onShiftUp);
            window.removeEventListener("blur", this._onBlur);
            this._unsubscribeInventoryWatch();
            if (this._inventoryRefreshTimer !== null) {
                clearTimeout(this._inventoryRefreshTimer);
                this._inventoryRefreshTimer = null;
            }
            this.bcTooltipEl?.remove();
            this.bcTooltipEl = null;
            if (this._sectionResizeRafId !== undefined) {
                cancelAnimationFrame(this._sectionResizeRafId);
                this._sectionResizeRafId = undefined;
            }
            this._sectionResizeObserver?.disconnect();
            this._sectionResizeObserver = undefined;
        }
        _subscribeInventoryWatch() {
            if (this._inventoryWatchHandlers || !localPlayer)
                return;
            const onAdd = () => this.scheduleInventoryRefresh();
            const onRemove = () => this.scheduleInventoryRefresh();
            const onUpdate = () => this.scheduleInventoryRefresh();
            localPlayer.event.subscribe("inventoryItemAdd", onAdd);
            localPlayer.event.subscribe("inventoryItemRemove", onRemove);
            localPlayer.event.subscribe("inventoryItemUpdate", onUpdate);
            this._inventoryWatchHandlers = { onAdd, onRemove, onUpdate };
        }
        _unsubscribeInventoryWatch() {
            if (!this._inventoryWatchHandlers || !localPlayer)
                return;
            const { onAdd, onRemove, onUpdate } = this._inventoryWatchHandlers;
            localPlayer.event.unsubscribe("inventoryItemAdd", onAdd);
            localPlayer.event.unsubscribe("inventoryItemRemove", onRemove);
            localPlayer.event.unsubscribe("inventoryItemUpdate", onUpdate);
            this._inventoryWatchHandlers = null;
        }
        scheduleInventoryRefresh() {
            if (this._inventoryRefreshTimer !== null) {
                clearTimeout(this._inventoryRefreshTimer);
            }
            this._inventoryRefreshTimer = setTimeout(() => {
                this._inventoryRefreshTimer = null;
                if (!this.panelVisible || this.bulkCrafting)
                    return;
                if (this.activeTab === "bulk") {
                    this._bulkContentDirty = true;
                    this.buildBulkContent();
                }
                else {
                    this.updateRecipe(this.itemType, false);
                }
            }, 200);
        }
        switchTab(tab) {
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
                this.element.classList.remove("bc-panel-bulk");
            }
            else {
                this.bulkTabBtn.classList.add("bc-tab-active");
                this.normalTabBtn.classList.remove("bc-tab-active");
                this.normalBody.style.set("display", "none");
                this.normalFooter.style.set("display", "none");
                this.bulkBody.style.set("display", "");
                this.bulkFooter.style.set("display", "flex");
                this.element.classList.add("bc-panel-bulk");
                if (this._bulkContentDirty) {
                    this.buildBulkContent();
                }
            }
            this.syncResultsVisibility();
        }
        showPanel() {
            const wasVisible = this.panelVisible;
            if (!wasVisible) {
                this.switchTab("normal");
                this._subscribeInventoryWatch();
            }
            this.style.set("display", "flex");
            this.updateHighlights();
        }
        hidePanel() {
            if (this.bulkCrafting)
                this.onBulkAbortCallback?.();
            this._unsubscribeInventoryWatch();
            if (this._inventoryRefreshTimer !== null) {
                clearTimeout(this._inventoryRefreshTimer);
                this._inventoryRefreshTimer = null;
            }
            this.bulkExcludedIds.clear();
            this._lastBulkItemType = 0;
            this.clearResults();
            this.style.set("display", "none");
            this.clearHighlights();
            this.bcHideTooltip();
        }
        get panelVisible() {
            return this.element?.style.display !== "none";
        }
        setBulkAbortCallback(cb) {
            this.onBulkAbortCallback = cb;
        }
        onBulkCraftStart(total) {
            if (this.bulkCraftBtnEl)
                this.bulkCraftBtnEl.style.set("display", "none");
            if (this.bulkQtyRow)
                this.bulkQtyRow.style.display = "none";
            if (this.bulkProgressEl) {
                this.bulkProgressEl.textContent = `Crafting 0 / ${total}`;
                this.bulkProgressEl.style.display = "";
            }
            if (this.bulkStopBtn)
                this.bulkStopBtn.style.set("display", "");
        }
        setBulkProgress(current, total) {
            if (this.bulkProgressEl) {
                this.bulkProgressEl.textContent = `Crafting ${current} / ${total}`;
            }
        }
        onBulkCraftEnd() {
            if (this.bulkStopBtn)
                this.bulkStopBtn.style.set("display", "none");
            if (this.bulkProgressEl)
                this.bulkProgressEl.style.display = "none";
            if (this.bulkCraftBtnEl)
                this.bulkCraftBtnEl.style.set("display", "");
            if (this.bulkQtyRow)
                this.bulkQtyRow.style.display = "";
            this._bulkContentDirty = true;
            if (this.panelVisible)
                this.buildBulkContent();
        }
        updateHighlights() {
            this.clearHighlights();
            if (!this.recipe)
                return;
            const selectors = [];
            for (const component of this.recipe.components) {
                selectors.push(ItemManager_1.default.isGroup(component.type)
                    ? [IHighlight_1.HighlightType.ItemGroup, component.type]
                    : [IHighlight_1.HighlightType.ItemType, component.type]);
            }
            if (this.recipe.baseComponent !== undefined) {
                selectors.push(ItemManager_1.default.isGroup(this.recipe.baseComponent)
                    ? [IHighlight_1.HighlightType.ItemGroup, this.recipe.baseComponent]
                    : [IHighlight_1.HighlightType.ItemType, this.recipe.baseComponent]);
            }
            if (selectors.length > 0)
                ui?.highlights?.start(this, { selectors });
        }
        clearHighlights() {
            ui?.highlights?.end(this);
        }
        updateRecipe(itemType, clearResults = true) {
            this.itemType = itemType;
            const pendingIds = this._pendingSelectionIds;
            this._pendingSelectionIds = null;
            this.selectedItems.clear();
            this.sectionCounters.clear();
            this.normalStaticContent.dump();
            this.normalScrollInner.dump();
            const desc = ItemDescriptions_1.itemDescriptions[itemType];
            this.recipe = desc?.recipe;
            this._bulkContentDirty = true;
            if (clearResults)
                this.clearResults();
            if (!this.recipe) {
                const noRecipe = new Text_1.default();
                noRecipe.setText(TranslationImpl_1.default.generator("No recipe found for this item."));
                noRecipe.style.set("color", "#ff6666");
                this.normalScrollInner.append(noRecipe);
                this.updateCraftButtonState();
                return;
            }
            if (this.recipe.baseComponent !== undefined) {
                const items = this.findMatchingItems(this.recipe.baseComponent);
                const pre = this.getPreSelectedItems(items, 1, pendingIds);
                if (pre.length)
                    this.selectedItems.set(-1, pre);
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const component = this.recipe.components[i];
                const items = this.findMatchingItems(component.type);
                const pre = this.getPreSelectedItems(items, component.requiredAmount, pendingIds);
                if (pre.length)
                    this.selectedItems.set(i, pre);
            }
            this.buildOutputCard(itemType, this.recipe, false);
            if (this.recipe.baseComponent !== undefined)
                this.addBaseComponentSection(this.recipe.baseComponent);
            for (let i = 0; i < this.recipe.components.length; i++)
                this.addComponentSection(i, this.recipe.components[i]);
            this.updateCraftButtonState();
            if (this.activeTab === "bulk") {
                this.buildBulkContent();
            }
        }
        getPreSelectedItems(items, maxCount, pendingIds) {
            if (pendingIds !== null) {
                const restored = items.filter(item => pendingIds.has(getItemId(item)));
                if (restored.length >= maxCount)
                    return restored.slice(0, maxCount);
                if (restored.length > 0) {
                    const restoredIds = new Set(restored.map(item => getItemId(item)));
                    const extras = items.filter(item => !restoredIds.has(getItemId(item)));
                    return [...restored, ...extras].slice(0, maxCount);
                }
            }
            return items.slice(0, maxCount);
        }
        toTitleCase(str) {
            return str.replace(/\b\w/g, c => c.toUpperCase());
        }
        formatEnumName(name) {
            return this.toTitleCase(name.replace(/([a-z])([A-Z])/g, "$1 $2"));
        }
        updateCraftButtonState() {
            if (!this.craftBtn)
                return;
            let met = true;
            if (this.recipe) {
                for (let i = 0; i < this.recipe.components.length; i++) {
                    if ((this.selectedItems.get(i) || []).length < this.recipe.components[i].requiredAmount) {
                        met = false;
                        break;
                    }
                }
                if (met && this.recipe.baseComponent !== undefined) {
                    if ((this.selectedItems.get(-1) || []).length < 1)
                        met = false;
                }
            }
            else {
                met = false;
            }
            if (met) {
                this.craftBtn.classes.remove("bc-craft-disabled");
            }
            else {
                this.craftBtn.classes.add("bc-craft-disabled");
            }
        }
        updateCounter(slotIndex, maxSelect) {
            const counter = this.sectionCounters.get(slotIndex);
            if (!counter)
                return;
            const count = (this.selectedItems.get(slotIndex) || []).length;
            counter.setText(TranslationImpl_1.default.generator(`${count}/${maxSelect}`));
            counter.style.set("color", count >= maxSelect ? "#33ff99" : "#c8bc8a");
            this.updateCraftButtonState();
        }
        buildOutputCard(itemType, recipe, isBulk) {
            const desc = ItemDescriptions_1.itemDescriptions[itemType];
            const fmt = (s) => this.formatEnumName(s);
            const card = new Component_1.default();
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
                const handler = new ItemComponentHandler_1.ItemComponentHandler({ getItemType: () => itemType, noDrag: true });
                const iconComp = ItemComponent_1.default.create(handler);
                if (iconComp)
                    iconHolder.appendChild(iconComp.element);
            }
            catch { }
            row1.appendChild(iconHolder);
            const itemName = (() => {
                try {
                    return fmt(IItem_1.ItemType[itemType] || `Item ${itemType}`);
                }
                catch {
                    return `Item ${itemType}`;
                }
            })();
            const nameSpan = document.createElement("span");
            nameSpan.textContent = itemName;
            nameSpan.style.cssText = "color:#d4c89a;font-weight:600;font-size:1.2em;flex-shrink:0;";
            row1.appendChild(nameSpan);
            const inlineStat = (label, value) => {
                const s = document.createElement("span");
                s.style.cssText = "color:#9a8860;font-size:0.9em;white-space:nowrap;";
                s.innerHTML = `${label}: <span style="color:#c0b080">${value}</span>`;
                row1.appendChild(s);
            };
            inlineStat("Difficulty", fmt(IItem_1.RecipeLevel[recipe.level] ?? String(recipe.level)));
            inlineStat("Skill", fmt(ISkills_1.SkillType[recipe.skill] ?? String(recipe.skill)));
            if (desc?.durability !== undefined)
                inlineStat("Durability", String(desc.durability));
            const w = desc?.weightRange
                ? `${desc.weightRange[0].toFixed(1)}–${desc.weightRange[1].toFixed(1)}`
                : desc?.weight !== undefined ? desc.weight.toFixed(1) : null;
            if (w)
                inlineStat("Weight", w);
            card.element.appendChild(row1);
            if (desc?.group && desc.group.length > 0) {
                const groupLine = document.createElement("div");
                groupLine.style.cssText = "font-size:0.85em;color:#9a8860;";
                const parts = desc.group.map(g => {
                    const tierNum = desc?.tier?.[g];
                    const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                    return `<span style="color:#c0b080">${fmt(IItem_1.ItemTypeGroup[g] || `Group ${g}`)}${tierStr}</span>`;
                });
                groupLine.innerHTML = `Groupings: ${parts.join(", ")}`;
                card.element.appendChild(groupLine);
            }
            if (desc?.use && desc.use.length > 0) {
                const useLine = document.createElement("div");
                useLine.style.cssText = "font-size:0.85em;color:#9a8860;";
                const parts = desc.use.map(u => {
                    const tierNum = desc?.actionTier?.[u];
                    const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                    return `<span style="color:#c0b080">${fmt(IAction_1.ActionType[u] || `Action ${u}`)}${tierStr}</span>`;
                });
                useLine.innerHTML = `Uses: ${parts.join(", ")}`;
                card.element.appendChild(useLine);
            }
            if (isBulk) {
                card.classes.add("bc-bulk-output-card");
                this.bulkStaticContent.append(card);
            }
            else {
                const qualityNote = document.createElement("div");
                qualityNote.style.cssText = "font-size:0.85em;color:#7a6850;font-style:italic;";
                qualityNote.textContent = "Quality depends on your crafting skill level.";
                card.element.appendChild(qualityNote);
                this.normalStaticContent.append(card);
            }
        }
        addBaseComponentSection(baseType) {
            const section = this.createSection();
            const labelRow = this.createLabelRow();
            const baseAvailable = this.findMatchingItems(baseType).length;
            const label = new Text_1.default();
            label.classes.add("better-crafting-heading");
            label.setText(TranslationImpl_1.default.generator(`Base: ${this.getTypeName(baseType)} (${baseAvailable} available)`));
            label.style.set("font-weight", "bold");
            labelRow.append(label);
            const counter = new Text_1.default();
            counter.setText(TranslationImpl_1.default.generator("0/1"));
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
            }
            else {
                for (const item of items)
                    this.addItemRow(itemsContainer, -1, item, 1);
            }
            this.updateCounter(-1, 1);
            this.normalScrollInner.append(section);
        }
        addComponentSection(index, component) {
            const section = this.createSection();
            const consumed = component.consumedAmount > 0;
            const maxSelect = component.requiredAmount;
            const labelRow = this.createLabelRow();
            const compAvailable = this.findMatchingItems(component.type).length;
            const label = new Text_1.default();
            label.classes.add("better-crafting-heading");
            label.setText(TranslationImpl_1.default.generator(`${this.getTypeName(component.type)} \u00d7${maxSelect}${consumed ? " (consumed)" : " (tool)"} (${compAvailable} available)`));
            label.style.set("font-weight", "bold");
            labelRow.append(label);
            const counter = new Text_1.default();
            counter.setText(TranslationImpl_1.default.generator(`0/${maxSelect}`));
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
            }
            else {
                for (const item of items)
                    this.addItemRow(itemsContainer, index, item, maxSelect);
            }
            this.updateCounter(index, maxSelect);
            this.normalScrollInner.append(section);
        }
        createSection() {
            const section = new Component_1.default();
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
        createLabelRow() {
            const row = new Component_1.default();
            row.style.set("display", "flex");
            row.style.set("flex-shrink", "0");
            row.style.set("justify-content", "space-between");
            row.style.set("align-items", "center");
            row.style.set("margin-bottom", "4px");
            row.style.set("padding", "4px 4px 4px 8px");
            return row;
        }
        createItemsContainer() {
            const container = new Component_1.default();
            container.classes.add("better-crafting-item-list");
            container.style.set("flex", "1 1 0");
            container.style.set("overflow-y", "auto");
            container.style.set("min-height", "0");
            return container;
        }
        makeFullWidthWrapper() {
            const wrapper = new Component_1.default();
            wrapper.style.set("flex", "1 1 100%");
            wrapper.style.set("width", "100%");
            return wrapper;
        }
        appendMissing(parent) {
            const missing = new Text_1.default();
            missing.setText(TranslationImpl_1.default.generator("  \u2717 None in inventory"));
            missing.style.set("color", "#cc4444");
            missing.style.set("font-style", "italic");
            parent.append(missing);
        }
        addItemRow(parent, slotIndex, item, maxSelect) {
            const qualityColor = getQualityColor(item.quality);
            const borderBase = `1px solid ${qualityColor}33`;
            const borderHover = `1px solid ${qualityColor}77`;
            const borderSelected = `1px solid ${qualityColor}`;
            const preSelected = (this.selectedItems.get(slotIndex) || []).indexOf(item) >= 0;
            const row = new Button_1.default();
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
            row.style.set("border", preSelected ? borderSelected : borderBase);
            row.style.set("background", preSelected ? "rgba(30, 255, 128, 0.1)" : "transparent");
            const qualityName = getQualityName(item.quality);
            let displayName;
            try {
                displayName = this.toTitleCase(item.getName(ITranslation_1.Article.None).getString());
            }
            catch {
                displayName = this.formatEnumName(IItem_1.ItemType[item.type] || `Item ${item.type}`);
            }
            if (qualityName)
                displayName = `${qualityName} ${displayName}`;
            row.addEventListener("mouseenter", (e) => {
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
            row.addEventListener("mousemove", (e) => {
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
                const handler = new ItemComponentHandler_1.ItemComponentHandler({
                    getItem: () => item,
                    getItemType: () => item.type,
                    getItemQuality: () => item.quality,
                    noDrag: true,
                });
                const itemComp = ItemComponent_1.default.create(handler);
                if (itemComp) {
                    itemComp.style.set("flex-shrink", "0");
                    itemComp.style.set("margin-right", "5px");
                    row.append(itemComp);
                }
            }
            catch { }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            const check = new CheckButton_1.CheckButton();
            check.style.set("pointer-events", "none");
            check.style.set("margin-left", "4px");
            check.style.set("flex-shrink", "0");
            check.style.set("background", "transparent");
            check.style.set("background-color", "transparent");
            check.style.set("border", "none");
            check.style.set("box-shadow", "none");
            check.style.set("padding", "0");
            if (preSelected)
                check.setChecked(true, false);
            row.append(check);
            row.event.subscribe("activate", () => {
                const selected = this.selectedItems.get(slotIndex) || [];
                const idx = selected.indexOf(item);
                if (idx >= 0) {
                    selected.splice(idx, 1);
                    check.setChecked(false, false);
                    row.style.set("background", "transparent");
                    row.style.set("border", borderBase);
                }
                else {
                    if (selected.length >= maxSelect)
                        return;
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
        buildBulkContent() {
            this._bulkContentDirty = false;
            this.bulkStaticContent.dump();
            this.bulkScrollInner.dump();
            if (!this.recipe) {
                const noRecipe = new Text_1.default();
                noRecipe.setText(TranslationImpl_1.default.generator("No recipe found for this item."));
                noRecipe.style.set("color", "#ff6666");
                this.bulkScrollInner.append(noRecipe);
                this.updateBulkCraftBtnState();
                return;
            }
            if (this.itemType !== this._lastBulkItemType) {
                this.bulkExcludedIds.clear();
                this._lastBulkItemType = this.itemType;
            }
            this.buildOutputCard(this.itemType, this.recipe, true);
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
            if (this.bulkQtyInputEl)
                this.bulkQtyInputEl.value = "1";
            this.updateBulkMaxDisplay();
            this.updateBulkCraftBtnState();
        }
        addBulkHelpBox() {
            const wrapper = document.createElement("div");
            wrapper.className = "bc-bulk-help-box";
            const title = document.createElement("div");
            title.className = "bc-bulk-help-title";
            title.textContent = "How Bulk Crafting Works";
            wrapper.appendChild(title);
            const rows = [
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
            const container = this.makeFullWidthWrapper();
            container.element.appendChild(wrapper);
            this.bulkStaticContent.append(container);
        }
        addBulkMaterialsHeader() {
            const el = document.createElement("div");
            el.className = "bc-bulk-materials-header";
            el.textContent = "Materials — Click to Exclude";
            const container = this.makeFullWidthWrapper();
            container.element.appendChild(el);
            this.bulkStaticContent.append(container);
        }
        addBulkComponentSection(slotIndex, type, requiredAmount, consumed) {
            const section = this.createSection();
            section.classes.add("bc-bulk-section");
            const labelRow = this.createLabelRow();
            const label = new Text_1.default();
            label.classes.add("better-crafting-heading");
            const prefix = slotIndex === -1 ? "Base: " : "";
            const bulkAvailable = this.findMatchingItems(type).length;
            label.setText(TranslationImpl_1.default.generator(`${prefix}${this.getTypeName(type)} \u00d7${requiredAmount}${consumed ? " (consumed)" : " (tool)"} (${bulkAvailable} available)`));
            label.style.set("font-weight", "bold");
            labelRow.append(label);
            section.append(labelRow);
            const itemsContainer = this.createItemsContainer();
            section.append(itemsContainer);
            const items = this.findMatchingItems(type);
            if (items.length === 0) {
                this.appendMissing(itemsContainer);
            }
            else {
                if (!this.bulkExcludedIds.has(slotIndex)) {
                    this.bulkExcludedIds.set(slotIndex, new Set());
                }
                for (const item of items) {
                    this.addBulkItemRow(itemsContainer, slotIndex, item);
                }
            }
            this.bulkScrollInner.append(section);
        }
        addBulkItemRow(parent, slotIndex, item) {
            const qualityColor = getQualityColor(item.quality);
            const itemId = getItemId(item);
            const autoExcluded = isItemProtected(item);
            if (autoExcluded) {
                const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set();
                excludedSet.add(itemId);
                this.bulkExcludedIds.set(slotIndex, excludedSet);
            }
            const isExcluded = () => this.bulkExcludedIds.get(slotIndex)?.has(itemId) ?? false;
            const row = new Button_1.default();
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
            let displayName;
            try {
                displayName = this.toTitleCase(item.getName(ITranslation_1.Article.None).getString());
            }
            catch {
                displayName = this.formatEnumName(IItem_1.ItemType[item.type] || `Item ${item.type}`);
            }
            const qualityName = getQualityName(item.quality);
            if (qualityName)
                displayName = `${qualityName} ${displayName}`;
            if (autoExcluded) {
                const badge = document.createElement("span");
                badge.textContent = "🔒";
                badge.style.cssText = "font-size:0.75em;margin-right:4px;opacity:0.6;";
                row.element.appendChild(badge);
            }
            try {
                const handler = new ItemComponentHandler_1.ItemComponentHandler({
                    getItem: () => item,
                    getItemType: () => item.type,
                    getItemQuality: () => item.quality,
                    noDrag: true,
                });
                const itemComp = ItemComponent_1.default.create(handler);
                if (itemComp) {
                    itemComp.style.set("flex-shrink", "0");
                    itemComp.style.set("margin-right", "5px");
                    row.append(itemComp);
                }
            }
            catch { }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
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
                    const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set();
                    if (excludedSet.has(itemId)) {
                        excludedSet.delete(itemId);
                        row.classes.remove("bc-bulk-row-excluded");
                        exclIndicator.textContent = "";
                        row.style.set("background", "transparent");
                        row.style.set("border", `1px solid ${qualityColor}33`);
                    }
                    else {
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
        computeBulkLimits() {
            if (!this.recipe || !localPlayer?.island)
                return { staminaMax: 0, materialMax: 0 };
            const staminaCost = exports.STAMINA_COST_PER_LEVEL[this.recipe.level] ?? 4;
            const currentStamina = localPlayer.stat?.get?.(IStats_1.Stat.Stamina)?.value ?? 0;
            const staminaMax = this.getSettings().unsafeBulkCrafting
                ? Number.MAX_SAFE_INTEGER
                : staminaCost > 0 ? Math.floor(currentStamina / staminaCost) : 9999;
            let materialMax = 0;
            const excludedIds = this.getBulkExcludedIds();
            const permanentlyConsumedIds = new Set();
            for (let i = 0; i < 9999; i++) {
                const selection = this.resolveBulkCraftSelection(this.itemType, excludedIds, permanentlyConsumedIds);
                if (!selection)
                    break;
                for (const id of selection.permanentlyConsumedIds) {
                    permanentlyConsumedIds.add(id);
                }
                materialMax++;
            }
            return { staminaMax, materialMax };
            if (this.recipe.baseComponent !== undefined) {
                const excluded = this.bulkExcludedIds.get(-1) ?? new Set();
                const available = this.findMatchingItems(this.recipe.baseComponent)
                    .filter(item => !excluded.has(getItemId(item)));
                materialMax = Math.min(materialMax, available.length);
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                if (comp.consumedAmount <= 0)
                    continue;
                const excluded = this.bulkExcludedIds.get(i) ?? new Set();
                const available = this.findMatchingItems(comp.type)
                    .filter(item => !excluded.has(getItemId(item)));
                const perCraft = comp.requiredAmount;
                if (perCraft <= 0)
                    continue;
                materialMax = Math.min(materialMax, Math.floor(available.length / perCraft));
            }
            return { staminaMax, materialMax };
        }
        computeBulkMax() {
            const { staminaMax, materialMax } = this.computeBulkLimits();
            return Math.max(0, Math.min(staminaMax, materialMax));
        }
        updateBulkMaxDisplay() {
            const { staminaMax, materialMax } = this.computeBulkLimits();
            const max = Math.max(0, Math.min(staminaMax, materialMax));
            if (this.bulkMaxLabel) {
                if (max > 0) {
                    this.bulkMaxLabel.textContent = `(max ${max})`;
                    this.bulkMaxLabel.style.color = "#7a6850";
                }
                else {
                    this.bulkMaxLabel.textContent = (!this.getSettings().unsafeBulkCrafting && staminaMax === 0 && materialMax > 0)
                        ? "(insufficient stamina)"
                        : "(not enough materials)";
                    this.bulkMaxLabel.style.color = "#cc4444";
                }
            }
            if (max > 0 && this.bulkQuantity > max) {
                this.bulkQuantity = max;
                if (this.bulkQtyInputEl)
                    this.bulkQtyInputEl.value = String(this.bulkQuantity);
            }
        }
        adjustBulkQty(delta) {
            const max = this.computeBulkMax();
            let newQty = this.bulkQuantity + delta;
            const effectiveMax = max > 0 ? max : 1;
            if (newQty > effectiveMax)
                newQty = effectiveMax;
            if (newQty < 1)
                newQty = 1;
            this.bulkQuantity = newQty;
            if (this.bulkQtyInputEl)
                this.bulkQtyInputEl.value = String(this.bulkQuantity);
            this.updateBulkMaxDisplay();
            this.updateBulkCraftBtnState();
        }
        updateBulkCraftBtnState() {
            if (!this.bulkCraftBtnEl)
                return;
            const max = this.computeBulkMax();
            const canCraft = max > 0 && this.bulkQuantity >= 1;
            if (canCraft) {
                this.bulkCraftBtnEl.classes.remove("bc-craft-disabled");
            }
            else {
                this.bulkCraftBtnEl.classes.add("bc-craft-disabled");
            }
        }
        async onBulkCraft() {
            if (this.bulkCrafting || !this.itemType || !this.recipe)
                return;
            const max = this.computeBulkMax();
            if (max <= 0 || this.bulkQuantity < 1)
                return;
            const flatExcluded = this.getBulkExcludedIds();
            this.bulkCrafting = true;
            try {
                await this.onBulkCraftCallback(this.itemType, this.bulkQuantity, flatExcluded);
                this._bulkContentDirty = true;
                this.buildBulkContent();
            }
            finally {
                this.bulkCrafting = false;
            }
        }
        resolveForBulkCraft(itemType, excludedIds, sessionConsumedIds) {
            const effectiveExcluded = sessionConsumedIds?.size
                ? new Set([...excludedIds, ...sessionConsumedIds])
                : excludedIds;
            const selection = this.resolveBulkCraftSelection(itemType, effectiveExcluded);
            if (!selection)
                return null;
            return {
                tools: selection.tools,
                consumed: selection.consumed,
                base: selection.base,
            };
        }
        getBulkExcludedIds() {
            const excludedIds = new Set();
            for (const [, excludedSet] of this.bulkExcludedIds) {
                for (const id of excludedSet)
                    excludedIds.add(id);
            }
            return excludedIds;
        }
        resolveBulkCraftSelection(itemType, excludedIds, permanentlyConsumedIds = new Set()) {
            const recipe = ItemDescriptions_1.itemDescriptions[itemType]?.recipe;
            if (!recipe)
                return null;
            const tools = [];
            const consumed = [];
            const reservedIds = new Set(permanentlyConsumedIds);
            const newlyConsumedIds = new Set();
            let base;
            const reserveItem = (item, permanentlyConsumed) => {
                const itemId = getItemId(item);
                if (reservedIds.has(itemId))
                    return false;
                reservedIds.add(itemId);
                if (permanentlyConsumed)
                    newlyConsumedIds.add(itemId);
                return true;
            };
            if (recipe.baseComponent !== undefined) {
                const candidates = this.findBulkCandidates(recipe.baseComponent, excludedIds, reservedIds);
                if (candidates.length === 0)
                    return null;
                base = candidates[0];
                if (!reserveItem(base, true))
                    return null;
            }
            for (const comp of recipe.components) {
                const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds);
                if (candidates.length < comp.requiredAmount)
                    return null;
                const picked = candidates.slice(0, comp.requiredAmount);
                const consumedCount = Math.min(comp.consumedAmount, comp.requiredAmount);
                for (let j = 0; j < picked.length; j++) {
                    if (!reserveItem(picked[j], j < consumedCount))
                        return null;
                }
                consumed.push(...picked.slice(0, consumedCount));
                tools.push(...picked.slice(consumedCount));
            }
            return {
                tools,
                consumed,
                base,
                permanentlyConsumedIds: newlyConsumedIds,
            };
        }
        findBulkCandidates(type, excludedIds, reservedIds) {
            return this.findMatchingItems(type).filter(item => {
                const itemId = getItemId(item);
                return !excludedIds.has(itemId)
                    && !reservedIds.has(itemId)
                    && !isItemProtected(item);
            });
        }
        bcGetOrCreateTooltip() {
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
        bcShowTooltip(item, displayName, mouseX, mouseY) {
            const el = this.bcGetOrCreateTooltip();
            el.style.fontSize = window.getComputedStyle(this.element).fontSize;
            el.style.borderColor = getQualityColor(item.quality);
            this.bcFillTooltipForItem(el, item.type, displayName, item);
            el.style.display = "block";
            this.bcPositionTooltip(mouseX, mouseY);
        }
        bcHideTooltip() {
            if (this.bcTooltipEl)
                this.bcTooltipEl.style.display = "none";
        }
        bcPositionTooltip(mouseX, mouseY) {
            const el = this.bcTooltipEl;
            if (!el)
                return;
            const W = el.offsetWidth || 220;
            const H = el.offsetHeight || 100;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const GAP = 14;
            let left = mouseX + GAP;
            let top = mouseY - 8;
            if (left + W > vw - 8)
                left = mouseX - W - GAP;
            if (top + H > vh - 8)
                top = vh - H - 8;
            if (top < 8)
                top = 8;
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
        }
        bcFillTooltipForItem(el, itemType, displayName, item) {
            el.innerHTML = "";
            const desc = ItemDescriptions_1.itemDescriptions[itemType];
            const color = item ? getQualityColor(item.quality) : "#e0d0b0";
            const fmt = (s) => this.formatEnumName(s);
            const header = document.createElement("div");
            header.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px;";
            const nameEl = document.createElement("span");
            nameEl.textContent = displayName;
            nameEl.style.cssText = `color:${color};font-weight:bold;font-size:1.1em;`;
            header.appendChild(nameEl);
            const categoryText = desc?.group?.[0] !== undefined
                ? fmt(IItem_1.ItemTypeGroup[desc.group[0]] || "")
                : fmt(IItem_1.ItemType[itemType] || "");
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
                const dur = item.durability;
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
            }
            else if (desc) {
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
            if (propsRow.childElementCount > 0)
                el.appendChild(propsRow);
            const groups = desc?.group;
            if (groups && groups.length > 0) {
                el.appendChild(this.bcTooltipDivider());
                const gh = document.createElement("div");
                gh.textContent = "Groupings";
                gh.style.cssText = "color:#9a8860;font-size:0.9em;font-weight:bold;margin-bottom:2px;";
                el.appendChild(gh);
                for (const g of groups) {
                    const tierNum = desc?.tier?.[g];
                    const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                    const ge = document.createElement("div");
                    ge.textContent = `\u2022 ${fmt(IItem_1.ItemTypeGroup[g] || `Group ${g}`)}${tierStr}`;
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
                    const tierNum = desc?.actionTier?.[u];
                    const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                    const ue = document.createElement("div");
                    ue.textContent = `\u2022 ${fmt(IAction_1.ActionType[u] || `Action ${u}`)}${tierStr}`;
                    ue.style.cssText = "color:#c0b080;font-size:0.9em;padding-left:4px;";
                    el.appendChild(ue);
                }
            }
        }
        bcTooltipDivider() {
            const div = document.createElement("div");
            div.style.cssText = "height:1px;background:rgba(180,140,60,0.28);margin:5px 0;";
            return div;
        }
        clearResults() {
            this.clearResultsContainer(this.normalResultsEl);
            this.clearResultsContainer(this.bulkResultsEl);
            this.syncResultsVisibility();
        }
        showSingleCraftResult(result) {
            this.renderSingleCraftResult(this.normalResultsEl, result);
            this.activeTab = "normal";
            this.syncResultsVisibility();
        }
        showBulkCraftResults(results) {
            this.renderBulkCraftResults(this.bulkResultsEl, results);
            this.syncResultsVisibility();
        }
        createResultsContainer() {
            const el = document.createElement("div");
            el.className = "bc-results-panel";
            return el;
        }
        clearResultsContainer(el) {
            el.innerHTML = "";
            el.style.display = "none";
        }
        syncResultsVisibility() {
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
        renderSingleCraftResult(el, result) {
            el.innerHTML = "";
            el.appendChild(this.createResultsTitle("Craft Result"));
            const status = document.createElement("div");
            status.className = `bc-results-status ${result.success ? "bc-results-status-success" : "bc-results-status-failed"}`;
            status.textContent = result.success ? "Success" : "Failed";
            el.appendChild(status);
            if (result.item) {
                this.bcFillTooltipForItem(el, result.item.type, this.getDisplayName(result.item), result.item);
            }
            else {
                const msg = document.createElement("div");
                msg.className = "bc-results-empty";
                msg.textContent = `No ${this.formatEnumName(IItem_1.ItemType[result.itemType] || `Item ${result.itemType}`)} was crafted.`;
                el.appendChild(msg);
            }
        }
        renderBulkCraftResults(el, results) {
            el.innerHTML = "";
            el.appendChild(this.createResultsTitle("Craft Results"));
            const list = document.createElement("div");
            list.className = "bc-results-summary-list";
            const failures = results.filter(result => !result.success || !result.item).length;
            const counts = new Map();
            for (const result of results) {
                if (!result.success || !result.item)
                    continue;
                const item = result.item;
                const name = this.getDisplayName(item);
                const existing = counts.get(name);
                if (existing) {
                    existing.count++;
                }
                else {
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
        createResultsTitle(text) {
            const title = document.createElement("div");
            title.className = "bc-results-title";
            title.textContent = text;
            return title;
        }
        getDisplayName(item) {
            let displayName;
            try {
                displayName = this.toTitleCase(item.getName(ITranslation_1.Article.None).getString());
            }
            catch {
                displayName = this.formatEnumName(IItem_1.ItemType[item.type] || `Item ${item.type}`);
            }
            const qualityName = getQualityName(item.quality);
            if (qualityName)
                displayName = `${qualityName} ${displayName}`;
            return displayName;
        }
        getTypeName(type) {
            if (ItemManager_1.default.isGroup(type)) {
                return this.formatEnumName(IItem_1.ItemTypeGroup[type] || `Group ${type}`);
            }
            return this.formatEnumName(IItem_1.ItemType[type] || `Item ${type}`);
        }
        findMatchingItems(type) {
            if (!localPlayer)
                return [];
            const items = localPlayer.island.items;
            const subContainerOpts = { includeSubContainers: true };
            const result = ItemManager_1.default.isGroup(type)
                ? items.getItemsInContainerByGroup(localPlayer, type, subContainerOpts)
                : items.getItemsInContainerByType(localPlayer, type, subContainerOpts);
            const adjacentContainers = items.getAdjacentContainers(localPlayer);
            for (const container of adjacentContainers) {
                const adjacentItems = ItemManager_1.default.isGroup(type)
                    ? items.getItemsInContainerByGroup(container, type, subContainerOpts)
                    : items.getItemsInContainerByType(container, type, subContainerOpts);
                for (const item of adjacentItems) {
                    if (!result.includes(item))
                        result.push(item);
                }
            }
            return result.sort((a, b) => qualitySortKey(b.quality) - qualitySortKey(a.quality));
        }
        async onCraft() {
            if (this.crafting || !this.itemType || !this.recipe)
                return;
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                const sel = this.selectedItems.get(i) || [];
                if (sel.length < comp.requiredAmount) {
                    this.showValidationError(`Select ${comp.requiredAmount} ${this.getTypeName(comp.type)} (have ${sel.length})`);
                    return;
                }
            }
            if (this.recipe.baseComponent !== undefined && (this.selectedItems.get(-1) || []).length < 1) {
                this.showValidationError(`Select a base component: ${this.getTypeName(this.recipe.baseComponent)}`);
                return;
            }
            const toolItems = [];
            const consumeItems = [];
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                (comp.consumedAmount > 0 ? consumeItems : toolItems).push(...(this.selectedItems.get(i) || []));
            }
            const baseItems = this.selectedItems.get(-1) || [];
            const baseComponent = baseItems[0];
            const pendingIds = new Set();
            for (const [, items] of this.selectedItems) {
                for (const item of items)
                    pendingIds.add(getItemId(item));
            }
            this._pendingSelectionIds = pendingIds;
            this.crafting = true;
            try {
                await this.onCraftCallback(this.itemType, toolItems, consumeItems, baseComponent);
                this.updateRecipe(this.itemType, false);
            }
            finally {
                this.crafting = false;
            }
        }
        showValidationError(msg) {
            if (this.validationMsg)
                this.validationMsg.remove();
            this.validationMsg = new Text_1.default();
            this.validationMsg.setText(TranslationImpl_1.default.generator(msg));
            this.validationMsg.style.set("color", "#ff6666");
            this.validationMsg.style.set("padding", "6px 10px");
            this.validationMsg.style.set("margin-top", "4px");
            this.validationMsg.style.set("border-left", "3px solid #ff4444");
            this.validationMsg.style.set("background", "rgba(255,68,68,0.08)");
            this.normalScrollInner.append(this.validationMsg);
            setTimeout(() => { this.validationMsg?.remove(); this.validationMsg = undefined; }, 3000);
        }
    }
    exports.default = BetterCraftingPanel;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmV0dGVyQ3JhZnRpbmdEaWFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJCZXR0ZXJDcmFmdGluZ0RpYWxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0lBNkNBLE1BQU0sY0FBYyxHQUEyQjtRQUMzQyxDQUFDLGlCQUFPLENBQUMsSUFBSSxDQUFDLEVBQVcsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsTUFBTSxDQUFDLEVBQVMsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsUUFBUSxDQUFDLEVBQU8sU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsVUFBVSxDQUFDLEVBQUssU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsV0FBVyxDQUFDLEVBQUksU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsS0FBSyxDQUFDLEVBQVUsU0FBUztLQUNyQyxDQUFDO0lBRUYsU0FBUyxlQUFlLENBQUMsT0FBaUI7UUFDdEMsT0FBTyxjQUFjLENBQUMsT0FBTyxJQUFJLGlCQUFPLENBQUMsSUFBSSxDQUFDLElBQUksY0FBYyxDQUFDLGlCQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVELFNBQVMsY0FBYyxDQUFDLE9BQWlCO1FBQ3JDLElBQUksT0FBTyxLQUFLLFNBQVMsSUFBSSxPQUFPLEtBQUssaUJBQU8sQ0FBQyxJQUFJLElBQUksT0FBTyxLQUFLLGlCQUFPLENBQUMsTUFBTTtZQUFFLE9BQU8sRUFBRSxDQUFDO1FBQy9GLE9BQU8saUJBQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVELFNBQVMsY0FBYyxDQUFDLE9BQWlCO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sSUFBSSxpQkFBTyxDQUFDLElBQUksQ0FBQztRQUNsQyxJQUFJLENBQUMsS0FBSyxpQkFBTyxDQUFDLElBQUks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