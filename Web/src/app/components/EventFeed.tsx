import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useGardenData } from '../hooks/useGardenData';

export function EventFeed() {
  const { connected, eventFeed } = useGardenData();

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent event feed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Connect to stream to see events.</p>
        </CardContent>
      </Card>
    );
  }

  if (eventFeed.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent event feed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No events yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent event feed</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 max-h-48 overflow-y-auto text-sm font-mono">
          {eventFeed.slice(0, 30).map((evt, i) => (
            <li key={`${evt.ts}-${i}`} className="flex gap-2 flex-wrap">
              <span className="text-muted-foreground shrink-0">
                {evt.ts != null ? String(evt.ts).slice(0, 19) : '—'}
              </span>
              <span className="text-muted-foreground">{String(evt.kind ?? 'summary')}</span>
              <span>{evt.topic != null ? String(evt.topic) : ''}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
