import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, DollarSign, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import { AccountForm } from '@/components/accounts-payable/AccountForm';
import { AccountsList } from '@/components/accounts-payable/AccountsList';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalOpen: number;
  totalOverdue: number;
  totalPaidThisMonth: number;
  dueNextWeek: number;
}

const AccountsPayable = () => {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalOpen: 0,
    totalOverdue: 0,
    totalPaidThisMonth: 0,
    dueNextWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

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

      // Total pago no mês
      const { data: paidThisMonth } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'pago')
        .gte('updated_at', firstDayOfMonth);

      // Vencendo na próxima semana
      const { data: dueNextWeekData } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto')
        .gte('due_date', today)
        .lte('due_date', nextWeek);

      setStats({
        totalOpen: openAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        totalOverdue: overdueAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        totalPaidThisMonth: paidThisMonth?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        dueNextWeek: dueNextWeekData?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground">
            Gerencie suas contas e obrigações financeiras
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Conta a Pagar</DialogTitle>
            </DialogHeader>
            <AccountForm onSuccess={handleAccountCreated} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Pago no Mês</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaidThisMonth)}</div>
            <p className="text-xs text-muted-foreground">
              Total pago neste mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próxima Semana</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{formatCurrency(stats.dueNextWeek)}</div>
            <p className="text-xs text-muted-foreground">
              Vencendo em 7 dias
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