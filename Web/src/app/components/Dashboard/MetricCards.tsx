import { Thermometer, Droplets } from "lucide-react";
import React from "react";
import { MetricCard } from "../MetricCard";
import { useGardenData } from "../../hooks/useGardenData";

const getTemperatureStatus = (temp?: number) => {
    if (!temp) return 'normal';
    if (temp > 28 || temp < 15) return 'critical';
    if (temp > 25 || temp < 18) return 'warning';
    return 'normal';
};

export default function MetricCards(){
    const { summary } = useGardenData();
    
    return(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                title="Temperature"
                value={summary?.latest.temperature?.toFixed(1) || '--'}
                unit="°C"
                icon={Thermometer}
                trend="stable"
                trendValue="±0.5°C"
                status={getTemperatureStatus(summary?.latest.temperature)}
            />
            <MetricCard
                title="Humidity"
                value={summary?.latest.humidity?.toFixed(0) || '--'}
                unit="%"
                icon={Droplets}
                trend="down"
                trendValue="2% from avg"
                status="normal"
            />
            {/* <MetricCard
                title="Light Level"
                value={summary?.latest.light_level?.toFixed(0) || '--'}
                unit="lux"
                icon={Sun}
                trend="stable"
                trendValue="Normal"
                status="normal"
            /> */}
        </div>
    )
}