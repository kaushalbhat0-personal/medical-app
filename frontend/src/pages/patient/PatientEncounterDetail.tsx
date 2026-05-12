/**
 * PatientEncounterDetail — patient encounter detail page.
 *
 * Shows:
 * - diagnosis
 * - treatment summary
 * - prescriptions
 * - vitals captured
 * - follow-up notes
 * - downloadable prescription PDF
 * - downloadable encounter summary PDF
 *
 * CRITICAL:
 * - SOAP internal sections are NEVER exposed
 * - Doctor-only notes are NEVER exposed
 * - Audit metadata is NEVER exposed
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ArrowLeft,
  Download,
  FileText,
  HeartPulse,
  Pill,
  Stethoscope,
  Thermometer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { encountersApi } from '../../services/appointments';
import { documentsApi } from '../../services/documents';
import type { EncounterDetailAggregate } from '../../types';
import { DISPLAY_TIMEZONE } from '../../constants/time';
import { formatAppointmentDateTimeWithZoneLabel } from '../../utils/doctorSchedule';
import { ErrorState } from '../../components/common';
import toast from 'react-hot-toast';

export function PatientEncounterDetail() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [encounter, setEncounter] = useState<EncounterDetailAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPrescription, setDownloadingPrescription] = useState(false);
  const [downloadingSummary, setDownloadingSummary] = useState(false);

  useEffect(() => {
    if (!appointmentId) {
      setError('No appointment specified.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await encountersApi.getById(appointmentId);
        if (!cancelled) setEncounter(data);
      } catch {
        if (!cancelled) setError('Unable to load encounter details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const handleDownloadPrescription = async () => {
    if (!appointmentId) return;
    setDownloadingPrescription(true);
    try {
      await documentsApi.triggerPrescriptionDownload(appointmentId);
      toast.success('Prescription downloaded');
    } catch {
      toast.error('Failed to download prescription');
    } finally {
      setDownloadingPrescription(false);
    }
  };

  const handleDownloadSummary = async () => {
    if (!appointmentId) return;
    setDownloadingSummary(true);
    try {
      await documentsApi.triggerEncounterSummaryDownload(appointmentId);
      toast.success('Encounter summary downloaded');
    } catch {
      toast.error('Failed to download encounter summary');
    } finally {
      setDownloadingSummary(false);
    }
  };

  if (error) {
    return <ErrorState title="Encounter Details" description={error} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!encounter) {
    return <ErrorState title="Not Found" description="This encounter could not be found." />;
  }

  const { appointment, doctor, vitals, prescriptions } = encounter;
  const dateLabel = appointment.appointment_time
    ? formatAppointmentDateTimeWithZoneLabel(appointment.appointment_time, DISPLAY_TIMEZONE)
    : 'Date unknown';

  return (
    <div className="space-y-6">
      {/* ── Back button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/patient/home')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to timeline
      </button>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
              <Stethoscope className="h-7 w-7 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-foreground">
                {doctor?.name || 'Doctor'}
              </h1>
              {doctor?.specialization && (
                <p className="text-sm text-muted-foreground">{doctor.specialization}</p>
              )}
              <p className="mt-1.5 text-sm font-medium text-foreground/80">{dateLabel}</p>
              <Badge
                variant={
                  appointment.status === 'completed'
                    ? 'default'
                    : appointment.status === 'cancelled'
                      ? 'destructive'
                      : 'secondary'
                }
                className="mt-2 capitalize"
              >
                {appointment.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Diagnosis ────────────────────────────────────────────────────── */}
      {appointment.diagnosis && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" aria-hidden />
              Diagnosis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {appointment.diagnosis}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Treatment Summary ────────────────────────────────────────────── */}
      {appointment.treatment_summary && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" aria-hidden />
              Treatment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {appointment.treatment_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Prescriptions ────────────────────────────────────────────────── */}
      {prescriptions && prescriptions.length > 0 && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" aria-hidden />
              Prescriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {prescriptions.map((rx) => (
                <div key={rx.id}>
                  {rx.notes && (
                    <p className="mb-2 text-sm text-muted-foreground">{rx.notes}</p>
                  )}
                  <div className="divide-y divide-border/50 rounded-xl border border-border/50">
                    {rx.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {item.medicine_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[item.dosage, item.frequency, item.duration]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        {item.instructions && (
                          <p className="text-xs text-muted-foreground/70 italic">
                            {item.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Vitals ────────────────────────────────────────────────────────── */}
      {vitals && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-primary" aria-hidden />
              Vitals Captured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {vitals.bp_systolic != null && vitals.bp_diastolic != null && (
                <div className="rounded-xl bg-muted/30 px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Blood Pressure
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {vitals.bp_systolic}/{vitals.bp_diastolic}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">mmHg</span>
                  </p>
                </div>
              )}
              {vitals.pulse != null && (
                <div className="rounded-xl bg-muted/30 px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pulse
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {vitals.pulse}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">bpm</span>
                  </p>
                </div>
              )}
              {vitals.temperature != null && (
                <div className="rounded-xl bg-muted/30 px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Temperature
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {vitals.temperature}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">°F</span>
                  </p>
                </div>
              )}
              {vitals.spo2 != null && (
                <div className="rounded-xl bg-muted/30 px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    SpO₂
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {vitals.spo2}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">%</span>
                  </p>
                </div>
              )}
              {vitals.weight != null && (
                <div className="rounded-xl bg-muted/30 px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Weight
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {vitals.weight}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">kg</span>
                  </p>
                </div>
              )}
              {vitals.bmi != null && (
                <div className="rounded-xl bg-muted/30 px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    BMI
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {vitals.bmi}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">kg/m²</span>
                  </p>
                </div>
              )}
            </div>
            {vitals.notes && (
              <p className="mt-3 text-xs text-muted-foreground">{vitals.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Follow-up ────────────────────────────────────────────────────── */}
      {appointment.follow_up_date && (
        <Card className="rounded-2xl border-amber-200/60 bg-amber-50/30 shadow-sm dark:border-amber-800/30 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <FileText className="h-4 w-4" aria-hidden />
              Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground">
              {dayjs(appointment.follow_up_date).format('MMMM D, YYYY')}
            </p>
            {appointment.follow_up_notes && (
              <p className="mt-1 text-sm text-muted-foreground">
                {appointment.follow_up_notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Download buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {prescriptions && prescriptions.length > 0 && (
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={handleDownloadPrescription}
            disabled={downloadingPrescription}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            {downloadingPrescription ? 'Downloading…' : 'Download Prescription PDF'}
          </Button>
        )}
        {appointment.status === 'completed' && (
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={handleDownloadSummary}
            disabled={downloadingSummary}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            {downloadingSummary ? 'Downloading…' : 'Download Encounter Summary PDF'}
          </Button>
        )}
      </div>
    </div>
  );
}
