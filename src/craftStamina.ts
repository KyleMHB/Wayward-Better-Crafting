import { RecipeLevel } from "@wayward/game/game/item/IItem";

/**
 * Recipe-level stamina cost table shared by the dialog and runtime craft paths.
 */
export const STAMINA_COST_PER_LEVEL: Partial<Record<RecipeLevel, number>> = {
    [RecipeLevel.Simple]: 2,
    [RecipeLevel.Intermediate]: 5,
    [RecipeLevel.Advanced]: 10,
    [RecipeLevel.Expert]: 16,
    [RecipeLevel.Master]: 25,
};

export const DEFAULT_CRAFT_STAMINA_COST = 4;

export function getCraftStaminaCost(level: RecipeLevel): number {
    return STAMINA_COST_PER_LEVEL[level] ?? DEFAULT_CRAFT_STAMINA_COST;
}
