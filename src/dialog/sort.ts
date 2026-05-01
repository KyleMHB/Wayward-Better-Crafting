import { Quality } from "@wayward/game/game/IObject";
import type Item from "@wayward/game/game/item/Item";
import { SortDirection } from "@wayward/game/save/ISaveManager";
import { QUALITY_COLORS } from "./theme";

export function getQualityColor(quality?: Quality): string {
    return QUALITY_COLORS[quality ?? Quality.None] ?? QUALITY_COLORS[Quality.None];
}

export function getQualityName(quality?: Quality): string {
    if (quality === undefined || quality === Quality.None || quality === Quality.Random) return "";
    return Quality[quality] ?? "";
}

export function qualitySortKey(quality?: Quality): number {
    const q = quality ?? Quality.None;
    if (q === Quality.None || q === Quality.Random) return 0;
    return q as number;
}

export function compareQuality(a: Item, b: Item, direction: SortDirection): number {
    return direction === SortDirection.Descending
        ? qualitySortKey(b.quality) - qualitySortKey(a.quality)
        : qualitySortKey(a.quality) - qualitySortKey(b.quality);
}
