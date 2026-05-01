import { ContainerSort } from "@wayward/game/game/item/IItem";
import { Quality } from "@wayward/game/game/IObject";

export const QUALITY_COLORS: Record<number, string> = {
    [Quality.None]:          "#e0d0b0",
    [Quality.Random]:        "#e0d0b0",
    [Quality.Superior]:      "#33ff99",
    [Quality.Remarkable]:    "#00b4ff",
    [Quality.Exceptional]:   "#ce5eff",
    [Quality.Mastercrafted]: "#ff8c00",
    [Quality.Relic]:         "#ffd700",
};

export const SCREEN_THEME = {
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
} as const;

export const ROW_MIN_HEIGHT = 30;
export const ROW_PADDING_V = 4;
export const ROW_MARGIN = 2;

export const SECTION_SORTS = [
    ContainerSort.Recent,
    ContainerSort.Name,
    ContainerSort.Weight,
    ContainerSort.Group,
    ContainerSort.Durability,
    ContainerSort.Quality,
    ContainerSort.Magical,
    ContainerSort.Decay,
    ContainerSort.Worth,
    ContainerSort.BestForCrafting,
] as const;
