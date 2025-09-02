import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  Plus,
  FileText,
  Building,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalOpen: number;
  totalOverdue: number;
  totalPaid: number;
  totalNext7Days: number;
  totalOpenAmount: number;
  totalOverdueAmount: number;
  totalPaidAmount: number;
  totalNext7DaysAmount: number;
}

const Dashboard = () => {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOpen: 0,
    totalOverdue: 0,
    totalPaid: 0,
    totalNext7Days: 0,
    totalOpenAmount: 0,
    totalOverdueAmount: 0,
    totalPaidAmount: 0,
    totalNext7DaysAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Contas em aberto
      const { data: openAccounts } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto');

      // Contas vencidas
      const { data: overdueAccounts } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto')
        .lt('due_date', today);

      // Contas pagas no mês atual
      const { data: paidAccounts } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'pago')
        .gte('updated_at', `${currentMonth}-01`);

      // Contas a vencer nos próximos 7 dias
      const { data: next7DaysAccounts } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'em_aberto')
        .gte('due_date', today)
        .lte('due_date', next7Days);

      setStats({
        totalOpen: openAccounts?.length || 0,
        totalOverdue: overdueAccounts?.length || 0,
        totalPaid: paidAccounts?.length || 0,
        totalNext7Days: next7DaysAccounts?.length || 0,
        totalOpenAmount: openAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        totalOverdueAmount: overdueAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        totalPaidAmount: paidAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
        totalNext7DaysAmount: next7DaysAccounts?.reduce((sum, acc) => sum + Number(acc.amount), 0) || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Bem-vindo, {profile?.full_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/accounts/new">
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOpen}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalOpenAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.totalOverdue}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalOverdueAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagas (Mês)</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.totalPaid}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalPaidAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos 7 dias</CardTitle>
              <Calendar className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.totalNext7Days}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalNext7DaysAmount)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <FileText className="h-5 w-5 mr-2" />
                Contas a Pagar
              </CardTitle>
              <CardDescription>
                Visualizar e gerenciar todas as contas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/accounts">Ver Contas</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Building className="h-5 w-5 mr-2" />
                Fornecedores
              </CardTitle>
              <CardDescription>
                Cadastrar e gerenciar fornecedores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/suppliers">Ver Fornecedores</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <DollarSign className="h-5 w-5 mr-2" />
                Centros de Custo
              </CardTitle>
              <CardDescription>
                Gerenciar centros de custo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/cost-centers">Ver Centros</Link>
              </Button>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Users className="h-5 w-5 mr-2" />
                  Usuários
                </CardTitle>
                <CardDescription>
                  Gerenciar usuários e permissões
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/users">Ver Usuários</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;