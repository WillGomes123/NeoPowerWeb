import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CommandInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandType: string;
  chargerName: string;
  onConfirm: (values: Record<string, string | number>) => void;
}

export const CommandInputDialog: React.FC<CommandInputDialogProps> = ({
  open,
  onOpenChange,
  commandType,
  chargerName,
  onConfirm,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Converter valores conforme necessário
    const processedValues: Record<string, string | number> = {};
    Object.entries(values).forEach(([key, value]) => {
      // Converter para número se for id ou connectorId
      if (['transactionId', 'connectorId'].includes(key)) {
        processedValues[key] = parseInt(value) || 0;
      } else {
        processedValues[key] = value;
      }
    });

    onConfirm(processedValues);
    setValues({});
    onOpenChange(false);
  };

  const renderInputs = () => {
    switch (commandType) {
      case 'start':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="idTag">ID Tag</Label>
              <Input
                id="idTag"
                placeholder="Ex: 12345"
                value={values.idTag || ''}
                onChange={e => setValues({ ...values, idTag: e.target.value })}
                required
              />
              <p className="text-sm text-zinc-400">Identificador do cartão/tag RFID</p>
            </div>
          </div>
        );

      case 'stop':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transactionId">ID da Transação</Label>
              <Input
                id="transactionId"
                type="number"
                placeholder="Ex: 123"
                value={values.transactionId || ''}
                onChange={e => setValues({ ...values, transactionId: e.target.value })}
                required
              />
              <p className="text-sm text-zinc-400">Número da transação ativa</p>
            </div>
          </div>
        );

      case 'reset':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Reset</Label>
              <Select
                value={values.type || 'Hard'}
                onValueChange={value => setValues({ ...values, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hard">Hard (Reinicialização completa)</SelectItem>
                  <SelectItem value="Soft">Soft (Reinicialização leve)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-zinc-400">
                Hard: reinicia completamente. Soft: reinicia apenas o software
              </p>
            </div>
          </div>
        );

      case 'availability':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connectorId">ID do Conector</Label>
              <Input
                id="connectorId"
                type="number"
                placeholder="Ex: 1"
                value={values.connectorId || '1'}
                onChange={e => setValues({ ...values, connectorId: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availabilityType">Disponibilidade</Label>
              <Select
                value={values.type || 'Operative'}
                onValueChange={value => setValues({ ...values, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operative">Operativo (Disponível)</SelectItem>
                  <SelectItem value="Inoperative">Inoperativo (Indisponível)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'unlock':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connectorId">ID do Conector</Label>
              <Input
                id="connectorId"
                type="number"
                placeholder="Ex: 1"
                value={values.connectorId || '1'}
                onChange={e => setValues({ ...values, connectorId: e.target.value })}
                required
              />
              <p className="text-sm text-zinc-400">Número do conector a destravar</p>
            </div>
          </div>
        );

      case 'triggerMessage':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestedMessage">Mensagem OCPP</Label>
              <Select
                value={values.requestedMessage || 'StatusNotification'}
                onValueChange={value => setValues({ ...values, requestedMessage: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a mensagem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="StatusNotification">Status Notification</SelectItem>
                  <SelectItem value="Heartbeat">Heartbeat</SelectItem>
                  <SelectItem value="MeterValues">Meter Values</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-zinc-400">Tipo de mensagem a ser disparada</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    const titles: Record<string, string> = {
      start: 'Iniciar Transação Remota',
      stop: 'Parar Transação Remota',
      reset: 'Resetar Carregador',
      availability: 'Alterar Disponibilidade',
      unlock: 'Destravar Conector',
      triggerMessage: 'Disparar Mensagem OCPP',
    };
    return titles[commandType] || 'Executar Comando';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogDescription>
              Carregador: <span className="font-semibold text-emerald-400">{chargerName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">{renderInputs()}</div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600">
              Executar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
