import Mod from '@wayward/game/mod/Mod';
import BetterCraftingPanel, { type ICraftDisplayResult, STAMINA_COST_PER_LEVEL } from './src/BetterCraftingDialog';
import { EventHandler } from "@wayward/game/event/EventManager";
import { EventBus } from "@wayward/game/event/EventBuses";
import { ActionType } from "@wayward/game/game/entity/action/IAction";
import type { IActionHandlerApi } from "@wayward/game/game/entity/action/IAction";
import type Entity from "@wayward/game/game/entity/Entity";
import { ScreenId } from "@wayward/game/ui/screen/IScreen";
import ActionExecutor from "@wayward/game/game/entity/action/ActionExecutor";
import Craft from "@wayward/game/game/entity/action/actions/Craft";
import type Item from "@wayward/game/game/item/Item";
import { ItemType, RecipeLevel } from "@wayward/game/game/item/IItem";
import { itemDescriptions } from "@wayward/game/game/item/ItemDescriptions";
import { Stat } from "@wayward/game/game/entity/IStats";
import type { IStat } from "@wayward/game/game/entity/IStats";
import type { IStatChangeInfo } from "@wayward/game/game/entity/IEntity";
import type Tile from "@wayward/game/game/tile/Tile";
import { Quality } from "@wayward/game/game/IObject";

interface IInventorySnapshotEntry {
    item: Item;
    signature: string;
}

interface ICraftResultCapture {
    before: Map<number, IInventorySnapshotEntry>;
    eventCandidates: Item[];
    unsubscribe: () => void;
}

export default class BetterCrafting extends Mod {
    @Mod.instance<BetterCrafting>()
    public static readonly INSTANCE: BetterCrafting;

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

    // ── Mod lifecycle ─────────────────────────────────────────────────────────

    public override onInitialize(): void {}

    public override onLoad(): void {
        document.addEventListener("keydown", this.onKeyDown);
        document.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
    }

