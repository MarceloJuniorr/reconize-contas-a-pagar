import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Edit, Eye, CheckCircle, X, Download, History, Filter, CalendarIcon, Paperclip, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AccountForm } from './AccountForm';
import { PaymentModal } from './PaymentModal';
import { AccountHistoryModal } from './AccountHistoryModal';
import { AttachmentsModal } from './AttachmentsModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Attachment {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  source: 'account' | 'payment';
}

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
  onUpdate: (customDateFromFilter?: Date, customDateUntilFilter?: Date) => void;
  onDateFilterChange?: (customDateFromFilter?: Date, customDateUntilFilter?: Date) => void;
}

interface Filters {
  supplier: string;
  costCenter: string;
  paymentType: string;
  status: string;
  dueDateFrom: Date | undefined;
  dueDateUntil: Date | undefined;
}

type SortField = 'description' | 'supplier' | 'cost_center' | 'payment_type' | 'amount' | 'due_date' | 'status';
type SortDirection = 'asc' | 'desc' | null;

interface ColumnFilters {
  description: string;
  supplier: string;
  costCenter: string;
  paymentType: string;
  amount: string;
  dueDate: string;
  status: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDateInput = (value: string, type: 'day' | 'month' | 'year') => {
  // Remove tudo que não é número
  let numOnly = value.replace(/\D/g, '');

  if (type === 'day') {
    // Formato: dd/mm/yyyy
    if (numOnly.length > 8) numOnly = numOnly.slice(0, 8);
    if (numOnly.length >= 2) {
      numOnly = numOnly.slice(0, 2) + '/' + numOnly.slice(2);
    }
    if (numOnly.length >= 5) {
      numOnly = numOnly.slice(0, 5) + '/' + numOnly.slice(5);
    }
  } else if (type === 'month') {
    // Formato: mm/yyyy
    if (numOnly.length > 6) numOnly = numOnly.slice(0, 6);
    if (numOnly.length >= 2) {
      numOnly = numOnly.slice(0, 2) + '/' + numOnly.slice(2);
    }
  } else if (type === 'year') {
    // Formato: yyyy
    if (numOnly.length > 4) numOnly = numOnly.slice(0, 4);
  }

  return numOnly;
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
const getStatusLabel = (status: string, dueDate: string) => {
  if (status === 'em_aberto') {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    if (dueDate === todayStr) {
      return 'Vence Hoje';
    } else if (dueDate < todayStr) {
      return 'Vencida';
    }
    return 'Em Aberto';
  }

  switch (status) {
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

export const AccountsList = ({ accounts, loading, onUpdate, onDateFilterChange }: AccountsListProps) => {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openCardActions, setOpenCardActions] = useState<string | null>(null);
  const [mobileShowFilters, setMobileShowFilters] = useState(false);
  const [mobileFilterStatus, setMobileFilterStatus] = useState('all');
  const [mobileFilterSupplier, setMobileFilterSupplier] = useState('all');
  const [mobileFilterPaymentType, setMobileFilterPaymentType] = useState('all');
  const [mobileFilterDateType, setMobileFilterDateType] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [mobileFilterDateValue, setMobileFilterDateValue] = useState('');
  const [mobileSortBy, setMobileSortBy] = useState<'recent' | 'old' | 'high_value' | 'low_value'>('recent');
  const [filters, setFilters] = useState<Filters>({
    supplier: 'all',
    costCenter: 'all',
    paymentType: 'all',
    status: 'all',
    dueDateFrom: undefined,
    dueDateUntil: undefined,
  });
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    description: '',
    supplier: '',
    costCenter: '',
    paymentType: '',
    amount: '',
    dueDate: '',
    status: '',
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

  // Filter accounts based on selected filters and column filters
  const filteredAccounts = useMemo(() => {
    let filtered = accounts.filter(account => {
      // Existing desktop filters
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
      if (filters.dueDateFrom || filters.dueDateUntil) {
        const accountDate = new Date(account.due_date);
        accountDate.setHours(0, 0, 0, 0);

        if (filters.dueDateFrom) {
          const fromDate = new Date(filters.dueDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (accountDate < fromDate) {
            return false;
          }
        }

        if (filters.dueDateUntil) {
          const untilDate = new Date(filters.dueDateUntil);
          untilDate.setHours(23, 59, 59, 999);
          if (accountDate > untilDate) {
            return false;
          }
        }
      }

      // Mobile filters
      if (mobileFilterStatus !== 'all' && account.status !== mobileFilterStatus) {
        return false;
      }
      if (mobileFilterSupplier !== 'all' && account.suppliers?.name !== mobileFilterSupplier) {
        return false;
      }
      if (mobileFilterPaymentType !== 'all' && account.payment_type !== mobileFilterPaymentType) {
        return false;
      }

      // Mobile date filters
      if (mobileFilterDateType !== 'all' && mobileFilterDateValue) {
        const [year, month, day] = account.due_date.split('-');
        if (mobileFilterDateType === 'day') {
          return `${day}/${month}/${year}` === mobileFilterDateValue;
        } else if (mobileFilterDateType === 'month') {
          return `${month}/${year}` === mobileFilterDateValue;
        } else if (mobileFilterDateType === 'year') {
          return year === mobileFilterDateValue;
        }
      }

      // Column filters
      if (columnFilters.description && !account.description.toLowerCase().includes(columnFilters.description.toLowerCase())) {
        return false;
      }
      if (columnFilters.supplier && !account.suppliers?.name.toLowerCase().includes(columnFilters.supplier.toLowerCase())) {
        return false;
      }
      if (columnFilters.costCenter && !`${account.cost_centers?.code} - ${account.cost_centers?.name}`.toLowerCase().includes(columnFilters.costCenter.toLowerCase())) {
        return false;
      }
      if (columnFilters.paymentType && !getPaymentTypeLabel(account.payment_type).toLowerCase().includes(columnFilters.paymentType.toLowerCase())) {
        return false;
      }
      if (columnFilters.amount && !formatCurrency(account.amount).includes(columnFilters.amount)) {
        return false;
      }
      if (columnFilters.dueDate && !formatDate(account.due_date).includes(columnFilters.dueDate)) {
        return false;
      }
      if (columnFilters.status && !getStatusLabel(account.status, account.due_date).toLowerCase().includes(columnFilters.status.toLowerCase())) {
        return false;
      }

      return true;
    });

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'description':
            aValue = a.description.toLowerCase();
            bValue = b.description.toLowerCase();
            break;
          case 'supplier':
            aValue = a.suppliers?.name.toLowerCase() || '';
            bValue = b.suppliers?.name.toLowerCase() || '';
            break;
          case 'cost_center':
            aValue = `${a.cost_centers?.code} - ${a.cost_centers?.name}`.toLowerCase();
            bValue = `${b.cost_centers?.code} - ${b.cost_centers?.name}`.toLowerCase();
            break;
          case 'payment_type':
            aValue = getPaymentTypeLabel(a.payment_type);
            bValue = getPaymentTypeLabel(b.payment_type);
            break;
          case 'amount':
            aValue = Number(a.amount);
            bValue = Number(b.amount);
            break;
          case 'due_date':
            aValue = new Date(a.due_date).getTime();
            bValue = new Date(b.due_date).getTime();
            break;
          case 'status':
            aValue = getStatusLabel(a.status, a.due_date);
            bValue = getStatusLabel(b.status, b.due_date);
            break;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else if (mobileSortBy) {
      // Mobile sorting
      filtered = [...filtered].sort((a, b) => {
        if (mobileSortBy === 'recent') {
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        } else if (mobileSortBy === 'old') {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        } else if (mobileSortBy === 'high_value') {
          return Number(b.amount) - Number(a.amount);
        } else if (mobileSortBy === 'low_value') {
          return Number(a.amount) - Number(b.amount);
        }
        return 0;
      });
    }

    return filtered;
  }, [accounts, filters, columnFilters, sortField, sortDirection, mobileFilterStatus, mobileFilterSupplier, mobileFilterPaymentType, mobileFilterDateType, mobileFilterDateValue, mobileSortBy]);

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
      dueDateFrom: undefined,
      dueDateUntil: undefined,
    };
    setFilters(newFilters);
    setColumnFilters({
      description: '',
      supplier: '',
      costCenter: '',
      paymentType: '',
      amount: '',
      dueDate: '',
      status: '',
    });
    setSortField(null);
    setSortDirection(null);
    if (onDateFilterChange) {
      onDateFilterChange(undefined);
    }
  };

  const clearMobileFilters = () => {
    setMobileFilterStatus('all');
    setMobileFilterSupplier('all');
    setMobileFilterPaymentType('all');
    setMobileFilterDateType('all');
    setMobileFilterDateValue('');
    setMobileSortBy('recent');
  };

  const hasMobileFilters = mobileFilterStatus !== 'all' || mobileFilterSupplier !== 'all' || mobileFilterPaymentType !== 'all' || mobileFilterDateType !== 'all' || mobileFilterDateValue !== '' || mobileSortBy !== 'recent';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
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

  const handleViewAttachments = (account: Account) => {
    setSelectedAccount(account);
    setIsAttachmentsOpen(true);
  };

  const getStatusColor = (status: string, dueDate: string) => {
    if (status === 'em_aberto') {
      const today = new Date();
      const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

      if (dueDate === todayStr) {
        return 'warning'; // Vence hoje - amarelo
      } else if (dueDate < todayStr) {
        return 'destructive'; // Vencida - vermelho
      }
      return 'default'; // Em aberto - azul
    }

    switch (status) {
      case 'pago':
        return 'success';
      case 'cancelado':
        return 'destructive';
      default:
        return 'secondary';
    }
  };



  const isOverdue = (dueDate: string, status: string) => {
    if (status !== 'em_aberto') return false;
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    const result = dueDate < todayStr;
    console.log(`isOverdue debug: dueDate=${dueDate}, todayStr=${todayStr}, result=${result}`);
    return result;
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


  return (
    <>
      {/* Filtros Desktop */}
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
            (filters.dueDateFrom && filters.dueDateFrom.getTime() !== new Date().setHours(0, 0, 0, 0)) ||
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
                          {status === 'em_aberto' ? 'Em Aberto' : status === 'pago' ? 'Pago' : status === 'cancelado' ? 'Cancelado' : status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        </div>
      </div>

      {/* Mobile filters button */}
      <div className="md:hidden flex gap-2 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileShowFilters(!mobileShowFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
        {hasMobileFilters && (
          <Button variant="ghost" size="sm" onClick={clearMobileFilters} className="text-muted-foreground">
            Limpar
          </Button>
        )}
      </div>

      {/* Mobile filters panel */}
      {mobileShowFilters && (
        <div className="md:hidden bg-muted/50 rounded-lg p-4 space-y-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Filtrar por Data</label>
            <Select value={mobileFilterDateType} onValueChange={(value: any) => setMobileFilterDateType(value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as datas</SelectItem>
                <SelectItem value="day">Por Dia</SelectItem>
                <SelectItem value="month">Por Mês</SelectItem>
                <SelectItem value="year">Por Ano</SelectItem>
              </SelectContent>
            </Select>
            {mobileFilterDateType !== 'all' && (
              <Input
                placeholder={
                  mobileFilterDateType === 'day' ? 'dd/mm/yyyy' :
                    mobileFilterDateType === 'month' ? 'mm/yyyy' :
                      'yyyy'
                }
                value={mobileFilterDateValue}
                onChange={(e) => setMobileFilterDateValue(formatDateInput(e.target.value, mobileFilterDateType))}
                className="h-8 text-xs"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fornecedor</label>
            <Select value={mobileFilterSupplier} onValueChange={setMobileFilterSupplier}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Pagamento</label>
            <Select value={mobileFilterPaymentType} onValueChange={setMobileFilterPaymentType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={mobileFilterStatus} onValueChange={setMobileFilterStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filterOptions.statuses.map(status => (
                  <SelectItem key={status} value={status}>
                    {status === 'em_aberto' ? 'Em Aberto' : status === 'pago' ? 'Pago' : status === 'cancelado' ? 'Cancelado' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ordenar por</label>
            <Select value={mobileSortBy} onValueChange={(value: any) => setMobileSortBy(value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais Recente</SelectItem>
                <SelectItem value="old">Mais Antigo</SelectItem>
                <SelectItem value="high_value">Valor Mais Alto</SelectItem>
                <SelectItem value="low_value">Valor Mais Baixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        {/* Mobile: cards */}
        <div className="md:hidden divide-y">
          {filteredAccounts.map((acc) => (
            <div
              key={acc.id}
              className="p-4 hover:bg-muted/50 cursor-pointer"
              onClick={() => setOpenCardActions(openCardActions === acc.id ? null : acc.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">{acc.suppliers?.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{getPaymentTypeLabel(acc.payment_type)}</div>
                </div>
                <div className="text-xs text-muted-foreground text-right">{formatDate(acc.due_date)}</div>
              </div>
              <div className="text-sm text-muted-foreground mt-2 line-clamp-2">{acc.description}</div>
              <div className="flex items-center justify-between mt-3">
                <div className="text-lg font-bold">{formatCurrency(acc.amount)}</div>
                <Badge variant={getStatusColor(acc.status, acc.due_date) as any}>
                  {getStatusLabel(acc.status, acc.due_date)}
                </Badge>
              </div>

              {/* Ações visíveis ao clicar no card */}
              {openCardActions === acc.id && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetails(acc); }} title="Visualizar detalhes">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewHistory(acc); }} title="Ver histórico">
                    <History className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewAttachments(acc); }} title="Ver anexos">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  {acc.status === 'em_aberto' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditAccount(acc); }} title="Editar conta">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {(hasRole('admin') || hasRole('pagador')) && (
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePayAccount(acc); }} className="text-green-600 hover:text-green-600" title="Marcar como pago">
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {hasRole('admin') && (
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCancelAccount(acc); }} className="text-destructive hover:text-destructive" title="Cancelar conta">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {filteredAccounts.length === 0 && accounts.length > 0 && (
            <div className="p-4 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma conta encontrada com os filtros aplicados.</p>
              <Button variant="outline" size="sm" onClick={clearMobileFilters} className="mt-2">
                Limpar Filtros
              </Button>
            </div>
          )}
        </div>

        {/* Desktop/tablet: manter tabela original */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('description')}>
                  <div className="flex items-center">
                    Descrição
                    {getSortIcon('description')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('supplier')}>
                  <div className="flex items-center">
                    Fornecedor
                    {getSortIcon('supplier')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('cost_center')}>
                  <div className="flex items-center">
                    Centro de Custo
                    {getSortIcon('cost_center')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('payment_type')}>
                  <div className="flex items-center">
                    Tipo
                    {getSortIcon('payment_type')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('amount')}>
                  <div className="flex items-center">
                    Valor
                    {getSortIcon('amount')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('due_date')}>
                  <div className="flex items-center">
                    Vencimento
                    {getSortIcon('due_date')}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="p-2">
                  <Input
                    placeholder="Filtrar..."
                    value={columnFilters.description}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, description: e.target.value }))}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    placeholder="Filtrar..."
                    value={columnFilters.supplier}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, supplier: e.target.value }))}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    placeholder="Filtrar..."
                    value={columnFilters.costCenter}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, costCenter: e.target.value }))}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    placeholder="Filtrar..."
                    value={columnFilters.paymentType}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, paymentType: e.target.value }))}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    placeholder="Filtrar..."
                    value={columnFilters.amount}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, amount: e.target.value }))}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    placeholder="Filtrar..."
                    value={columnFilters.dueDate}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    placeholder="Filtrar..."
                    value={columnFilters.status}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2"></TableHead>
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
                    <Badge variant={getStatusColor(account.status, account.due_date) as any}>
                      {getStatusLabel(account.status, account.due_date)}
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

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAttachments(account)}
                        title="Ver anexos"
                      >
                        <Paperclip className="h-4 w-4" />
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
                            <Badge variant={getStatusColor(selectedAccount.status, selectedAccount.due_date) as any}>
                              {getStatusLabel(selectedAccount.status, selectedAccount.due_date)}
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

      {/* Modal de Anexos */}
      {selectedAccount && (
        <AttachmentsModal
          accountId={selectedAccount.id}
          open={isAttachmentsOpen}
          onClose={() => setIsAttachmentsOpen(false)}
        />
      )}
    </>
  );
};