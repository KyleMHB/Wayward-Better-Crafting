define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.appendInlineStat = appendInlineStat;
    exports.createColoredListLine = createColoredListLine;
    exports.createHelpBoxRow = createHelpBoxRow;
    function normalizeSegments(content) {
        return typeof content === "string" ? [content] : content;
    }
    function appendInlineStat(parent, label, value, accentColor, cssText) {
        const stat = document.createElement("span");
        stat.style.cssText = cssText;
        stat.append(`${label}: `);
        const valueSpan = document.createElement("span");
        valueSpan.style.color = accentColor;
        valueSpan.textContent = value;
        stat.appendChild(valueSpan);
        parent.appendChild(stat);
        return stat;
    }
    function createColoredListLine(label, values, accentColor, cssText) {
        const line = document.createElement("div");
        line.style.cssText = cssText;
        line.append(`${label}: `);
        values.forEach((value, index) => {
            if (index > 0)
                line.append(", ");
            const valueSpan = document.createElement("span");
            valueSpan.style.color = accentColor;
            valueSpan.textContent = value;
            line.appendChild(valueSpan);
        });
        return line;
    }
    function createHelpBoxRow(label, content) {
        const row = document.createElement("div");
        row.className = "bc-bulk-help-row";
        const labelEl = document.createElement("strong");
        labelEl.textContent = `${label}:`;
        row.appendChild(labelEl);
        row.append(" ");
        for (const segment of normalizeSegments(content)) {
            if (typeof segment === "string") {
                row.append(segment);
                continue;
            }
            const el = segment.strong ? document.createElement("strong") : document.createElement("span");
            el.textContent = segment.text;
            row.appendChild(el);
        }
        return row;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmV0dGVyQ3JhZnRpbmdEb20uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJCZXR0ZXJDcmFmdGluZ0RvbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7SUFXQSw0Q0FZQztJQUVELHNEQWVDO0lBRUQsNENBcUJDO0lBeERELFNBQVMsaUJBQWlCLENBQUMsT0FBMEI7UUFDakQsT0FBTyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztJQUM3RCxDQUFDO0lBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBbUIsRUFBRSxLQUFhLEVBQUUsS0FBYSxFQUFFLFdBQW1CLEVBQUUsT0FBZTtRQUNwSCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQztRQUUxQixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pELFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxTQUFTLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztRQUM5QixJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTVCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekIsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELFNBQWdCLHFCQUFxQixDQUFDLEtBQWEsRUFBRSxNQUF5QixFQUFFLFdBQW1CLEVBQUUsT0FBZTtRQUNoSCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQztRQUUxQixNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQzVCLElBQUksS0FBSyxHQUFHLENBQUM7Z0JBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVqQyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2pELFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQztZQUNwQyxTQUFTLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztZQUM5QixJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hDLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELFNBQWdCLGdCQUFnQixDQUFDLEtBQWEsRUFBRSxPQUEwQjtRQUN0RSxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsa0JBQWtCLENBQUM7UUFFbkMsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxPQUFPLENBQUMsV0FBVyxHQUFHLEdBQUcsS0FBSyxHQUFHLENBQUM7UUFDbEMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN6QixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRWhCLEtBQUssTUFBTSxPQUFPLElBQUksaUJBQWlCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUMvQyxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUM5QixHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNwQixTQUFTO1lBQ2IsQ0FBQztZQUVELE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUYsRUFBRSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQzlCLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEIsQ0FBQztRQUVELE9BQU8sR0FBRyxDQUFDO0lBQ2YsQ0FBQyJ9