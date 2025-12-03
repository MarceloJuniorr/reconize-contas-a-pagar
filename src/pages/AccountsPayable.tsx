import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, DollarSign, AlertTriangle, CheckCircle, Calendar, Upload, Filter, X } from 'lucide-react';
import { AccountForm } from '@/components/accounts-payable/AccountForm';
import { AccountsList } from '@/components/accounts-payable/AccountsList';
import { CSVImport } from '@/components/accounts-payable/CSVImport';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const timeZone = 'America/Sao_Paulo';
const locale = 'fr-CA'; // Esse locale força o formato YYYY-MM-DD


interface DashboardStats {
  totalOpen: number;
  totalOverdue: number;
  dueToday: number;
  dueTomorrow: number;
  dueNextWeek: number;
  paidToday: number;
  paidLast30Days: number;
}

type DashboardFilter = 'all' | 'open' | 'overdue' | 'due_today' | 'due_tomorrow' | 'due_next_week' | 'paid_today' | 'paid_last_30_days';

function getDataBrasil(diasParaAdicionar = 0) {
  const data = new Date();
  data.setDate(data.getDate() + diasParaAdicionar);

  return data.toLocaleDateString('fr-CA', {
    timeZone: 'America/Sao_Paulo'
  });
}

const AccountsPayable = () => {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalOpen: 0,
    totalOverdue: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueNextWeek: 0,
    paidToday: 0,
    paidLast30Days: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>('all');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateUntil, setCustomDateUntil] = useState<string>('');
  const { toast } = useToast();

  const fetchAccounts = useCallback(async (customDateFrom?: Date, customDateUntil?: Date, filter?: DashboardFilter) => {
    try {
      console.log('fetchAccounts called with:', { customDateFrom, customDateUntil, filter });

      const today = getDataBrasil(0);
      const tomorrow = getDataBrasil(1);
      const nextWeek = getDataBrasil(7);

      let query = supabase
        .from('accounts_payable')
        .select(`
          *,
          suppliers(name),  
          cost_centers(name, code)
        `);

      // Aplicar filtro do dashboard se fornecido
      if (filter) {
        switch (filter) {
          case 'open':
            query = query.eq('status', 'em_aberto');
            break;
          case 'overdue':
            query = query.eq('status', 'em_aberto').lt('due_date', today);
            break;
          case 'due_today':
            query = query.eq('status', 'em_aberto').eq('due_date', today);
            break;
          case 'due_tomorrow':
            query = query.eq('status', 'em_aberto').eq('due_date', tomorrow);
            break;
          case 'due_next_week':
            query = query.eq('status', 'em_aberto').gte('due_date', today).lte('due_date', nextWeek);
            break;
          case 'paid_today': {
            // Para mostrar contas pagas hoje, vamos buscar da tabela de payments
            query = supabase
              .from('accounts_payable')
              .select(`
                  *, 
                  suppliers(name), 
                  cost_centers(name,code), 
                  payments!inner(account_id) 
                  `)
              .eq('payments.payment_date', today);
            break;
          }
          case 'paid_last_30_days': {
            const thirtyDaysAgo = getDataBrasil(-30);
            query = supabase
              .from('accounts_payable')
              .select('*, suppliers(name), cost_centers(name,code), payments!inner(payment_date)')
              .gte('payments.payment_date', thirtyDaysAgo);
            break;
          }
        }
      } else if (customDateFrom || customDateUntil) {
        // Aplicar filtros customizados de data
        if (customDateFrom) {
          const fromDateStr = customDateFrom.toISOString().split('T')[0];
          query = query.gte('due_date', fromDateStr);
        }
        if (customDateUntil) {
          const untilDateStr = customDateUntil.toISOString().split('T')[0];
          query = query.lte('due_date', untilDateStr);
        }
      } else {
        // Filtro padrão (hoje até próxima semana)
        query = query.eq('due_date', today);
      }

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar contas a pagar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {

      const today = getDataBrasil(0);
      const tomorrow = getDataBrasil(1);
      const nextWeek = getDataBrasil(7);

      // Total em aberto
      const { data: openAccounts } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto');

      // Total vencido
      const { data: overdueAccounts } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto')
        .lt('due_date', today);

      // Vencendo hoje
      const { data: dueTodayData } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto')
        .eq('due_date', today);

      // Vencendo amanhã
      const { data: dueTomorrowData } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto')
        .eq('due_date', tomorrow);

      // Vencendo na próxima semana
      const { data: dueNextWeekData } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto')
        .gte('due_date', today)
        .lte('due_date', nextWeek);

      // Pago hoje
      const { data: paidTodayData } = await supabase
        .from('payments')
        .select('amount_paid')
        .eq('payment_date', today);

      // Pago nos últimos 30 dias
      const thirtyDaysAgo = getDataBrasil(-30);
      const { data: paidLast30DaysData } = await supabase
        .from('payments')
        .select('amount_paid')
        .gte('payment_date', thirtyDaysAgo);

      setStats({
        totalOpen: openAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        totalOverdue: overdueAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        dueToday: dueTodayData?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        dueTomorrow: dueTomorrowData?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        dueNextWeek: dueNextWeekData?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        paidToday: paidTodayData?.reduce((sum, payment) => sum + Number(payment.amount_paid), 0) || 0,
        paidLast30Days: paidLast30DaysData?.reduce((sum, payment) => sum + Number(payment.amount_paid), 0) || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchStats();
  }, [fetchAccounts, fetchStats]);

  const handleAccountCreated = () => {
    setIsDialogOpen(false);
    fetchAccounts();
    fetchStats();
    toast({
      title: "Sucesso",
      description: "Conta a pagar cadastrada com sucesso",
    });
  };

  const handleImportSuccess = () => {
    setIsImportDialogOpen(false);
    fetchAccounts();
    fetchStats();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleDashboardCardClick = (filter: DashboardFilter) => {
    setActiveFilter(filter);
    setLoading(true);
    // Limpar filtros de data customizados ao clicar em card
    setCustomDateFrom('');
    setCustomDateUntil('');
    fetchAccounts(undefined, undefined, filter);
  };

  const handleApplyDateFilter = () => {
    const fromDate = customDateFrom ? new Date(customDateFrom + 'T12:00:00') : undefined;
    const untilDate = customDateUntil ? new Date(customDateUntil + 'T12:00:00') : undefined;

    setActiveFilter('all');
    setDateFilterOpen(false);
    setLoading(true);
    fetchAccounts(fromDate, untilDate);
  };

  const handleClearDateFilter = () => {
    setCustomDateFrom('');
    setCustomDateUntil('');
    setDateFilterOpen(false);
    setActiveFilter('all');
    setLoading(true);
    fetchAccounts();
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="container mx-auto px-0 space-y-6 max-w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contas a Pagar</h1>
            <p className="text-muted-foreground">
              Gerencie suas contas e obrigações financeiras
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Filtro de Data Mobile */}
            <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filtrar por Data
                  {(customDateFrom || customDateUntil) && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      1
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium leading-none">Filtrar por Período</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateFilterOpen(false)}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="date-from">Data Inicial</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date-until">Data Final</Label>
                      <Input
                        id="date-until"
                        type="date"
                        value={customDateUntil}
                        onChange={(e) => setCustomDateUntil(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearDateFilter}
                      className="flex-1"
                    >
                      Limpar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyDateFilter}
                      className="flex-1"
                      disabled={!customDateFrom && !customDateUntil}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Conta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Conta a Pagar</DialogTitle>
                </DialogHeader>
                <AccountForm onSuccess={handleAccountCreated} />
              </DialogContent>
            </Dialog>

          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'open' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => handleDashboardCardClick('open')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalOpen)}</div>
              <p className="text-xs text-muted-foreground">
                Contas pendentes de pagamento
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'overdue' ? 'ring-2 ring-destructive' : ''}`}
            onClick={() => handleDashboardCardClick('overdue')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalOverdue)}</div>
              <p className="text-xs text-muted-foreground">
                Contas em atraso
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'due_today' ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => handleDashboardCardClick('due_today')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencendo Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{formatCurrency(stats.dueToday)}</div>
              <p className="text-xs text-muted-foreground">
                Contas que vencem hoje
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'due_tomorrow' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => handleDashboardCardClick('due_tomorrow')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vence Amanhã</CardTitle>
              <Calendar className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{formatCurrency(stats.dueTomorrow)}</div>
              <p className="text-xs text-muted-foreground">
                Contas que vencem amanhã
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'due_next_week' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => handleDashboardCardClick('due_next_week')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próxima Semana</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{formatCurrency(stats.dueNextWeek)}</div>
              <p className="text-xs text-muted-foreground">
                Vencendo em 7 dias
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'paid_today' ? 'ring-2 ring-green-600' : ''}`}
            onClick={() => handleDashboardCardClick('paid_today')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pago Hoje</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidToday)}</div>
              <p className="text-xs text-muted-foreground">
                Total pago hoje
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'paid_last_30_days' ? 'ring-2 ring-emerald-500' : ''}`}
            onClick={() => handleDashboardCardClick('paid_last_30_days')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagos 30 Dias</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{formatCurrency(stats.paidLast30Days)}</div>
              <p className="text-xs text-muted-foreground">
                Últimos 30 dias pagos
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Lista de Contas a Pagar
              {(activeFilter !== 'all' || customDateFrom || customDateUntil) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    setActiveFilter('all');
                    setCustomDateFrom('');
                    setCustomDateUntil('');
                    setLoading(true);
                    fetchAccounts();
                  }}
                >
                  Limpar Filtro
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              {activeFilter !== 'all' ? (
                'Mostrando contas filtradas pelo dashboard'
              ) : customDateFrom || customDateUntil ? (
                `Período: ${customDateFrom ? new Date(customDateFrom + 'T12:00:00').toLocaleDateString('pt-BR', {
                  timeZone: 'America/Sao_Paulo'
                }) : '...'} até ${customDateUntil ? new Date(customDateUntil + 'T12:00:00').toLocaleDateString('pt-BR', {
                  timeZone: 'America/Sao_Paulo'
                }) : '...'}`
              ) : (
                'Visualize e gerencie todas as contas cadastradas'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountsList
              accounts={accounts}
              loading={loading}
              onUpdate={() => {
                fetchAccounts(undefined, undefined, activeFilter !== 'all' ? activeFilter : undefined);
                fetchStats();
              }}
              onDateFilterChange={(fromDate, untilDate) => {
                setActiveFilter('all');
                setCustomDateFrom(fromDate ? fromDate.toISOString().split('T')[0] : '');
                setCustomDateUntil(untilDate ? untilDate.toISOString().split('T')[0] : '');
                console.log('Date filter changed:', { fromDate, untilDate });
                fetchAccounts(fromDate, untilDate);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountsPayable;