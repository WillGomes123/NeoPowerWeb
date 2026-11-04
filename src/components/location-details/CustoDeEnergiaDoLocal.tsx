import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ResumoDoCustoDeEnergia } from '@/components/ResumoDoCustoDeEnergia';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  corpoDoCusto,
  CustoDoLocal,
  FormularioDeCusto,
  formularioDoCusto,
  NOMES_DOS_DIAS,
  textoDoCusto,
} from '@/lib/custoDeEnergia';

interface Props {
  locationId: number;
  inicio: string;
  fim: string;
}

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Aba Financeiro do local: quanto o operador paga por kWh na conta de luz. */
export function CustoDeEnergiaDoLocal({ locationId, inicio, fim }: Props) {
  const { user } = useAuth();
  const podeGerenciar = user?.role === 'admin' || (user?.role === 'operador' && !!user?.clientId);

  const [carregou, setCarregou] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);
  const [historico, setHistorico] = useState<CustoDoLocal[]>([]);
  const [atual, setAtual] = useState<CustoDoLocal | null>(null);
  const [form, setForm] = useState<FormularioDeCusto>(() => formularioDoCusto(null, hojeLocal()));
  const [salvando, setSalvando] = useState(false);
  const [repasse, setRepasse] = useState<number | null>(null);
  // Muda a cada gravação, para o resumo apurar de novo com o custo novo.
  const [versao, setVersao] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.get(`/locations/${locationId}/custo-energia`);
      if (!resposta.ok) {
        setSemAcesso(true);
        return;
      }
      const corpo = await resposta.json();
      const dados = corpo.data ?? corpo;
      setSemAcesso(false);
      setHistorico(dados.historico ?? []);
      setAtual(dados.atual ?? null);
      setForm(formularioDoCusto(dados.atual ?? null, hojeLocal()));
    } catch {
      setSemAcesso(true);
    } finally {
      setCarregou(true);
    }
  }, [locationId]);

  useEffect(() => {
    if (podeGerenciar) void carregar();
  }, [podeGerenciar, carregar]);

  // O repasse vem do mesmo relatório do PDF, para a sobra bater com ele.
  useEffect(() => {
    if (!podeGerenciar || historico.length === 0) return;
    let cancelado = false;
    api
      .get(`/reports/financial?locationId=${locationId}&startDate=${inicio}&endDate=${fim}`)
      .then(async resposta => {
        if (!resposta.ok) return;
        const corpo = await resposta.json();
        const valor = (corpo.data ?? corpo)?.repasse?.recargas?.repasse;
        if (!cancelado) setRepasse(typeof valor === 'number' ? valor : null);
      })
      .catch(() => {
        if (!cancelado) setRepasse(null);
      });
    return () => {
      cancelado = true;
    };
  }, [podeGerenciar, historico.length, locationId, inicio, fim]);

  if (!podeGerenciar || !carregou || semAcesso) return null;

  const salvar = async () => {
    const montado = corpoDoCusto(form);
    if ('erro' in montado) {
      toast.error(montado.erro);
      return;
    }
    setSalvando(true);
    try {
      const resposta = await api.post(`/locations/${locationId}/custo-energia`, montado.corpo);
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(corpo?.error || 'Não foi possível salvar o custo de energia.');
      }
      toast.success('Custo de energia salvo. O preço do cliente não mudou.');
      await carregar();
      setVersao(v => v + 1);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível salvar o custo de energia.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarDia = (dia: number) =>
    setForm(f => ({
      ...f,
      diasPonta: f.diasPonta.includes(dia) ? f.diasPonta.filter(d => d !== dia) : [...f.diasPonta, dia],
    }));

  return (
    <div className="space-y-4">
      <ResumoDoCustoDeEnergia
        key={versao}
        inicio={inicio}
        fim={fim}
        locationId={locationId}
        repasse={repasse}
      />

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg text-foreground">Custo da conta de luz</CardTitle>
          <p className="text-sm text-muted-foreground">
            Quanto este local paga por kWh à distribuidora. Fica só na gestão da marca: não muda o preço
            nem aparece para o cliente.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <p className="text-sm text-foreground">
            {atual ? (
              <>
                <span className="font-medium">Vale hoje:</span> {textoDoCusto(atual)}, desde{' '}
                {dataBr(atual.vigenteDesde)}.
              </>
            ) : (
              'Nenhum custo valendo hoje.'
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="custo-kwh">
                {form.temPonta ? 'Custo fora de ponta (R$/kWh)' : 'Custo por kWh (R$)'}
              </Label>
              <Input
                id="custo-kwh"
                inputMode="decimal"
                placeholder="0,45"
                value={form.custoKwh}
                onChange={e => setForm(f => ({ ...f, custoKwh: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custo-vigencia">Vale a partir de</Label>
              <Input
                id="custo-vigencia"
                type="date"
                value={form.vigenteDesde}
                onChange={e => setForm(f => ({ ...f, vigenteDesde: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="custo-tem-ponta"
              checked={form.temPonta}
              onCheckedChange={marcado => setForm(f => ({ ...f, temPonta: marcado }))}
            />
            <Label htmlFor="custo-tem-ponta">A conta tem horário de ponta</Label>
          </div>

          {form.temPonta && (
            <div className="space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custo-ponta">Custo na ponta (R$/kWh)</Label>
                  <Input
                    id="custo-ponta"
                    inputMode="decimal"
                    placeholder="1,79"
                    value={form.custoPonta}
                    onChange={e => setForm(f => ({ ...f, custoPonta: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custo-ponta-inicio">Início</Label>
                  <Input
                    id="custo-ponta-inicio"
                    type="time"
                    value={form.inicioPonta}
                    onChange={e => setForm(f => ({ ...f, inicioPonta: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custo-ponta-fim">Último minuto</Label>
                  <Input
                    id="custo-ponta-fim"
                    type="time"
                    value={form.fimPonta}
                    onChange={e => setForm(f => ({ ...f, fimPonta: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dias da ponta</Label>
                <div className="flex flex-wrap gap-2">
                  {NOMES_DOS_DIAS.map((nome, dia) => (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => alternarDia(dia)}
                      aria-pressed={form.diasPonta.includes(dia)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        form.diasPonta.includes(dia)
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'text-muted-foreground border-border'
                      }`}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Nos horários e dias fora daqui, vale o custo fora de ponta. Feriado não é tratado à parte.
                </p>
              </div>
            </div>
          )}

          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar custo'}
          </Button>

          {historico.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase mt-3 mb-2">Histórico</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {historico.slice(0, 6).map(c => (
                  <li key={c.id}>
                    Desde {dataBr(c.vigenteDesde)}: {textoDoCusto(c)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CustoDeEnergiaDoLocal;
