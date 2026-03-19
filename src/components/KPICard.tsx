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
    <Card className="relative overflow-hidden bg-zinc-900/40 border-zinc-800/60 backdrop-blur-xl transition-all duration-500 hover:bg-zinc-800/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-zinc-700/60 group">
      {/* Subtle top edge highlight that appears on hover */}
      <div className="absolute inset-x-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors duration-300">{title}</CardTitle>
        {icon && (
          <div className="p-2 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-lg text-emerald-400 border border-emerald-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500 ease-out">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
          {period && <span className="text-xs text-zinc-500 font-medium">{period}</span>}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1.5 mt-3 bg-zinc-950/30 w-fit px-2 py-1 rounded-md border border-zinc-800/50">
            {change >= 0 ? (
              <ArrowUpIcon className="w-3 h-3 text-emerald-500" />
            ) : (
              <ArrowDownIcon className="w-3 h-3 text-red-500" />
            )}
            <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-xs text-zinc-500">vs. ant.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

