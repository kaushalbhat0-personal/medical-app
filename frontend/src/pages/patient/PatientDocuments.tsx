/**
 * PatientDocuments — document center for the patient workspace.
 *
 * Integrates document generation APIs.
 * Patient can:
 * - download prescription
 * - download encounter summary
 * - download invoices/statements
 *
 * Uses tenant branding automatically.
 */

import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Download,
  FileText,
  FileWarning,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { patientWorkspaceApi } from '../../services/patientWorkspace';
import { documentsApi } from '../../services/documents';
import type { DocumentRef } from '../../types';
import { ErrorState } from '../../components/common';
import toast from 'react-hot-toast';

export function PatientDocuments() {
  const [documents, setDocuments] = useState<DocumentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const loadDocuments = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const workspace = await patientWorkspaceApi.getWorkspace();
      setDocuments(workspace.recent_documents);
    } catch {
      setError('Unable to load your documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleDownload = async (doc: DocumentRef) => {
    const key = `${doc.appointment_id}-${doc.document_type}`;
    setDownloading((prev) => ({ ...prev, [key]: true }));
    try {
      if (doc.document_type === 'prescription') {
        await documentsApi.triggerPrescriptionDownload(doc.appointment_id);
      } else if (doc.document_type === 'encounter_summary') {
        await documentsApi.triggerEncounterSummaryDownload(doc.appointment_id);
      } else if (doc.document_type === 'invoice') {
        await documentsApi.triggerInvoiceDownload(doc.appointment_id);
      }
      toast.success(`${doc.document_type.replace('_', ' ')} downloaded`);
    } catch {
      toast.error(`Failed to download ${doc.document_type.replace('_', ' ')}`);
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'encounter_summary':
        return <FileWarning className="h-5 w-5 text-emerald-500" />;
      case 'invoice':
        return <Receipt className="h-5 w-5 text-amber-500" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'prescription':
        return 'Prescription';
      case 'encounter_summary':
        return 'Encounter Summary';
      case 'invoice':
        return 'Invoice / Statement';
      default:
        return type.replace('_', ' ');
    }
  };

  if (error) {
    return <ErrorState title="Documents" description={error} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download your medical records and documents.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-lg pt-3">No documents yet</CardTitle>
            <CardDescription className="max-w-sm mx-auto">
              After your first visit, you'll be able to download prescriptions,
              encounter summaries, and invoices here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, idx) => {
            const key = `${doc.appointment_id}-${doc.document_type}`;
            return (
              <Card
                key={`${key}-${idx}`}
                className="rounded-2xl border-border/60 shadow-sm transition hover:shadow-md"
              >
                <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50">
                    {getIcon(doc.document_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground capitalize">
                      {getTypeLabel(doc.document_type)}
                    </p>
                    {doc.doctor_name && (
                      <p className="text-xs text-muted-foreground">
                        {doc.doctor_name}
                      </p>
                    )}
                    {doc.appointment_time && (
                      <p className="text-xs text-muted-foreground/60">
                        {dayjs(doc.appointment_time).format('MMM D, YYYY')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-xl"
                    onClick={() => handleDownload(doc)}
                    disabled={downloading[key]}
                  >
                    <Download className="mr-1.5 h-4 w-4" aria-hidden />
                    {downloading[key] ? '…' : 'Download'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
