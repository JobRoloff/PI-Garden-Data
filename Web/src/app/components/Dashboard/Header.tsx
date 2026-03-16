import React from "react";
import { ConnectionStatus } from "../ConnectionStatus";
import { useGardenData } from "../../hooks/useGardenData";

import { Badge } from "../../components/ui/badge";
import { Activity, RefreshCw } from "lucide-react";

export default function Header() {
  const { summary, connected } = useGardenData();
  const lastUpdate = summary?.ts ? new Date(summary.ts) : new Date();

  return (
    <div className="flex items-center justify-between">
        <h1>Greenhouse Data</h1>
      <div className="flex items-center gap-4">
        <ConnectionStatus />
        {connected && (
          <Badge variant="outline" className="gap-2">
            <Activity className="h-4 w-4 text-[#626E60]" />
            <span>Live</span>
          </Badge>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          <span>Updated {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
