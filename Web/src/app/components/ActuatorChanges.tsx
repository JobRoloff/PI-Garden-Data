import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useGardenData } from '../hooks/useGardenData';
import React from 'react';

export function ActuatorChanges() {
  const { connected, actuatorChanges } = useGardenData();

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actuator changes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Connect to stream to see actuator events.</p>
        </CardContent>
      </Card>
    );
  }

  if (actuatorChanges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actuator changes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No actuator events yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actuator changes</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {actuatorChanges.slice(0, 20).map((event, index) => (
            <li key={`${event.ts}-${event.actuator_id ?? index}`} className="flex gap-2 text-sm font-mono">
              <span className="text-muted-foreground">{String(event.ts ?? '—').slice(0, 19)}</span>
              <span>{String(event.actuator_id ?? '—')}</span>
              <span>{String(event.value ?? '—')}</span>
              {event.reason != null && (
                <span className="text-muted-foreground">{String(event.reason)}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
