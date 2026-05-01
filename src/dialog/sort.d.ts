import { Quality } from "@wayward/game/game/IObject";
import type Item from "@wayward/game/game/item/Item";
import { SortDirection } from "@wayward/game/save/ISaveManager";
export declare function getQualityColor(quality?: Quality): string;
export declare function getQualityName(quality?: Quality): string;
export declare function qualitySortKey(quality?: Quality): number;
export declare function compareQuality(a: Item, b: Item, direction: SortDirection): number;
