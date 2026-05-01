define(["require", "exports", "@wayward/game/ui/component/Component", "@wayward/game/ui/component/Button", "@wayward/game/ui/component/CheckButton", "@wayward/game/ui/component/Text", "@wayward/game/language/impl/TranslationImpl", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/item/IItem", "@wayward/game/game/item/ItemSort", "@wayward/game/game/entity/skill/ISkills", "@wayward/game/game/item/ItemManager", "@wayward/game/language/ITranslation", "@wayward/game/game/IObject", "@wayward/game/game/entity/action/IAction", "@wayward/game/save/ISaveManager", "@wayward/game/ui/screen/screens/game/component/ItemComponent", "@wayward/game/ui/screen/screens/game/component/item/ItemComponentHandler", "@wayward/game/ui/util/IHighlight", "@wayward/game/game/entity/IStats", "@wayward/utilities/Log", "./BetterCraftingDom", "./craftingSelection", "./craftStamina", "./itemIdentity", "./itemState", "./craftStamina"], function (require, exports, Component_1, Button_1, CheckButton_1, Text_1, TranslationImpl_1, ItemDescriptions_1, IItem_1, ItemSort_1, ISkills_1, ItemManager_1, ITranslation_1, IObject_1, IAction_1, ISaveManager_1, ItemComponent_1, ItemComponentHandler_1, IHighlight_1, IStats_1, Log_1, BetterCraftingDom_1, craftingSelection_1, craftStamina_1, itemIdentity_1, itemState_1, craftStamina_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.STAMINA_COST_PER_LEVEL = exports.DEFAULT_CRAFT_STAMINA_COST = void 0;
    const QUALITY_COLORS = {
        [IObject_1.Quality.None]: "#e0d0b0",
        [IObject_1.Quality.Random]: "#e0d0b0",
        [IObject_1.Quality.Superior]: "#33ff99",
        [IObject_1.Quality.Remarkable]: "#00b4ff",
        [IObject_1.Quality.Exceptional]: "#ce5eff",
        [IObject_1.Quality.Mastercrafted]: "#ff8c00",
        [IObject_1.Quality.Relic]: "#ffd700",
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
    };
    const craftDebugLog = Log_1.default.warn("Better Crafting", "CraftDebug");
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
        return (0, itemIdentity_1.getItemIdSafe)(item);
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
    function getSectionCounterKey(slotIndex, semantic = "base") {
        return `${slotIndex}:${semantic}`;
    }
    const ROW_MIN_HEIGHT = 30;
    const ROW_PADDING_V = 4;
    const ROW_MARGIN = 2;
    const SECTION_SORTS = [
        IItem_1.ContainerSort.Recent,
        IItem_1.ContainerSort.Name,
        IItem_1.ContainerSort.Weight,
        IItem_1.ContainerSort.Group,
        IItem_1.ContainerSort.Durability,
        IItem_1.ContainerSort.Quality,
        IItem_1.ContainerSort.Magical,
        IItem_1.ContainerSort.Decay,
        IItem_1.ContainerSort.Worth,
        IItem_1.ContainerSort.BestForCrafting,
    ];
    Object.defineProperty(exports, "DEFAULT_CRAFT_STAMINA_COST", { enumerable: true, get: function () { return craftStamina_2.DEFAULT_CRAFT_STAMINA_COST; } });
    Object.defineProperty(exports, "STAMINA_COST_PER_LEVEL", { enumerable: true, get: function () { return craftStamina_2.STAMINA_COST_PER_LEVEL; } });
    class BetterCraftingPanel extends Component_1.default {
        get activationHotkey() {
            return this.getSettings().activationHotkey;
        }
        get closeHotkey() {
            return this.getSettings().closeHotkey;
        }
        get debugLoggingEnabled() {
            return this.getSettings().debugLogging === true;
        }
        getCurrentStamina() {
            return localPlayer ? localPlayer.stat?.get?.(IStats_1.Stat.Stamina)?.value ?? 0 : 0;
        }
        isSafeCraftingEnabled() {
            return this.safeCraftingEnabled;
        }
        shouldPreserveDismantleRequiredDurability() {
            return this.preserveDismantleRequiredDurability;
        }
        showMultiplayerMessage(message) {
            this.showValidationError(message);
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
        consumeLastBulkResolutionMessage() {
            const message = this.lastBulkResolutionMessage;
            this.lastBulkResolutionMessage = undefined;
            return message;
        }
        setSafeCraftingEnabled(enabled) {
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
        resetSafeCraftingEnabled() {
            this.setSafeCraftingEnabled(true);
        }
        getPanelScale(panelRect = this.element.getBoundingClientRect()) {
            return this.element.offsetWidth > 0
                ? panelRect.width / this.element.offsetWidth
                : 1;
        }
        anchorPanelToViewport() {
            const panelRect = this.element.getBoundingClientRect();
            const scale = this.getPanelScale(panelRect);
            const cssLeft = panelRect.left / scale;
            const cssTop = panelRect.top / scale;
            this.style.set("transform", "none");
            this.element.style.left = `${cssLeft}px`;
            this.element.style.top = `${cssTop}px`;
            return { panelRect, scale, cssLeft, cssTop };
        }
        getMinDimensionPx(property, fallback) {
            const computedValue = window.getComputedStyle(this.element)[property];
            const parsed = Number.parseFloat(computedValue);
            return Number.isFinite(parsed) ? parsed : fallback;
        }
        beginResize(direction, event) {
            if (event.button !== 0)
                return;
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
            const onMouseMove = (moveEvent) => {
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
        isConfiguredHotkey(key) {
            return key === this.activationHotkey;
        }
        isConfiguredCloseHotkey(key) {
            return key.toLowerCase() === this.closeHotkey.toLowerCase();
        }
        isTypingInEditableControl(target) {
            const element = target instanceof HTMLElement ? target : undefined;
            if (!element)
                return false;
            if (element.closest("input, textarea, select"))
                return true;
            const editable = element.closest("[contenteditable]");
            return editable instanceof HTMLElement && editable.isContentEditable;
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
        bindTooltipRowHandlers(row, item, displayName, options) {
            row.addEventListener("mouseenter", (event) => {
                this._hoveredItem = item;
                this._hoveredDisplayName = displayName;
                this._hoveredMouseX = event.clientX;
                this._hoveredMouseY = event.clientY;
                options?.onEnter?.(event);
                if (this.shiftHeld) {
                    this.bcShowTooltip(item, displayName, event.clientX, event.clientY);
                }
            });
            row.addEventListener("mousemove", (event) => {
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
        constructor(onCraft, onBulkCraft, onDismantle, getSettings, initialSafeCrafting = true) {
            super();
            this.itemType = 0;
            this.panelMode = "craft";
            this.selectedItems = new Map();
            this.splitSelectedItems = new Map();
            this.normalRenderReservations = new Map();
            this.explicitSelections = new Map();
            this.explicitSelectionSequence = 0;
            this.sectionCounters = new Map();
            this.sectionFilterStates = new Map();
            this.pendingSectionReselectKeys = new Set();
            this.pendingSortReselectKeys = new Set();
            this._pendingSelectionIds = null;
            this._pendingSplitSelectionIds = null;
            this.bcTooltipEl = null;
            this._hoveredItem = null;
            this._hoveredDisplayName = "";
            this._hoveredMouseX = 0;
            this._hoveredMouseY = 0;
            this.shiftHeld = false;
            this._inventoryRefreshTimer = null;
            this._inventoryRefreshQueued = false;
            this._inventoryWatchHandlers = null;
            this.activeTab = "normal";
            this.bulkExcludedIds = new Map();
            this.bulkPreserveDurabilityBySlot = new Map();
            this.bulkPinnedToolSelections = new Map();
            this.bulkPinnedUsedSelections = new Map();
            this._lastBulkItemType = 0;
            this.bulkQuantity = 1;
            this.bulkQtyInputEl = null;
            this.bulkMaxLabel = null;
            this.bulkCraftBtnEl = null;
            this.bulkSafeToggleEl = null;
            this.bulkSafeToggleWrap = null;
            this._bulkContentDirty = true;
            this.bulkStopBtn = null;
            this.bulkQtyRow = null;
            this.bulkProgressEl = null;
            this.onBulkAbortCallback = null;
            this.onPanelHideCallback = null;
            this.bulkProgressVerb = "Crafting";
            this.safeCraftingEnabled = true;
            this.destroyed = false;
            this.dismantleExcludedIds = new Set();
            this.preserveDismantleRequiredDurability = true;
            this.helpBoxExpanded = {
                normal: false,
                bulk: false,
                dismantle: false,
            };
            this._onShiftDown = (e) => {
                if (this.isTypingInEditableControl(e.target))
                    return;
                if (this.panelVisible && this.isConfiguredCloseHotkey(e.key)) {
                    this.hidePanel();
                    return;
                }
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
            };
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
            document.addEventListener("keydown", this._onShiftDown);
            document.addEventListener("keyup", this._onShiftUp);
            window.addEventListener("blur", this._onBlur);
            this.element.addEventListener("mousedown", (e) => {
                if (e.button !== 0)
                    return;
                const t = e.target;
                if (t.closest("button, .better-crafting-item-list, input, select, .bc-resize-handle"))
                    return;
                const { scale, cssLeft, cssTop } = this.anchorPanelToViewport();
                const startX = e.clientX;
                const startY = e.clientY;
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
            this.craftFrame = new Component_1.default();
            this.craftFrame.classes.add("bc-craft-frame");
            this.append(this.craftFrame);
            const rightResizeHandle = document.createElement("div");
            rightResizeHandle.className = "bc-resize-handle bc-resize-handle-right";
            rightResizeHandle.addEventListener("mousedown", (e) => this.beginResize("right", e));
            this.element.appendChild(rightResizeHandle);
            const bottomResizeHandle = document.createElement("div");
            bottomResizeHandle.className = "bc-resize-handle bc-resize-handle-bottom";
            bottomResizeHandle.addEventListener("mousedown", (e) => this.beginResize("bottom", e));
            this.element.appendChild(bottomResizeHandle);
            const cornerResizeHandle = document.createElement("div");
            cornerResizeHandle.className = "bc-resize-handle bc-resize-handle-corner";
            cornerResizeHandle.addEventListener("mousedown", (e) => this.beginResize("corner", e));
            this.element.appendChild(cornerResizeHandle);
            this.normalBody = new Component_1.default();
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
            this.normalFooter = new Component_1.default();
            this.normalFooter.classes.add("dialog-footer");
            this.normalFooter.style.set("padding", "8px 10px");
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
            this.bulkBody = new Component_1.default();
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
            this.bulkFooter = new Component_1.default();
            this.bulkFooter.classes.add("dialog-footer");
            this.bulkFooter.style.set("padding", "8px 10px");
            this.bulkFooter.style.set("display", "none");
            this.bulkFooter.style.set("gap", "8px");
            this.bulkFooter.style.set("flex-shrink", "0");
            this.bulkFooter.style.set("justify-content", "flex-end");
            this.bulkFooter.style.set("align-items", "center");
            this.append(this.bulkFooter);
            const qtyRow = document.createElement("div");
            qtyRow.style.cssText = "display:flex;align-items:center;gap:4px;margin-right:auto;";
            const minusBtn = document.createElement("button");
            minusBtn.type = "button";
            minusBtn.className = "bc-qty-btn";
            minusBtn.textContent = "−";
            minusBtn.setAttribute("aria-label", "Decrease bulk quantity");
            minusBtn.addEventListener("mousedown", (e) => {
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
                const v = parseInt(this.bulkQtyInputEl.value, 10);
                if (!isNaN(v) && v >= 1) {
                    const limits = this.computeBulkUiLimits();
                    const max = limits.max;
                    this.bulkQuantity = max > 0 ? Math.min(v, max) : 1;
                    if (this.bulkQtyInputEl)
                        this.bulkQtyInputEl.value = String(this.bulkQuantity);
                    this.updateBulkMaxDisplay(limits);
                    this.updateBulkCraftBtnState(limits);
                }
                else {
                    this.bulkQtyInputEl.value = String(this.bulkQuantity);
                }
            });
            qtyRow.appendChild(this.bulkQtyInputEl);
            const plusBtn = document.createElement("button");
            plusBtn.type = "button";
            plusBtn.className = "bc-qty-btn";
            plusBtn.textContent = "+";
            plusBtn.setAttribute("aria-label", "Increase bulk quantity");
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
            this.bulkSafeToggleWrap = this.createSafeToggle(toggle => {
                this.bulkSafeToggleEl = toggle;
            });
            this.bulkFooter.append(this.bulkSafeToggleWrap);
            this.bulkCraftBtnEl = new Button_1.default();
            this.bulkCraftBtnEl.classes.add("button-block", "better-crafting-craft-btn", "bc-craft-disabled");
            this.bulkCraftBtnEl.setText(TranslationImpl_1.default.generator("Bulk Craft"));
            this.bulkCraftBtnEl.style.set("padding", "6px 14px");
            this.bulkCraftBtnEl.event.subscribe("activate", () => this.onBulkCraft());
            this.bulkFooter.append(this.bulkCraftBtnEl);
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
        destroyListeners() {
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
        clearSectionFilterStates() {
            for (const state of this.sectionFilterStates.values()) {
                if (state.debounceTimer !== null) {
                    clearTimeout(state.debounceTimer);
                    state.debounceTimer = null;
                }
            }
            this.sectionFilterStates.clear();
        }
        resetWindowSessionState() {
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
            if (this.bulkQtyInputEl)
                this.bulkQtyInputEl.value = "1";
            this._bulkContentDirty = true;
            this.lastBulkResolutionMessage = undefined;
            this.dismantleExcludedIds.clear();
            this.dismantleDescription = undefined;
            this.dismantleRequiredSelection = undefined;
            this.dismantleSelectedItemType = undefined;
            this.preserveDismantleRequiredDurability = true;
        }
        canAccessElements() {
            return !this.destroyed && !!this.element?.isConnected;
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
                if (!this.panelVisible || !this.canAccessElements())
                    return;
                if (this.crafting || this.bulkCrafting) {
                    this._inventoryRefreshQueued = true;
                    return;
                }
                this.refreshVisibleCraftingViews(false);
            }, 200);
        }
        flushQueuedInventoryRefresh(preserveScroll = false) {
            if (!this._inventoryRefreshQueued || !this.panelVisible || !this.canAccessElements())
                return;
            if (this.crafting || this.bulkCrafting)
                return;
            this._inventoryRefreshQueued = false;
            this.refreshVisibleCraftingViews(preserveScroll);
        }
        isDismantleMode() {
            return this.panelMode === "dismantle";
        }
        isSameDismantleType(itemType) {
            return this.panelMode === "dismantle" && this.dismantleSelectedItemType === itemType;
        }
        requiresDismantleRequiredItem() {
            return this.dismantleDescription?.required !== undefined;
        }
        resolveDismantleRequiredSelection() {
            if (!this.dismantleDescription?.required)
                return this.dismantleRequiredSelection;
            const items = this.getFilteredSortedSectionItems("dismantle", -2, "tool", this.findMatchingItems(this.dismantleDescription.required));
            if (this.dismantleRequiredSelection && items.includes(this.dismantleRequiredSelection)) {
                return this.dismantleRequiredSelection;
            }
            return items[0];
        }
        showSelectionChangedError(message = "Your selection changed. Please reselect the items and try again.") {
            this.showMultiplayerMessage(message);
            return undefined;
        }
        sanitizeSelectedItems(items, candidates, maxCount) {
            const candidateIds = candidates ? new Set(candidates.map(item => getItemId(item)).filter((id) => id !== undefined)) : undefined;
            const seenIds = new Set();
            const sanitized = [];
            for (const item of items) {
                const itemId = getItemId(item);
                if (!item || itemId === undefined || seenIds.has(itemId))
                    continue;
                if (candidateIds && !candidateIds.has(itemId))
                    continue;
                sanitized.push(item);
                seenIds.add(itemId);
                if (maxCount !== undefined && sanitized.length >= maxCount)
                    break;
            }
            return sanitized;
        }
        getReservationRoleLabel(role) {
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
        reserveItemsForRole(reservations, items, role) {
            for (const item of items) {
                const itemId = getItemId(item);
                if (itemId !== undefined && !reservations.has(itemId)) {
                    reservations.set(itemId, role);
                }
            }
        }
        getReservationConflict(reservations, item, currentRole) {
            const itemId = getItemId(item);
            if (itemId === undefined)
                return undefined;
            const reservedRole = reservations.get(itemId);
            return reservedRole !== undefined && reservedRole !== currentRole ? reservedRole : undefined;
        }
        filterUnreservedItems(items, reservations, currentRole) {
            return items.filter(item => {
                const itemId = getItemId(item);
                if (itemId === undefined)
                    return true;
                const reservedRole = reservations.get(itemId);
                return reservedRole === undefined || reservedRole === currentRole;
            });
        }
        repairSelectedItemsForRole(selectedItems, candidates, maxCount, reservations, role, forceTopVisible = false) {
            const selectableCandidates = this.filterUnreservedItems(candidates, reservations, role);
            if (forceTopVisible)
                return selectableCandidates.slice(0, maxCount);
            const candidateValidSelection = this.sanitizeSelectedItems([...selectedItems], candidates, maxCount);
            const repairedSelection = this.sanitizeSelectedItems([...selectedItems], selectableCandidates, maxCount);
            if (repairedSelection.length < candidateValidSelection.length) {
                return this.supplementSelectedItems(repairedSelection, selectableCandidates, maxCount);
            }
            return repairedSelection;
        }
        hasDuplicateItemIds(items) {
            return this.hasDuplicateIds(items.map(item => getItemId(item)).filter((id) => id !== undefined));
        }
        hasDuplicateIds(itemIds) {
            const seenIds = new Set();
            for (const itemId of itemIds) {
                if (seenIds.has(itemId))
                    return true;
                seenIds.add(itemId);
            }
            return false;
        }
        supplementSelectedItems(selectedItems, candidates, maxCount) {
            if (selectedItems.length >= maxCount)
                return selectedItems.slice(0, maxCount);
            const selectedIds = new Set(selectedItems.map(item => getItemId(item)).filter((id) => id !== undefined));
            const supplemented = [...selectedItems];
            for (const item of candidates) {
                const itemId = getItemId(item);
                if (itemId !== undefined && selectedIds.has(itemId))
                    continue;
                supplemented.push(item);
                if (itemId !== undefined)
                    selectedIds.add(itemId);
                if (supplemented.length >= maxCount)
                    break;
            }
            return supplemented;
        }
        getSelectionFailureMessage(details) {
            const slotLabel = details.slotIndex === -1
                ? "base component"
                : details.slotIndex !== undefined
                    ? `${this.getTypeName(details.itemTypeOrGroup)} slot`
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
        setBulkResolutionFailure(details) {
            this.lastBulkResolutionMessage = this.getSelectionFailureMessage(details);
        }
        buildCraftRequestDiagnostics(request) {
            return {
                requestId: request.requestId,
                itemType: request.itemType,
                slots: this.recipe?.components.map((component, slotIndex) => ({
                    slotIndex,
                    requiredAmount: component.requiredAmount,
                    selectedIds: request.slotSelections.find(selection => selection.slotIndex === slotIndex)?.itemIds ?? [],
                    candidateIds: (0, itemIdentity_1.getItemIds)(this.findMatchingItems(component.type), item => getItemId(item)),
                })) ?? [],
                base: this.recipe?.baseComponent === undefined
                    ? undefined
                    : {
                        selectedId: request.baseItemId,
                        candidateIds: (0, itemIdentity_1.getItemIds)(this.findMatchingItems(this.recipe.baseComponent), item => getItemId(item)),
                    },
            };
        }
        buildCraftExecutionDiagnostics(itemType, slotSelections, base) {
            const slots = [...slotSelections].map((items, slotIndex) => {
                const component = this.recipe?.components[slotIndex];
                const consumedItems = component
                    ? (0, craftingSelection_1.partitionSelectedItems)(items, component.requiredAmount, component.consumedAmount).consumed
                    : [];
                const splitSelection = this.splitSelectedItems.get(slotIndex);
                return {
                    slotIndex,
                    requiredAmount: component?.requiredAmount,
                    consumedAmount: component?.consumedAmount,
                    selectedIds: (0, itemIdentity_1.getItemIds)(items, item => getItemId(item)),
                    consumedIds: (0, itemIdentity_1.getItemIds)(consumedItems, item => getItemId(item)),
                    requiredIds: (0, itemIdentity_1.getItemIds)(items, item => getItemId(item)),
                    splitConsumedIds: (0, itemIdentity_1.getItemIds)(splitSelection?.consumed, item => getItemId(item)),
                    splitUsedIds: (0, itemIdentity_1.getItemIds)(splitSelection?.used, item => getItemId(item)),
                };
            });
            const payload = (0, craftingSelection_1.buildCraftExecutionPayload)([...slotSelections], (_, slotIndex) => {
                const component = this.recipe?.components[slotIndex];
                return {
                    requiredAmount: component?.requiredAmount ?? 0,
                    consumedAmount: component?.consumedAmount ?? 0,
                };
            });
            return {
                itemType,
                requiredIds: (0, itemIdentity_1.getItemIds)(payload.required, item => getItemId(item)),
                consumedIds: (0, itemIdentity_1.getItemIds)(payload.consumed, item => getItemId(item)),
                baseId: getItemId(base),
                slots,
            };
        }
        buildCurrentNormalCraftSelectionState() {
            return {
                itemType: this.itemType,
                slots: this.recipe?.components.map((component, slotIndex) => ({
                    slotIndex,
                    requiredAmount: component.requiredAmount,
                    consumedAmount: component.consumedAmount,
                    selectedIds: (0, itemIdentity_1.getItemIds)(this.selectedItems.get(slotIndex), item => getItemId(item)),
                    consumedIds: (0, itemIdentity_1.getItemIds)(this.splitSelectedItems.get(slotIndex)?.consumed, item => getItemId(item)),
                    usedIds: (0, itemIdentity_1.getItemIds)(this.splitSelectedItems.get(slotIndex)?.used, item => getItemId(item)),
                })) ?? [],
                baseIds: (0, itemIdentity_1.getItemIds)(this.selectedItems.get(-1), item => getItemId(item)),
            };
        }
        buildBulkRequestDiagnostics(request) {
            return {
                requestId: request.requestId,
                itemType: request.itemType,
                quantity: request.quantity,
                excludedIds: request.excludedIds,
                pinnedToolSelections: request.pinnedToolSelections.map(selection => ({
                    slotIndex: selection.slotIndex,
                    itemIds: selection.itemIds,
                    candidateIds: this.recipe?.components[selection.slotIndex]
                        ? (0, itemIdentity_1.getItemIds)(this.findMatchingItems(this.recipe.components[selection.slotIndex].type), item => getItemId(item))
                        : [],
                })),
                pinnedUsedSelections: (request.pinnedUsedSelections ?? []).map(selection => ({
                    slotIndex: selection.slotIndex,
                    itemIds: selection.itemIds,
                    candidateIds: this.recipe?.components[selection.slotIndex]
                        ? (0, itemIdentity_1.getItemIds)(this.findMatchingItems(this.recipe.components[selection.slotIndex].type), item => getItemId(item))
                        : [],
                })),
            };
        }
        serializeSlotSelection(slotIndex, type, requiredAmount) {
            const component = this.recipe?.components[slotIndex];
            const candidates = component && this.isSplitComponent(component)
                ? this.mergeVisibleSplitCandidates(slotIndex, this.findMatchingItems(type))
                : this.getFilteredSortedSectionItems("normal", slotIndex, component && component.consumedAmount <= 0 ? "tool" : "consumed", this.findMatchingItems(type));
            const resolved = component
                ? this.resolveComponentSelection(slotIndex, component, candidates, requiredAmount)
                : undefined;
            if (!resolved)
                return undefined;
            return {
                slotIndex,
                itemIds: (0, itemIdentity_1.getItemIds)(resolved.items, item => getItemId(item)),
            };
        }
        serializeCraftSelectionRequest(requestId) {
            this.debugLog("SerializeCraftSelectionRequest", {
                requestId,
                itemType: this.itemType,
                selectedState: this.buildCurrentNormalCraftSelectionState(),
            });
            if (!this.itemType || !this.recipe)
                return undefined;
            const slotSelections = [];
            for (let i = 0; i < this.recipe.components.length; i++) {
                const selection = this.serializeSlotSelection(i, this.recipe.components[i].type, this.recipe.components[i].requiredAmount);
                if (!selection)
                    return undefined;
                slotSelections.push(selection);
            }
            let baseItemId;
            if (this.recipe.baseComponent !== undefined) {
                const baseCandidates = this.getFilteredSortedSectionItems("normal", -1, "base", this.findMatchingItems(this.recipe.baseComponent));
                const sanitizedBase = this.sanitizeSelectedItems(this.selectedItems.get(-1) ?? [], baseCandidates, 1);
                const selectedBase = sanitizedBase[0];
                baseItemId = getItemId(selectedBase);
                if (baseItemId === undefined) {
                    return this.showSelectionChangedError(this.getSelectionFailureMessage({
                        reason: "baseUnavailable",
                        slotIndex: -1,
                        itemTypeOrGroup: this.recipe.baseComponent,
                        candidateItemIds: baseCandidates.map(item => getItemId(item)).filter((id) => id !== undefined),
                    }));
                }
                this.selectedItems.set(-1, [selectedBase]);
            }
            const selectedIdsForRequest = [];
            for (const selection of slotSelections) {
                selectedIdsForRequest.push(...selection.itemIds);
            }
            if (baseItemId !== undefined)
                selectedIdsForRequest.push(baseItemId);
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
        resolveCurrentCraftSelection() {
            if (!this.itemType || !this.recipe)
                return undefined;
            const slotSelections = new Map();
            for (let i = 0; i < this.recipe.components.length; i++) {
                const component = this.recipe.components[i];
                const candidates = this.isSplitComponent(component)
                    ? this.mergeVisibleSplitCandidates(i, this.findMatchingItems(component.type))
                    : this.getFilteredSortedSectionItems("normal", i, component.consumedAmount <= 0 ? "tool" : "consumed", this.findMatchingItems(component.type));
                const resolved = this.resolveComponentSelection(i, component, candidates, component.requiredAmount);
                if (!resolved)
                    return undefined;
                slotSelections.set(i, resolved.items);
            }
            let base;
            if (this.recipe.baseComponent !== undefined) {
                const baseCandidates = this.getFilteredSortedSectionItems("normal", -1, "base", this.findMatchingItems(this.recipe.baseComponent));
                const sanitizedBase = this.sanitizeSelectedItems(this.selectedItems.get(-1) ?? [], baseCandidates, 1);
                base = sanitizedBase[0];
                if (!base) {
                    return this.showSelectionChangedError(this.getSelectionFailureMessage({
                        reason: "baseUnavailable",
                        slotIndex: -1,
                        itemTypeOrGroup: this.recipe.baseComponent,
                        candidateItemIds: baseCandidates.map(item => getItemId(item)).filter((id) => id !== undefined),
                    }));
                }
                this.selectedItems.set(-1, [base]);
            }
            const orderedSelections = this.recipe.components.map((_, slotIndex) => slotSelections.get(slotIndex) ?? []);
            const payload = (0, craftingSelection_1.buildCraftExecutionPayload)(orderedSelections, (_, slotIndex) => ({
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
        serializeBulkCraftRequest(requestId, quantity) {
            this.debugLog("SerializeBulkCraftRequest", {
                requestId,
                quantity,
                itemType: this.itemType,
                pinnedToolSelections: [...this.bulkPinnedToolSelections.entries()].map(([slotIndex, items]) => ({
                    slotIndex,
                    itemIds: (0, itemIdentity_1.getItemIds)(items, item => getItemId(item)),
                })),
                pinnedUsedSelections: [...this.bulkPinnedUsedSelections.entries()].map(([slotIndex, items]) => ({
                    slotIndex,
                    itemIds: (0, itemIdentity_1.getItemIds)(items, item => getItemId(item)),
                })),
            });
            if (!this.itemType || !this.recipe)
                return undefined;
            const excludedIds = [...this.getBulkExcludedIds()];
            if (!this.prepareBulkPinnedSelections(new Set(excludedIds)))
                return this.showSelectionChangedError();
            for (const [slotIndex, items] of this.bulkPinnedToolSelections) {
                const component = this.recipe.components[slotIndex];
                if (!component)
                    continue;
                const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, "tool", this.findMatchingItems(component.type));
                const sanitized = this.sanitizeSelectedItems(items, candidates, component.requiredAmount);
                if (sanitized.length < component.requiredAmount)
                    return this.showSelectionChangedError();
                this.bulkPinnedToolSelections.set(slotIndex, sanitized);
            }
            for (const [slotIndex, items] of this.bulkPinnedUsedSelections) {
                const component = this.recipe.components[slotIndex];
                if (!component)
                    continue;
                const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, "used", this.findMatchingItems(component.type)).filter(candidate => {
                    const candidateId = getItemId(candidate);
                    return candidateId === undefined || !(this.bulkExcludedIds.get(slotIndex)?.has(candidateId) ?? false);
                });
                const sanitized = this.sanitizeSelectedItems(items, candidates, (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount));
                if (sanitized.length < (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount))
                    return this.showSelectionChangedError();
                this.bulkPinnedUsedSelections.set(slotIndex, sanitized);
            }
            return {
                requestId,
                itemType: this.itemType,
                quantity,
                excludedIds,
                pinnedToolSelections: [...this.bulkPinnedToolSelections.entries()].map(([slotIndex, items]) => ({
                    slotIndex,
                    itemIds: items.map(getItemId).filter((id) => id !== undefined),
                })),
                pinnedUsedSelections: [...this.bulkPinnedUsedSelections.entries()].map(([slotIndex, items]) => ({
                    slotIndex,
                    itemIds: items.map(getItemId).filter((id) => id !== undefined),
                })),
                unsafeCrafting: !this.safeCraftingEnabled,
            };
        }
        serializeDismantleRequest(requestId, quantity) {
            this.debugLog("SerializeDismantleRequest", {
                requestId,
                quantity,
                itemType: this.dismantleSelectedItemType,
                excludedIds: [...this.dismantleExcludedIds],
                requiredSelectionId: getItemId(this.dismantleRequiredSelection),
            });
            if (!this.dismantleSelectedItemType || !this.dismantleDescription)
                return undefined;
            const targets = this.sanitizeSelectedItems(this.getIncludedDismantleItems().slice(0, quantity), this.findMatchingItems(this.dismantleSelectedItemType), quantity);
            const targetItemIds = targets.map(getItemId).filter((id) => id !== undefined);
            if (targetItemIds.length === 0)
                return this.showSelectionChangedError();
            let requiredItemId;
            if (this.dismantleRequiredSelection) {
                const requiredCandidates = this.dismantleDescription.required
                    ? this.getFilteredSortedSectionItems("dismantle", -2, "tool", this.findMatchingItems(this.dismantleDescription.required))
                    : undefined;
                const sanitizedRequired = this.sanitizeSelectedItems([this.dismantleRequiredSelection], requiredCandidates, 1);
                const requiredItem = sanitizedRequired[0];
                requiredItemId = getItemId(requiredItem);
                if (requiredItemId === undefined)
                    return this.showSelectionChangedError();
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
        openDismantle(item) {
            const itemType = item.type;
            const dismantle = ItemDescriptions_1.itemDescriptions[itemType]?.dismantle;
            if (!dismantle)
                return;
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
        applyPanelModeLayout() {
            if (!this.canAccessElements())
                return;
            if (this.panelMode === "dismantle") {
                this.tabBar.style.display = "none";
                this.closeBtn.style.display = "";
                this.normalBody.style.set("display", "none");
                this.normalFooter.style.set("display", "none");
                this.bulkBody.style.set("display", "flex");
                this.bulkFooter.style.set("display", "flex");
                this.element.classList.remove("bc-panel-bulk");
                this.element.classList.add("bc-panel-dismantle");
                this.bulkCraftBtnEl?.setText(TranslationImpl_1.default.generator("Dismantle"));
                return;
            }
            this.tabBar.style.display = "";
            this.closeBtn.style.display = "";
            this.element.classList.remove("bc-panel-dismantle");
            this.bulkCraftBtnEl?.setText(TranslationImpl_1.default.generator("Bulk Craft"));
            if (this.activeTab === "bulk") {
                this.normalBody.style.set("display", "none");
                this.normalFooter.style.set("display", "none");
                this.bulkBody.style.set("display", "flex");
                this.bulkFooter.style.set("display", "flex");
                this.element.classList.add("bc-panel-bulk");
            }
            else {
                this.normalBody.style.set("display", "flex");
                this.normalFooter.style.set("display", "flex");
                this.bulkBody.style.set("display", "none");
                this.bulkFooter.style.set("display", "none");
                this.element.classList.remove("bc-panel-bulk");
            }
        }
        switchTab(tab) {
            if (this.panelMode === "dismantle")
                return;
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
            }
            else {
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
        showPanel() {
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
        hidePanel() {
            if (this.bulkCrafting)
                this.onBulkAbortCallback?.();
            this.onPanelHideCallback?.();
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
        get panelVisible() {
            return this.element?.style.display !== "none";
        }
        setBulkAbortCallback(cb) {
            this.onBulkAbortCallback = cb;
        }
        setPanelHideCallback(cb) {
            this.onPanelHideCallback = cb;
        }
        onBulkCraftStart(total, verb = "Crafting") {
            this.bulkProgressVerb = verb;
            if (this.bulkCraftBtnEl)
                this.bulkCraftBtnEl.style.set("display", "none");
            if (this.bulkSafeToggleWrap)
                this.bulkSafeToggleWrap.style.display = "none";
            if (this.bulkQtyRow)
                this.bulkQtyRow.style.display = "none";
            if (this.bulkProgressEl) {
                this.bulkProgressEl.textContent = `${verb} 0 / ${total}`;
                this.bulkProgressEl.style.display = "";
            }
            if (this.bulkStopBtn)
                this.bulkStopBtn.style.set("display", "");
        }
        setBulkProgress(current, total, verb = this.bulkProgressVerb) {
            if (this.bulkProgressEl) {
                this.bulkProgressEl.textContent = `${verb} ${current} / ${total}`;
            }
        }
        onBulkCraftEnd() {
            if (this.bulkStopBtn)
                this.bulkStopBtn.style.set("display", "none");
            if (this.bulkProgressEl)
                this.bulkProgressEl.style.display = "none";
            if (this.bulkCraftBtnEl)
                this.bulkCraftBtnEl.style.set("display", "");
            if (this.bulkSafeToggleWrap)
                this.bulkSafeToggleWrap.style.display = "";
            if (this.bulkQtyRow)
                this.bulkQtyRow.style.display = "";
            this._bulkContentDirty = true;
            this.flushQueuedInventoryRefresh(false);
        }
        updateHighlights() {
            this.clearHighlights();
            const selectors = [];
            if (this.panelMode === "dismantle") {
                if (this.dismantleSelectedItemType !== undefined) {
                    selectors.push([IHighlight_1.HighlightType.ItemType, this.dismantleSelectedItemType]);
                }
                if (this.dismantleDescription?.required !== undefined) {
                    selectors.push([IHighlight_1.HighlightType.ItemGroup, this.dismantleDescription.required]);
                }
            }
            else if (this.recipe) {
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
            }
            if (selectors.length > 0)
                ui?.highlights?.start(this, { selectors });
        }
        clearHighlights() {
            ui?.highlights?.end(this);
        }
        updateRecipe(itemType, clearResults = true, preserveScroll = false) {
            this.panelMode = "craft";
            this.applyPanelModeLayout();
            this.itemType = itemType;
            const pendingIds = clearResults ? this._pendingSelectionIds : (this._pendingSelectionIds ?? this.collectCurrentNormalSelectionIds());
            const pendingSplitIds = clearResults ? this._pendingSplitSelectionIds : (this._pendingSplitSelectionIds ?? this.collectCurrentSplitSelectionIds());
            this._pendingSelectionIds = null;
            this._pendingSplitSelectionIds = null;
            this.selectedItems.clear();
            this.splitSelectedItems.clear();
            const desc = ItemDescriptions_1.itemDescriptions[itemType];
            this.recipe = desc?.recipe;
            this._bulkContentDirty = true;
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
                const pre = this.getPreSelectedItems(items, 1, pendingIds?.get(-1));
                if (pre.length)
                    this.selectedItems.set(-1, pre);
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
            if (this.activeTab === "bulk") {
                this.buildBulkContent(preserveScroll, true);
            }
        }
        refreshNormalCraftView(preserveScroll = true, preserveSelections = true) {
            if (this.itemType === undefined)
                return;
            if (preserveSelections) {
                this._pendingSelectionIds = this.collectCurrentNormalSelectionIds();
                this._pendingSplitSelectionIds = this.collectCurrentSplitSelectionIds();
            }
            this.updateRecipe(this.itemType, !preserveSelections, preserveScroll);
        }
        refreshBulkCraftView(preserveScroll = true, preserveQuantity = true, preserveSelections = true) {
            if (!this.recipe)
                return;
            if (!preserveSelections) {
                this.bulkExcludedIds.clear();
                this.bulkPreserveDurabilityBySlot.clear();
                this.bulkPinnedToolSelections.clear();
                this.bulkPinnedUsedSelections.clear();
            }
            this._bulkContentDirty = true;
            this.buildBulkContent(preserveScroll, preserveQuantity);
        }
        refreshDismantleView(preserveScroll = true, preserveQuantity = true, preserveSelections = true) {
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
                if (this.bulkQtyInputEl)
                    this.bulkQtyInputEl.value = "1";
                const limits = this.computeBulkUiLimits();
                this.updateBulkMaxDisplay(limits);
                this.updateBulkCraftBtnState(limits);
            }
        }
        refreshVisibleCraftingViews(preserveScroll = true) {
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
        rebuildNormalContent(preserveScroll = false) {
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
                const noRecipe = new Text_1.default();
                noRecipe.setText(TranslationImpl_1.default.generator("No recipe found for this item."));
                noRecipe.style.set("color", "#ff6666");
                this.normalScrollInner.append(noRecipe);
                this.updateCraftButtonState();
                this.restoreScrollPosition(this.scrollContent, scrollTop, scrollLeft, preserveScroll);
                return;
            }
            this.buildOutputCard(this.itemType, this.recipe, false);
            this.addNormalHelpBox();
            if (this.recipe.baseComponent !== undefined)
                this.addBaseComponentSection(this.recipe.baseComponent);
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
        restoreScrollPosition(port, scrollTop, scrollLeft = 0, preserveScroll = false) {
            if (!preserveScroll)
                return;
            requestAnimationFrame(() => {
                if (!this.canAccessElements() || !port.element?.isConnected)
                    return;
                port.element.scrollTop = scrollTop;
                port.element.scrollLeft = scrollLeft;
            });
        }
        getItemsByOrderedIds(items, orderedIds, maxCount) {
            if (!orderedIds?.length)
                return [];
            const candidateMap = new Map();
            for (const item of items) {
                const itemId = getItemId(item);
                if (itemId !== undefined && !candidateMap.has(itemId)) {
                    candidateMap.set(itemId, item);
                }
            }
            const orderedItems = [];
            for (const itemId of orderedIds) {
                const item = candidateMap.get(itemId);
                if (!item)
                    continue;
                orderedItems.push(item);
                if (maxCount !== undefined && orderedItems.length >= maxCount)
                    break;
            }
            return orderedItems;
        }
        mergeVisibleSplitCandidates(slotIndex, items) {
            const merged = [];
            const seenIds = new Set();
            for (const item of [
                ...this.getFilteredSortedSectionItems("normal", slotIndex, "consumed", items),
                ...this.getFilteredSortedSectionItems("normal", slotIndex, "used", items),
            ]) {
                const itemId = getItemId(item);
                if (itemId === undefined || seenIds.has(itemId))
                    continue;
                seenIds.add(itemId);
                merged.push(item);
            }
            return merged;
        }
        getPreSelectedItems(items, maxCount, pendingIds) {
            if (pendingIds?.length) {
                const restored = this.getItemsByOrderedIds(items, pendingIds, maxCount);
                if (restored.length >= maxCount)
                    return restored.slice(0, maxCount);
                if (restored.length > 0) {
                    const restoredIds = new Set(restored.map(item => getItemId(item)).filter((id) => id !== undefined));
                    const extras = items.filter(item => {
                        const itemId = getItemId(item);
                        return itemId === undefined || !restoredIds.has(itemId);
                    });
                    return [...restored, ...extras].slice(0, maxCount);
                }
            }
            return items.slice(0, maxCount);
        }
        isSplitComponent(component) {
            return (0, craftingSelection_1.isSplitConsumption)(component.requiredAmount, component.consumedAmount);
        }
        getSplitSelection(slotIndex) {
            return this.splitSelectedItems.get(slotIndex) ?? { consumed: [], used: [] };
        }
        setSplitSelection(slotIndex, consumed, used) {
            const nextSelection = { consumed: [...consumed], used: [...used] };
            this.splitSelectedItems.set(slotIndex, nextSelection);
            this.selectedItems.set(slotIndex, [...nextSelection.consumed, ...nextSelection.used]);
        }
        clearSplitSelection(slotIndex) {
            this.splitSelectedItems.delete(slotIndex);
        }
        collectCurrentSplitSelectionIds() {
            const pending = new Map();
            for (const [slotIndex, selection] of this.splitSelectedItems) {
                pending.set(slotIndex, {
                    consumedIds: selection.consumed.map(item => getItemId(item)).filter((id) => id !== undefined),
                    usedIds: selection.used.map(item => getItemId(item)).filter((id) => id !== undefined),
                });
            }
            return pending;
        }
        repairSplitSelection(slotIndex, component, candidates, pendingSplitIds) {
            const consumedCount = (0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount);
            const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount);
            const current = pendingSplitIds
                ? {
                    consumed: this.getItemsByOrderedIds(candidates, pendingSplitIds.consumedIds),
                    used: this.getItemsByOrderedIds(candidates, pendingSplitIds.usedIds),
                }
                : this.getSplitSelection(slotIndex);
            const used = this.sanitizeSelectedItems(current.used, candidates, usedCount);
            const repairedUsed = this.supplementSelectedItems(used, candidates, usedCount);
            const repairedUsedIds = new Set(repairedUsed.map(item => getItemId(item)).filter((id) => id !== undefined));
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
        normalizeNormalSelectionsForRender() {
            if (!this.recipe)
                return;
            const repairRole = (slotIndex, semantic, role, current, candidates, maxCount) => {
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
                if (!this.isSplitComponent(component))
                    continue;
                const splitSelection = this.getSplitSelection(i);
                const candidates = this.getFilteredSortedSectionItems("normal", i, "used", this.findMatchingItems(component.type));
                const used = repairRole(i, "used", "used", splitSelection.used, candidates, (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount));
                this.setSplitSelection(i, splitSelection.consumed, used);
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const component = this.recipe.components[i];
                if (component.consumedAmount > 0)
                    continue;
                const candidates = this.getFilteredSortedSectionItems("normal", i, "tool", this.findMatchingItems(component.type));
                this.clearSplitSelection(i);
                this.selectedItems.set(i, repairRole(i, "tool", "tool", this.selectedItems.get(i) ?? [], candidates, component.requiredAmount));
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const component = this.recipe.components[i];
                if (component.consumedAmount <= 0)
                    continue;
                const candidates = this.getFilteredSortedSectionItems("normal", i, "consumed", this.findMatchingItems(component.type));
                if (this.isSplitComponent(component)) {
                    const splitSelection = this.getSplitSelection(i);
                    const consumed = repairRole(i, "consumed", "consumed", splitSelection.consumed, candidates, (0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount));
                    this.setSplitSelection(i, consumed, splitSelection.used);
                    continue;
                }
                this.clearSplitSelection(i);
                this.selectedItems.set(i, repairRole(i, "consumed", "consumed", this.selectedItems.get(i) ?? [], candidates, component.requiredAmount));
            }
        }
        reportSelectionUnavailable(slotIndex, type, requestedItems, candidates) {
            return this.showSelectionChangedError(this.getSelectionFailureMessage({
                reason: "itemUnavailable",
                slotIndex,
                itemTypeOrGroup: type,
                requestedItemIds: (0, itemIdentity_1.getItemIds)(requestedItems, item => getItemId(item)),
                candidateItemIds: (0, itemIdentity_1.getItemIds)(candidates, item => getItemId(item)),
            }));
        }
        resolveComponentSelection(slotIndex, component, candidates, requiredAmount, pendingSplitIds, writeBack = true) {
            if (this.isSplitComponent(component)) {
                const repairedSplit = this.repairSplitSelection(slotIndex, component, candidates, pendingSplitIds);
                const repairedItems = [...repairedSplit.consumed, ...repairedSplit.used];
                if (repairedSplit.consumed.length < (0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount)
                    || repairedSplit.used.length < (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount)) {
                    return this.reportSelectionUnavailable(slotIndex, component.type, repairedItems, candidates);
                }
                if (writeBack)
                    this.setSplitSelection(slotIndex, repairedSplit.consumed, repairedSplit.used);
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
        collectCurrentNormalSelectionIds() {
            const pendingIds = new Map();
            for (const [slotIndex, items] of this.selectedItems) {
                const orderedIds = [];
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
                    const component = this.recipe.components[i];
                    if (this.isSplitComponent(component)) {
                        const splitSelection = this.getSplitSelection(i);
                        if (splitSelection.consumed.length < (0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount)
                            || splitSelection.used.length < (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount)) {
                            met = false;
                            break;
                        }
                        continue;
                    }
                    if ((this.selectedItems.get(i) || []).length < component.requiredAmount) {
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
        getSelectedCountForSection(slotIndex, semantic) {
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
        updateCounter(slotIndex, maxSelect, semantic = "base") {
            const counter = this.sectionCounters.get(getSectionCounterKey(slotIndex, semantic));
            if (!counter)
                return;
            const count = this.getSelectedCountForSection(slotIndex, semantic);
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
            catch (error) {
                this.debugLog("Failed to create output card item icon.", { itemType, error });
            }
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
            const cardTheme = isBulk ? SCREEN_THEME.bulk : SCREEN_THEME.normal;
            nameSpan.style.cssText = `color:${cardTheme.title};font-weight:600;font-size:1.2em;flex-shrink:0;`;
            row1.appendChild(nameSpan);
            const inlineStat = (label, value) => (0, BetterCraftingDom_1.appendInlineStat)(row1, label, value, cardTheme.accent, `color:${cardTheme.body};font-size:0.9em;white-space:nowrap;`);
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
                const parts = desc.group.map(g => {
                    const tierNum = desc?.tier?.[g];
                    const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                    return `${fmt(IItem_1.ItemTypeGroup[g] || `Group ${g}`)}${tierStr}`;
                });
                const groupLine = (0, BetterCraftingDom_1.createColoredListLine)("Groupings", parts, cardTheme.accent, `font-size:0.85em;color:${cardTheme.body};`);
                card.element.appendChild(groupLine);
            }
            if (desc?.use && desc.use.length > 0) {
                const parts = desc.use.map(u => {
                    const tierNum = desc?.actionTier?.[u];
                    const tierStr = tierNum !== undefined && tierNum > 0 ? ` ${toRoman(tierNum)}` : "";
                    return `${fmt(IAction_1.ActionType[u] || `Action ${u}`)}${tierStr}`;
                });
                const useLine = (0, BetterCraftingDom_1.createColoredListLine)("Uses", parts, cardTheme.accent, `font-size:0.85em;color:${cardTheme.body};`);
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
        getSemanticTooltip(semantic) {
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
        appendSectionHeader(labelRow, titleText, availableCount, semantic) {
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
        addBaseComponentSection(baseType) {
            const section = this.createSection();
            const labelRow = this.createLabelRow();
            const items = this.findMatchingItems(baseType);
            const visibleItems = this.getFilteredSortedSectionItems("normal", -1, "base", items);
            this.appendSectionHeader(labelRow, `Base: ${this.getTypeName(baseType)}`, this.formatAvailableCount(visibleItems.length, items.length), "base");
            const counter = new Text_1.default();
            counter.setText(TranslationImpl_1.default.generator(`${this.getSelectedCountForSection(-1, "base")}/1`));
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
            }
            else {
                for (const item of visibleItems)
                    this.addItemRow(itemsContainer, -1, item, 1);
            }
            this.updateCounter(-1, 1, "base");
            this.normalScrollInner.append(section);
        }
        addComponentSection(index, component, semantic) {
            const section = this.createSection();
            const labelRow = this.createLabelRow();
            const split = this.isSplitComponent(component);
            const maxSelect = semantic === "used"
                ? (0, craftingSelection_1.getUsedSelectionCount)(component.requiredAmount, component.consumedAmount)
                : semantic === "consumed"
                    ? (0, craftingSelection_1.getConsumedSelectionCount)(component.requiredAmount, component.consumedAmount)
                    : component.requiredAmount;
            const items = this.findMatchingItems(component.type);
            const sortedVisibleItems = this.getFilteredSortedSectionItems("normal", index, semantic, items);
            const visibleItems = sortedVisibleItems;
            const totalAvailableCount = items.length;
            this.appendSectionHeader(labelRow, `${this.getTypeName(component.type)} ×${maxSelect}`, this.formatAvailableCount(visibleItems.length, totalAvailableCount), semantic);
            const counter = new Text_1.default();
            counter.setText(TranslationImpl_1.default.generator(`${this.getSelectedCountForSection(index, semantic)}/${maxSelect}`));
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
            }
            else {
                if (split && (semantic === "consumed" || semantic === "used")) {
                    for (const item of visibleItems)
                        this.addSplitItemRow(itemsContainer, index, item, maxSelect, semantic);
                }
                else {
                    for (const item of visibleItems)
                        this.addItemRow(itemsContainer, index, item, maxSelect);
                }
            }
            this.updateCounter(index, maxSelect, semantic);
            this.normalScrollInner.append(section);
        }
        createStaticContentContainer() {
            const c = new Component_1.default();
            c.style.set("display", "flex");
            c.style.set("flex-wrap", "wrap");
            c.style.set("gap", "8px");
            c.style.set("align-items", "flex-start");
            c.style.set("flex", "0 0 auto");
            c.style.set("min-height", "0");
            return c;
        }
        createScrollPort() {
            const viewport = new Component_1.default();
            viewport.style.set("display", "block");
            viewport.style.set("flex", "1 1 0");
            viewport.style.set("min-height", "0");
            viewport.style.set("overflow-y", "auto");
            viewport.style.set("overflow-x", "hidden");
            viewport.style.set("scrollbar-width", "thin");
            viewport.style.set("scrollbar-color", "#888888 rgba(0,0,0,0.3)");
            const inner = new Component_1.default();
            inner.style.set("display", "flex");
            inner.style.set("flex-wrap", "wrap");
            inner.style.set("gap", "8px");
            inner.style.set("align-items", "stretch");
            inner.style.set("align-content", "stretch");
            inner.style.set("min-height", "100%");
            viewport.append(inner);
            return [viewport, inner];
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
        createSafeToggle(assignToggle) {
            const wrapper = document.createElement("div");
            wrapper.classList.add("bc-safe-toggle-wrap");
            wrapper.style.cssText = "display:flex;align-items:center;gap:4px;margin-right:4px;background:transparent;padding:0;border:0;";
            const label = document.createElement("span");
            label.classList.add("bc-safe-toggle-label");
            label.textContent = "Safe";
            label.style.cssText = "font-weight:bold;color:inherit;";
            wrapper.appendChild(label);
            const toggle = new CheckButton_1.CheckButton();
            toggle.element.classList.add("bc-safe-toggle-checkbox");
            toggle.setChecked(this.safeCraftingEnabled, false);
            toggle.style.set("background", "transparent");
            toggle.style.set("background-color", "transparent");
            toggle.style.set("border", "none");
            toggle.style.set("box-shadow", "none");
            toggle.style.set("padding", "0");
            toggle.style.set("margin", "0");
            toggle.event.subscribe("toggle", (_, checked) => {
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
            const component = slotIndex >= 0 ? this.recipe?.components[slotIndex] : undefined;
            const semantic = slotIndex === -1
                ? "base"
                : component && component.consumedAmount <= 0
                    ? "tool"
                    : "consumed";
            const conflictRole = this.getReservationConflict(this.normalRenderReservations, item, semantic);
            const disabled = conflictRole !== undefined;
            const row = new Button_1.default();
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
            row.style.set("border", preSelected ? borderSelected : borderBase);
            row.style.set("background", preSelected ? "rgba(30, 255, 128, 0.1)" : disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
            if (disabled)
                row.style.set("opacity", "0.7");
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
                if ((this.selectedItems.get(slotIndex) || []).indexOf(item) < 0 && !disabled) {
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
                    row.style.set("background", disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
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
            catch (error) {
                this.debugLog("Failed to create normal selection item icon.", { itemId: getItemId(item), itemType: item.type, error });
            }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            if (component && component.consumedAmount <= 0) {
                this.appendRemainingUsesHint(row.element, item, (0, itemState_1.getCraftDurabilityLoss)(item), false);
            }
            if (conflictRole !== undefined) {
                const disabledText = document.createElement("span");
                disabledText.textContent = this.getReservationRoleLabel(conflictRole);
                disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
                row.element.appendChild(disabledText);
            }
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
                if (disabled)
                    return;
                const selected = this.selectedItems.get(slotIndex) || [];
                const idx = selected.indexOf(item);
                if (idx >= 0) {
                    selected.splice(idx, 1);
                }
                else {
                    if (selected.length >= maxSelect) {
                        if (maxSelect !== 1 || selected.length === 0)
                            return;
                        selected.splice(0, selected.length, item);
                    }
                    else {
                        selected.unshift(item);
                    }
                }
                this.selectedItems.set(slotIndex, selected);
                this.setExplicitSelection("normal", slotIndex, semantic, semantic === "tool" ? "tool" : semantic === "base" ? "base" : "consumed", selected);
                this.rebuildNormalContent(false);
            });
            parent.append(row);
        }
        addSplitItemRow(parent, slotIndex, item, maxSelect, semantic) {
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
            const row = new Button_1.default();
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
            if (disabled)
                row.style.set("opacity", "0.7");
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
            row.addEventListener("mouseenter", (e) => {
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
                if (!isSelected) {
                    row.style.set("background", disabled ? "rgba(255, 80, 80, 0.05)" : "transparent");
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
            catch (error) {
                this.debugLog("Failed to create split selection item icon.", { itemId: getItemId(item), itemType: item.type, error });
            }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            if (semantic === "used" && !disabled) {
                this.appendRemainingUsesHint(row.element, item, (0, itemState_1.getCraftDurabilityLoss)(item), false);
            }
            if (disabledRole !== undefined) {
                const disabledText = document.createElement("span");
                disabledText.textContent = this.getReservationRoleLabel(disabledRole);
                disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
                row.element.appendChild(disabledText);
            }
            const check = new CheckButton_1.CheckButton();
            check.style.set("pointer-events", "none");
            check.style.set("margin-left", "4px");
            check.style.set("flex-shrink", "0");
            check.style.set("background", "transparent");
            check.style.set("background-color", "transparent");
            check.style.set("border", "none");
            check.style.set("box-shadow", "none");
            check.style.set("padding", "0");
            if (isSelected)
                check.setChecked(true, false);
            row.append(check);
            row.event.subscribe("activate", () => {
                if (disabled)
                    return;
                const nextSelection = this.getSplitSelection(slotIndex);
                const target = semantic === "consumed" ? [...nextSelection.consumed] : [...nextSelection.used];
                const existingIndex = target.indexOf(item);
                if (existingIndex >= 0) {
                    target.splice(existingIndex, 1);
                }
                else {
                    if (target.length >= maxSelect) {
                        if (maxSelect !== 1 || target.length === 0)
                            return;
                        target.splice(0, target.length, item);
                    }
                    else {
                        target.unshift(item);
                    }
                }
                if (semantic === "consumed") {
                    this.setSplitSelection(slotIndex, target, nextSelection.used);
                    this.setExplicitSelection("normal", slotIndex, "consumed", "consumed", target);
                    this.updateCounter(slotIndex, maxSelect, "consumed");
                }
                else {
                    this.setSplitSelection(slotIndex, nextSelection.consumed, target);
                    this.setExplicitSelection("normal", slotIndex, "used", "used", target);
                    this.updateCounter(slotIndex, maxSelect, "used");
                }
                this.rebuildNormalContent(false);
            });
            parent.append(row);
        }
        buildBulkContent(preserveScroll = false, preserveQuantity = false) {
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
                const noRecipe = new Text_1.default();
                noRecipe.setText(TranslationImpl_1.default.generator("No recipe found for this item."));
                noRecipe.style.set("color", "#ff6666");
                this.bulkScrollInner.append(noRecipe);
                this.updateBulkCraftBtnState(this.computeBulkUiLimits());
                this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
                return;
            }
            if (this.itemType !== this._lastBulkItemType) {
                this.bulkExcludedIds.clear();
                this.bulkPreserveDurabilityBySlot.clear();
                this.bulkPinnedToolSelections.clear();
                this.bulkPinnedUsedSelections.clear();
                this._lastBulkItemType = this.itemType;
            }
            this.normalizeBulkSelectionsForRender();
            this.buildOutputCard(this.itemType, this.recipe, true);
            this.addBulkHelpBox();
            this.addBulkMaterialsHeader();
            if (this.recipe.baseComponent !== undefined) {
                this.addBulkComponentSection(-1, this.recipe.baseComponent, 1, "tool");
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                if (comp.consumedAmount > 0) {
                    this.addBulkComponentSection(i, comp.type, (0, craftingSelection_1.getConsumedSelectionCount)(comp.requiredAmount, comp.consumedAmount), "consumed");
                }
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                if (this.isSplitComponent(comp)) {
                    this.addBulkComponentSection(i, comp.type, (0, craftingSelection_1.getUsedSelectionCount)(comp.requiredAmount, comp.consumedAmount), "used");
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
                if (this.bulkQtyInputEl)
                    this.bulkQtyInputEl.value = "1";
            }
            const limits = this.computeBulkUiLimits();
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
            this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
        }
        buildDismantleContent(preserveScroll = false) {
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
                const noDismantle = new Text_1.default();
                noDismantle.setText(TranslationImpl_1.default.generator("No dismantle data found for this item."));
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
            if (this.bulkQtyInputEl)
                this.bulkQtyInputEl.value = String(this.bulkQuantity);
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
            this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
        }
        buildDismantleHeaderCard(itemType, dismantle) {
            const theme = SCREEN_THEME.dismantle;
            const card = new Component_1.default();
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
                const handler = new ItemComponentHandler_1.ItemComponentHandler({ getItemType: () => itemType, noDrag: true });
                const iconComp = ItemComponent_1.default.create(handler);
                if (iconComp)
                    iconHolder.appendChild(iconComp.element);
            }
            catch (error) {
                if (this.debugLoggingEnabled) {
                    console.error("[Better Crafting] Failed to create dismantle item icon", error);
                }
            }
            headerRow.appendChild(iconHolder);
            const title = document.createElement("div");
            title.className = "bc-dismantle-header-title";
            title.textContent = this.formatEnumName(IItem_1.ItemType[itemType] || `Item ${itemType}`);
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
                    const handler = new ItemComponentHandler_1.ItemComponentHandler({ getItemType: () => output.type, noDrag: true });
                    const iconComp = ItemComponent_1.default.create(handler);
                    if (iconComp) {
                        iconComp.style.set("flex-shrink", "0");
                        row.appendChild(iconComp.element);
                    }
                }
                catch (error) {
                    if (this.debugLoggingEnabled) {
                        console.error("[Better Crafting] Failed to create dismantle output icon", error);
                    }
                }
                const label = document.createElement("span");
                label.textContent = `${output.amount}x ${this.formatEnumName(IItem_1.ItemType[output.type] || `Item ${output.type}`)}`;
                label.style.color = theme.accent;
                row.appendChild(label);
                outputList.appendChild(row);
            }
            card.element.appendChild(outputList);
            this.bulkStaticContent.append(card);
        }
        addDismantleHelpBox() {
            this.addHelpBox("dismantle", "How This Works", [
                ["Consumed", "Selected targets are dismantled and consumed by the action."],
                ["Used", "Required items are needed for the action but are not consumed."],
                ["Tool", "Tool rows stay after the action and lose durability as normal."],
                ["Safe", "Safe blocks low-stamina dismantling and damage-based bulk aborts for this screen."],
                ["Protect", "Protect keeps one durability on the required row instead of letting it break."],
                ["Hotkey", `Current hotkey: ${this.getCurrentHotkeyText()}. ${this.getActivationModeText()}`],
            ]);
        }
        addDismantleRequiredSection(required) {
            const section = this.createSection();
            const labelRow = this.createLabelRow();
            const items = this.findMatchingItems(required);
            const visibleItems = this.getFilteredSortedSectionItems("dismantle", -2, "tool", items);
            const selectableItems = this.getSelectableDismantleRequiredItems(visibleItems);
            if (this.shouldReselectSection("dismantle", -2, "tool") || this.shouldReselectSectionForSort("dismantle", -2, "tool")) {
                this.dismantleRequiredSelection = selectableItems[0];
                this.clearSectionReselect("dismantle", -2, "tool");
                this.clearSectionSortReselect("dismantle", -2, "tool");
            }
            else if (!this.dismantleRequiredSelection || !selectableItems.includes(this.dismantleRequiredSelection)) {
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
            }
            else {
                for (const item of visibleItems) {
                    this.addDismantleRequiredRow(itemsContainer, item);
                }
            }
            this.bulkScrollInner.append(section);
        }
        addDismantleTargetSection(itemType) {
            const section = this.createSection();
            const labelRow = this.createLabelRow();
            const items = this.findMatchingItems(itemType);
            const visibleItems = this.getFilteredSortedSectionItems("dismantle", -1, "consumed", items);
            if (this.shouldReselectSection("dismantle", -1, "consumed")) {
                const eligibleVisibleItems = visibleItems.filter(item => !(0, itemState_1.isItemProtected)(item) && !this.isReservedDismantleRequiredItem(item));
                const includedIds = new Set(eligibleVisibleItems.slice(0, this.bulkQuantity).map(item => getItemId(item)).filter((id) => id !== undefined));
                this.dismantleExcludedIds.clear();
                for (const item of items) {
                    const itemId = getItemId(item);
                    if (itemId === undefined)
                        continue;
                    if ((0, itemState_1.isItemProtected)(item) || this.isReservedDismantleRequiredItem(item) || !includedIds.has(itemId)) {
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
            }
            else {
                for (const item of visibleItems) {
                    this.addDismantleTargetRow(itemsContainer, item);
                }
            }
            this.bulkScrollInner.append(section);
        }
        addDismantleRequiredRow(parent, item) {
            const qualityColor = getQualityColor(item.quality);
            const selected = () => this.dismantleRequiredSelection === item;
            const disabled = this.isIncludedDismantleTargetItem(item) && !selected();
            const borderBase = `1px solid ${qualityColor}33`;
            const borderHover = `1px solid ${qualityColor}77`;
            const borderSelected = `1px solid ${qualityColor}`;
            const row = new Button_1.default();
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
            if (disabled)
                row.style.set("opacity", "0.7");
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
            catch (error) {
                if (this.debugLoggingEnabled) {
                    console.error("[Better Crafting] Failed to create dismantle required row icon", error);
                }
            }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            this.appendRemainingUsesHint(row.element, item, (0, itemState_1.getDismantleDurabilityLoss)(item, IAction_1.ActionType.Dismantle), this.preserveDismantleRequiredDurability);
            if (disabled) {
                const disabledText = document.createElement("span");
                disabledText.textContent = this.getReservationRoleLabel("target");
                disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
                row.element.appendChild(disabledText);
            }
            const check = new CheckButton_1.CheckButton();
            check.style.set("pointer-events", "none");
            check.style.set("margin-left", "4px");
            check.style.set("flex-shrink", "0");
            check.style.set("background", "transparent");
            check.style.set("background-color", "transparent");
            check.style.set("border", "none");
            check.style.set("box-shadow", "none");
            check.style.set("padding", "0");
            if (selected())
                check.setChecked(true, false);
            row.append(check);
            row.event.subscribe("activate", () => {
                if (disabled)
                    return;
                if (this.dismantleRequiredSelection === item)
                    return;
                this.dismantleRequiredSelection = item;
                this.buildDismantleContent(false);
            });
            parent.append(row);
        }
        appendBulkDurabilityControls(labelRow, slotIndex) {
            const wrapper = document.createElement("div");
            wrapper.style.cssText = "display:flex;align-items:center;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;background:transparent;padding:0;border:0;";
            const label = document.createElement("span");
            label.textContent = "Protect?";
            label.style.cssText = "font-weight:bold;color:inherit;";
            wrapper.appendChild(label);
            const protect = new CheckButton_1.CheckButton();
            protect.setChecked(this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true, false);
            protect.style.set("background", "transparent");
            protect.style.set("background-color", "transparent");
            protect.style.set("border", "none");
            protect.style.set("box-shadow", "none");
            protect.style.set("padding", "0");
            protect.style.set("margin", "0");
            protect.event.subscribe("toggle", (_, checked) => {
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
        appendDismantleDurabilityControls(labelRow) {
            const wrapper = document.createElement("div");
            wrapper.style.cssText = "display:flex;align-items:center;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;background:transparent;padding:0;border:0;";
            const label = document.createElement("span");
            label.textContent = "Protect?";
            label.style.cssText = "font-weight:bold;color:inherit;";
            wrapper.appendChild(label);
            const protect = new CheckButton_1.CheckButton();
            protect.setChecked(this.preserveDismantleRequiredDurability, false);
            protect.style.set("background", "transparent");
            protect.style.set("background-color", "transparent");
            protect.style.set("border", "none");
            protect.style.set("box-shadow", "none");
            protect.style.set("padding", "0");
            protect.style.set("margin", "0");
            protect.event.subscribe("toggle", (_, checked) => {
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
        getMaxUsesText(item, perUseLoss, protect) {
            if (perUseLoss <= 0)
                return "";
            const maxUses = (0, itemState_1.getRemainingDurabilityUses)(item.durability, perUseLoss, protect);
            if (maxUses >= Number.MAX_SAFE_INTEGER || maxUses <= 0)
                return "";
            return `uses remaining ${maxUses}`;
        }
        appendRemainingUsesHint(parent, item, perUseLoss, protect) {
            const text = this.getMaxUsesText(item, perUseLoss, protect);
            if (!text)
                return;
            const hint = document.createElement("span");
            hint.style.cssText = "color:#7a6850;font-size:0.8em;margin-left:6px;white-space:nowrap;";
            hint.textContent = text;
            parent.appendChild(hint);
        }
        addDismantleTargetRow(parent, item) {
            const itemId = getItemId(item);
            const qualityColor = getQualityColor(item.quality);
            const lockedByRequired = this.isReservedDismantleRequiredItem(item);
            const locked = (0, itemState_1.isItemProtected)(item) || lockedByRequired;
            if (locked && itemId !== undefined)
                this.dismantleExcludedIds.add(itemId);
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
                }
                else {
                    row.classes.remove("bc-bulk-row-excluded");
                }
            };
            sync();
            if (!locked) {
                row.event.subscribe("activate", () => {
                    if (itemId !== undefined && this.dismantleExcludedIds.has(itemId)) {
                        this.dismantleExcludedIds.delete(itemId);
                    }
                    else {
                        if (itemId !== undefined) {
                            this.dismantleExcludedIds.add(itemId);
                        }
                    }
                    const max = this.computeDismantleMax();
                    if (max > 0 && this.bulkQuantity > max) {
                        this.bulkQuantity = max;
                        if (this.bulkQtyInputEl)
                            this.bulkQtyInputEl.value = String(this.bulkQuantity);
                    }
                    sync();
                    const limits = this.computeBulkUiLimits();
                    this.updateBulkMaxDisplay(limits);
                    this.updateBulkCraftBtnState(limits);
                });
            }
            parent.append(row);
        }
        createSelectionRow(item, qualityColor, locked) {
            const row = new Button_1.default();
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
            catch (error) {
                if (this.debugLoggingEnabled) {
                    console.error("[Better Crafting] Failed to create selection row icon", error);
                }
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
            this.bindTooltipRowHandlers(row, item, displayName);
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            row.append(nameText);
            return row;
        }
        applySelectionRowState(element, selected, qualityColor) {
            element.style.border = selected ? `1px solid ${qualityColor}` : `1px solid ${qualityColor}33`;
            element.style.background = selected ? "rgba(156, 74, 53, 0.14)" : "transparent";
        }
        getCurrentHotkeyText() {
            return this.activationHotkey;
        }
        getActivationModeText() {
            return this.getSettings().activationMode === "holdHotkeyToBypass"
                ? "Hold hotkey to bypass Better Crafting UI."
                : "Hold hotkey to access Better Crafting UI.";
        }
        resetHelpBoxStates() {
            this.helpBoxExpanded.normal = false;
            this.helpBoxExpanded.bulk = false;
            this.helpBoxExpanded.dismantle = false;
        }
        addHelpBox(mode, titleText, rows) {
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
                content.appendChild((0, BetterCraftingDom_1.createHelpBoxRow)(label, rowContent));
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
            }
            else {
                this.bulkStaticContent.append(container);
            }
        }
        addNormalHelpBox() {
            this.addHelpBox("normal", "How This Works", [
                ["Consumed", "Consumed items are destroyed when you complete the craft."],
                ["Used", "Used items are required for the craft but are not consumed."],
                ["Tool", "Tool rows stay after the craft and lose durability as normal."],
                ["Safe", "Safe blocks low-stamina crafting for this screen. Turn it off to ignore stamina limits."],
                ["Quality", "Result quality depends on your crafting skill."],
                ["Hotkey", `Current hotkey: ${this.getCurrentHotkeyText()}. ${this.getActivationModeText()}`],
            ]);
        }
        addBulkHelpBox() {
            this.addHelpBox("bulk", "How This Works", [
                ["Consumed", "Consumed items are destroyed when the craft completes."],
                ["Used", "Used items are required for the craft but are not consumed."],
                ["Tool", "Tool rows stay after the craft and lose durability as normal."],
                ["Safe", "Safe blocks low-stamina crafting and damage-based bulk aborts for this screen."],
                ["Protect", "Protect keeps one durability on used and tool rows instead of letting them break."],
                ["Hotkey", `Current hotkey: ${this.getCurrentHotkeyText()}. ${this.getActivationModeText()}`],
            ]);
        }
        addBulkMaterialsHeader() {
            const el = document.createElement("div");
            el.className = "bc-bulk-materials-header";
            el.textContent = "Materials - Click to Exclude";
            const container = this.makeFullWidthWrapper();
            container.element.appendChild(el);
            this.bulkStaticContent.append(container);
        }
        addBulkComponentSection(slotIndex, type, requiredAmount, semantic) {
            const section = this.createSection();
            section.classes.add("bc-bulk-section");
            const labelRow = this.createLabelRow();
            const prefix = slotIndex === -1 ? "Base: " : "";
            const items = this.findMatchingItems(type);
            const sectionSemantic = slotIndex === -1 ? "base" : semantic;
            const sortedVisibleItems = this.getFilteredSortedSectionItems("bulk", slotIndex, sectionSemantic, items);
            const reservedNonconsumedIds = this.getBulkReservedNonconsumedIds();
            const isConsumedSide = sectionSemantic === "base" || semantic === "consumed";
            const visibleItems = sortedVisibleItems;
            const availableCount = items.filter(item => {
                const itemId = getItemId(item);
                const excludedIds = this.bulkExcludedIds.get(slotIndex) ?? new Set();
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
            }
            else {
                if (!this.bulkExcludedIds.has(slotIndex)) {
                    this.bulkExcludedIds.set(slotIndex, new Set());
                }
                for (const item of visibleItems) {
                    if (semantic === "consumed" || slotIndex < 0) {
                        this.addBulkItemRow(itemsContainer, slotIndex, item);
                    }
                    else if (semantic === "used") {
                        this.addBulkUsedRow(itemsContainer, slotIndex, item, requiredAmount);
                    }
                    else {
                        this.addBulkToolRow(itemsContainer, slotIndex, item, requiredAmount);
                    }
                }
            }
            this.bulkScrollInner.append(section);
        }
        getBulkReservedNonconsumedIds() {
            const reservedIds = new Set();
            const addSelectionIds = (selections) => {
                for (const [, items] of selections) {
                    for (const item of items) {
                        const itemId = getItemId(item);
                        if (itemId !== undefined)
                            reservedIds.add(itemId);
                    }
                }
            };
            addSelectionIds(this.bulkPinnedUsedSelections);
            addSelectionIds(this.bulkPinnedToolSelections);
            return reservedIds;
        }
        getBulkReservedNonconsumedRole(item, currentRole) {
            const itemId = getItemId(item);
            if (itemId === undefined)
                return undefined;
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
        normalizeBulkSelectionsForRender() {
            if (!this.recipe)
                return;
            const bulkPrefix = `bulk:${this.itemType ?? 0}:`;
            const explicitEntries = [...this.explicitSelections.entries()].filter(([key]) => key.startsWith(bulkPrefix));
            const reservations = this.collectExplicitReservations(explicitEntries);
            const repairBulkRole = (slotIndex, type, semantic, current, maxCount) => {
                const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, semantic, this.findMatchingItems(type)).filter(item => {
                    const itemId = getItemId(item);
                    return itemId !== undefined
                        && !(0, itemState_1.isItemProtected)(item)
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
                if (!this.isSplitComponent(comp))
                    continue;
                this.bulkPinnedUsedSelections.set(i, repairBulkRole(i, comp.type, "used", this.bulkPinnedUsedSelections.get(i) ?? [], (0, craftingSelection_1.getUsedSelectionCount)(comp.requiredAmount, comp.consumedAmount)));
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                if (comp.consumedAmount > 0)
                    continue;
                this.bulkPinnedToolSelections.set(i, repairBulkRole(i, comp.type, "tool", this.bulkPinnedToolSelections.get(i) ?? [], comp.requiredAmount));
            }
        }
        addBulkItemRow(parent, slotIndex, item) {
            const qualityColor = getQualityColor(item.quality);
            const itemId = getItemId(item);
            const reservedRole = this.getBulkReservedNonconsumedRole(item);
            const autoExcluded = (0, itemState_1.isItemProtected)(item);
            if (autoExcluded) {
                const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set();
                if (itemId !== undefined) {
                    excludedSet.add(itemId);
                }
                this.bulkExcludedIds.set(slotIndex, excludedSet);
            }
            const isReservedSelection = () => reservedRole !== undefined;
            const isExcluded = () => itemId !== undefined && ((this.bulkExcludedIds.get(slotIndex)?.has(itemId) ?? false) || isReservedSelection());
            const row = new Button_1.default();
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
            catch (error) {
                this.debugLog("Failed to create bulk consumed item icon.", { itemId: getItemId(item), itemType: item.type, error });
            }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
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
                    const excludedSet = this.bulkExcludedIds.get(slotIndex) ?? new Set();
                    if (itemId !== undefined && excludedSet.has(itemId)) {
                        excludedSet.delete(itemId);
                        row.classes.remove("bc-bulk-row-excluded");
                        exclIndicator.textContent = "";
                        row.style.set("background", "transparent");
                        row.style.set("border", `1px solid ${qualityColor}33`);
                    }
                    else {
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
        addBulkUsedRow(parent, slotIndex, item, maxSelect) {
            const qualityColor = getQualityColor(item.quality);
            const itemId = getItemId(item);
            const excludedIds = this.bulkExcludedIds.get(slotIndex) ?? new Set();
            const isSelected = () => (this.bulkPinnedUsedSelections.get(slotIndex) ?? []).some(entry => getItemId(entry) === itemId);
            const reservedRole = this.getBulkReservedNonconsumedRole(item, "used");
            const isDisabled = () => itemId !== undefined && (excludedIds.has(itemId) || reservedRole !== undefined);
            const preSelected = isSelected();
            const borderBase = `1px solid ${qualityColor}33`;
            const borderHover = `1px solid ${qualityColor}77`;
            const borderSelected = `1px solid ${qualityColor}`;
            const row = new Button_1.default();
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
            if (isDisabled())
                row.style.set("opacity", "0.7");
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
                if (!isSelected() && !isDisabled()) {
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
                if (!isSelected()) {
                    row.style.set("background", isDisabled() ? "rgba(255, 80, 80, 0.05)" : "transparent");
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
            catch (error) {
                this.debugLog("Failed to create bulk used item icon.", { itemId: getItemId(item), itemType: item.type, error });
            }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            if (!isDisabled()) {
                this.appendRemainingUsesHint(row.element, item, (0, itemState_1.getCraftDurabilityLoss)(item), this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true);
            }
            if (isDisabled()) {
                const disabledText = document.createElement("span");
                disabledText.textContent = reservedRole !== undefined ? this.getReservationRoleLabel(reservedRole) : "Excluded";
                disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
                row.element.appendChild(disabledText);
            }
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
                if (isDisabled())
                    return;
                const selected = this.bulkPinnedUsedSelections.get(slotIndex) ?? [];
                const idx = selected.findIndex(entry => getItemId(entry) === itemId);
                if (idx >= 0) {
                    selected.splice(idx, 1);
                }
                else {
                    if (selected.length >= maxSelect) {
                        if (maxSelect !== 1 || selected.length === 0)
                            return;
                        selected.splice(0, selected.length, item);
                    }
                    else {
                        selected.unshift(item);
                    }
                }
                this.bulkPinnedUsedSelections.set(slotIndex, [...selected]);
                this.setExplicitSelection("bulk", slotIndex, "used", "used", selected);
                this.buildBulkContent(false, true);
            });
            parent.append(row);
        }
        addBulkToolRow(parent, slotIndex, item, maxSelect) {
            const qualityColor = getQualityColor(item.quality);
            const itemId = getItemId(item);
            const isSelected = () => (this.bulkPinnedToolSelections.get(slotIndex) ?? []).some(entry => getItemId(entry) === itemId);
            const reservedRole = this.getBulkReservedNonconsumedRole(item, "tool");
            const isDisabled = () => reservedRole !== undefined;
            const preSelected = isSelected();
            const borderBase = `1px solid ${qualityColor}33`;
            const borderHover = `1px solid ${qualityColor}77`;
            const borderSelected = `1px solid ${qualityColor}`;
            const row = new Button_1.default();
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
            if (isDisabled())
                row.style.set("opacity", "0.7");
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
                if (!isSelected() && !isDisabled()) {
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
                if (!isSelected()) {
                    row.style.set("background", isDisabled() ? "rgba(255, 80, 80, 0.05)" : "transparent");
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
            catch (error) {
                this.debugLog("Failed to create bulk tool item icon.", { itemId: getItemId(item), itemType: item.type, error });
            }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            this.appendRemainingUsesHint(row.element, item, (0, itemState_1.getCraftDurabilityLoss)(item), this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true);
            if (reservedRole !== undefined) {
                const disabledText = document.createElement("span");
                disabledText.textContent = this.getReservationRoleLabel(reservedRole);
                disabledText.style.cssText = "color:#cc7777;font-size:0.8em;margin-left:6px;white-space:nowrap;";
                row.element.appendChild(disabledText);
            }
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
                if (isDisabled())
                    return;
                const selected = this.bulkPinnedToolSelections.get(slotIndex) ?? [];
                const idx = selected.findIndex(entry => getItemId(entry) === itemId);
                if (idx >= 0) {
                    selected.splice(idx, 1);
                    check.setChecked(false, false);
                    row.style.set("background", "transparent");
                    row.style.set("border", borderBase);
                }
                else {
                    if (selected.length >= maxSelect) {
                        if (maxSelect !== 1 || selected.length === 0)
                            return;
                        selected.splice(0, selected.length, item);
                    }
                    else {
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
        computeBulkDurabilityMaxFromSelection(selection) {
            if (!this.recipe)
                return 0;
            let durabilityMax = Number.MAX_SAFE_INTEGER;
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                const items = selection.slotSelections.get(i) ?? [];
                const preserveDurability = this.bulkPreserveDurabilityBySlot.get(i) !== false;
                const durabilityItems = this.isSplitComponent(comp)
                    ? items.slice((0, craftingSelection_1.getConsumedSelectionCount)(comp.requiredAmount, comp.consumedAmount))
                    : comp.consumedAmount <= 0
                        ? items
                        : [];
                for (const item of durabilityItems) {
                    durabilityMax = Math.min(durabilityMax, (0, itemState_1.getRemainingDurabilityUses)(item.durability, (0, itemState_1.getCraftDurabilityLoss)(item), preserveDurability));
                }
            }
            return durabilityMax;
        }
        prepareBulkPinnedSelections(excludedIds) {
            if (!this.recipe)
                return false;
            const selection = this.resolveBulkCraftSelection(this.itemType, excludedIds);
            if (!selection)
                return false;
            this.bulkPinnedToolSelections.clear();
            this.bulkPinnedUsedSelections.clear();
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                const items = selection.slotSelections.get(i) ?? [];
                if (this.isSplitComponent(comp)) {
                    const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(comp.requiredAmount, comp.consumedAmount);
                    const usedItems = items.slice((0, craftingSelection_1.getConsumedSelectionCount)(comp.requiredAmount, comp.consumedAmount));
                    if (usedItems.length < usedCount)
                        return false;
                    this.bulkPinnedUsedSelections.set(i, [...usedItems]);
                    continue;
                }
                if (comp.consumedAmount > 0)
                    continue;
                if (items.length < comp.requiredAmount)
                    return false;
                this.bulkPinnedToolSelections.set(i, [...items]);
            }
            return true;
        }
        computeBulkLimits() {
            if (!this.recipe || !localPlayer?.island)
                return { staminaMax: 0, materialMax: 0, durabilityMax: 0 };
            const staminaCost = (0, craftStamina_1.getCraftStaminaCost)(this.recipe.level);
            const currentStamina = this.getCurrentStamina();
            const staminaMax = !this.safeCraftingEnabled
                ? Number.MAX_SAFE_INTEGER
                : staminaCost > 0 ? Math.floor(currentStamina / staminaCost) : 9999;
            let materialMax = 0;
            let durabilityMax = Number.MAX_SAFE_INTEGER;
            const excludedIds = this.getBulkExcludedIds();
            const permanentlyConsumedIds = new Set();
            const materialIterationCap = this.safeCraftingEnabled
                ? Math.max(1, Math.min(9999, staminaMax))
                : 9999;
            const candidateCache = this.createBulkCandidateCache();
            for (let i = 0; i < materialIterationCap; i++) {
                const selection = this.resolveBulkCraftSelection(this.itemType, excludedIds, permanentlyConsumedIds, candidateCache);
                if (!selection)
                    break;
                if (i === 0) {
                    durabilityMax = this.computeBulkDurabilityMaxFromSelection(selection);
                }
                for (const id of selection.permanentlyConsumedIds) {
                    permanentlyConsumedIds.add(id);
                }
                materialMax++;
            }
            if (materialMax === 0)
                durabilityMax = 0;
            return { staminaMax, materialMax, durabilityMax };
        }
        computeBulkMax() {
            if (this.panelMode === "dismantle") {
                return this.computeDismantleMax();
            }
            return this.computeBulkUiLimits().max;
        }
        computeBulkUiLimits() {
            if (this.panelMode === "dismantle") {
                const materialMax = this.getIncludedDismantleItems().length;
                const staminaMax = this.computeDismantleStaminaMax();
                const durabilityMax = !this.dismantleRequiredSelection
                    ? Number.MAX_SAFE_INTEGER
                    : (0, itemState_1.getRemainingDurabilityUses)(this.dismantleRequiredSelection.durability, (0, itemState_1.getDismantleDurabilityLoss)(this.dismantleRequiredSelection, IAction_1.ActionType.Dismantle), this.preserveDismantleRequiredDurability);
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
        computeDismantleStaminaMax() {
            if (!this.safeCraftingEnabled)
                return Number.MAX_SAFE_INTEGER;
            const currentStamina = this.getCurrentStamina();
            return Math.max(0, Math.floor(currentStamina));
        }
        computeDismantleMax() {
            if (!this.dismantleSelectedItemType || !this.dismantleDescription)
                return 0;
            if (this.dismantleDescription.required !== undefined && !this.dismantleRequiredSelection)
                return 0;
            const targetMax = this.getIncludedDismantleItems().length;
            const staminaMax = this.computeDismantleStaminaMax();
            const durabilityMax = !this.dismantleRequiredSelection
                ? Number.MAX_SAFE_INTEGER
                : (0, itemState_1.getRemainingDurabilityUses)(this.dismantleRequiredSelection.durability, (0, itemState_1.getDismantleDurabilityLoss)(this.dismantleRequiredSelection, IAction_1.ActionType.Dismantle), this.preserveDismantleRequiredDurability);
            return Math.max(0, Math.min(targetMax, staminaMax, durabilityMax));
        }
        hasDismantleDurabilityLimit() {
            if (!this.dismantleRequiredSelection)
                return false;
            const perUseLoss = (0, itemState_1.getDismantleDurabilityLoss)(this.dismantleRequiredSelection, IAction_1.ActionType.Dismantle);
            return (0, itemState_1.getRemainingDurabilityUses)(this.dismantleRequiredSelection.durability, perUseLoss, this.preserveDismantleRequiredDurability) === 0;
        }
        hasDismantleStaminaLimit() {
            return this.safeCraftingEnabled
                && this.computeDismantleStaminaMax() === 0
                && this.getIncludedDismantleItems().length > 0;
        }
        isReservedDismantleRequiredItem(item) {
            const requiredItem = this.dismantleRequiredSelection;
            if (!requiredItem)
                return false;
            const itemId = getItemId(item);
            const requiredItemId = getItemId(requiredItem);
            if (itemId !== undefined && requiredItemId !== undefined) {
                return itemId === requiredItemId;
            }
            return item === requiredItem;
        }
        getSelectableDismantleRequiredItems(visibleItems) {
            const currentSelection = this.dismantleRequiredSelection;
            if (!currentSelection || !visibleItems.includes(currentSelection)) {
                return [...visibleItems];
            }
            return visibleItems.filter(item => item === currentSelection || !this.isIncludedDismantleTargetItem(item));
        }
        getIncludedDismantleTargetIds() {
            const includedIds = new Set();
            if (!this.dismantleSelectedItemType)
                return includedIds;
            for (const item of this.findMatchingItems(this.dismantleSelectedItemType)) {
                const itemId = getItemId(item);
                if (itemId !== undefined && !this.dismantleExcludedIds.has(itemId) && !(0, itemState_1.isItemProtected)(item)) {
                    includedIds.add(itemId);
                }
            }
            return includedIds;
        }
        isIncludedDismantleTargetItem(item) {
            const itemId = getItemId(item);
            return itemId !== undefined
                && this.getIncludedDismantleTargetIds().has(itemId);
        }
        getIncludedDismantleItems() {
            if (!this.dismantleSelectedItemType)
                return [];
            return this.getFilteredSortedSectionItems("dismantle", -1, "consumed", this.findMatchingItems(this.dismantleSelectedItemType)).filter(item => {
                const itemId = getItemId(item);
                return !this.isReservedDismantleRequiredItem(item)
                    && !(0, itemState_1.isItemProtected)(item)
                    && (itemId === undefined || !this.dismantleExcludedIds.has(itemId));
            });
        }
        updateBulkMaxDisplay(limits = this.computeBulkUiLimits()) {
            if (this.panelMode === "dismantle") {
                const max = limits.max;
                if (this.bulkMaxLabel) {
                    if (max > 0) {
                        this.bulkMaxLabel.textContent = `(max ${max})`;
                        this.bulkMaxLabel.style.color = "#9f7768";
                    }
                    else {
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
                    if (this.bulkQtyInputEl)
                        this.bulkQtyInputEl.value = String(this.bulkQuantity);
                }
                return;
            }
            const { staminaMax, materialMax, durabilityMax, max } = limits;
            if (this.bulkMaxLabel) {
                if (max > 0) {
                    this.bulkMaxLabel.textContent = `(max ${max})`;
                    this.bulkMaxLabel.style.color = "#7a6850";
                }
                else {
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
            if (max > 0 && this.bulkQuantity > max) {
                this.bulkQuantity = max;
                if (this.bulkQtyInputEl)
                    this.bulkQtyInputEl.value = String(this.bulkQuantity);
            }
        }
        adjustBulkQty(delta) {
            const limits = this.computeBulkUiLimits();
            const max = limits.max;
            let newQty = this.bulkQuantity + delta;
            const effectiveMax = max > 0 ? max : 1;
            if (newQty > effectiveMax)
                newQty = effectiveMax;
            if (newQty < 1)
                newQty = 1;
            this.bulkQuantity = newQty;
            if (this.bulkQtyInputEl)
                this.bulkQtyInputEl.value = String(this.bulkQuantity);
            this.updateBulkMaxDisplay(limits);
            this.updateBulkCraftBtnState(limits);
        }
        updateBulkCraftBtnState(limits = this.computeBulkUiLimits()) {
            if (!this.bulkCraftBtnEl)
                return;
            const canCraft = limits.max > 0 && this.bulkQuantity >= 1;
            if (canCraft) {
                this.bulkCraftBtnEl.classes.remove("bc-craft-disabled");
            }
            else {
                this.bulkCraftBtnEl.classes.add("bc-craft-disabled");
            }
        }
        hasIncompleteBulkToolSelection() {
            if (!this.recipe)
                return false;
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                const expectedCount = this.isSplitComponent(comp)
                    ? (0, craftingSelection_1.getUsedSelectionCount)(comp.requiredAmount, comp.consumedAmount)
                    : comp.consumedAmount <= 0
                        ? comp.requiredAmount
                        : 0;
                if (expectedCount === 0)
                    continue;
                const selected = this.isSplitComponent(comp)
                    ? (this.bulkPinnedUsedSelections.get(i) ?? [])
                    : (this.bulkPinnedToolSelections.get(i) ?? []);
                if (selected.length < expectedCount) {
                    return true;
                }
            }
            return false;
        }
        async onBulkCraft() {
            if (this.panelMode === "dismantle") {
                if (this.bulkCrafting || !this.dismantleSelectedItemType || !this.dismantleDescription)
                    return;
                const max = this.computeDismantleMax();
                if (max <= 0 || this.bulkQuantity < 1)
                    return;
                const targets = this.getIncludedDismantleItems().slice(0, this.bulkQuantity);
                if (targets.length === 0)
                    return;
                this.bulkCrafting = true;
                try {
                    await this.onDismantleCallback(targets, this.dismantleRequiredSelection);
                    this.scheduleInventoryRefresh();
                }
                finally {
                    this.bulkCrafting = false;
                }
                return;
            }
            if (this.bulkCrafting || !this.itemType || !this.recipe)
                return;
            const max = this.computeBulkMax();
            if (max <= 0 || this.bulkQuantity < 1)
                return;
            const flatExcluded = this.getBulkExcludedIds();
            if (!this.prepareBulkPinnedSelections(flatExcluded))
                return;
            this.bulkCrafting = true;
            try {
                await this.onBulkCraftCallback(this.itemType, this.bulkQuantity, flatExcluded);
                this._bulkContentDirty = true;
            }
            finally {
                this.bulkCrafting = false;
            }
        }
        resolveForBulkCraft(itemType, excludedIds, sessionConsumedIds) {
            this.lastBulkResolutionMessage = undefined;
            const effectiveExcluded = sessionConsumedIds?.size
                ? new Set([...excludedIds, ...sessionConsumedIds])
                : excludedIds;
            const selection = this.resolveBulkCraftSelection(itemType, effectiveExcluded);
            if (!selection)
                return null;
            return {
                required: selection.required,
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
        resolveBulkCraftSelection(itemType, excludedIds, permanentlyConsumedIds = new Set(), candidateCache = this.createBulkCandidateCache()) {
            this.lastBulkResolutionMessage = undefined;
            const recipe = ItemDescriptions_1.itemDescriptions[itemType]?.recipe;
            if (!recipe)
                return null;
            const reservedIds = new Set(permanentlyConsumedIds);
            const newlyConsumedIds = new Set();
            const slotSelections = new Map();
            const preReservedUsedSelections = new Map();
            const preReservedToolSelections = new Map();
            let base;
            const reserveItem = (item, permanentlyConsumed) => {
                const itemId = getItemId(item);
                if (itemId === undefined)
                    return false;
                if (reservedIds.has(itemId))
                    return false;
                reservedIds.add(itemId);
                if (permanentlyConsumed)
                    newlyConsumedIds.add(itemId);
                return true;
            };
            for (let i = 0; i < recipe.components.length; i++) {
                const comp = recipe.components[i];
                if (this.isSplitComponent(comp)) {
                    const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(comp.requiredAmount, comp.consumedAmount);
                    const pinnedUsed = this.bulkPinnedUsedSelections.get(i) ?? [];
                    if (pinnedUsed.length === 0)
                        continue;
                    const pinnedUsedIds = pinnedUsed.map(item => getItemId(item)).filter((id) => id !== undefined);
                    const candidates = this.getBulkCachedCandidates(candidateCache, comp.type, i, "used").filter(item => {
                        const itemId = getItemId(item);
                        return itemId !== undefined
                            && !excludedIds.has(itemId)
                            && !reservedIds.has(itemId)
                            && !(0, itemState_1.isItemProtected)(item);
                    });
                    const candidateMap = new Map();
                    for (const candidate of candidates) {
                        const candidateId = getItemId(candidate);
                        if (candidateId !== undefined && !candidateMap.has(candidateId))
                            candidateMap.set(candidateId, candidate);
                    }
                    const resolvedUsed = [];
                    for (const itemId of pinnedUsedIds) {
                        const candidate = candidateMap.get(itemId);
                        if (!candidate)
                            break;
                        reservedIds.add(itemId);
                        resolvedUsed.push(candidate);
                        if (resolvedUsed.length >= usedCount)
                            break;
                    }
                    if (resolvedUsed.length >= usedCount) {
                        preReservedUsedSelections.set(i, resolvedUsed);
                    }
                    continue;
                }
                if (comp.consumedAmount > 0)
                    continue;
                const pinned = this.bulkPinnedToolSelections.get(i) ?? [];
                if (pinned.length === 0)
                    continue;
                const pinnedIds = pinned.map(item => getItemId(item)).filter((id) => id !== undefined);
                const candidates = this.getBulkCachedCandidates(candidateCache, comp.type, i, "tool").filter(item => {
                    const itemId = getItemId(item);
                    return itemId !== undefined
                        && !excludedIds.has(itemId)
                        && !reservedIds.has(itemId)
                        && !(0, itemState_1.isItemProtected)(item);
                });
                const candidateMap = new Map();
                for (const candidate of candidates) {
                    const candidateId = getItemId(candidate);
                    if (candidateId !== undefined && !candidateMap.has(candidateId))
                        candidateMap.set(candidateId, candidate);
                }
                const resolvedPinned = [];
                for (const itemId of pinnedIds) {
                    const candidate = candidateMap.get(itemId);
                    if (!candidate)
                        break;
                    reservedIds.add(itemId);
                    resolvedPinned.push(candidate);
                    if (resolvedPinned.length >= comp.requiredAmount)
                        break;
                }
                if (resolvedPinned.length >= comp.requiredAmount) {
                    preReservedToolSelections.set(i, resolvedPinned);
                }
            }
            if (recipe.baseComponent !== undefined) {
                const candidates = this.findBulkCandidates(recipe.baseComponent, excludedIds, reservedIds, -1, "base", candidateCache);
                if (candidates.length === 0)
                    return null;
                base = candidates[0];
                if (!reserveItem(base, true))
                    return null;
            }
            for (let i = 0; i < recipe.components.length; i++) {
                const comp = recipe.components[i];
                if (this.isSplitComponent(comp)) {
                    const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(comp.requiredAmount, comp.consumedAmount);
                    const consumedCount = (0, craftingSelection_1.getConsumedSelectionCount)(comp.requiredAmount, comp.consumedAmount);
                    const resolvedUsed = preReservedUsedSelections.get(i) ?? [];
                    if (resolvedUsed.length < usedCount) {
                        this.setBulkResolutionFailure({
                            reason: "pinnedToolUnavailable",
                            slotIndex: i,
                            itemTypeOrGroup: comp.type,
                            requestedItemIds: (this.bulkPinnedUsedSelections.get(i) ?? []).map(item => getItemId(item)).filter((id) => id !== undefined),
                            candidateItemIds: this.findMatchingItems(comp.type).map(item => getItemId(item)).filter((id) => id !== undefined),
                        });
                        return null;
                    }
                    const consumedCandidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, i, "consumed", candidateCache);
                    if (consumedCandidates.length < consumedCount)
                        return null;
                    const pickedConsumed = consumedCandidates.slice(0, consumedCount);
                    for (const item of pickedConsumed) {
                        if (!reserveItem(item, true))
                            return null;
                    }
                    slotSelections.set(i, [...pickedConsumed, ...resolvedUsed]);
                    continue;
                }
                if (comp.consumedAmount <= 0)
                    continue;
                const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, i, "consumed", candidateCache);
                if (candidates.length < comp.requiredAmount)
                    return null;
                const picked = candidates.slice(0, comp.requiredAmount);
                if (picked.length < comp.requiredAmount)
                    return null;
                const partitioned = (0, craftingSelection_1.partitionSelectedItems)(picked, comp.requiredAmount, comp.consumedAmount);
                const consumedIds = new Set(partitioned.consumed.map(item => getItemId(item)).filter((id) => id !== undefined));
                for (const item of partitioned.required) {
                    const itemId = getItemId(item);
                    if (!reserveItem(item, itemId !== undefined && consumedIds.has(itemId)))
                        return null;
                }
                slotSelections.set(i, partitioned.required);
            }
            const toolSlots = recipe.components
                .map((comp, index) => comp.consumedAmount <= 0 ? index : -1)
                .filter((index) => index >= 0);
            const pickToolItemsForSlot = (slotIndex, orderedCandidates, startIndex, requiredAmount, picked, nextToolSlotIndex) => {
                if (picked.length >= requiredAmount) {
                    slotSelections.set(slotIndex, [...picked]);
                    const resolved = resolveToolSlots(nextToolSlotIndex);
                    if (resolved)
                        return true;
                    slotSelections.delete(slotIndex);
                    return false;
                }
                const remainingNeeded = requiredAmount - picked.length;
                for (let i = startIndex; i <= orderedCandidates.length - remainingNeeded; i++) {
                    const candidate = orderedCandidates[i];
                    const candidateId = getItemId(candidate);
                    if (candidateId === undefined || reservedIds.has(candidateId))
                        continue;
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
            const resolveToolSlots = (toolSlotPosition) => {
                if (toolSlotPosition >= toolSlots.length)
                    return true;
                const slotIndex = toolSlots[toolSlotPosition];
                const comp = recipe.components[slotIndex];
                const preReserved = preReservedToolSelections.get(slotIndex);
                if (preReserved) {
                    slotSelections.set(slotIndex, preReserved);
                    return resolveToolSlots(toolSlotPosition + 1);
                }
                const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, slotIndex, "tool", candidateCache);
                if (candidates.length < comp.requiredAmount)
                    return false;
                const pinned = this.bulkPinnedToolSelections.get(slotIndex) ?? [];
                if (pinned.length > 0) {
                    const pinnedIds = pinned.map(item => getItemId(item)).filter((id) => id !== undefined);
                    const candidateMap = new Map();
                    for (const candidate of candidates) {
                        const candidateId = getItemId(candidate);
                        if (candidateId !== undefined && !candidateMap.has(candidateId)) {
                            candidateMap.set(candidateId, candidate);
                        }
                    }
                    const resolvedPinned = [];
                    for (const itemId of pinnedIds) {
                        const candidate = candidateMap.get(itemId);
                        if (!candidate || reservedIds.has(itemId)) {
                            this.setBulkResolutionFailure({
                                reason: "pinnedToolUnavailable",
                                slotIndex,
                                itemTypeOrGroup: comp.type,
                                requestedItemIds: pinnedIds,
                                candidateItemIds: candidates.map(item => getItemId(item)).filter((id) => id !== undefined),
                            });
                            return false;
                        }
                        reservedIds.add(itemId);
                        resolvedPinned.push(candidate);
                        if (resolvedPinned.length >= comp.requiredAmount)
                            break;
                    }
                    if (resolvedPinned.length < comp.requiredAmount) {
                        this.setBulkResolutionFailure({
                            reason: "pinnedToolUnavailable",
                            slotIndex,
                            itemTypeOrGroup: comp.type,
                            requestedItemIds: pinnedIds,
                            candidateItemIds: candidates.map(item => getItemId(item)).filter((id) => id !== undefined),
                        });
                        return false;
                    }
                    slotSelections.set(slotIndex, resolvedPinned);
                    return resolveToolSlots(toolSlotPosition + 1);
                }
                const orderedCandidates = this.getBulkToolCandidateOrder(slotIndex, candidates);
                return pickToolItemsForSlot(slotIndex, orderedCandidates, 0, comp.requiredAmount, [], toolSlotPosition + 1);
            };
            if (!resolveToolSlots(0))
                return null;
            const required = [];
            const consumed = [];
            for (let i = 0; i < recipe.components.length; i++) {
                const comp = recipe.components[i];
                const picked = slotSelections.get(i) ?? [];
                const partitioned = (0, craftingSelection_1.partitionSelectedItems)(picked, comp.requiredAmount, comp.consumedAmount);
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
        getBulkToolCandidateOrder(slotIndex, candidates) {
            const pinned = this.bulkPinnedToolSelections.get(slotIndex) ?? [];
            const ordered = [];
            const seenIds = new Set();
            const candidateIds = new Set(candidates.map(item => getItemId(item)).filter((id) => id !== undefined));
            for (const item of pinned) {
                const itemId = getItemId(item);
                if (itemId !== undefined && candidateIds.has(itemId) && !seenIds.has(itemId)) {
                    ordered.push(item);
                    seenIds.add(itemId);
                }
            }
            for (const item of candidates) {
                const itemId = getItemId(item);
                if (itemId === undefined)
                    continue;
                if (seenIds.has(itemId))
                    continue;
                ordered.push(item);
                seenIds.add(itemId);
            }
            return ordered;
        }
        findBulkCandidates(type, excludedIds, reservedIds, slotIndex, semantic, candidateCache = this.createBulkCandidateCache()) {
            return this.getBulkCachedCandidates(candidateCache, type, slotIndex, semantic).filter(item => {
                const itemId = getItemId(item);
                return itemId !== undefined
                    && !excludedIds.has(itemId)
                    && !reservedIds.has(itemId)
                    && !(0, itemState_1.isItemProtected)(item);
            });
        }
        createBulkCandidateCache() {
            return new Map();
        }
        getBulkCachedCandidates(cache, type, slotIndex, semantic) {
            const key = `${slotIndex}:${semantic}:${type}`;
            const cached = cache.get(key);
            if (cached)
                return cached;
            const candidates = this.getFilteredSortedSectionItems("bulk", slotIndex, semantic, this.findMatchingItems(type));
            cache.set(key, candidates);
            return candidates;
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
        bcShowTextTooltip(title, lines, mouseX, mouseY) {
            const el = this.bcGetOrCreateTooltip();
            el.style.fontSize = window.getComputedStyle(this.element).fontSize;
            el.style.borderColor = "rgba(180,140,60,0.55)";
            this.bcFillTooltipForText(el, title, lines);
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
            this.bcAppendTooltipContent(el, itemType, displayName, item);
        }
        bcFillTooltipForText(el, title, lines) {
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
        createInfoIcon(title, lines) {
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
            let tooltipTimer = null;
            let lastMouseX = 0;
            let lastMouseY = 0;
            const clearTimer = () => {
                if (tooltipTimer !== null) {
                    clearTimeout(tooltipTimer);
                    tooltipTimer = null;
                }
            };
            icon.addEventListener("mouseenter", (e) => {
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                clearTimer();
                tooltipTimer = window.setTimeout(() => {
                    tooltipTimer = null;
                    this.bcShowTextTooltip(title, lines, lastMouseX, lastMouseY);
                }, 250);
            });
            icon.addEventListener("mousemove", (e) => {
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
            icon.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            icon.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            return icon;
        }
        bcAppendTooltipContent(el, itemType, displayName, item) {
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
                    (0, BetterCraftingDom_1.appendInlineStat)(propsRow, "Durability", `${dur}/${durMax}`, "#c0b080", "color:#9a8860;font-size:0.9em;");
                }
                (0, BetterCraftingDom_1.appendInlineStat)(propsRow, "Weight", item.weight.toFixed(1), "#c0b080", "color:#9a8860;font-size:0.9em;");
            }
            else if (desc) {
                if (desc.durability !== undefined) {
                    (0, BetterCraftingDom_1.appendInlineStat)(propsRow, "Durability", String(desc.durability), "#5eff80", "color:#9a8860;font-size:0.9em;");
                }
                const w = desc.weightRange ? `${desc.weightRange[0].toFixed(1)}–${desc.weightRange[1].toFixed(1)}` : desc.weight !== undefined ? desc.weight.toFixed(1) : null;
                if (w) {
                    (0, BetterCraftingDom_1.appendInlineStat)(propsRow, "Weight", w, "#c0b080", "color:#9a8860;font-size:0.9em;");
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
        getSectionStateKey(view, slotIndex, semantic) {
            const activeItemType = view === "dismantle" ? this.dismantleSelectedItemType ?? 0 : this.itemType ?? 0;
            return `${view}:${activeItemType}:${slotIndex}:${semantic}`;
        }
        getExplicitSelectionKey(view, slotIndex, semantic) {
            return this.getSectionStateKey(view, slotIndex, semantic);
        }
        setExplicitSelection(view, slotIndex, semantic, role, items) {
            const itemIds = items.map(item => getItemId(item)).filter((id) => id !== undefined);
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
        pruneExplicitSelection(view, slotIndex, semantic, selectedItems) {
            const key = this.getExplicitSelectionKey(view, slotIndex, semantic);
            const explicit = this.explicitSelections.get(key);
            if (!explicit)
                return;
            const selectedIds = new Set(selectedItems.map(item => getItemId(item)).filter((id) => id !== undefined));
            const itemIds = explicit.itemIds.filter(itemId => selectedIds.has(itemId));
            if (itemIds.length === 0) {
                this.explicitSelections.delete(key);
                return;
            }
            explicit.itemIds = itemIds;
        }
        collectExplicitReservations(entries) {
            const reservations = new Map();
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
        getDefaultSectionSortDirection(sort) {
            return sort === IItem_1.ContainerSort.Quality
                ? ISaveManager_1.SortDirection.Descending
                : ISaveManager_1.SortDirection.Ascending;
        }
        getSectionFilterState(view, slotIndex, semantic) {
            const key = this.getSectionStateKey(view, slotIndex, semantic);
            let state = this.sectionFilterStates.get(key);
            if (!state) {
                state = {
                    filterText: "",
                    sort: IItem_1.ContainerSort.BestForCrafting,
                    sortDirection: this.getDefaultSectionSortDirection(IItem_1.ContainerSort.BestForCrafting),
                    debounceTimer: null,
                };
                this.sectionFilterStates.set(key, state);
            }
            return state;
        }
        shouldReselectSection(view, slotIndex, semantic) {
            return this.pendingSectionReselectKeys.has(this.getSectionStateKey(view, slotIndex, semantic));
        }
        clearSectionReselect(view, slotIndex, semantic) {
            this.pendingSectionReselectKeys.delete(this.getSectionStateKey(view, slotIndex, semantic));
        }
        shouldReselectSectionForSort(view, slotIndex, semantic) {
            return this.pendingSortReselectKeys.has(this.getSectionStateKey(view, slotIndex, semantic));
        }
        clearSectionSortReselect(view, slotIndex, semantic) {
            this.pendingSortReselectKeys.delete(this.getSectionStateKey(view, slotIndex, semantic));
        }
        shouldSortReselectSection(view, slotIndex, semantic) {
            return view === "normal"
                || (view === "bulk" && slotIndex >= 0 && (semantic === "used" || semantic === "tool"))
                || (view === "dismantle" && slotIndex === -2 && semantic === "tool");
        }
        getItemDisplayName(item) {
            let displayName;
            try {
                displayName = this.toTitleCase(item.getName(ITranslation_1.Article.None).getString());
            }
            catch {
                displayName = this.formatEnumName(IItem_1.ItemType[item.type] || `Item ${item.type}`);
            }
            const qualityName = getQualityName(item.quality);
            return qualityName ? `${qualityName} ${displayName}` : displayName;
        }
        getFilteredSortedSectionItems(view, slotIndex, semantic, items) {
            const state = this.getSectionFilterState(view, slotIndex, semantic);
            const filterText = state.filterText.trim().toLocaleLowerCase();
            const visible = filterText
                ? items.filter(item => this.getItemDisplayName(item).toLocaleLowerCase().includes(filterText))
                : [...items];
            const sorter = ItemSort_1.default.createSorter(state.sort, state.sortDirection);
            return visible.sort((a, b) => {
                const sorted = state.sort === IItem_1.ContainerSort.Quality
                    ? state.sortDirection === ISaveManager_1.SortDirection.Descending
                        ? qualitySortKey(b.quality) - qualitySortKey(a.quality)
                        : qualitySortKey(a.quality) - qualitySortKey(b.quality)
                    : sorter(a, b);
                if (sorted !== 0)
                    return sorted;
                return (getItemId(a) ?? Number.MAX_SAFE_INTEGER) - (getItemId(b) ?? Number.MAX_SAFE_INTEGER);
            });
        }
        formatAvailableCount(visibleCount, totalCount) {
            return visibleCount === totalCount
                ? `${totalCount} available`
                : `${visibleCount}/${totalCount} visible`;
        }
        appendSectionControls(section, view, slotIndex, semantic, rebuild) {
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
                if (state.debounceTimer !== null)
                    clearTimeout(state.debounceTimer);
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
                option.textContent = this.formatEnumName(IItem_1.ContainerSort[sortOption]);
                option.selected = state.sort === sortOption;
                sort.appendChild(option);
            }
            sort.addEventListener("change", () => {
                const selectedSort = Number(sort.value);
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
                state.sortDirection = state.sortDirection === ISaveManager_1.SortDirection.Descending
                    ? ISaveManager_1.SortDirection.Ascending
                    : ISaveManager_1.SortDirection.Descending;
                rebuild();
            });
            controls.appendChild(direction);
            section.element.appendChild(controls);
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
            return (0, craftingSelection_1.filterSelectableItems)(result, getItemId).sort((a, b) => qualitySortKey(b.quality) - qualitySortKey(a.quality));
        }
        async onCraft() {
            if (this.crafting || !this.itemType || !this.recipe)
                return;
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                if (this.isSplitComponent(comp)) {
                    const splitSelection = this.getSplitSelection(i);
                    const consumedCount = (0, craftingSelection_1.getConsumedSelectionCount)(comp.requiredAmount, comp.consumedAmount);
                    const usedCount = (0, craftingSelection_1.getUsedSelectionCount)(comp.requiredAmount, comp.consumedAmount);
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
            this.debugLog("NormalCraftPreResolve", this.buildCurrentNormalCraftSelectionState());
            const resolvedSelection = this.resolveCurrentCraftSelection();
            if (!resolvedSelection)
                return;
            const staminaCost = (0, craftStamina_1.getCraftStaminaCost)(this.recipe.level);
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
                await this.onCraftCallback(this.itemType, resolvedSelection.required.length > 0 ? resolvedSelection.required : undefined, resolvedSelection.consumed.length > 0 ? resolvedSelection.consumed : undefined, resolvedSelection.base);
                this.scheduleInventoryRefresh();
            }
            finally {
                this.crafting = false;
                this.flushQueuedInventoryRefresh();
            }
        }
        showValidationError(msg) {
            if (!this.canAccessElements())
                return;
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
            setTimeout(() => {
                if (!this.canAccessElements())
                    return;
                this.validationMsg?.remove();
                this.validationMsg = undefined;
            }, 3000);
        }
    }
    exports.default = BetterCraftingPanel;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmV0dGVyQ3JhZnRpbmdEaWFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJCZXR0ZXJDcmFmdGluZ0RpYWxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0lBa0lBLE1BQU0sY0FBYyxHQUEyQjtRQUMzQyxDQUFDLGlCQUFPLENBQUMsSUFBSSxDQUFDLEVBQVcsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsTUFBTSxDQUFDLEVBQVMsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsUUFBUSxDQUFDLEVBQU8sU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsVUFBVSxDQUFDLEVBQUssU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsV0FBVyxDQUFDLEVBQUksU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsS0FBSyxDQUFDLEVBQVUsU0FBUztLQUNyQyxDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQUc7UUFDakIsTUFBTSxFQUFFO1lBQ0osS0FBSyxFQUFFLFNBQVM7WUFDaEIsSUFBSSxFQUFFLFNBQVM7WUFDZixNQUFNLEVBQUUsU0FBUztZQUNqQixNQUFNLEVBQUUsU0FBUztZQUNqQixLQUFLLEVBQUUsU0FBUztZQUNoQixNQUFNLEVBQUUsU0FBUztTQUNwQjtRQUNELElBQUksRUFBRTtZQUNGLEtBQUssRUFBRSxTQUFTO1lBQ2hCLElBQUksRUFBRSxTQUFTO1lBQ2YsTUFBTSxFQUFFLFNBQVM7WUFDakIsTUFBTSxFQUFFLFNBQVM7WUFDakIsS0FBSyxFQUFFLFNBQVM7WUFDaEIsTUFBTSxFQUFFLFNBQVM7U0FDcEI7UUFDRCxTQUFTLEVBQUU7WUFDUCxLQUFLLEVBQUUsU0FBUztZQUNoQixJQUFJLEVBQUUsU0FBUztZQUNmLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLEtBQUssRUFBRSxTQUFTO1lBQ2hCLE1BQU0sRUFBRSxT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