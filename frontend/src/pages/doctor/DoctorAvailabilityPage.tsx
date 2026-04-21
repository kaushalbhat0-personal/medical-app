import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function DoctorAvailabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure when you accept appointments.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Manage your availability</CardTitle>
          <CardDescription>
            A calendar-based editor for weekly hours and time off will be available in a future update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For now, ask your clinic administrator if you need schedule changes reflected in the system.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
