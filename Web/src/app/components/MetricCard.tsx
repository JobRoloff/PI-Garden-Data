import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'normal' | 'warning' | 'critical';
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  status = 'normal',
}: MetricCardProps) {
  const statusColors = {
    normal: 'bg-[#626E60]',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  const trendColors = {
    up: 'text-red-500',
    down: 'text-blue-500',
    stable: 'text-gray-500',
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{value}</span>
              {unit && <span className="text-lg text-muted-foreground">{unit}</span>}
            </div>
            {trend && trendValue && (
              <p className={`text-sm mt-2 ${trendColors[trend]}`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
              </p>
            )}
          </div>
          <div className={`${statusColors[status]} p-3 rounded-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
