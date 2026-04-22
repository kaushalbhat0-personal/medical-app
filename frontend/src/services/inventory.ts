import { api, retryRequest } from './api';

export type InventoryItemType = 'medicine' | 'consumable';

export interface InventoryItemDTO {
  id: string;
  tenant_id: string;
  name: string;
  type: InventoryItemType;
  unit: string;
  cost_price: number;
  selling_price: number;
  is_active: boolean;
  created_at: string;
}

export interface InventoryItemCreatePayload {
  name: string;
  type: InventoryItemType;
  unit: string;
  cost_price: number;
  selling_price: number;
  is_active?: boolean;
}

export interface StockOperationResultDTO {
  item_id: string;
  doctor_id: string | null;
  quantity: number;
  movement_id: string;
}

export const inventoryApi = {
  listItems(params?: { skip?: number; limit?: number; active_only?: boolean }) {
    return retryRequest(() =>
      api.get<InventoryItemDTO[]>('/inventory/items', {
        params: { limit: 200, ...params },
      })
    ).then((r) => r.data);
  },

  /** Single bulk fetch; merge with items on the client. */
  getBulkStockMap(doctorId?: string | null) {
    const params: Record<string, unknown> = { as_map: true };
    if (doctorId) params.doctor_id = doctorId;
    return retryRequest(() => api.get<Record<string, number>>('/inventory/stock/bulk', { params })).then(
      (r) => r.data
    );
  },

  addStock(body: { item_id: string; quantity: number; doctor_id?: string | null }) {
    return api.post<StockOperationResultDTO>('/inventory/stock/add', body).then((r) => r.data);
  },

  adjustStock(body: { item_id: string; quantity: number; doctor_id?: string | null }) {
    return api.post<StockOperationResultDTO>('/inventory/stock/adjust', body).then((r) => r.data);
  },

  createItem(body: InventoryItemCreatePayload) {
    return api.post<InventoryItemDTO>('/inventory/items', body).then((r) => r.data);
  },
};
