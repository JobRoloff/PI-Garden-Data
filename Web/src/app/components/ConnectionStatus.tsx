import { useGardenStreamContext } from '../GardenStreamProvider';

export function ConnectionStatus() {
  const { connected, connectionStatus } = useGardenStreamContext();
  const dbOk = connectionStatus?.database_ok ?? false;

  return (
    <div className="flex items-center gap-3 text-sm" aria-live="polite">
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#626E60]' : 'bg-red-500'}`}
        title={connected ? 'WebSocket connected' : 'WebSocket disconnected'}
      />
      <span className="text-muted-foreground">
        Stream: {connected ? 'Live' : 'Disconnected'}
      </span>
      {connected && (
        <>
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${dbOk ? 'bg-[#626E60]' : 'bg-amber-500'}`}
            title={dbOk ? 'Database OK' : 'Database error'}
          />
          <span className="text-muted-foreground">DB: {dbOk ? 'OK' : 'Error'}</span>
        </>
      )}
    </div>
  );
}
