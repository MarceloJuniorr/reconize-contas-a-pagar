import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, ArrowUp, ArrowDown, X, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Account {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  payment_type: string;
  created_at: string;
  cost_center_name?: string;
}

interface SupplierHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
}

type SortField = 'description' | 'amount' | 'due_date' | 'status' | 'payment_type' | 'cost_center_name';
type SortDirection = 'asc' | 'desc' | null;

interface ColumnFilters {
  description: string;
  amount: string;
  due_date: string;
  status: string;
  payment_type: string;
  cost_center_name: string;
}

export const SupplierHistoryModal = ({ isOpen, onClose, supplierId, supplierName }: SupplierHistoryModalProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    description: '',
    amount: '',
    due_date: '',
    status: '',
    payment_type: '',
    cost_center_name: '',
  });

  // Filtros mobile
  const [mobileShowFilters, setMobileShowFilters] = useState(false);
  const [mobileFilterDateType, setMobileFilterDateType] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [mobileFilterDateValue, setMobileFilterDateValue] = useState('');
  const [mobileFilterStatus, setMobileFilterStatus] = useState('all');
  const [mobileSortBy, setMobileSortBy] = useState<'recent' | 'old' | 'high_value' | 'low_value'>('recent');

  // Converte 'YYYY-MM-DD' para Date no timezone local (evita shift UTC)
  const parseDateLocal = (dateStr: string) => {
    if (!dateStr) return new Date('');
    const parts = dateStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    return new Date(year, month, day);
  };

  const fetchSupplierAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounts_payable')
        .select(`
          id,
          description,
          amount,
          due_date,
          status,
          payment_type,
          created_at,
          cost_center_id,
          cost_centers(name)
        `)
        .eq('supplier_id', supplierId)
        .order('due_date', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        amount: item.amount,
        due_date: item.due_date,
        status: item.status,
        payment_type: item.payment_type,
        created_at: item.created_at,
        cost_center_name: item.cost_centers?.name || 'N/A',
      }));

      setAccounts(formattedData);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && supplierId) {
      fetchSupplierAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, supplierId]);

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
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4 ml-1" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4 ml-1" />;
    return <ArrowUpDown className="h-4 w-4 ml-1" />;
  };

  const handleColumnFilterChange = (column: keyof ColumnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const clearFilters = () => {
    setColumnFilters({
      description: '',
      amount: '',
      due_date: '',
      status: '',
      payment_type: '',
      cost_center_name: '',
    });
    setSortField(null);
    setSortDirection(null);
  };

  const filteredAndSortedAccounts = useMemo(() => {
    let result = [...accounts];

    // Desktop filters
    // Apply column filters
    if (columnFilters.description) {
      result = result.filter(a =>
        a.description.toLowerCase().includes(columnFilters.description.toLowerCase())
      );
    }
    if (columnFilters.amount) {
      result = result.filter(a =>
        a.amount.toString().includes(columnFilters.amount)
      );
    }
    if (columnFilters.due_date) {
      result = result.filter(a => {
        if (typeof a.due_date === 'string' && a.due_date.includes('-')) {
          const [year, month, day] = a.due_date.split('-');
          const newDate = `${day}/${month}/${year}`;
          return newDate.includes(columnFilters.due_date)
        }
      });
    }
    if (columnFilters.status) {
      const statusMap: Record<string, string> = {
        'em_aberto': 'Em Aberto',
        'pago': 'Pago',
        'cancelado': 'Cancelado',
      };
      result = result.filter(a =>
        (statusMap[a.status] || a.status).toLowerCase().includes(columnFilters.status.toLowerCase())
      );
    }
    if (columnFilters.payment_type) {
      const typeMap: Record<string, string> = {
        'boleto': 'Boleto',
        'pix': 'PIX',
        'transferencia': 'Transferência',
        'cartao': 'Cartão',
      };
      result = result.filter(a =>
        (typeMap[a.payment_type] || a.payment_type).toLowerCase().includes(columnFilters.payment_type.toLowerCase())
      );
    }
    if (columnFilters.cost_center_name) {
      result = result.filter(a =>
        (a.cost_center_name || '').toLowerCase().includes(columnFilters.cost_center_name.toLowerCase())
      );
    }

    // Mobile filters
    if (mobileFilterStatus !== 'all') {
      result = result.filter(a => a.status === mobileFilterStatus);
    }

    if (mobileFilterDateType !== 'all' && mobileFilterDateValue) {
      result = result.filter(a => {
        const [year, month, day] = a.due_date.split('-');
        if (mobileFilterDateType === 'day') {
          return `${day}/${month}/${year}` === mobileFilterDateValue;
        } else if (mobileFilterDateType === 'month') {
          return `${month}/${year}` === mobileFilterDateValue;
        } else if (mobileFilterDateType === 'year') {
          return year === mobileFilterDateValue;
        }
        return true;
      });
    }

    // Apply sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

        if (sortField === 'amount') {
          aValue = Number(aValue);
          bValue = Number(bValue);
        } else if (sortField === 'due_date') {
          aValue = parseDateLocal(aValue).getTime();
          bValue = parseDateLocal(bValue).getTime();
        } else {
          aValue = (aValue || '').toString().toLowerCase();
          bValue = (bValue || '').toString().toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else if (mobileSortBy) {
      result.sort((a, b) => {
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

    return result;
  }, [accounts, columnFilters, sortField, sortDirection, mobileFilterDateType, mobileFilterDateValue, mobileFilterStatus, mobileSortBy]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const today = new Date().toISOString().split('T')[0];

    if (status === 'pago') {
      return <Badge className="bg-green-500 hover:bg-green-600">Pago</Badge>;
    }
    if (status === 'cancelado') {
      return <Badge variant="secondary">Cancelado</Badge>;
    }
    if (dueDate < today) {
      return <Badge variant="destructive">Vencida</Badge>;
    }
    if (dueDate === today) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Vence Hoje</Badge>;
    }
    return <Badge variant="outline">Em Aberto</Badge>;
  };

  const getPaymentTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'boleto': 'Boleto',
      'pix': 'PIX',
      'transferencia': 'Transferência',
      'cartao': 'Cartão',
    };
    return types[type] || type;
  };

  const totalAberto = filteredAndSortedAccounts
    .filter(a => a.status === 'em_aberto')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalPago = filteredAndSortedAccounts
    .filter(a => a.status === 'pago')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const hasActiveFilters = Object.values(columnFilters).some(v => v !== '') || sortField !== null;
  const clearMobileFilters = () => {
    setMobileFilterDateType('all');
    setMobileFilterDateValue('');
    setMobileFilterStatus('all');
    setMobileSortBy('recent');
  };

  const hasMobileFilters = mobileFilterDateType !== 'all' || mobileFilterDateValue !== '' || mobileFilterStatus !== 'all' || mobileSortBy !== 'recent';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Contas - {supplierName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total de Contas</p>
              <p className="text-2xl font-bold">{filteredAndSortedAccounts.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total em Aberto</p>
              <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalAberto)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Pago</p>
              <p className="text-2xl font-bold text-green-500">{formatCurrency(totalPago)}</p>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="hidden md:flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}

          {/* Mobile filters button */}
          <div className="md:hidden flex gap-2">
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
            <div className="md:hidden bg-muted/50 rounded-lg p-4 space-y-4">
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
                    onChange={(e) => setMobileFilterDateValue(e.target.value)}
                    className="h-8 text-xs"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={mobileFilterStatus} onValueChange={setMobileFilterStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="em_aberto">Em Aberto</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
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

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-muted-foreground">Carregando histórico...</div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma conta encontrada para este fornecedor.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              {/* Mobile: cards com filtros aplicados */}
              <div className="md:hidden divide-y">
                {filteredAndSortedAccounts.map((account) => (
                  <div key={account.id} className="p-3 hover:bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm line-clamp-2">{account.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {getPaymentTypeLabel(account.payment_type)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {format(parseDateLocal(account.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="text-lg font-bold">{formatCurrency(account.amount)}</div>
                      {getStatusBadge(account.status, account.due_date)}
                    </div>

                    <div className="text-xs text-muted-foreground mt-2">
                      Centro: {account.cost_center_name}
                    </div>
                  </div>
                ))}
                {filteredAndSortedAccounts.length === 0 && accounts.length > 0 && (
                  <div className="p-4 text-center">
                    <p className="text-muted-foreground text-sm">Nenhuma conta encontrada com os filtros aplicados.</p>
                    <Button variant="outline" size="sm" onClick={clearMobileFilters} className="mt-2">
                      Limpar Filtros
                    </Button>
                  </div>
                )}
              </div>

              {/* Desktop/tablet: manter tabela original */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('description')} className="h-8 px-2">
                          Descrição {getSortIcon('description')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('amount')} className="h-8 px-2">
                          Valor {getSortIcon('amount')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('due_date')} className="h-8 px-2">
                          Vencimento {getSortIcon('due_date')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="h-8 px-2">
                          Status {getSortIcon('status')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('payment_type')} className="h-8 px-2">
                          Tipo {getSortIcon('payment_type')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('cost_center_name')} className="h-8 px-2">
                          Centro de Custo {getSortIcon('cost_center_name')}
                        </Button>
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="py-2">
                        <Input
                          placeholder="Filtrar..."
                          value={columnFilters.description}
                          onChange={(e) => handleColumnFilterChange('description', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableHead>
                      <TableHead className="py-2">
                        <Input
                          placeholder="Filtrar..."
                          value={columnFilters.amount}
                          onChange={(e) => handleColumnFilterChange('amount', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableHead>
                      <TableHead className="py-2">
                        <Input
                          placeholder="dd/mm/aaaa"
                          value={columnFilters.due_date}
                          onChange={(e) => handleColumnFilterChange('due_date', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableHead>
                      <TableHead className="py-2">
                        <Input
                          placeholder="Filtrar..."
                          value={columnFilters.status}
                          onChange={(e) => handleColumnFilterChange('status', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableHead>
                      <TableHead className="py-2">
                        <Input
                          placeholder="Filtrar..."
                          value={columnFilters.payment_type}
                          onChange={(e) => handleColumnFilterChange('payment_type', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableHead>
                      <TableHead className="py-2">
                        <Input
                          placeholder="Filtrar..."
                          value={columnFilters.cost_center_name}
                          onChange={(e) => handleColumnFilterChange('cost_center_name', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {account.description}
                        </TableCell>
                        <TableCell>{formatCurrency(account.amount)}</TableCell>
                        <TableCell>
                          {format(parseDateLocal(account.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(account.status, account.due_date)}
                        </TableCell>
                        <TableCell>{getPaymentTypeLabel(account.payment_type)}</TableCell>
                        <TableCell>{account.cost_center_name}</TableCell>
                      </TableRow>
                    ))}
                    {filteredAndSortedAccounts.length === 0 && accounts.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <p className="text-muted-foreground">Nenhuma conta encontrada com os filtros aplicados.</p>
                          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                            Limpar Filtros
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                +              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
