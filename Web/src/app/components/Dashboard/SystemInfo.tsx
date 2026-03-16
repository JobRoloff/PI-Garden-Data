import React from "react";
import { useGardenData } from "../../hooks/useGardenData";

export default function SystemInfo(){
    const {
        summary
      } = useGardenData();
    return (
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm text-muted-foreground mb-2">MQTT Topic</h4>
            <p className="font-mono text-sm">{summary?.topic || 'garden/sensors/main'}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm text-muted-foreground mb-2">Sample Count</h4>
            <p className="font-mono text-sm">{summary?.sample_count || 0} samples/hour</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm text-muted-foreground mb-2">Report Interval</h4>
            <p className="font-mono text-sm">{summary?.dt_sec || 60}s</p>
          </div>
        </div>

    )
}