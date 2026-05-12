/**
 * Procurement Reports — Tax summary, stock valuation, and CSV exports.
 *
 * Mobile-first cards and tables for accountant-friendly reporting.
 */

import { useState } from 'react';
import dayjs from 'dayjs';
import {
  FileSpreadsheet,
  FileText,
  Package,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '../../components/common';
import {
  getProcurementCsvUrl,
  getTaxCsvUrl,
  type ProcurementReport,
  type TaxSummary,
  type StockValuation,
} from '../../services/procurement';


// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YYYY');
}


// ── Props ──────────────────────────────────────────────────────────────────

interface ProcurementReportsProps {
  dateFrom: string;
  dateTo: string;
  procurementReport: ProcurementReport | null;
  taxSummary: TaxSummary | null;
  stockValuation: StockValuation | null;
  onRefresh: () => void;
}


// ── Component ──────────────────────────────────────────────────────────────

export default function ProcurementReports({
  dateFrom,
  dateTo,
  procurementReport,
  taxSummary,
  stockValuation,
}: ProcurementReportsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleCsvExport = async (url: string, label: string) => {
    setExporting(label);
    try {
      // Open in new tab to trigger download
      window.open(url, '_blank');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stock Valuation Card */}
      {stockValuation && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Items in Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockValuation.total_items}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stockValuation.total_quantity} total units
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Value at Cost</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCurrency(stockValuation.total_value_at_cost)}</div>
              <p className="text-xs text-muted-foreground mt-1">Purchase cost basis</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Value at Selling</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCurrency(stockValuation.total_value_at_selling)}</div>
              <p className="text-xs text-muted-foreground mt-1">Selling price basis</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Procurement Report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Procurement Report</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCsvExport(getProcurementCsvUrl({ date_from: dateFrom, date_to: dateTo }), 'procurement')}
              disabled={exporting === 'procurement'}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              {exporting === 'procurement' ? 'Exporting...' : 'CSV Export'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!procurementReport ? (
            <Skeleton className="h-48" />
          ) : procurementReport.rows.length === 0 ? (
            <EmptyState title="No procurement data" description="No purchase orders found for the selected period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Invoice</th>
                    <th className="pb-2 font-medium">Supplier</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Items</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Subtotal</th>
                    <th className="pb-2 font-medium text-right">Tax</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {procurementReport.rows.map((row) => (
                    <tr key={row.purchase_order_id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.invoice_number || '—'}</td>
                      <td className="py-2">{row.supplier_name}</td>
                      <td className="py-2">{fmtDate(row.invoice_date)}</td>
                      <td className="py-2 text-right">{row.item_count}</td>
                      <td className="py-2 text-right">{row.total_qty}</td>
                      <td className="py-2 text-right">{fmtCurrency(row.subtotal)}</td>
                      <td className="py-2 text-right">{fmtCurrency(row.tax_amount)}</td>
                      <td className="py-2 text-right font-medium">{fmtCurrency(row.total_amount)}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={
                          row.status === 'completed' ? 'text-green-600 border-green-200 bg-green-50' :
                          row.status === 'cancelled' ? 'text-red-600 border-red-200 bg-red-50' :
                          'text-gray-600 border-gray-200 bg-gray-50'
                        }>
                          {row.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td colSpan={5} className="py-2 text-right">Totals:</td>
                    <td className="py-2 text-right">{fmtCurrency(procurementReport.total_subtotal)}</td>
                    <td className="py-2 text-right">{fmtCurrency(procurementReport.total_tax)}</td>
                    <td className="py-2 text-right">{fmtCurrency(procurementReport.grand_total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Tax Summary (Input GST)</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCsvExport(getTaxCsvUrl({ date_from: dateFrom, date_to: dateTo }), 'tax')}
              disabled={exporting === 'tax'}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              {exporting === 'tax' ? 'Exporting...' : 'Tax CSV'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!taxSummary ? (
            <Skeleton className="h-48" />
          ) : taxSummary.rows.length === 0 ? (
            <EmptyState title="No tax data" description="No taxable purchases found for the selected period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Supplier</th>
                    <th className="pb-2 font-medium">GST</th>
                    <th className="pb-2 font-medium">Invoice</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Taxable Value</th>
                    <th className="pb-2 font-medium text-right">Input Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {taxSummary.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{row.supplier_name}</td>
                      <td className="py-2 font-mono text-xs">{row.gst_number || '—'}</td>
                      <td className="py-2">{row.invoice_number || '—'}</td>
                      <td className="py-2">{fmtDate(row.invoice_date)}</td>
                      <td className="py-2 text-right">{fmtCurrency(row.taxable_value)}</td>
                      <td className="py-2 text-right font-medium">{fmtCurrency(row.total_tax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td colSpan={4} className="py-2 text-right">Totals:</td>
                    <td className="py-2 text-right">{fmtCurrency(taxSummary.total_taxable_value)}</td>
                    <td className="py-2 text-right">{fmtCurrency(taxSummary.total_tax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document Exports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col items-center gap-1"
              onClick={() => handleCsvExport(getProcurementCsvUrl({ date_from: dateFrom, date_to: dateTo }), 'procurement')}
              disabled={exporting === 'procurement'}
            >
              <FileText className="h-6 w-6" />
              <span className="text-xs">Purchase Invoice PDF</span>
              <span className="text-[10px] text-muted-foreground">TODO — XLSX hook</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col items-center gap-1"
              onClick={() => handleCsvExport(getProcurementCsvUrl({ date_from: dateFrom, date_to: dateTo }), 'procurement')}
              disabled={exporting === 'procurement'}
            >
              <Package className="h-6 w-6" />
              <span className="text-xs">Inward Stock Summary</span>
              <span className="text-[10px] text-muted-foreground">TODO — XLSX hook</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col items-center gap-1"
              onClick={() => handleCsvExport(getTaxCsvUrl({ date_from: dateFrom, date_to: dateTo }), 'tax')}
              disabled={exporting === 'tax'}
            >
              <Wallet className="h-6 w-6" />
              <span className="text-xs">Supplier Purchase History</span>
              <span className="text-[10px] text-muted-foreground">TODO — XLSX hook</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
