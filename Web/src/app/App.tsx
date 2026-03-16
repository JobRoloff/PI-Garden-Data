import { Thermometer, Droplets} from 'lucide-react';
import { MetricCard } from './components/MetricCard';
import { SensorChart } from './components/SensorChart';
import { ActuatorChanges } from './components/ActuatorChanges';
import { EventFeed } from './components/EventFeed';
import { useGardenData } from './hooks/useGardenData';
import React from 'react';
import Header from './components/Dashboard/Header';
import SystemInfo from './components/Dashboard/SystemInfo';
import Charts from './components/Dashboard/Charts';

function App() {
  const {
    summary,

  } = useGardenData();



  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header/>


        <Charts/>
        {/* Event feed & actuators from WebSocket */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EventFeed />
          <ActuatorChanges />
        </div> */}

        {/* Control Status */}
        {summary?.control && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="mb-4">Control Systems</h3>
            <div className="flex gap-6">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    summary.control.humidifier_status ? 'bg-[#626E60]' : 'bg-gray-300'
                  }`}
                />
                <span>Humidifier {summary.control.humidifier_status ? 'On' : 'Off'}</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    summary.control.fan_status ? 'bg-[#626E60]' : 'bg-gray-300'
                  }`}
                />
                <span>Fan {summary.control.fan_status ? 'On' : 'Off'}</span>
              </div>
            </div>
          </div>
        )}

        <SystemInfo/>
        </div>
    </div>
  );
}

export default App;
