/**
 * TimelineEncounterCard — patient-safe encounter card for the health timeline.
 *
 * CRITICAL:
 * - SOAP internal sections are NEVER exposed
 * - Doctor-only notes are NEVER exposed
 * - Audit metadata is NEVER exposed
 *
 * Design: calm, readable, mobile-first, app-like (NOT enterprise/admin)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Pill,
  Stethoscope,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { documentsApi } from '../../services/documents';
import type { EncounterCard as EncounterCardType } from '../../types';
import { DISPLAY_TIMEZONE } from '../../constants/time';
import { formatAppointmentDateTimeWithZoneLabel } from '../../utils/doctorSchedule';
import toast from 'react-hot-toast';

interface TimelineEncounterCardProps {
  encounter: EncounterCardType;
}

export function TimelineEncounterCard({ encounter }: TimelineEncounterCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [downloadingPrescription, setDownloadingPrescription] = useState(false);
  const [downloadingSummary, setDownloadingSummary] = useState(false);

  const dateLabel = encounter.appointment_time
    ? formatAppointmentDateTimeWithZoneLabel(
        encounter.appointment_time,
        DISPLAY_TIMEZONE
      )
    : 'Date unknown';

  const statusVariant =
    encounter.status === 'completed'
      ? 'default'
      : encounter.status === 'cancelled'
        ? 'destructive'
        : 'secondary';

  const handleCardClick = () => {
    navigate(`/patient/encounters/${encounter.appointment_id}`);
  };

  const handleDownloadPrescription = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingPrescription(true);
    try {
      await documentsApi.triggerPrescriptionDownload(encounter.appointment_id);
      toast.success('Prescription downloaded');
    } catch {
      toast.error('Failed to download prescription');
    } finally {
      setDownloadingPrescription(false);
    }
  };

  const handleDownloadSummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingSummary(true);
    try {
      await documentsApi.triggerEncounterSummaryDownload(encounter.appointment_id);
      toast.success('Encounter summary downloaded');
    } catch {
      toast.error('Failed to download encounter summary');
    } finally {
      setDownloadingSummary(false);
    }
  };

  return (
    <Card
      className="group cursor-pointer rounded-2xl border border-border/60 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
      onClick={handleCardClick}
    >
      <CardContent className="p-4 sm:p-5">
        {/* ── Header: Doctor + Clinic + Date ─────────────────────────────── */}
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <Stethoscope className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {encounter.doctor_name}
                </h3>
                {encounter.clinic_name && (
                  <p className="truncate text-sm text-muted-foreground">
                    {encounter.clinic_name}
                  </p>
                )}
                {encounter.doctor_specialization && (
                  <p className="truncate text-xs text-muted-foreground/70">
                    {encounter.doctor_specialization}
                  </p>
                )}
              </div>
              <Badge
                variant={statusVariant}
                className="shrink-0 capitalize"
              >
                {encounter.status}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm font-medium text-foreground/80">
              {dateLabel}
            </p>
          </div>
        </div>

        {/* ── Diagnosis (collapsible if long) ────────────────────────────── */}
        {encounter.diagnosis && (
          <div className="mt-3 rounded-xl bg-muted/40 px-3.5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Diagnosis
            </p>
            <p className="mt-0.5 text-sm text-foreground">
              {expanded || encounter.diagnosis.length <= 120
                ? encounter.diagnosis
                : `${encounter.diagnosis.slice(0, 120)}…`}
            </p>
            {encounter.diagnosis.length > 120 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Read more <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* ── Treatment Summary ──────────────────────────────────────────── */}
        {encounter.treatment_summary && (
          <div className="mt-2 rounded-xl bg-muted/30 px-3.5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Treatment
            </p>
            <p className="mt-0.5 text-sm text-foreground">
              {encounter.treatment_summary.length <= 150
                ? encounter.treatment_summary
                : `${encounter.treatment_summary.slice(0, 150)}…`}
            </p>
          </div>
        )}

        {/* ── Medicines prescribed ───────────────────────────────────────── */}
        {encounter.prescriptions_count > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-blue-50/60 px-3.5 py-2 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
            <Pill className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              {encounter.prescriptions_count}{' '}
              {encounter.prescriptions_count === 1 ? 'medicine' : 'medicines'}{' '}
              prescribed
            </span>
          </div>
        )}

        {/* ── Follow-up badge ────────────────────────────────────────────── */}
        {encounter.follow_up_date && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50/60 px-3.5 py-2 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Follow-up:{' '}
              {dayjs(encounter.follow_up_date).format('MMM D, YYYY')}
              {encounter.follow_up_notes && ` — ${encounter.follow_up_notes}`}
            </span>
          </div>
        )}

        {/* ── Download buttons ───────────────────────────────────────────── */}
        <div
          className={cn(
            'mt-3 flex flex-wrap items-center gap-2',
            'opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100'
          )}
        >
          {encounter.has_prescription && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={handleDownloadPrescription}
              disabled={downloadingPrescription}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {downloadingPrescription ? 'Downloading…' : 'Prescription PDF'}
            </Button>
          )}
          {encounter.has_encounter_summary && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={handleDownloadSummary}
              disabled={downloadingSummary}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {downloadingSummary ? 'Downloading…' : 'Summary PDF'}
            </Button>
          )}
        </div>

        {/* ── View details link ──────────────────────────────────────────── */}
        <div className="mt-3 flex justify-end">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            View details
            <ChevronDown className="h-3 w-3 -rotate-90" aria-hidden />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
