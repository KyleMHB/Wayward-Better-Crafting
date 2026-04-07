import Mod from '@wayward/game/mod/Mod';
import { ActionType } from "@wayward/game/game/entity/action/IAction";
import type { IActionHandlerApi } from "@wayward/game/game/entity/action/IAction";
import type Entity from "@wayward/game/game/entity/Entity";
export default class Precision extends Mod {
    static readonly INSTANCE: Precision;
    private panel?;
    bypassIntercept: boolean;
    private shiftHeld;
    onInitialize(): void;
    onLoad(): void;
    onUnload(): void;
    private onKeyDown;
    private onKeyUp;
    private onBlur;
    private ensurePanel;
    private executeCraft;
    onPreExecuteAction(host: any, actionType: ActionType, actionApi: IActionHandlerApi<Entity>, args: any[]): false | void;
}
