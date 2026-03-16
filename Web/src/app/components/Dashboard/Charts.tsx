import React from "react";
import { useGardenData } from "../../hooks/useGardenData";
import { SensorChart } from "../SensorChart";
import { LightChart } from "../LightChart";

export default function Charts(){
    const {
        temperaturePoints,
        humidityPoints,
        lightSpectrumPoints
      } = useGardenData();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SensorChart
                title="Temperature"
                data={temperaturePoints}
                unit="°C"
            />
            <SensorChart
                title="Humidity"
                data={humidityPoints}
                unit="%"
            />
            <LightChart
                title="Light Spectrum"
                data={lightSpectrumPoints}
            />
        </div>
    )
}