export interface InventoryProvider {
  id: string;
  name: string;
  normalizedName?: string;
  createdAt?: string;
  createdBy?: string;
  isDeleted?: boolean;
}
