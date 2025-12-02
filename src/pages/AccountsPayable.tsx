import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, DollarSign, AlertTriangle, CheckCircle, Calendar, Upload } from 'lucide-react';
import { AccountForm } from '@/components/accounts-payable/AccountForm';
import { AccountsList } from '@/components/accounts-payable/AccountsList';
import { CSVImport } from '@/components/accounts-payable/CSVImport';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalOpen: number;
  totalOverdue: number;
  dueToday: number;
  dueTomorrow: number;
  dueNextWeek: number;
  paidToday: number;
  paidLast30Days: number;
}

type DashboardFilter = 'all' | 'open' | 'overdue' | 'due_today' | 'due_tomorrow' | 'due_next_week' | 'paid_today' | 'paid_last_60_days';

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
  const { toast } = useToast();

  const fetchAccounts = async (customDateFrom?: Date, customDateUntil?: Date, filter?: DashboardFilter) => {
    try {
      console.log('fetchAccounts called with:', { customDateFrom, customDateUntil, filter });

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
          case 'paid_today':
            // Para mostrar contas pagas hoje, vamos buscar da tabela de payments
            const { data: paidAccounts } = await supabase
              .from('payments')
              .select('account_id')
              .eq('payment_date', today);

            if (paidAccounts && paidAccounts.length > 0) {
              const accountIds = paidAccounts.map(p => p.account_id);
              query = query.in('id', accountIds);
            } else {
              setAccounts([]);
              setLoading(false);
              return;
            }
            break;
          case 'paid_last_60_days':
            const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data: paid60DaysAccounts } = await supabase
              .from('payments')
              .select('account_id')
              .gte('payment_date', sixtyDaysAgo);

            if (paid60DaysAccounts && paid60DaysAccounts.length > 0) {
              const accountIds = [...new Set(paid60DaysAccounts.map(p => p.account_id))];
              query = query.in('id', accountIds);
            } else {
              setAccounts([]);
              setLoading(false);
              return;
            }
            break;
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
        query = query.or(`due_date.lt.${today},and(due_date.gte.${today},due_date.lte.${nextWeek})`);
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
  };

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
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
  };

  useEffect(() => {
    fetchAccounts();
    fetchStats();
  }, []);

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
    fetchAccounts(undefined, undefined, filter);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground">
            Gerencie suas contas e obrigações financeiras
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
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

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle>Importar Contas via CSV</DialogTitle>
              </DialogHeader>
              <CSVImport onSuccess={handleImportSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
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
          className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'paid_last_60_days' ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => handleDashboardCardClick('paid_last_60_days')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos 30 Dias</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(stats.paidLast30Days)}</div>
            <p className="text-xs text-muted-foreground">
              Últimos 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Contas a Pagar
            {activeFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => {
                  setActiveFilter('all');
                  setLoading(true);
                  fetchAccounts();
                }}
              >
                Limpar Filtro
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            {activeFilter !== 'all'
              ? 'Mostrando contas filtradas pelo dashboard'
              : 'Visualize e gerencie todas as contas cadastradas'
            }
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
              console.log('Date filter changed:', { fromDate, untilDate });
              fetchAccounts(fromDate, untilDate);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsPayable;