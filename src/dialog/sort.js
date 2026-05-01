define(["require", "exports", "@wayward/game/game/IObject", "@wayward/game/save/ISaveManager", "./theme"], function (require, exports, IObject_1, ISaveManager_1, theme_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getQualityColor = getQualityColor;
    exports.getQualityName = getQualityName;
    exports.qualitySortKey = qualitySortKey;
    exports.compareQuality = compareQuality;
    function getQualityColor(quality) {
        return theme_1.QUALITY_COLORS[quality ?? IObject_1.Quality.None] ?? theme_1.QUALITY_COLORS[IObject_1.Quality.None];
    }
    function getQualityName(quality) {
        if (quality === undefined || quality === IObject_1.Quality.None || quality === IObject_1.Quality.Random)
            return "";
        return IObject_1.Quality[quality] ?? "";
    }
    function qualitySortKey(quality) {
        const q = quality ?? IObject_1.Quality.None;
        if (q === IObject_1.Quality.None || q === IObject_1.Quality.Random)
            return 0;
        return q;
    }
    function compareQuality(a, b, direction) {
        return direction === ISaveManager_1.SortDirection.Descending
            ? qualitySortKey(b.quality) - qualitySortKey(a.quality)
            : qualitySortKey(a.quality) - qualitySortKey(b.quality);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29ydC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0lBS0EsMENBRUM7SUFFRCx3Q0FHQztJQUVELHdDQUlDO0lBRUQsd0NBSUM7SUFuQkQsU0FBZ0IsZUFBZSxDQUFDLE9BQWlCO1FBQzdDLE9BQU8sc0JBQWMsQ0FBQyxPQUFPLElBQUksaUJBQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxzQkFBYyxDQUFDLGlCQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVELFNBQWdCLGNBQWMsQ0FBQyxPQUFpQjtRQUM1QyxJQUFJLE9BQU8sS0FBSyxTQUFTLElBQUksT0FBTyxLQUFLLGlCQUFPLENBQUMsSUFBSSxJQUFJLE9BQU8sS0FBSyxpQkFBTyxDQUFDLE1BQU07WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUMvRixPQUFPLGlCQUFPLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFFRCxTQUFnQixjQUFjLENBQUMsT0FBaUI7UUFDNUMsTUFBTSxDQUFDLEdBQUcsT0FBTyxJQUFJLGlCQUFPLENBQUMsSUFBSSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxLQUFLLGlCQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxpQkFBTyxDQUFDLE1BQU07WUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6RCxPQUFPLENBQVcsQ0FBQztJQUN2QixDQUFDO0lBRUQsU0FBZ0IsY0FBYyxDQUFDLENBQU8sRUFBRSxDQUFPLEVBQUUsU0FBd0I7UUFDckUsT0FBTyxTQUFTLEtBQUssNEJBQWEsQ0FBQyxVQUFVO1lBQ3pDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3ZELENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEUsQ0FBQyJ9