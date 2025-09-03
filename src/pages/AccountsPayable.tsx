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
  });
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchAccounts = async (customDateFilter?: Date) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = customDateFilter ? customDateFilter.toISOString().split('T')[0] : 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('accounts_payable')
        .select(`
          *,
          suppliers(name),
          cost_centers(name, code)
        `)
        .or(`due_date.lt.${today},and(due_date.gte.${today},due_date.lte.${nextWeek})`)
        .order('due_date', { ascending: true });

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

      setStats({
        totalOpen: openAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        totalOverdue: overdueAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        dueToday: dueTodayData?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        dueTomorrow: dueTomorrowData?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        dueNextWeek: dueNextWeekData?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        paidToday: paidTodayData?.reduce((sum, payment) => sum + Number(payment.amount_paid), 0) || 0,
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
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

        <Card>
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

        <Card>
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

        <Card>
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

        <Card>
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

        <Card>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Contas a Pagar</CardTitle>
          <CardDescription>
            Visualize e gerencie todas as contas cadastradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountsList 
            accounts={accounts} 
            loading={loading} 
            onUpdate={fetchAccounts}
            onDateFilterChange={fetchAccounts}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsPayable;