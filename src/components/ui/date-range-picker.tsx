'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';

import { cn } from './utils';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Input } from './input';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear?: () => void;
  className?: string;
  showTime?: boolean;
}

interface PresetRange {
  label: string;
  getValue: () => { from: Date; to: Date };
}

const presetRanges: PresetRange[] = [
  {
    label: 'Hoje',
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    label: 'Ontem',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    },
  },
  {
    label: 'Esta semana',
    getValue: () => {
      const today = new Date();
      return { from: startOfWeek(today, { weekStartsOn: 0 }), to: endOfWeek(today, { weekStartsOn: 0 }) };
    },
  },
  {
    label: 'Semana passada',
    getValue: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return { from: startOfWeek(lastWeek, { weekStartsOn: 0 }), to: endOfWeek(lastWeek, { weekStartsOn: 0 }) };
    },
  },
  {
    label: 'Este mês',
    getValue: () => {
      const today = new Date();
      return { from: startOfMonth(today), to: endOfMonth(today) };
    },
  },
  {
    label: 'Mês passado',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    },
  },
  {
    label: 'Este trimestre',
    getValue: () => {
      const today = new Date();
      return { from: startOfQuarter(today), to: endOfQuarter(today) };
    },
  },
  {
    label: 'Trimestre passado',
    getValue: () => {
      const lastQuarter = subQuarters(new Date(), 1);
      return { from: startOfQuarter(lastQuarter), to: endOfQuarter(lastQuarter) };
    },
  },
];

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  className,
  showTime = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customDays, setCustomDays] = useState<string>('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(new Date());

  // Parse dates from string
  const parseDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
  };

  const selectedRange: DateRange | undefined = {
    from: parseDate(startDate),
    to: parseDate(endDate),
  };

  // Handle date range selection
  const handleSelect = (range: DateRange | undefined) => {
    setSelectedPreset(null);
    if (range?.from) {
      onStartDateChange(format(range.from, 'yyyy-MM-dd'));
    }
    if (range?.to) {
      onEndDateChange(format(range.to, 'yyyy-MM-dd'));
    } else if (range?.from && !range?.to) {
      onEndDateChange('');
    }
  };

  // Handle preset selection
  const handlePresetClick = (preset: PresetRange) => {
    const { from, to } = preset.getValue();
    setSelectedPreset(preset.label);
    onStartDateChange(format(from, 'yyyy-MM-dd'));
    onEndDateChange(format(to, 'yyyy-MM-dd'));
    setMonth(from);
  };

  // Handle custom days input
  const handleCustomDaysChange = (value: string) => {
    setCustomDays(value);
    const days = parseInt(value);
    if (!isNaN(days) && days > 0) {
      const from = subDays(new Date(), days);
      const to = new Date();
      setSelectedPreset(`${days} dias`);
      onStartDateChange(format(from, 'yyyy-MM-dd'));
      onEndDateChange(format(to, 'yyyy-MM-dd'));
      setMonth(from);
    }
  };

  // Handle clear
  const handleClear = () => {
    onStartDateChange('');
    onEndDateChange('');
    setSelectedPreset(null);
    setCustomDays('');
    setStartTime('00:00');
    setEndTime('23:59');
    onClear?.();
  };

  // Format display text
  const getDisplayText = () => {
    if (!startDate && !endDate) {
      return 'Selecionar período';
    }

    const fromStr = startDate ? format(new Date(startDate), 'dd/MM/yyyy', { locale: ptBR }) : '';
    const toStr = endDate ? format(new Date(endDate), 'dd/MM/yyyy', { locale: ptBR }) : '';

    if (showTime && startTime && endTime) {
      return `${fromStr} ${startTime} - ${toStr} ${endTime}`;
    }

    if (fromStr && toStr) {
      return `${fromStr} - ${toStr}`;
    }

    return fromStr || toStr || 'Selecionar período';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            'bg-emerald-950/30 border-emerald-800/50 text-emerald-50 hover:bg-emerald-900/50 hover:text-emerald-50',
            'focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500',
            !startDate && !endDate && 'text-emerald-300/50',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-emerald-500" />
          <span className="truncate">{getDisplayText()}</span>
          {(startDate || endDate) && (
            <X
              className="ml-auto h-4 w-4 text-emerald-400 hover:text-emerald-300 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 !bg-[#0a1f1a] border-emerald-700/60 shadow-2xl shadow-black/50 backdrop-blur-none"
        align="start"
        sideOffset={8}
        style={{ backgroundColor: '#0a1f1a' }}
      >
        <div className="flex bg-[#0a1f1a]">
          {/* Sidebar - Presets */}
          <div className="w-44 border-r border-emerald-700/40 p-3 space-y-1 bg-[#0d2922]">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 px-2">
              Atalhos
            </p>
            {presetRanges.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-all',
                  selectedPreset === preset.label
                    ? 'bg-emerald-500 text-emerald-950 font-medium'
                    : 'text-emerald-200 hover:bg-emerald-900/50 hover:text-emerald-50'
                )}
              >
                {preset.label}
              </button>
            ))}

            {/* Custom days input */}
            <div className="pt-3 mt-3 border-t border-emerald-800/30">
              <p className="text-xs text-emerald-400/70 mb-2 px-2">Dias anteriores</p>
              <div className="flex items-center gap-2 px-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="X"
                  value={customDays}
                  onChange={(e) => handleCustomDaysChange(e.target.value)}
                  className="w-16 h-8 text-center bg-emerald-900/40 border-emerald-700/50 text-emerald-50 text-sm focus:border-emerald-500"
                />
                <span className="text-xs text-emerald-300/60">dias</span>
              </div>
            </div>
          </div>

          {/* Main Calendar Area */}
          <div className="p-4 bg-[#0a1f1a]">
            {/* Header - Manual Date Inputs */}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-800/30">
              <div className="flex-1">
                <label className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1 block">
                  Data Inicial
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    onStartDateChange(e.target.value);
                    setSelectedPreset(null);
                  }}
                  className="h-9 bg-emerald-900/40 border-emerald-700/50 text-emerald-50 text-sm focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center pt-5">
                <span className="text-emerald-500">→</span>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1 block">
                  Data Final
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    onEndDateChange(e.target.value);
                    setSelectedPreset(null);
                  }}
                  className="h-9 bg-emerald-900/40 border-emerald-700/50 text-emerald-50 text-sm focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-[#0d2922] rounded-lg p-3 border border-emerald-700/30">
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={handleSelect}
                month={month}
                onMonthChange={setMonth}
                locale={ptBR}
                showOutsideDays
                className="!bg-transparent"
                classNames={{
                  months: 'flex flex-col sm:flex-row gap-2',
                  month: 'space-y-4',
                  caption: 'flex justify-center pt-1 relative items-center h-10',
                  caption_label: 'text-base font-bold text-emerald-50',
                  nav: 'space-x-1 flex items-center',
                  nav_button: cn(
                    'h-8 w-8 bg-emerald-800/60 hover:bg-emerald-700 border border-emerald-600/50',
                    'rounded-lg flex items-center justify-center transition-all duration-200',
                    'text-emerald-200 hover:text-emerald-50 shadow-sm'
                  ),
                  nav_button_previous: 'absolute left-1',
                  nav_button_next: 'absolute right-1',
                  table: 'w-full border-collapse mt-2',
                  head_row: 'flex mb-2',
                  head_cell: 'text-emerald-400 rounded-md w-10 font-semibold text-[0.7rem] uppercase tracking-wide',
                  row: 'flex w-full mt-1',
                  cell: cn(
                    'relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20',
                    '[&:has([aria-selected])]:bg-emerald-500/20',
                    '[&:has([aria-selected].day-range-end)]:rounded-r-lg',
                    '[&:has([aria-selected].day-range-start)]:rounded-l-lg',
                    'first:[&:has([aria-selected])]:rounded-l-lg',
                    'last:[&:has([aria-selected])]:rounded-r-lg'
                  ),
                  day: cn(
                    'h-10 w-10 p-0 font-medium rounded-lg transition-all duration-200',
                    'text-emerald-100 hover:bg-emerald-700/60 hover:text-emerald-50',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-400/60',
                    'aria-selected:opacity-100 cursor-pointer'
                  ),
                  day_range_start: 'day-range-start !bg-emerald-500 !text-emerald-950 font-bold rounded-l-lg shadow-md',
                  day_range_end: 'day-range-end !bg-emerald-500 !text-emerald-950 font-bold rounded-r-lg shadow-md',
                  day_selected: '!bg-emerald-500 !text-emerald-950 font-bold shadow-md',
                  day_today: 'bg-emerald-700/50 text-emerald-300 font-bold ring-2 ring-emerald-400/70',
                  day_outside: 'text-emerald-600/50 opacity-40 hover:opacity-60',
                  day_disabled: 'text-emerald-800/50 opacity-30 cursor-not-allowed',
                  day_range_middle: '!bg-emerald-500/25 !text-emerald-50',
                  day_hidden: 'invisible',
                }}
                components={{
                  Chevron: ({ orientation }) => (
                    orientation === 'left'
                      ? <ChevronLeft className="h-5 w-5" />
                      : <ChevronRight className="h-5 w-5" />
                  ),
                }}
              />
            </div>

            {/* Time Selection (Optional) */}
            {showTime && (
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-emerald-800/30">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-emerald-400/70">Horário:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-24 h-8 bg-emerald-900/40 border-emerald-700/50 text-emerald-50 text-sm focus:border-emerald-500"
                  />
                  <span className="text-emerald-500">-</span>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-24 h-8 bg-emerald-900/40 border-emerald-700/50 text-emerald-50 text-sm focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-emerald-800/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/50"
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateRangePicker;
