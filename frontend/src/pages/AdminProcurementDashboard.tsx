/**
 * Admin Procurement Dashboard — Phase 4 Procurement Foundation.
 *
 * Tab-based dashboard with:
 * - Supplier Management
 * - Purchase Entry
 * - Procurement Reports
 * - Tax Summary
 * - Stock Valuation
 *
 * Mobile-first with cards, tables, and export buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  BarChart3,
  Filter,
  Package,
  Plus,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '../components/common';
import {
  listSuppliers,
  listPurchaseOrders,
  getProcurementReport,
  getTaxSummary,
  getStockValuation,
  getInwardOutwardValuation,
  type Supplier,
  type PurchaseOrder,
  type ProcurementReport,
  type TaxSummary,
  type StockValuation,
  type InwardOutwardValuation,
} from '../services/procurement';
import SupplierManagement from './procurement/SupplierManagement';
import PurchaseEntryModal from './procurement/PurchaseEntryModal';
import ProcurementReports from './procurement/ProcurementReports';


// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YYYY');
}

function statusBadge(status: string): React.ReactNode {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status.toUpperCase()}
    </span>
  );
}

function paymentBadge(status: string): React.ReactNode {
  const map: Record<string, string> = {
    unpaid: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-blue-100 text-blue-700',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status.toUpperCase()}
    </span>
  );
}


// ── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}


// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function AdminProcurementDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [procurementReport, setProcurementReport] = useState<ProcurementReport | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [stockValuation, setStockValuation] = useState<StockValuation | null>(null);
  const [inwardOutward, setInwardOutward] = useState<InwardOutwardValuation | null>(null);

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [supRes, poRes, reportRes, taxRes, valRes, ioRes] = await Promise.all([
        listSuppliers({ limit: 5 }),
        listPurchaseOrders({ limit: 10 }),
        getProcurementReport({ date_from: dateFrom, date_to: dateTo }),
        getTaxSummary({ date_from: dateFrom, date_to: dateTo }),
        getStockValuation(),
        getInwardOutwardValuation({ date_from: dateFrom, date_to: dateTo }),
      ]);
      setSuppliers(supRes.suppliers);
      setPurchaseOrders(poRes.purchase_orders);
      setProcurementReport(reportRes);
      setTaxSummary(taxRes);
      setStockValuation(valRes);
      setInwardOutward(ioRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load procurement data');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Overview Tab ──────────────────────────────────────────────────────

  const renderOverview = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      );
    }

    if (error) return <ErrorState title="Failed to load" description={error} onRetry={fetchData} />;

    const totalPurchases = procurementReport?.grand_total ?? 0;
    const totalTax = procurementReport?.total_tax ?? 0;
    const stockValue = stockValuation?.total_value_at_cost ?? 0;
    const supplierCount = suppliers.length;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Purchases"
            value={fmtCurrency(totalPurchases)}
            subtitle={`${dateFrom} to ${dateTo}`}
            icon={ShoppingCart}
          />
          <SummaryCard
            title="Input Tax (GST)"
            value={fmtCurrency(totalTax)}
            subtitle="Claimable input tax credit"
            icon={Wallet}
          />
          <SummaryCard
            title="Stock Value (Cost)"
            value={fmtCurrency(stockValue)}
            subtitle={`${stockValuation?.total_quantity ?? 0} units across ${stockValuation?.total_items ?? 0} items`}
            icon={Package}
          />
          <SummaryCard
            title="Active Suppliers"
            value={String(supplierCount)}
            subtitle="Registered vendors"
            icon={Users}
          />
        </div>

        {/* Recent Purchase Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Purchase Orders</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveTab('reports')}>
                <BarChart3 className="h-4 w-4 mr-1" /> Reports
              </Button>
              <Button size="sm" onClick={() => setShowPurchaseModal(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Purchase
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {purchaseOrders.length === 0 ? (
              <EmptyState title="No purchase orders" description="Create your first purchase entry to get started." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Invoice</th>
                      <th className="pb-2 font-medium">Supplier</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{po.invoice_number || '—'}</td>
                        <td className="py-2">{po.supplier_name || '—'}</td>
                        <td className="py-2">{fmtDate(po.invoice_date)}</td>
                        <td className="py-2 text-right font-medium">{fmtCurrency(po.total_amount)}</td>
                        <td className="py-2">{statusBadge(po.status)}</td>
                        <td className="py-2">{paymentBadge(po.payment_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inward vs Outward Summary */}
        {inwardOutward && inwardOutward.rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock Movement (Inward vs Outward)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Period</th>
                      <th className="pb-2 font-medium text-right">Inward Qty</th>
                      <th className="pb-2 font-medium text-right">Inward Value</th>
                      <th className="pb-2 font-medium text-right">Outward Qty</th>
                      <th className="pb-2 font-medium text-right">Outward Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inwardOutward.rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2">{row.period}</td>
                        <td className="py-2 text-right">{row.inward_qty}</td>
                        <td className="py-2 text-right">{fmtCurrency(row.inward_value)}</td>
                        <td className="py-2 text-right">{row.outward_qty}</td>
                        <td className="py-2 text-right">{fmtCurrency(row.outward_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procurement Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Supplier management, purchase accounting, and tax-ready exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div>
              <Label htmlFor="df" className="text-xs">From</Label>
              <Input
                id="df"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="dt" className="text-xs">To</Label>
              <Input
                id="dt"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <Filter className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="reports">Reports & Tax</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SupplierManagement />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <ProcurementReports
            dateFrom={dateFrom}
            dateTo={dateTo}
            procurementReport={procurementReport}
            taxSummary={taxSummary}
            stockValuation={stockValuation}
            onRefresh={fetchData}
          />
        </TabsContent>
      </Tabs>

      {/* Purchase Entry Modal */}
      {showPurchaseModal && (
        <PurchaseEntryModal
          onClose={() => setShowPurchaseModal(false)}
          onSuccess={() => {
            setShowPurchaseModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