    public override onUnload(): void {
        document.removeEventListener("keydown", this.onKeyDown);
        document.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onBlur);
        this.panel?.hidePanel();
        this.panel?.destroyListeners();
        this.panel?.remove();
        this.panel = undefined;
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Shift") this.shiftHeld = true;
    };

    private onKeyUp = (e: KeyboardEvent) => {
        if (e.key === "Shift") this.shiftHeld = false;
    };

    private onBlur = () => {
        this.shiftHeld = false;
    };

    // ── Panel management ──────────────────────────────────────────────────────

    private ensurePanel(): BetterCraftingPanel | undefined {
        if (!this.panel) {
            const gameScreen = ui?.screens?.get(ScreenId.Game);
            if (gameScreen) {
                this.panel = new BetterCraftingPanel(
                    async (itemType, tools, consumed, base) => {
                        await this.executeCraft(itemType, tools, consumed, base);
                    },
                    async (itemType, quantity, excludedIds) => {
                        await this.executeBulkCraft(itemType, quantity, excludedIds);
                    },
                );
                gameScreen.append(this.panel);
            }
        }
        return this.panel;
    }

    private snapshotInventory(): Map<number, IInventorySnapshotEntry> {
        const snapshot = new Map<number, IInventorySnapshotEntry>();
        if (!localPlayer?.island?.items) return snapshot;

        const items = localPlayer.island.items.getItemsInContainer(localPlayer, { includeSubContainers: true });
        for (const item of items) {
            const id = this.getItemId(item);
            if (id === undefined) continue;
            snapshot.set(id, { item, signature: this.getItemSignature(item) });
        }

        return snapshot;
    }

    private beginCraftResultCapture(itemType: ItemType): ICraftResultCapture {
        const eventCandidates: Item[] = [];
        const pushCandidates = (items: Item[]) => {
            for (const item of items) {
                if (item?.type === itemType) eventCandidates.push(item);
            }
        };

        const onAdd = (items: Item[]) => pushCandidates(items);
        const onUpdate = (items: Item[]) => pushCandidates(items);

        localPlayer.event.subscribe("inventoryItemAdd", onAdd);
        localPlayer.event.subscribe("inventoryItemUpdate", onUpdate);

        return {
            before: this.snapshotInventory(),
            eventCandidates,
            unsubscribe: () => {
                localPlayer.event.unsubscribe("inventoryItemAdd", onAdd);
                localPlayer.event.unsubscribe("inventoryItemUpdate", onUpdate);
            },
        };
    }

    private finishCraftResultCapture(capture: ICraftResultCapture, itemType: ItemType): ICraftDisplayResult {
        capture.unsubscribe();
        const after = this.snapshotInventory();
        const item = this.resolveCraftResultItem(itemType, capture.before, after, capture.eventCandidates);
        return { success: !!item, item, itemType };
    }

    private resolveCraftResultItem(
        itemType: ItemType,
        before: Map<number, IInventorySnapshotEntry>,
        after: Map<number, IInventorySnapshotEntry>,
        eventCandidates: Item[],
    ): Item | undefined {
        const candidates: Item[] = [];
        const seen = new Set<number>();
        const push = (item: Item | undefined) => {
            if (!item || item.type !== itemType) return;
            const id = this.getItemId(item);
            if (id === undefined || seen.has(id) || !after.has(id)) return;
            seen.add(id);
            candidates.push(after.get(id)!.item);
        };

        for (const item of eventCandidates) push(item);

        for (const [id, entry] of after) {
            const beforeEntry = before.get(id);
            if (!beforeEntry || beforeEntry.signature !== entry.signature) {
                push(entry.item);
            }
        }

        return candidates.sort((a, b) =>
            ((b.quality ?? Quality.None) as number) - ((a.quality ?? Quality.None) as number)
            || this.getItemId(b)! - this.getItemId(a)!,
        )[0];
    }

    private getItemId(item: Item): number | undefined {
        return (item as any).id as number | undefined;
    }

    private getItemSignature(item: Item): string {
        const magic = item.magic ? item.magic.toString?.() ?? "magic" : "";
        const used = item.used ? JSON.stringify(item.used) : "";
        return [
            item.type,
            item.quality ?? Quality.None,
            item.durability,
            item.durabilityMax,
            item.weight.toFixed(3),
            (item as any).bonusAttack ?? "",
            (item as any).bonusDefense ?? "",
            (item as any).baseItem ?? "",
            (item as any).crafterIdentifier ?? "",
            used,
            magic,
        ].join("|");
    }

    // ── Craft execution ───────────────────────────────────────────────────────

    /** Normal single craft: passes directly to vanilla Craft action. */
    private async executeCraft(
        itemType: ItemType,
        tools: Item[] | undefined,
        consumed: Item[] | undefined,
        base: Item | undefined,
    ): Promise<void> {
        this.panel?.clearResults();
        const capture = this.beginCraftResultCapture(itemType);
        this.bypassIntercept = true;
        try {
            await ActionExecutor.get(Craft).execute(
                localPlayer,
                itemType,
                tools,
                consumed,
                base,
                undefined,
            );
            this.panel?.showSingleCraftResult(this.finishCraftResultCapture(capture, itemType));
        } catch (error) {
            capture.unsubscribe();
            this.panel?.showSingleCraftResult({ success: false, itemType });
            throw error;
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

    /**
     * Subscribes to movement and damage events to abort the bulk craft.
     * Returns a cleanup function that unsubscribes all handlers.
     */
    private registerBulkInterruptHooks(): () => void {
        const moveHandler = (_: any, fromTile: Tile, toTile: Tile) => {
            if (fromTile !== toTile) this.abortBulkCraft("movement");
        };

        const statHandler = (_: any, stat: IStat, oldValue: number, _info: IStatChangeInfo) => {
            if (stat.type === Stat.Health && (stat.value ?? 0) < oldValue) {
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
        if (this.isBulkCrafting) return;

        const recipe = itemDescriptions[itemType]?.recipe;
        if (!recipe) return;

        const staminaCost = STAMINA_COST_PER_LEVEL[recipe.level as RecipeLevel] ?? 4;

        // Set up abort controller and interrupt hooks.
        this.bulkAbortController = { aborted: false, reason: "", resolveWait: null };
        const cleanupHooks = this.registerBulkInterruptHooks();
        this.panel?.setBulkAbortCallback(() => this.abortBulkCraft("user_stop"));
        this.panel?.clearResults();
        this.panel?.onBulkCraftStart(quantity);

        this.isBulkCrafting = true;
        this.bypassIntercept = true;
        const craftResults: ICraftDisplayResult[] = [];
        try {
            for (let i = 0; i < quantity; i++) {
                if (this.bulkAbortController.aborted) break;

                // Player / island null-guard.
                if (!localPlayer?.island) break;

                // Stamina pre-check.
                const currentStamina: number =
                    (localPlayer as any).stat?.get?.(Stat.Stamina)?.value ?? 0;
                if (currentStamina < staminaCost) break;

                // Re-resolve items — prior crafts consume materials.
                const resolved = this.panel?.resolveForBulkCraft(itemType, excludedIds);
                if (!resolved) break;

                // Check abort again (events may have fired during resolve).
                if (this.bulkAbortController.aborted) break;

                // Subscribe to turnEnd BEFORE execute — it fires synchronously
                // inside execute(), so subscribing after would miss it.
                const turnEndPromise = this.waitForTurnEnd();
                const capture = this.beginCraftResultCapture(itemType);

                // One vanilla Craft action.
                try {
                    await ActionExecutor.get(Craft).execute(
                        localPlayer,
                        itemType,
                        resolved.tools.length > 0 ? resolved.tools : undefined,
                        resolved.consumed.length > 0 ? resolved.consumed : undefined,
                        resolved.base,
                        undefined,
                    );
                    craftResults.push(this.finishCraftResultCapture(capture, itemType));
                } catch (error) {
                    capture.unsubscribe();
                    craftResults.push({ success: false, itemType });
                    throw error;
                }

                // Update progress counter immediately after the craft completes.
                this.panel?.setBulkProgress(i + 1, quantity);

                // Wait for turnEnd + one RAF (~16ms) before next iteration.
                await turnEndPromise;
            }
        } finally {
            cleanupHooks();
            this.bulkAbortController = null;
            this.panel?.setBulkAbortCallback(null);
            this.panel?.showBulkCraftResults(craftResults);
            this.panel?.onBulkCraftEnd();
            this.isBulkCrafting = false;
            this.bypassIntercept = false;
        }
    }

    // ── Action interception ───────────────────────────────────────────────────

    @EventHandler(EventBus.Actions, "preExecuteAction")
    public onPreExecuteAction(
        host: any,
        actionType: ActionType,
        actionApi: IActionHandlerApi<Entity>,
        args: any[],
    ): false | void {
        if (this.bypassIntercept) return;
        if (this.shiftHeld) return;

        if (actionType === ActionType.Craft && actionApi.executor === localPlayer) {
            const itemType = args[0] as number;
            const panel = this.ensurePanel();

            if (panel) {
                panel.updateRecipe(itemType);
                panel.showPanel();
            }

            return false;
        }
    }
}
