import type { ItemType } from "@wayward/game/game/item/IItem";
export type BetterCraftingRequestKind = "craft" | "bulkCraft" | "dismantle";
export type BetterCraftingSelectionFailureReason = "missingSelection" | "itemUnavailable" | "itemProtected" | "duplicateSelection" | "baseUnavailable" | "pinnedToolUnavailable";
export interface ISelectionFailureDetails {
    reason: BetterCraftingSelectionFailureReason;
    slotIndex?: number;
    itemTypeOrGroup?: number;
    requestedItemIds?: number[];
    candidateItemIds?: number[];
}
export interface ISelectionSlotIds {
    slotIndex: number;
    itemIds: number[];
}
export interface ICraftSelectionRequest {
    requestId: number;
    itemType: ItemType;
    slotSelections: ISelectionSlotIds[];
    baseItemId?: number;
}
export interface IBulkCraftRequest {
    requestId: number;
    itemType: ItemType;
    quantity: number;
    excludedIds: number[];
    pinnedToolSelections: ISelectionSlotIds[];
    pinnedUsedSelections: ISelectionSlotIds[];
    unsafeCrafting: boolean;
}
export interface IDismantleRequest {
    requestId: number;
    itemType: ItemType;
    targetItemIds: number[];
    requiredItemId?: number;
}
export interface ICraftApprovalResponse {
    requestId: number;
    kind: BetterCraftingRequestKind;
    approved: boolean;
    passCount?: number;
    message?: string;
    selectionFailure?: ISelectionFailureDetails;
}
export interface IBulkActionAbortRequest {
    requestId: number;
}
export interface IBetterCraftingRequestStatus {
    requestId: number;
    kind: BetterCraftingRequestKind;
    state: "progress" | "complete" | "error";
    current?: number;
    total?: number;
    verb?: string;
    message?: string;
    selectionFailure?: ISelectionFailureDetails;
}
