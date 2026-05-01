define(["require", "exports", "@wayward/game/ui/component/Component", "@wayward/game/ui/component/Button", "@wayward/game/ui/component/CheckButton", "@wayward/game/ui/component/Text", "@wayward/game/language/impl/TranslationImpl", "@wayward/game/game/item/ItemDescriptions", "@wayward/game/game/item/IItem", "@wayward/game/game/item/ItemSort", "@wayward/game/game/entity/skill/ISkills", "@wayward/game/game/item/ItemManager", "@wayward/game/language/ITranslation", "@wayward/game/game/IObject", "@wayward/game/game/entity/action/IAction", "@wayward/game/save/ISaveManager", "@wayward/game/ui/screen/screens/game/component/ItemComponent", "@wayward/game/ui/screen/screens/game/component/item/ItemComponentHandler", "@wayward/game/ui/util/IHighlight", "@wayward/game/game/entity/IStats", "@wayward/utilities/Log", "./BetterCraftingDom", "./craftingSelection", "./craftStamina", "./itemIdentity", "./craftStamina"], function (require, exports, Component_1, Button_1, CheckButton_1, Text_1, TranslationImpl_1, ItemDescriptions_1, IItem_1, ItemSort_1, ISkills_1, ItemManager_1, ITranslation_1, IObject_1, IAction_1, ISaveManager_1, ItemComponent_1, ItemComponentHandler_1, IHighlight_1, IStats_1, Log_1, BetterCraftingDom_1, craftingSelection_1, craftStamina_1, itemIdentity_1, craftStamina_2) {
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
    function isItemProtected(item) {
        return item.isProtected === true || item.protected === true;
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
            if (this.panelMode === "dismantle") {
                this.updateBulkMaxDisplay();
                this.updateBulkCraftBtnState();
                return;
            }
            if (this.activeTab === "bulk") {
                this.updateBulkMaxDisplay();
                this.updateBulkCraftBtnState();
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
                this.updateBulkMaxDisplay();
                this.updateBulkCraftBtnState();
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
                const forceTopVisible = this.shouldReselectSection("normal", slotIndex, semantic);
                const repaired = this.repairSelectedItemsForRole(current, candidates, maxCount, this.normalRenderReservations, role, forceTopVisible);
                this.clearSectionReselect("normal", slotIndex, semantic);
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
            if (semantic === "consumed") {
                return this.getSplitSelection(slotIndex).consumed.length;
            }
            if (semantic === "used") {
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
            catch { }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            if (component && component.consumedAmount <= 0) {
                this.appendRemainingUsesHint(row.element, item, this.getCraftDurabilityLoss(item), false);
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
            catch { }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            if (semantic === "used" && !disabled) {
                this.appendRemainingUsesHint(row.element, item, this.getCraftDurabilityLoss(item), false);
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
                this.updateBulkCraftBtnState();
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
            this.updateBulkMaxDisplay();
            this.updateBulkCraftBtnState();
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
                this.updateBulkCraftBtnState();
                this.restoreScrollPosition(this.bulkScrollContent, scrollTop, scrollLeft, preserveScroll);
                return;
            }
            this.buildDismantleHeaderCard(itemType, dismantle);
            this.addDismantleHelpBox();
            this.addDismantleTargetSection(itemType);
            if (dismantle.required !== undefined) {
                this.addDismantleRequiredSection(dismantle.required);
            }
            this.bulkQuantity = Math.max(1, Math.min(this.bulkQuantity, this.computeDismantleMax() || 1));
            if (this.bulkQtyInputEl)
                this.bulkQtyInputEl.value = String(this.bulkQuantity);
            this.updateBulkMaxDisplay();
            this.updateBulkCraftBtnState();
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
            const selectableItems = visibleItems.filter(item => !this.isIncludedDismantleTargetItem(item));
            if (this.shouldReselectSection("dismantle", -2, "tool")) {
                this.dismantleRequiredSelection = selectableItems[0];
                this.clearSectionReselect("dismantle", -2, "tool");
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
                const eligibleVisibleItems = visibleItems.filter(item => !isItemProtected(item) && !this.isReservedDismantleRequiredItem(item));
                const includedIds = new Set(eligibleVisibleItems.slice(0, this.bulkQuantity).map(item => getItemId(item)).filter((id) => id !== undefined));
                this.dismantleExcludedIds.clear();
                for (const item of items) {
                    const itemId = getItemId(item);
                    if (itemId === undefined)
                        continue;
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
            this.appendRemainingUsesHint(row.element, item, this.getDismantleDurabilityLoss(item), this.preserveDismantleRequiredDurability);
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
                this.updateBulkMaxDisplay();
                this.updateBulkCraftBtnState();
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
                this.updateBulkMaxDisplay();
                this.updateBulkCraftBtnState();
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
            const maxUses = this.getRemainingUses(item, perUseLoss, protect);
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
            const locked = isItemProtected(item) || lockedByRequired;
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
                    this.updateBulkMaxDisplay();
                    this.updateBulkCraftBtnState();
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
                        && !isItemProtected(item)
                        && (semantic !== "used" || !(this.bulkExcludedIds.get(slotIndex)?.has(itemId) ?? false));
                });
                const forceTopVisible = current.length === 0 || this.shouldReselectSection("bulk", slotIndex, semantic);
                const repaired = this.repairSelectedItemsForRole(current, candidates, maxCount, reservations, semantic, forceTopVisible);
                this.clearSectionReselect("bulk", slotIndex, semantic);
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
            const autoExcluded = isItemProtected(item);
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
            catch { }
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
            catch { }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            if (!isDisabled()) {
                this.appendRemainingUsesHint(row.element, item, this.getCraftDurabilityLoss(item), this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true);
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
            catch { }
            const nameText = new Text_1.default();
            nameText.setText(TranslationImpl_1.default.generator(displayName));
            nameText.style.set("color", qualityColor);
            nameText.style.set("flex", "1");
            nameText.style.set("font-size", "inherit");
            row.append(nameText);
            this.appendRemainingUsesHint(row.element, item, this.getCraftDurabilityLoss(item), this.bulkPreserveDurabilityBySlot.get(slotIndex) ?? true);
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
        getCraftDurabilityLoss(item) {
            return Math.max(0, item.getDamageModifier?.() ?? 0);
        }
        getDismantleDurabilityLoss(item) {
            return Math.max(0, item.description?.damageOnUse?.[IAction_1.ActionType.Dismantle] ?? item.getDamageModifier?.() ?? 0);
        }
        getRemainingUses(item, perUseLoss, leaveOneUse) {
            if (perUseLoss <= 0)
                return Number.MAX_SAFE_INTEGER;
            const durability = item.durability ?? 0;
            if (durability <= 0)
                return 0;
            const usableActions = Math.ceil(durability / perUseLoss);
            return Math.max(0, usableActions - (leaveOneUse ? 1 : 0));
        }
        computeBulkDurabilityMax(excludedIds) {
            if (!this.recipe)
                return Number.MAX_SAFE_INTEGER;
            const selection = this.resolveBulkCraftSelection(this.itemType, excludedIds);
            if (!selection)
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
                    durabilityMax = Math.min(durabilityMax, this.getRemainingUses(item, this.getCraftDurabilityLoss(item), preserveDurability));
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
            const durabilityMax = this.computeBulkDurabilityMax(excludedIds);
            return { staminaMax, materialMax, durabilityMax };
            if (this.recipe.baseComponent !== undefined) {
                const excluded = this.bulkExcludedIds.get(-1) ?? new Set();
                const available = this.findMatchingItems(this.recipe.baseComponent)
                    .filter(item => {
                    const itemId = getItemId(item);
                    return itemId === undefined || !excluded.has(itemId);
                });
                materialMax = Math.min(materialMax, available.length);
            }
            for (let i = 0; i < this.recipe.components.length; i++) {
                const comp = this.recipe.components[i];
                if (comp.consumedAmount <= 0)
                    continue;
                const excluded = this.bulkExcludedIds.get(i) ?? new Set();
                const available = this.findMatchingItems(comp.type)
                    .filter(item => {
                    const itemId = getItemId(item);
                    return itemId === undefined || !excluded.has(itemId);
                });
                const perCraft = comp.requiredAmount;
                if (perCraft <= 0)
                    continue;
                materialMax = Math.min(materialMax, Math.floor(available.length / perCraft));
            }
            return { staminaMax, materialMax, durabilityMax };
        }
        computeBulkMax() {
            if (this.panelMode === "dismantle") {
                return this.computeDismantleMax();
            }
            const { staminaMax, materialMax, durabilityMax } = this.computeBulkLimits();
            return Math.max(0, Math.min(staminaMax, materialMax, durabilityMax));
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
                : this.getRemainingUses(this.dismantleRequiredSelection, this.getDismantleDurabilityLoss(this.dismantleRequiredSelection), this.preserveDismantleRequiredDurability);
            return Math.max(0, Math.min(targetMax, staminaMax, durabilityMax));
        }
        hasDismantleDurabilityLimit() {
            if (!this.dismantleRequiredSelection)
                return false;
            const perUseLoss = this.getDismantleDurabilityLoss(this.dismantleRequiredSelection);
            return this.getRemainingUses(this.dismantleRequiredSelection, perUseLoss, this.preserveDismantleRequiredDurability) === 0;
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
        isIncludedDismantleTargetItem(item) {
            const itemId = getItemId(item);
            return itemId !== undefined
                && !this.dismantleExcludedIds.has(itemId)
                && !isItemProtected(item);
        }
        getIncludedDismantleItems() {
            if (!this.dismantleSelectedItemType)
                return [];
            return this.getFilteredSortedSectionItems("dismantle", -1, "consumed", this.findMatchingItems(this.dismantleSelectedItemType)).filter(item => {
                const itemId = getItemId(item);
                return !this.isReservedDismantleRequiredItem(item)
                    && !isItemProtected(item)
                    && (itemId === undefined || !this.dismantleExcludedIds.has(itemId));
            });
        }
        updateBulkMaxDisplay() {
            if (this.panelMode === "dismantle") {
                const max = this.computeDismantleMax();
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
            const { staminaMax, materialMax, durabilityMax } = this.computeBulkLimits();
            const max = Math.max(0, Math.min(staminaMax, materialMax, durabilityMax));
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
        resolveBulkCraftSelection(itemType, excludedIds, permanentlyConsumedIds = new Set()) {
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
                    const candidates = this.getFilteredSortedSectionItems("bulk", i, "used", this.findMatchingItems(comp.type)).filter(item => {
                        const itemId = getItemId(item);
                        return itemId !== undefined
                            && !excludedIds.has(itemId)
                            && !reservedIds.has(itemId)
                            && !isItemProtected(item);
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
                const candidates = this.getFilteredSortedSectionItems("bulk", i, "tool", this.findMatchingItems(comp.type)).filter(item => {
                    const itemId = getItemId(item);
                    return itemId !== undefined
                        && !excludedIds.has(itemId)
                        && !reservedIds.has(itemId)
                        && !isItemProtected(item);
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
                const candidates = this.findBulkCandidates(recipe.baseComponent, excludedIds, reservedIds, -1, "base");
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
                    const consumedCandidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, i, "consumed");
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
                const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, i, "consumed");
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
                const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, slotIndex, "tool");
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
        findBulkCandidates(type, excludedIds, reservedIds, slotIndex, semantic) {
            return this.getFilteredSortedSectionItems("bulk", slotIndex, semantic, this.findMatchingItems(type)).filter(item => {
                const itemId = getItemId(item);
                return itemId !== undefined
                    && !excludedIds.has(itemId)
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
        getSectionFilterState(view, slotIndex, semantic) {
            const key = this.getSectionStateKey(view, slotIndex, semantic);
            let state = this.sectionFilterStates.get(key);
            if (!state) {
                state = {
                    filterText: "",
                    sort: IItem_1.ContainerSort.Quality,
                    sortDirection: ISaveManager_1.SortDirection.Descending,
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
                state.sort = Number(sort.value);
                this.pendingSectionReselectKeys.add(key);
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
                this.pendingSectionReselectKeys.add(key);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmV0dGVyQ3JhZnRpbmdEaWFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJCZXR0ZXJDcmFmdGluZ0RpYWxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0lBbUhBLE1BQU0sY0FBYyxHQUEyQjtRQUMzQyxDQUFDLGlCQUFPLENBQUMsSUFBSSxDQUFDLEVBQVcsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsTUFBTSxDQUFDLEVBQVMsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsUUFBUSxDQUFDLEVBQU8sU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsVUFBVSxDQUFDLEVBQUssU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsV0FBVyxDQUFDLEVBQUksU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsS0FBSyxDQUFDLEVBQVUsU0FBUztLQUNyQyxDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQUc7UUFDakIsTUFBTSxFQUFFO1lBQ0osS0FBSyxFQUFFLFNBQVM7WUFDaEIsSUFBSSxFQUFFLFNBQVM7WUFDZixNQUFNLEVBQUUsU0FBUztZQUNqQixNQUFNLEVBQUUsU0FBUztZQUNqQixLQUFLLEVBQUUsU0FBUztZQUNoQixNQUFNLEVBQUUsU0FBUztTQUNwQjtRQUNELElBQUksRUFBRTtZQUNGLEtBQUssRUFBRSxTQUFTO1lBQ2hCLElBQUksRUFBRSxTQUFTO1lBQ2YsTUFBTSxFQUFFLFNBQVM7WUFDakIsTUFBTSxFQUFFLFNBQVM7WUFDakIsS0FBSyxFQUFFLFNBQVM7WUFDaEIsTUFBTSxFQUFFLFNBQVM7U0FDcEI7UUFDRCxTQUFTLEVBQUU7WUFDUCxLQUFLLEVBQUUsU0FBUztZQUNoQixJQUFJLEVBQUUsU0FBUztZQUNmLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLEtBQUssRUFBRSxTQUFTO1lBQ2hCLE1BQU0sRUFBRSxT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