import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  period?: string;
  icon?: React.ReactNode;
}

export const KPICard = ({ title, value, change, period, icon }: KPICardProps) => {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-zinc-400">{title}</CardTitle>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl text-white">{value}</div>
          {period && <span className="text-xs text-zinc-500">{period}</span>}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {change >= 0 ? (
              <ArrowUpIcon className="w-3 h-3 text-emerald-500" />
            ) : (
              <ArrowDownIcon className="w-3 h-3 text-red-500" />
            )}
            <span className={`text-xs ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {Math.abs(change)}%
            </span>
            <span className="text-xs text-zinc-500">vs. período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
