/**
 * PatientHealthTimeline — timeline-first patient experience.
 *
 * Each encounter card shows:
 * - doctor
 * - clinic
 * - date/time
 * - diagnosis summary
 * - treatment summary
 * - medicines prescribed
 * - follow-up recommendation
 * - downloadable documents
 *
 * Timeline feels:
 * - reassuring
 * - readable
 * - mobile-first
 * - chronological
 *
 * NOT enterprise/admin-like.
 *
 * CRITICAL:
 * - SOAP internal sections are NEVER exposed
 * - Doctor-only notes are NEVER exposed
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { HeartPulse } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TimelineEncounterCard } from '../../components/patient/TimelineEncounterCard';
import { patientWorkspaceApi } from '../../services/patientWorkspace';
import type { EncounterCard } from '../../types';
import { ErrorState } from '../../components/common';

export function PatientHealthTimeline() {
  const [encounters, setEncounters] = useState<EncounterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEncounters = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await patientWorkspaceApi.getEncounters({ limit: 100 });
      setEncounters(data);
    } catch {
      setError('Unable to load your health timeline. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEncounters();
  }, [loadEncounters]);

  // Group encounters by month/year
  const groupedEncounters = useMemo(() => {
    const groups: Map<string, EncounterCard[]> = new Map();

    for (const enc of encounters) {
      const monthKey = enc.appointment_time
        ? dayjs(enc.appointment_time).format('YYYY-MM')
        : 'Unknown';

      if (!groups.has(monthKey)) {
        groups.set(monthKey, []);
      }
      groups.get(monthKey)!.push(enc);
    }

    // Sort groups by month (newest first)
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));

    return sorted.map(([key, items]) => ({
      key,
      label: items[0]?.appointment_time
        ? dayjs(items[0].appointment_time).format('MMMM YYYY')
        : 'Unknown',
      items,
    }));
  }, [encounters]);

  if (error) {
    return <ErrorState title="Health Timeline" description={error} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Your Health Timeline
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          A chronological record of your visits and care.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 rounded-2xl bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded-md bg-muted animate-pulse" />
                    <div className="h-3 w-28 rounded-md bg-muted animate-pulse" />
                  </div>
                </div>
                <div className="mt-3 h-16 rounded-xl bg-muted/40 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : encounters.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <HeartPulse className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-lg pt-3">No visits yet</CardTitle>
            <CardDescription className="max-w-sm mx-auto">
              Your health timeline will start filling up after your first visit with a doctor.
              Each visit will appear here as a complete record of your care.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedEncounters.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur-md sm:mx-0 sm:px-0">
                <h2 className="text-lg font-semibold text-foreground">
                  {group.label}
                </h2>
                <div className="mt-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
              </div>
              <div className="space-y-4">
                {group.items.map((enc) => (
                  <TimelineEncounterCard key={enc.appointment_id} encounter={enc} />
                ))}
              </div>
            </div>
          ))}

          {encounters.length >= 100 && (
            <p className="text-center text-xs text-muted-foreground">
              Showing the most recent 100 visits.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
