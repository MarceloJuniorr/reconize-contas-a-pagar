import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Edit, Eye, CheckCircle, X, Download, History, Filter, CalendarIcon } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AccountForm } from './AccountForm';
import { PaymentModal } from './PaymentModal';
import { AccountHistoryModal } from './AccountHistoryModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Account {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: 'em_aberto' | 'pago' | 'cancelado';
  payment_type: 'boleto' | 'cartao' | 'transferencia' | 'pix';
  observations?: string;
  suppliers: { name: string };
  cost_centers: { name: string; code: string };
  created_at: string;
  updated_at: string;
}

interface AccountsListProps {
  accounts: Account[];
  loading: boolean;
  onUpdate: (customDateFilter?: Date) => void;
  onDateFilterChange?: (customDateFilter?: Date) => void;
}

interface Filters {
  supplier: string;
  costCenter: string;
  paymentType: string;
  status: string;
  dueDateFrom: Date | undefined;
  dueDateUntil: Date | undefined;
}

export const AccountsList = ({ accounts, loading, onUpdate, onDateFilterChange }: AccountsListProps) => {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    supplier: 'all',
    costCenter: 'all',
    paymentType: 'all',
    status: 'all',
    dueDateFrom: new Date(), // Data atual como padrão
    dueDateUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias por padrão
  });
  const { toast } = useToast();
  const { hasRole } = useAuth();

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const suppliers = [...new Set(accounts.map(acc => acc.suppliers?.name).filter(Boolean))];
    const costCenters = [...new Set(accounts.map(acc => `${acc.cost_centers?.code} - ${acc.cost_centers?.name}`).filter(Boolean))];
    const paymentTypes = [...new Set(accounts.map(acc => acc.payment_type))];
    const statuses = [...new Set(accounts.map(acc => acc.status))];
    
    return { suppliers, costCenters, paymentTypes, statuses };
  }, [accounts]);

  // Filter accounts based on selected filters
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      if (filters.supplier !== 'all' && account.suppliers?.name !== filters.supplier) {
        return false;
      }
      if (filters.costCenter !== 'all' && `${account.cost_centers?.code} - ${account.cost_centers?.name}` !== filters.costCenter) {
        return false;
      }
      if (filters.paymentType !== 'all' && account.payment_type !== filters.paymentType) {
        return false;
      }
      if (filters.status !== 'all' && account.status !== filters.status) {
        return false;
      }
      const accountDate = new Date(account.due_date);
      if (filters.dueDateFrom && accountDate < filters.dueDateFrom) {
        return false;
      }
      if (filters.dueDateUntil && accountDate > filters.dueDateUntil) {
        return false;
      }
      return true;
    });
  }, [accounts, filters]);

  // Calculate filtered accounts stats by payment type
  const filteredStats = useMemo(() => {
    const stats = {
      boleto: { pago: 0, em_aberto: 0, totalPago: 0, totalAberto: 0 },
      cartao: { pago: 0, em_aberto: 0, totalPago: 0, totalAberto: 0 },
      transferencia: { pago: 0, em_aberto: 0, totalPago: 0, totalAberto: 0 },
      pix: { pago: 0, em_aberto: 0, totalPago: 0, totalAberto: 0 }
    };

    filteredAccounts.forEach(account => {
      const type = account.payment_type as keyof typeof stats;
      if (stats[type]) {
        if (account.status === 'pago') {
          stats[type].pago += 1;
          stats[type].totalPago += Number(account.amount);
        } else if (account.status === 'em_aberto') {
          stats[type].em_aberto += 1;
          stats[type].totalAberto += Number(account.amount);
        }
      }
    });

    return stats;
  }, [filteredAccounts]);

  // Validate date range (max 3 months)
  const validateDateRange = (fromDate: Date | undefined, untilDate: Date | undefined) => {
    if (!fromDate || !untilDate) return true;
    
    const diffTime = Math.abs(untilDate.getTime() - fromDate.getTime());
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30); // Approximate months
    return diffMonths <= 3;
  };

  const clearFilters = () => {
    const newFilters = {
      supplier: 'all',
      costCenter: 'all',
      paymentType: 'all',
      status: 'all',
      dueDateFrom: new Date(), // Data atual como padrão
      dueDateUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias por padrão
    };
    setFilters(newFilters);
    if (onDateFilterChange) {
      onDateFilterChange(newFilters.dueDateUntil);
    }
  };

  const handleViewDetails = (account: Account) => {
    setSelectedAccount(account);
    setIsEditMode(false);
    setIsDetailsOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account);
    setIsEditMode(true);
    setIsDetailsOpen(true);
  };

  const handlePayAccount = (account: Account) => {
    setSelectedAccount(account);
    setIsPaymentOpen(true);
  };

  const handleCancelAccount = async (account: Account) => {
    if (!hasRole('admin')) {
      toast({
        title: "Sem permissão",
        description: "Apenas administradores podem cancelar contas",
        variant: "destructive",
      });
      return;
    }

    const reason = prompt('Digite o motivo do cancelamento:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('accounts_payable')
        .update({ 
          status: 'cancelado',
          observations: `${account.observations || ''}\n\nCANCELADO: ${reason}`.trim()
        })
        .eq('id', account.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Conta cancelada com sucesso",
      });

      onUpdate();
    } catch (error) {
      console.error('Erro ao cancelar conta:', error);
      toast({
        title: "Erro",
        description: "Falha ao cancelar conta",
        variant: "destructive",
      });
    }
  };

  const handleAccountUpdated = () => {
    setIsDetailsOpen(false);
    setSelectedAccount(null);
    setIsEditMode(false);
    onUpdate();
    toast({
      title: "Sucesso",
      description: "Conta atualizada com sucesso",
    });
  };

  const handlePaymentCompleted = () => {
    setIsPaymentOpen(false);
    setSelectedAccount(null);
    onUpdate();
    toast({
      title: "Sucesso",
      description: "Pagamento registrado com sucesso",
    });
  };

  const handleViewHistory = (account: Account) => {
    setSelectedAccount(account);
    setIsHistoryOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    // Para datas simples (YYYY-MM-DD) como due_date
    if (dateString.includes('T')) {
      // Para timestamps completos como created_at
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } else {
      // Para datas simples (YYYY-MM-DD)
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_aberto':
        return 'default';
      case 'pago':
        return 'success';
      case 'cancelado':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_aberto':
        return 'Em Aberto';
      case 'pago':
        return 'Pago';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'boleto':
        return 'Boleto';
      case 'cartao':
        return 'Cartão';
      case 'transferencia':
        return 'Transferência';
      case 'pix':
        return 'PIX';
      default:
        return type;
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status !== 'em_aberto') return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-muted-foreground">Carregando contas...</div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Nenhuma conta a pagar cadastrada ainda.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Clique em "Nova Conta" para cadastrar a primeira.
        </p>
      </div>
    );
  }

  if (filteredAccounts.length === 0 && accounts.length > 0) {
    return (
      <>
        {/* Filtros */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          {(filters.supplier !== 'all' || filters.costCenter !== 'all' || filters.paymentType !== 'all' || filters.status !== 'all' || 
             (filters.dueDateFrom && filters.dueDateFrom.getTime() !== new Date().setHours(0,0,0,0)) ||
             (filters.dueDateUntil && filters.dueDateUntil.getTime() !== new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime())) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              Limpar filtros
            </Button>
          )}
          </div>

          {showFilters && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {/* Filtro por Fornecedor */}
                  <div className="space-y-2">
                    <Label htmlFor="supplier-filter">Fornecedor</Label>
                    <Select
                      value={filters.supplier}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, supplier: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.suppliers.map(supplier => (
                        <SelectItem key={supplier} value={supplier}>
                          {supplier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por Centro de Custo */}
                  <div className="space-y-2">
                    <Label htmlFor="cost-center-filter">Centro de Custo</Label>
                    <Select
                      value={filters.costCenter}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, costCenter: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.costCenters.map(costCenter => (
                        <SelectItem key={costCenter} value={costCenter}>
                          {costCenter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por Tipo de Pagamento */}
                  <div className="space-y-2">
                    <Label htmlFor="payment-type-filter">Tipo</Label>
                    <Select
                      value={filters.paymentType}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, paymentType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.paymentTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {getPaymentTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por Status */}
                  <div className="space-y-2">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.statuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {getStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por Vencimento */}
                  <div className="space-y-2">
                    <Label htmlFor="due-date-filter">Vencimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !filters.dueDateFrom && !filters.dueDateUntil && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dueDateFrom && filters.dueDateUntil 
                            ? `${format(filters.dueDateFrom, "dd/MM/yyyy")} - ${format(filters.dueDateUntil, "dd/MM/yyyy")}`
                            : "Selecionar período"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs font-medium">Data inicial</Label>
                              <Calendar
                                mode="single"
                                selected={filters.dueDateFrom}
                                onSelect={(date) => {
                                  if (date && filters.dueDateUntil && !validateDateRange(date, filters.dueDateUntil)) {
                                    toast({
                                      title: "Intervalo inválido",
                                      description: "O intervalo de datas não pode ser maior que 3 meses",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  setFilters(prev => ({ ...prev, dueDateFrom: date }));
                                }}
                                className={cn("p-0 pointer-events-auto")}
                                disabled={(date) => {
                                  if (!filters.dueDateUntil) return false;
                                  return date > filters.dueDateUntil;
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Data final</Label>
                              <Calendar
                                mode="single"
                                selected={filters.dueDateUntil}
                                onSelect={(date) => {
                                  if (date && filters.dueDateFrom && !validateDateRange(filters.dueDateFrom, date)) {
                                    toast({
                                      title: "Intervalo inválido",
                                      description: "O intervalo de datas não pode ser maior que 3 meses",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  const newDate = date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                                  setFilters(prev => ({ ...prev, dueDateUntil: newDate }));
                                  if (onDateFilterChange) {
                                    onDateFilterChange(newDate);
                                  }
                                }}
                                className={cn("p-0 pointer-events-auto")}
                                disabled={(date) => {
                                  if (!filters.dueDateFrom) return false;
                                  return date < filters.dueDateFrom;
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const today = new Date();
                                const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                                setFilters(prev => ({ 
                                  ...prev, 
                                  dueDateFrom: today, 
                                  dueDateUntil: nextWeek 
                                }));
                                if (onDateFilterChange) {
                                  onDateFilterChange(nextWeek);
                                }
                              }}
                              className="w-full"
                            >
                              Hoje + 7 dias (padrão)
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="text-sm text-muted-foreground">
            Mostrando {filteredAccounts.length} de {accounts.length} contas
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-muted-foreground">Nenhuma conta encontrada com os filtros aplicados.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Tente ajustar os filtros ou limpar para ver todas as contas.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Filtros */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
            {(filters.supplier !== 'all' || filters.costCenter !== 'all' || filters.paymentType !== 'all' || filters.status !== 'all' || 
               (filters.dueDateFrom && filters.dueDateFrom.getTime() !== new Date().setHours(0,0,0,0)) ||
               (filters.dueDateUntil && filters.dueDateUntil.getTime() !== new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime())) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                Limpar filtros
              </Button>
            )}
        </div>

        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Filtro por Fornecedor */}
                <div className="space-y-2">
                  <Label htmlFor="supplier-filter">Fornecedor</Label>
                  <Select
                    value={filters.supplier}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, supplier: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.suppliers.map(supplier => (
                        <SelectItem key={supplier} value={supplier}>
                          {supplier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro por Centro de Custo */}
                <div className="space-y-2">
                  <Label htmlFor="cost-center-filter">Centro de Custo</Label>
                  <Select
                    value={filters.costCenter}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, costCenter: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.costCenters.map(costCenter => (
                        <SelectItem key={costCenter} value={costCenter}>
                          {costCenter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro por Tipo de Pagamento */}
                <div className="space-y-2">
                  <Label htmlFor="payment-type-filter">Tipo</Label>
                  <Select
                    value={filters.paymentType}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, paymentType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.paymentTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {getPaymentTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro por Status */}
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.statuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {getStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro por Vencimento */}
                <div className="space-y-2">
                  <Label htmlFor="due-date-filter">Vencimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !filters.dueDateFrom && !filters.dueDateUntil && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dueDateFrom && filters.dueDateUntil 
                          ? `${format(filters.dueDateFrom, "dd/MM/yyyy")} - ${format(filters.dueDateUntil, "dd/MM/yyyy")}`
                          : "Selecionar período"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-medium">Data inicial</Label>
                            <Calendar
                              mode="single"
                              selected={filters.dueDateFrom}
                              onSelect={(date) => {
                                if (date && filters.dueDateUntil && !validateDateRange(date, filters.dueDateUntil)) {
                                  toast({
                                    title: "Intervalo inválido",
                                    description: "O intervalo de datas não pode ser maior que 3 meses",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setFilters(prev => ({ ...prev, dueDateFrom: date }));
                              }}
                              className={cn("p-0 pointer-events-auto")}
                              disabled={(date) => {
                                if (!filters.dueDateUntil) return false;
                                return date > filters.dueDateUntil;
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Data final</Label>
                            <Calendar
                              mode="single"
                              selected={filters.dueDateUntil}
                              onSelect={(date) => {
                                if (date && filters.dueDateFrom && !validateDateRange(filters.dueDateFrom, date)) {
                                  toast({
                                    title: "Intervalo inválido",
                                    description: "O intervalo de datas não pode ser maior que 3 meses",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                const newDate = date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                                setFilters(prev => ({ ...prev, dueDateUntil: newDate }));
                                if (onDateFilterChange) {
                                  onDateFilterChange(newDate);
                                }
                              }}
                              className={cn("p-0 pointer-events-auto")}
                              disabled={(date) => {
                                if (!filters.dueDateFrom) return false;
                                return date < filters.dueDateFrom;
                              }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                              setFilters(prev => ({ 
                                ...prev, 
                                dueDateFrom: today, 
                                dueDateUntil: nextWeek 
                              }));
                              if (onDateFilterChange) {
                                onDateFilterChange(nextWeek);
                              }
                            }}
                            className="w-full"
                          >
                            Hoje + 7 dias (padrão)
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard das Contas Filtradas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo por Tipo de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(filteredStats).map(([type, stats]) => {
                const totalCount = stats.pago + stats.em_aberto;
                const totalValue = stats.totalPago + stats.totalAberto;
                
                if (totalCount === 0) return null;
                
                return (
                  <Card key={type} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">
                          {getPaymentTypeLabel(type)}
                        </h4>
                        <Badge variant="outline">{totalCount}</Badge>
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-green-600">Pago:</span>
                          <span>{stats.pago} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalPago)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-orange-600">Em Aberto:</span>
                          <span>{stats.em_aberto} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalAberto)}</span>
                        </div>
                        <div className="flex justify-between font-medium border-t pt-1">
                          <span>Total:</span>
                          <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        <div className="text-sm text-muted-foreground">
          Mostrando {filteredAccounts.length} de {accounts.length} contas
          <br />
          <span className="text-xs">Intervalo máximo permitido: 3 meses</span>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.map((account) => (
              <TableRow 
                key={account.id}
                className={isOverdue(account.due_date, account.status) ? 'bg-red-50' : ''}
              >
                <TableCell className="font-medium">
                  <div>
                    <div>{account.description}</div>
                    {isOverdue(account.due_date, account.status) && (
                      <div className="text-xs text-red-600">VENCIDA</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{account.suppliers?.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {account.cost_centers?.code}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {account.cost_centers?.name}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {getPaymentTypeLabel(account.payment_type)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">
                  {formatCurrency(account.amount)}
                </TableCell>
                <TableCell>
                  <div className={isOverdue(account.due_date, account.status) ? 'text-red-600 font-semibold' : ''}>
                    {formatDate(account.due_date)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(account.status) as any}>
                    {getStatusLabel(account.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(account)}
                      title="Visualizar detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {account.status === 'em_aberto' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditAccount(account)}
                        title="Editar conta"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}

                    {account.status === 'em_aberto' && (hasRole('admin') || hasRole('pagador')) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePayAccount(account)}
                        className="text-green-600 hover:text-green-600"
                        title="Marcar como pago"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}

                    {account.status === 'em_aberto' && hasRole('admin') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelAccount(account)}
                        className="text-destructive hover:text-destructive"
                        title="Cancelar conta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de Detalhes/Edição */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Editar Conta a Pagar' : 'Detalhes da Conta a Pagar'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAccount && (
            <>
              {isEditMode ? (
                <AccountForm 
                  onSuccess={handleAccountUpdated} 
                  initialData={selectedAccount}
                />
              ) : (
                 <div className="space-y-6">
                   {/* Botão de Histórico */}
                   <div className="flex justify-end">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => handleViewHistory(selectedAccount)}
                       className="flex items-center gap-2"
                     >
                       <History className="h-4 w-4" />
                       Ver Histórico
                     </Button>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-6">
                     <div>
                       <h3 className="font-semibold mb-3">Informações Básicas</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Descrição:</span>
                          <p className="text-base">{selectedAccount.description}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Fornecedor:</span>
                          <p className="text-base">{selectedAccount.suppliers?.name}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Centro de Custo:</span>
                          <p className="text-base">
                            {selectedAccount.cost_centers?.code} - {selectedAccount.cost_centers?.name}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Tipo de Pagamento:</span>
                          <p className="text-base">
                            <Badge variant="secondary">
                              {getPaymentTypeLabel(selectedAccount.payment_type)}
                            </Badge>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3">Valores e Datas</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Valor:</span>
                          <p className="text-lg font-bold">{formatCurrency(selectedAccount.amount)}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Vencimento:</span>
                          <p className="text-base">{formatDate(selectedAccount.due_date)}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Status:</span>
                          <p className="text-base">
                            <Badge variant={getStatusColor(selectedAccount.status) as any}>
                              {getStatusLabel(selectedAccount.status)}
                            </Badge>
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Criado em:</span>
                          <p className="text-sm">{formatDate(selectedAccount.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento */}
      {selectedAccount && (
        <PaymentModal
          account={selectedAccount}
          open={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={handlePaymentCompleted}
        />
      )}

      {/* Modal de Histórico */}
      {selectedAccount && (
        <AccountHistoryModal
          accountId={selectedAccount.id}
          open={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </>
  );
};