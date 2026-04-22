import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDoctorWorkspace } from '../../contexts/DoctorWorkspaceContext';

export function DoctorAvailabilityPage() {
  const { isIndependent, isReadOnly } = useDoctorWorkspace();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isReadOnly
            ? 'Your facility manages provider schedules; you do not edit them from this portal.'
            : isIndependent
              ? 'Configure when you accept appointments for your own practice.'
              : 'Configure when you accept appointments.'}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Manage your availability</CardTitle>
          <CardDescription>
            {isIndependent
              ? 'A calendar-based editor for weekly hours and time off will be available in a future update.'
              : 'Managed organization — ask your clinic administrator for schedule changes.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isIndependent
              ? 'Until then, ensure your slots can be booked by patients who use the public booking flow.'
              : 'Your organization links your profile to shared scheduling in the staff application.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
