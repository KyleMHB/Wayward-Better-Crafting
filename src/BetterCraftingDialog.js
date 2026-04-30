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
                    border-bottom: 1px solid var(--color-border, #554433);
                }
                .bc-header-bar {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    flex-shrink: 0;
                    padding: 8px 42px 8px 10px;
                }
                .bc-tab-btn {
                    flex: 1;
                    padding: 6px 10px;
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
                    top: 7px;
                    right: 8px;
                    z-index: 3;
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
            this.append(this.normalBody);
            this.normalStaticContent = this.createStaticContentContainer();
            this.normalBody.append(this.normalStaticContent);
            [this.scrollContent, this.normalScrollInner] = this.createScrollPort();
            this.normalBody.append(this.scrollContent);
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
            this.bulkBody = new Component_1.default();
            this.bulkBody.classes.add("better-crafting-body");
            this.bulkBody.style.set("flex", "1 1 0");
            this.bulkBody.style.set("flex-direction", "column");
            this.bulkBody.style.set("min-height", "0");
            this.bulkBody.style.set("overflow", "hidden");
            this.bulkBody.style.set("padding", "8px 10px");
            this.bulkBody.style.set("gap", "8px");
            this.bulkBody.style.set("display", "none");
            this.append(this.bulkBody);
            this.bulkStaticContent = this.createStaticContentContainer();
            this.bulkBody.append(this.bulkStaticContent);
            [this.bulkScrollContent, this.bulkScrollInner] = this.createScrollPort();
            this.bulkBody.append(this.bulkScrollContent);
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
        filterUnreservedItems(items, reservations) {
            return items.filter(item => {
                const itemId = getItemId(item);
                return itemId === undefined || !reservations.has(itemId);
            });
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
            this.bulkExcludedIds.clear();
            this.bulkPreserveDurabilityBySlot.clear();
            this.bulkPinnedToolSelections.clear();
            this.bulkPinnedUsedSelections.clear();
            this.dismantleExcludedIds.clear();
            this._lastBulkItemType = 0;
            this.dismantleDescription = undefined;
            this.dismantleRequiredSelection = undefined;
            this.dismantleSelectedItemType = undefined;
            this.preserveDismantleRequiredDurability = true;
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
            this.normalRenderReservations.clear();
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
            const consumed = this.sanitizeSelectedItems(current.consumed, candidates, consumedCount);
            const consumedIds = new Set(consumed.map(item => getItemId(item)).filter((id) => id !== undefined));
            const usedCandidates = candidates.filter(item => {
                const itemId = getItemId(item);
                return itemId === undefined || !consumedIds.has(itemId);
            });
            const used = this.sanitizeSelectedItems(current.used, usedCandidates, usedCount);
            const repairedConsumed = this.supplementSelectedItems(consumed, candidates, consumedCount);
            const repairedConsumedIds = new Set(repairedConsumed.map(item => getItemId(item)).filter((id) => id !== undefined));
            const repairedUsedCandidates = candidates.filter(item => {
                const itemId = getItemId(item);
                return itemId === undefined || !repairedConsumedIds.has(itemId);
            });
            const repairedUsed = this.supplementSelectedItems(used, repairedUsedCandidates, usedCount);
            return {
                consumed: repairedConsumed,
                used: repairedUsed,
            };
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
        updateCounter(slotIndex, maxSelect, semantic = "base") {
            const counter = this.sectionCounters.get(getSectionCounterKey(slotIndex, semantic));
            if (!counter)
                return;
            let count = (this.selectedItems.get(slotIndex) || []).length;
            if (semantic === "consumed") {
                count = this.getSplitSelection(slotIndex).consumed.length;
            }
            else if (semantic === "used") {
                count = this.getSplitSelection(slotIndex).used.length;
            }
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
            const selectableItems = this.filterUnreservedItems(visibleItems, this.normalRenderReservations);
            if (this.shouldReselectSection("normal", -1, "base")) {
                this.selectedItems.set(-1, selectableItems.slice(0, 1));
                this.clearSectionReselect("normal", -1, "base");
            }
            else {
                this.selectedItems.set(-1, this.sanitizeSelectedItems(this.selectedItems.get(-1) ?? [], selectableItems, 1));
            }
            this.reserveItemsForRole(this.normalRenderReservations, this.selectedItems.get(-1) ?? [], "base");
            this.appendSectionHeader(labelRow, `Base: ${this.getTypeName(baseType)}`, this.formatAvailableCount(visibleItems.length, items.length), "base");
            const counter = new Text_1.default();
            counter.setText(TranslationImpl_1.default.generator("0/1"));
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
            const selectableItems = this.filterUnreservedItems(visibleItems, this.normalRenderReservations);
            const totalAvailableCount = items.length;
            if (this.shouldReselectSection("normal", index, semantic)) {
                if (split && semantic === "consumed") {
                    this.setSplitSelection(index, selectableItems.slice(0, maxSelect), this.getSplitSelection(index).used);
                }
                else if (split && semantic === "used") {
                    this.setSplitSelection(index, this.getSplitSelection(index).consumed, selectableItems.slice(0, maxSelect));
                }
                else {
                    this.clearSplitSelection(index);
                    this.selectedItems.set(index, selectableItems.slice(0, maxSelect));
                }
                this.clearSectionReselect("normal", index, semantic);
            }
            else if (split && semantic === "consumed") {
                this.setSplitSelection(index, this.sanitizeSelectedItems(this.getSplitSelection(index).consumed, selectableItems, maxSelect), this.getSplitSelection(index).used);
            }
            else if (split && semantic === "used") {
                this.setSplitSelection(index, this.getSplitSelection(index).consumed, this.sanitizeSelectedItems(this.getSplitSelection(index).used, selectableItems, maxSelect));
            }
            else {
                this.clearSplitSelection(index);
                this.selectedItems.set(index, this.sanitizeSelectedItems(this.selectedItems.get(index) ?? [], selectableItems, maxSelect));
            }
            if (split && semantic === "consumed") {
                this.reserveItemsForRole(this.normalRenderReservations, this.getSplitSelection(index).consumed, "consumed");
            }
            else if (split && semantic === "used") {
                this.reserveItemsForRole(this.normalRenderReservations, this.getSplitSelection(index).used, "used");
            }
            else {
                this.reserveItemsForRole(this.normalRenderReservations, this.selectedItems.get(index) ?? [], semantic === "tool" ? "tool" : "consumed");
            }
            this.appendSectionHeader(labelRow, `${this.getTypeName(component.type)} ×${maxSelect}`, this.formatAvailableCount(visibleItems.length, totalAvailableCount), semantic);
            const counter = new Text_1.default();
            counter.setText(TranslationImpl_1.default.generator(`0/${maxSelect}`));
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
                    check.setChecked(false, false);
                    row.style.set("background", "transparent");
                    row.style.set("border", borderBase);
                }
                else {
                    if (selected.length >= maxSelect) {
                        if (maxSelect !== 1 || selected.length === 0)
                            return;
                        selected.splice(0, selected.length, item);
                        this.selectedItems.set(slotIndex, selected);
                        this.rebuildNormalContent(false);
                        return;
                    }
                    selected.unshift(item);
                    check.setChecked(true, false);
                    row.style.set("background", "rgba(30, 255, 128, 0.1)");
                    row.style.set("border", borderSelected);
                }
                this.selectedItems.set(slotIndex, selected);
                this.updateCounter(slotIndex, maxSelect, semantic);
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
                    this.updateCounter(slotIndex, maxSelect, "consumed");
                }
                else {
                    this.setSplitSelection(slotIndex, nextSelection.consumed, target);
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
            const selectableItems = sortedVisibleItems.filter(item => {
                const itemId = getItemId(item);
                const excludedIds = this.bulkExcludedIds.get(slotIndex) ?? new Set();
                if (semantic === "used") {
                    return itemId === undefined || !excludedIds.has(itemId);
                }
                if (isConsumedSide) {
                    return itemId === undefined || (!excludedIds.has(itemId) && !reservedNonconsumedIds.has(itemId));
                }
                return true;
            });
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
                if (semantic === "tool" && slotIndex >= 0) {
                    this.bulkPinnedToolSelections.set(slotIndex, this.getBulkToolSelection(slotIndex, selectableItems, requiredAmount, this.shouldReselectSection("bulk", slotIndex, sectionSemantic)));
                }
                if (semantic === "used" && slotIndex >= 0) {
                    this.bulkPinnedUsedSelections.set(slotIndex, this.getBulkUsedSelection(slotIndex, selectableItems, requiredAmount, this.shouldReselectSection("bulk", slotIndex, sectionSemantic)));
                }
                this.clearSectionReselect("bulk", slotIndex, sectionSemantic);
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
        getBulkToolSelection(slotIndex, items, maxSelect, forceTopVisible = false) {
            if (forceTopVisible)
                return items.slice(0, maxSelect);
            const selected = this.bulkPinnedToolSelections.get(slotIndex) ?? [];
            if (selected.length === 0)
                return items.slice(0, maxSelect);
            const orderedIds = selected.map(item => getItemId(item)).filter((id) => id !== undefined);
            const preserved = this.getItemsByOrderedIds(items, orderedIds).slice(0, maxSelect);
            if (preserved.length >= maxSelect)
                return preserved;
            return preserved;
        }
        getBulkUsedSelection(slotIndex, items, maxSelect, forceTopVisible = false) {
            if (forceTopVisible)
                return items.slice(0, maxSelect);
            const selected = this.bulkPinnedUsedSelections.get(slotIndex) ?? [];
            if (selected.length === 0)
                return items.slice(0, maxSelect);
            const excluded = this.bulkExcludedIds.get(slotIndex) ?? new Set();
            const orderedIds = selected.map(item => getItemId(item)).filter((id) => id !== undefined);
            const preserved = this.getItemsByOrderedIds(items, orderedIds).filter(item => {
                const itemId = getItemId(item);
                return itemId !== undefined && !excluded.has(itemId);
            }).slice(0, maxSelect);
            if (preserved.length >= maxSelect)
                return preserved;
            return preserved;
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
                    this.updateBulkMaxDisplay();
                    this.updateBulkCraftBtnState();
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
                    const candidates = this.findBulkCandidates(comp.type, excludedIds, reservedIds, i, "used");
                    const pinnedUsed = this.bulkPinnedUsedSelections.get(i) ?? [];
                    const pinnedUsedIds = pinnedUsed.map(item => getItemId(item)).filter((id) => id !== undefined);
                    const candidateMap = new Map();
                    for (const candidate of candidates) {
                        const candidateId = getItemId(candidate);
                        if (candidateId !== undefined && !candidateMap.has(candidateId)) {
                            candidateMap.set(candidateId, candidate);
                        }
                    }
                    const resolvedUsed = [];
                    for (const itemId of pinnedUsedIds) {
                        const candidate = candidateMap.get(itemId);
                        if (!candidate || reservedIds.has(itemId)) {
                            this.setBulkResolutionFailure({
                                reason: "pinnedToolUnavailable",
                                slotIndex: i,
                                itemTypeOrGroup: comp.type,
                                requestedItemIds: pinnedUsedIds,
                                candidateItemIds: candidates.map(item => getItemId(item)).filter((id) => id !== undefined),
                            });
                            return null;
                        }
                        reservedIds.add(itemId);
                        resolvedUsed.push(candidate);
                        if (resolvedUsed.length >= usedCount)
                            break;
                    }
                    if (resolvedUsed.length < usedCount) {
                        this.setBulkResolutionFailure({
                            reason: "pinnedToolUnavailable",
                            slotIndex: i,
                            itemTypeOrGroup: comp.type,
                            requestedItemIds: pinnedUsedIds,
                            candidateItemIds: candidates.map(item => getItemId(item)).filter((id) => id !== undefined),
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
                const sorted = sorter(a, b);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmV0dGVyQ3JhZnRpbmdEaWFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJCZXR0ZXJDcmFmdGluZ0RpYWxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0lBNkdBLE1BQU0sY0FBYyxHQUEyQjtRQUMzQyxDQUFDLGlCQUFPLENBQUMsSUFBSSxDQUFDLEVBQVcsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsTUFBTSxDQUFDLEVBQVMsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsUUFBUSxDQUFDLEVBQU8sU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsVUFBVSxDQUFDLEVBQUssU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsV0FBVyxDQUFDLEVBQUksU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsU0FBUztRQUNsQyxDQUFDLGlCQUFPLENBQUMsS0FBSyxDQUFDLEVBQVUsU0FBUztLQUNyQyxDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQUc7UUFDakIsTUFBTSxFQUFFO1lBQ0osS0FBSyxFQUFFLFNBQVM7WUFDaEIsSUFBSSxFQUFFLFNBQVM7WUFDZixNQUFNLEVBQUUsU0FBUztZQUNqQixNQUFNLEVBQUUsU0FBUztZQUNqQixLQUFLLEVBQUUsU0FBUztZQUNoQixNQUFNLEVBQUUsU0FBUztTQUNwQjtRQUNELElBQUksRUFBRTtZQUNGLEtBQUssRUFBRSxTQUFTO1lBQ2hCLElBQUksRUFBRSxTQUFTO1lBQ2YsTUFBTSxFQUFFLFNBQVM7WUFDakIsTUFBTSxFQUFFLFNBQVM7WUFDakIsS0FBSyxFQUFFLFNBQVM7WUFDaEIsTUFBTSxFQUFFLFNBQVM7U0FDcEI7UUFDRCxTQUFTLEVBQUU7WUFDUCxLQUFLLEVBQUUsU0FBUztZQUNoQixJQUFJLEVBQUUsU0FBUztZQUNmLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLEtBQUssRUFBRSxTQUFTO1lBQ2hCLE1BQU0sRUFBRSxT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