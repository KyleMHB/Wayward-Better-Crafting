define(["require", "exports", "@wayward/game/game/item/IItem", "@wayward/game/game/IObject"], function (require, exports, IItem_1, IObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SECTION_SORTS = exports.ROW_MARGIN = exports.ROW_PADDING_V = exports.ROW_MIN_HEIGHT = exports.SCREEN_THEME = exports.QUALITY_COLORS = void 0;
    exports.QUALITY_COLORS = {
        [IObject_1.Quality.None]: "#e0d0b0",
        [IObject_1.Quality.Random]: "#e0d0b0",
        [IObject_1.Quality.Superior]: "#33ff99",
        [IObject_1.Quality.Remarkable]: "#00b4ff",
        [IObject_1.Quality.Exceptional]: "#ce5eff",
        [IObject_1.Quality.Mastercrafted]: "#ff8c00",
        [IObject_1.Quality.Relic]: "#ffd700",
    };
    exports.SCREEN_THEME = {
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
    exports.ROW_MIN_HEIGHT = 30;
    exports.ROW_PADDING_V = 4;
    exports.ROW_MARGIN = 2;
    exports.SECTION_SORTS = [
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhlbWUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0aGVtZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0lBR2EsUUFBQSxjQUFjLEdBQTJCO1FBQ2xELENBQUMsaUJBQU8sQ0FBQyxJQUFJLENBQUMsRUFBVyxTQUFTO1FBQ2xDLENBQUMsaUJBQU8sQ0FBQyxNQUFNLENBQUMsRUFBUyxTQUFTO1FBQ2xDLENBQUMsaUJBQU8sQ0FBQyxRQUFRLENBQUMsRUFBTyxTQUFTO1FBQ2xDLENBQUMsaUJBQU8sQ0FBQyxVQUFVLENBQUMsRUFBSyxTQUFTO1FBQ2xDLENBQUMsaUJBQU8sQ0FBQyxXQUFXLENBQUMsRUFBSSxTQUFTO1FBQ2xDLENBQUMsaUJBQU8sQ0FBQyxhQUFhLENBQUMsRUFBRSxTQUFTO1FBQ2xDLENBQUMsaUJBQU8sQ0FBQyxLQUFLLENBQUMsRUFBVSxTQUFTO0tBQ3JDLENBQUM7SUFFVyxRQUFBLFlBQVksR0FBRztRQUN4QixNQUFNLEVBQUU7WUFDSixLQUFLLEVBQUUsU0FBUztZQUNoQixJQUFJLEVBQUUsU0FBUztZQUNmLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLEtBQUssRUFBRSxTQUFTO1lBQ2hCLE1BQU0sRUFBRSxTQUFTO1NBQ3BCO1FBQ0QsSUFBSSxFQUFFO1lBQ0YsS0FBSyxFQUFFLFNBQVM7WUFDaEIsSUFBSSxFQUFFLFNBQVM7WUFDZixNQUFNLEVBQUUsU0FBUztZQUNqQixNQUFNLEVBQUUsU0FBUztZQUNqQixLQUFLLEVBQUUsU0FBUztZQUNoQixNQUFNLEVBQUUsU0FBUztTQUNwQjtRQUNELFNBQVMsRUFBRTtZQUNQLEtBQUssRUFBRSxTQUFTO1lBQ2hCLElBQUksRUFBRSxTQUFTO1lBQ2YsTUFBTSxFQUFFLFNBQVM7WUFDakIsTUFBTSxFQUFFLFNBQVM7WUFDakIsS0FBSyxFQUFFLFNBQVM7WUFDaEIsTUFBTSxFQUFFLFNBQVM7U0FDcEI7S0FDSyxDQUFDO0lBRUUsUUFBQSxjQUFjLEdBQUcsRUFBRSxDQUFDO0lBQ3BCLFFBQUEsYUFBYSxHQUFHLENBQUMsQ0FBQztJQUNsQixRQUFBLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFFZixRQUFBLGFBQWEsR0FBRztRQUN6QixxQkFBYSxDQUFDLE1BQU07UUFDcEIscUJBQWEsQ0FBQyxJQUFJO1FBQ2xCLHFCQUFhLENBQUMsTUFBTTtRQUNwQixxQkFBYSxDQUFDLEtBQUs7UUFDbkIscUJBQWEsQ0FBQyxVQUFVO1FBQ3hCLHFCQUFhLENBQUMsT0FBTztRQUNyQixxQkFBYSxDQUFDLE9BQU87UUFDckIscUJBQWEsQ0FBQyxLQUFLO1FBQ25CLHFCQUFhLENBQUMsS0FBSztRQUNuQixxQkFBYSxDQUFDLGVBQWU7S0FDdkIsQ0FBQyJ9