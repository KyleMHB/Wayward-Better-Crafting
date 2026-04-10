export type TextSegment = string | {
    text: string;
    strong?: boolean;
};

export type HelpBoxRowContent = string | readonly TextSegment[];

function normalizeSegments(content: HelpBoxRowContent): readonly TextSegment[] {
    return typeof content === "string" ? [content] : content;
}

export function appendInlineStat(parent: HTMLElement, label: string, value: string, accentColor: string, cssText: string): HTMLSpanElement {
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

export function createColoredListLine(label: string, values: readonly string[], accentColor: string, cssText: string): HTMLDivElement {
    const line = document.createElement("div");
    line.style.cssText = cssText;
    line.append(`${label}: `);

    values.forEach((value, index) => {
        if (index > 0) line.append(", ");

        const valueSpan = document.createElement("span");
        valueSpan.style.color = accentColor;
        valueSpan.textContent = value;
        line.appendChild(valueSpan);
    });

    return line;
}

export function createHelpBoxRow(label: string, content: HelpBoxRowContent): HTMLDivElement {
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
