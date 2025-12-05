import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PackagePlus, ArrowLeft, Plus, Search, Eye, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReceiptDetailModal } from '@/components/stock/ReceiptDetailModal';
import { useIsMobile } from '@/hooks/use-mobile';

interface Store {
  id: string;
  name: string;
  code: string;
}

interface ReceiptHeader {
  id: string;
  receipt_number: string;
  invoice_number: string | null;
  notes: string | null;
  status: string;
  received_at: string;
  received_by: string | null;
  supplier: { name: string } | null;
  items_count?: number;
  total_value?: number;
}

type SortKey = 'receipt_number' | 'invoice_number' | 'supplier' | 'received_at' | 'items_count' | 'total_value' | 'status';
type SortDirection = 'asc' | 'desc';

const StockReceiptsList = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [receipts, setReceipts] = useState<ReceiptHeader[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Filtros e ordenação
  const [sortKey, setSortKey] = useState<SortKey>('received_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterNumber, setFilterNumber] = useState('');
  const [filterInvoice, setFilterInvoice] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchStores();
  }, [user]);

  useEffect(() => {
    const storeParam = searchParams.get('store');
    if (storeParam && stores.length > 0) {
      const storeExists = stores.some(s => s.id === storeParam);
      if (storeExists) {
        setStoreId(storeParam);
      }
    }
  }, [searchParams, stores]);

  useEffect(() => {
    if (storeId) {
      fetchReceipts();
    }
  }, [storeId]);

  const fetchStores = async () => {
    if (!user) return;

    try {
      const { data: userStores } = await (supabase as any)
        .from('user_stores')
        .select('store_id')
        .eq('user_id', user.id);

      let storesQuery = (supabase as any).from('stores').select('id, name, code').eq('active', true);
      
      if (userStores && userStores.length > 0) {
        const storeIds = userStores.map((us: any) => us.store_id);
        storesQuery = storesQuery.in('id', storeIds);
      }

      const { data: storesData } = await storesQuery.order('name');
      setStores(storesData || []);

      if (storesData && storesData.length > 0 && !storeId) {
        setStoreId(storesData[0].id);
      }
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    if (!storeId) return;

    try {
      setLoading(true);
      
      // Fetch receipt headers
      const { data: headersData, error: headersError } = await (supabase as any)
        .from('stock_receipt_headers')
        .select(`
          id,
          receipt_number,
          invoice_number,
          notes,
          status,
          received_at,
          received_by,
          supplier:suppliers(name)
        `)
        .eq('store_id', storeId)
        .order('received_at', { ascending: false });

      if (headersError) throw headersError;

      // For each header, count items and calculate total
      const headersWithTotals = await Promise.all(
        (headersData || []).map(async (header: ReceiptHeader) => {
          const { data: items } = await (supabase as any)
            .from('stock_receipts')
            .select('quantity, new_cost_price')
            .eq('header_id', header.id);

          const itemsCount = items?.length || 0;
          const totalValue = (items || []).reduce((sum: number, item: any) => 
            sum + (item.quantity * item.new_cost_price), 0);

          return {
            ...header,
            items_count: itemsCount,
            total_value: totalValue,
          };
        })
      );

      setReceipts(headersWithTotals);

      // Fetch profiles for received_by users
      const userIds = [...new Set((headersData || []).map((r: ReceiptHeader) => r.received_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profilesMap = new Map<string, string>();
        (profilesData || []).forEach((p: any) => {
          profilesMap.set(p.id, p.full_name);
        });
        setProfiles(profilesMap);
      }
    } catch (error) {
      console.error('Erro ao buscar recebimentos:', error);
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

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const formatDateShort = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yy", { locale: ptBR });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterNumber('');
    setFilterInvoice('');
    setFilterSupplier('');
    setFilterStatus('');
  };

  const hasActiveFilters = filterNumber || filterInvoice || filterSupplier || filterStatus || searchTerm;

  const filteredAndSortedReceipts = useMemo(() => {
    let result = receipts.filter(r => {
      // Busca geral
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
          r.receipt_number.toLowerCase().includes(search) ||
          (r.invoice_number && r.invoice_number.toLowerCase().includes(search)) ||
          (r.supplier?.name && r.supplier.name.toLowerCase().includes(search)) ||
          (r.notes && r.notes.toLowerCase().includes(search))
        );
        if (!matchesSearch) return false;
      }

      // Filtros individuais
      if (filterNumber && !r.receipt_number.toLowerCase().includes(filterNumber.toLowerCase())) return false;
      if (filterInvoice && !(r.invoice_number && r.invoice_number.toLowerCase().includes(filterInvoice.toLowerCase()))) return false;
      if (filterSupplier && !(r.supplier?.name && r.supplier.name.toLowerCase().includes(filterSupplier.toLowerCase()))) return false;
      if (filterStatus && r.status !== filterStatus) return false;

      return true;
    });

    // Ordenação
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortKey) {
        case 'receipt_number':
          aVal = a.receipt_number;
          bVal = b.receipt_number;
          break;
        case 'invoice_number':
          aVal = a.invoice_number || '';
          bVal = b.invoice_number || '';
          break;
        case 'supplier':
          aVal = a.supplier?.name || '';
          bVal = b.supplier?.name || '';
          break;
        case 'received_at':
          aVal = new Date(a.received_at).getTime();
          bVal = new Date(b.received_at).getTime();
          break;
        case 'items_count':
          aVal = a.items_count || 0;
          bVal = b.items_count || 0;
          break;
        case 'total_value':
          aVal = a.total_value || 0;
          bVal = b.total_value || 0;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [receipts, searchTerm, filterNumber, filterInvoice, filterSupplier, filterStatus, sortKey, sortDirection]);

  const handleViewReceipt = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setDetailModalOpen(true);
  };

  if (loading && stores.length === 0) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Você não tem acesso a nenhuma loja.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/stock')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Histórico de Recebimentos
            </CardTitle>
          </div>
          <Button onClick={() => navigate(`/stock/receipt/new?store=${storeId}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Recebimento
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-64">
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.code} - {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, nota fiscal ou fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando recebimentos...</div>
          ) : filteredAndSortedReceipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {receipts.length === 0 
                ? 'Nenhum recebimento registrado para esta loja.'
                : 'Nenhum recebimento encontrado com os filtros aplicados.'}
            </div>
          ) : isMobile ? (
            // Mobile: Cards
            <div className="space-y-3">
              {filteredAndSortedReceipts.map((receipt) => (
                <Card key={receipt.id} className="cursor-pointer" onClick={() => handleViewReceipt(receipt.id)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono font-medium">{receipt.receipt_number}</p>
                        <p className="text-sm text-muted-foreground">{formatDateShort(receipt.received_at)}</p>
                      </div>
                      <Badge variant={receipt.status === 'active' ? 'default' : 'destructive'}>
                        {receipt.status === 'active' ? 'Ativo' : 'Cancelado'}
                      </Badge>
                    </div>
                    {receipt.supplier?.name && (
                      <p className="text-sm mb-1">
                        <span className="text-muted-foreground">Fornecedor:</span> {receipt.supplier.name}
                      </p>
                    )}
                    {receipt.invoice_number && (
                      <p className="text-sm mb-1">
                        <span className="text-muted-foreground">NF:</span> {receipt.invoice_number}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Itens:</span> {receipt.items_count}
                      </div>
                      <div className="font-medium">
                        {formatCurrency(receipt.total_value || 0)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop: Table with filters
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="space-y-1">
                        <button
                          className="flex items-center font-medium hover:text-primary"
                          onClick={() => handleSort('receipt_number')}
                        >
                          Número {getSortIcon('receipt_number')}
                        </button>
                        <Input
                          placeholder="Filtrar..."
                          value={filterNumber}
                          onChange={(e) => setFilterNumber(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <button
                          className="flex items-center font-medium hover:text-primary"
                          onClick={() => handleSort('invoice_number')}
                        >
                          Nota Fiscal {getSortIcon('invoice_number')}
                        </button>
                        <Input
                          placeholder="Filtrar..."
                          value={filterInvoice}
                          onChange={(e) => setFilterInvoice(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <button
                          className="flex items-center font-medium hover:text-primary"
                          onClick={() => handleSort('supplier')}
                        >
                          Fornecedor {getSortIcon('supplier')}
                        </button>
                        <Input
                          placeholder="Filtrar..."
                          value={filterSupplier}
                          onChange={(e) => setFilterSupplier(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <button
                          className="flex items-center font-medium hover:text-primary"
                          onClick={() => handleSort('received_at')}
                        >
                          Data {getSortIcon('received_at')}
                        </button>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="space-y-1">
                        <button
                          className="flex items-center font-medium hover:text-primary ml-auto"
                          onClick={() => handleSort('items_count')}
                        >
                          Itens {getSortIcon('items_count')}
                        </button>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="space-y-1">
                        <button
                          className="flex items-center font-medium hover:text-primary ml-auto"
                          onClick={() => handleSort('total_value')}
                        >
                          Valor Total {getSortIcon('total_value')}
                        </button>
                      </div>
                    </TableHead>
                    <TableHead>Recebido por</TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <button
                          className="flex items-center font-medium hover:text-primary"
                          onClick={() => handleSort('status')}
                        >
                          Status {getSortIcon('status')}
                        </button>
                        <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedReceipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono font-medium">
                        {receipt.receipt_number}
                      </TableCell>
                      <TableCell>
                        {receipt.invoice_number || '-'}
                      </TableCell>
                      <TableCell>
                        {receipt.supplier?.name || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(receipt.received_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {receipt.items_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(receipt.total_value || 0)}
                      </TableCell>
                      <TableCell>
                        {receipt.received_by ? profiles.get(receipt.received_by) || '-' : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={receipt.status === 'active' ? 'default' : 'destructive'}>
                          {receipt.status === 'active' ? 'Ativo' : 'Cancelado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReceipt(receipt.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredAndSortedReceipts.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {filteredAndSortedReceipts.length} recebimento(s) encontrado(s)
            </div>
          )}
        </CardContent>
      </Card>

      <ReceiptDetailModal
        receiptId={selectedReceiptId}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onCancelled={fetchReceipts}
      />
    </div>
  );
};

export default StockReceiptsList;
