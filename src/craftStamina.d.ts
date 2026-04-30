import { RecipeLevel } from "@wayward/game/game/item/IItem";
export declare const STAMINA_COST_PER_LEVEL: Partial<Record<RecipeLevel, number>>;
export declare const DEFAULT_CRAFT_STAMINA_COST = 4;
export declare function getCraftStaminaCost(level: RecipeLevel): number;
