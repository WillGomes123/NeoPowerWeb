import React from 'react';
import { Badge } from './ui/badge';

interface StatusBadgeProps {
  status:
    | 'online'
    | 'offline'
    | 'charging'
    | 'active'
    | 'inactive'
    | 'completed'
    | 'failed'
    | 'pending';
  size?: 'sm' | 'md';
}

export const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          label: 'Online',
          className: 'bg-primary/20 text-primary border-primary/50',
        };
      case 'offline':
        return { label: 'Offline', className: 'bg-muted text-muted-foreground border-border' };
      case 'charging':
        return {
          label: 'Carregando',
          className: 'bg-primary/20 text-primary border-primary/50',
        };
      case 'active':
        return {
          label: 'Ativo',
          className: 'bg-primary/20 text-primary border-primary/50',
        };
      case 'inactive':
        return { label: 'Inativo', className: 'bg-muted text-muted-foreground border-border' };
      case 'completed':
        return {
          label: 'Finalizado',
          className: 'bg-primary/20 text-primary border-primary/50',
        };
      case 'failed':
        return { label: 'Falhou', className: 'bg-red-500/20 text-red-400 border-red-500/50' };
      case 'pending':
        return {
          label: 'Pendente',
          className: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
        };
      default:
        return { label: status, className: 'bg-muted text-muted-foreground border-border' };
    }
  };

  const config = getStatusConfig();
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <Badge variant="outline" className={`${config.className} ${sizeClass} border`}>
      {config.label}
    </Badge>
  );
};
