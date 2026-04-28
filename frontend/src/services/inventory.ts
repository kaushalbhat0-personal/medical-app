import { api, retryRequest } from './api';

export type InventoryItemType = 'medicine' | 'consumable' | 'equipment';

export interface InventoryItemDTO {
  id: string;
  tenant_id: string;
  name: string;
  type: InventoryItemType;
  unit: string;
  cost_price: number;
  selling_price: number;
  is_active: boolean;
  /** Server-side threshold for low-stock warnings */
  low_stock_threshold?: number | null;
  created_at: string;
}

export interface InventoryItemWithStockDTO extends InventoryItemDTO {
  quantity_available: number;
}

export interface InventoryItemCreatePayload {
  name: string;
  type: InventoryItemType;
  unit: string;
  cost_price: number;
  selling_price: number;
  is_active?: boolean;
  low_stock_threshold?: number | null;
}

export interface StockOperationResultDTO {
  item_id: string;
  doctor_id: string | null;
  quantity: number;
  movement_id: string;
}

export const inventoryApi = {
  /** Items with clinic (tenant) stock counts — for doctor read-only list. */
  listWithStock(params?: { skip?: number; limit?: number; active_only?: boolean; search?: string }) {
    return retryRequest(() =>
      api.get<InventoryItemWithStockDTO[]>('/inventory', {
        params: { limit: 200, ...params },
      })
    ).then((r) => r.data);
  },

  listItems(params?: { skip?: number; limit?: number; active_only?: boolean }) {
    return retryRequest(() =>
      api.get<InventoryItemDTO[]>('/inventory/items', {
        params: { limit: 200, ...params },
      })
    ).then((r) => r.data);
  },

  /** Single bulk fetch; merge with items on the client. */
  getBulkStockMap(doctorId?: string | null, tenantStockOnly?: boolean) {
    const params: Record<string, unknown> = { as_map: true };
    if (doctorId) params.doctor_id = doctorId;
    if (tenantStockOnly) params.tenant_stock_only = true;
    return retryRequest(() => api.get<Record<string, number>>('/inventory/stock/bulk', { params })).then(
      (r) => r.data
    );
  },

  /**
   * Legacy admin-only manual debit (doctors use POST /appointments/:id/mark-completed).
   */
  consumeForAppointment(body: { appointment_id: string; items: { item_id: string; quantity: number }[] }) {
    return api.post<{ ok: boolean; appointment_id: string }>('/inventory/use', body).then((r) => r.data);
  },

  addStockAdmin(body: { item_id: string; quantity: number }) {
    return api.post<StockOperationResultDTO>('/inventory/add', body).then((r) => r.data);
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
