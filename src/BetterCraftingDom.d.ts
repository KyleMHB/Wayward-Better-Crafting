export type TextSegment = string | {
    text: string;
    strong?: boolean;
};
export type HelpBoxRowContent = string | readonly TextSegment[];
export declare function appendInlineStat(parent: HTMLElement, label: string, value: string, accentColor: string, cssText: string): HTMLSpanElement;
export declare function createColoredListLine(label: string, values: readonly string[], accentColor: string, cssText: string): HTMLDivElement;
export declare function createHelpBoxRow(label: string, content: HelpBoxRowContent): HTMLDivElement;
