import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PackagePlus, ArrowLeft, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Store {
  id: string;
  name: string;
  code: string;
}

interface StockReceipt {
  id: string;
  quantity: number;
  new_cost_price: number;
  new_sale_price: number;
  old_sale_price: number | null;
  notes: string | null;
  received_at: string;
  product: {
    internal_code: string;
    name: string;
  };
  received_by_profile: {
    full_name: string;
  } | null;
}

const StockReceiptsList = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
      const { data, error } = await (supabase as any)
        .from('stock_receipts')
        .select(`
          id,
          quantity,
          new_cost_price,
          new_sale_price,
          old_sale_price,
          notes,
          received_at,
          product:products(internal_code, name),
          received_by_profile:profiles!stock_receipts_received_by_fkey(full_name)
        `)
        .eq('store_id', storeId)
        .order('received_at', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
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

  const filteredReceipts = receipts.filter(r => {
    const search = searchTerm.toLowerCase();
    return (
      r.product.name.toLowerCase().includes(search) ||
      r.product.internal_code.toLowerCase().includes(search) ||
      (r.notes && r.notes.toLowerCase().includes(search))
    );
  });

  const selectedStore = stores.find(s => s.id === storeId);

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
                placeholder="Buscar por produto ou observação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando recebimentos...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {receipts.length === 0 
                ? 'Nenhum recebimento registrado para esta loja.'
                : 'Nenhum recebimento encontrado com o termo buscado.'}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead>Recebido por</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(receipt.received_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{receipt.product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {receipt.product.internal_code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {receipt.quantity.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(receipt.new_cost_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(receipt.new_sale_price)}
                      </TableCell>
                      <TableCell>
                        {receipt.received_by_profile?.full_name || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {receipt.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredReceipts.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {filteredReceipts.length} recebimento(s) encontrado(s)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockReceiptsList;
