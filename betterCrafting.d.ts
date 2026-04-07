import Mod from '@wayward/game/mod/Mod';
import BetterCraftingPanel from './src/BetterCraftingDialog';
import { ActionType } from "@wayward/game/game/entity/action/IAction";
import type { IActionHandlerApi } from "@wayward/game/game/entity/action/IAction";
import type Entity from "@wayward/game/game/entity/Entity";
export default class BetterCrafting extends Mod {
    static readonly INSTANCE: BetterCrafting;
    panel?: BetterCraftingPanel;
    bypassIntercept: boolean;
    private shiftHeld;
    private isBulkCrafting;
    private bulkAbortController;
    onInitialize(): void;
    onLoad(): void;
    onUnload(): void;
    private onKeyDown;
    private onKeyUp;
    private onBlur;
    private ensurePanel;
    private executeCraft;
    private waitForTurnEnd;
    private abortBulkCraft;
    private registerBulkInterruptHooks;
    private executeBulkCraft;
    onPreExecuteAction(host: any, actionType: ActionType, actionApi: IActionHandlerApi<Entity>, args: any[]): false | void;
}
