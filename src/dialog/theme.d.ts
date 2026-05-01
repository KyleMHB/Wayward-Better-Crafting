import { ContainerSort } from "@wayward/game/game/item/IItem";
export declare const QUALITY_COLORS: Record<number, string>;
export declare const SCREEN_THEME: {
    readonly normal: {
        readonly title: "#d4c89a";
        readonly body: "#9a8860";
        readonly accent: "#c0b080";
        readonly strong: "#d4c89a";
        readonly muted: "#7a6850";
        readonly unsafe: "#c0b080";
    };
    readonly bulk: {
        readonly title: "#a8d0ef";
        readonly body: "#8ab8d8";
        readonly accent: "#c3def3";
        readonly strong: "#c3def3";
        readonly muted: "#78aace";
        readonly unsafe: "#8ab8d8";
    };
    readonly dismantle: {
        readonly title: "#d79b86";
        readonly body: "#e1b4a3";
        readonly accent: "#f0c8bb";
        readonly strong: "#f0c8bb";
        readonly muted: "#c9826a";
        readonly unsafe: "#d79b86";
    };
};
export declare const ROW_MIN_HEIGHT = 30;
export declare const ROW_PADDING_V = 4;
export declare const ROW_MARGIN = 2;
export declare const SECTION_SORTS: readonly [ContainerSort.Recent, ContainerSort.Name, ContainerSort.Weight, ContainerSort.Group, ContainerSort.Durability, ContainerSort.Quality, ContainerSort.Magical, ContainerSort.Decay, ContainerSort.Worth, ContainerSort.BestForCrafting];
