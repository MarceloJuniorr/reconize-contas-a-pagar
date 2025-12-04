import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Warehouse, PackagePlus, Search, AlertTriangle, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { MovementHistoryModal } from '@/components/stock/MovementHistoryModal';

interface Store {
  id: string;
  name: string;
  code: string;
}

interface StockItem {
  id: string;
  product_id: string;
  store_id: string;
  quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  products: {
    internal_code: string;
    name: string;
    ean: string | null;
    units: { abbreviation: string } | null;
  };
  current_pricing?: {
    cost_price: number;
    sale_price: number;
    markup: number;
  } | null;
}

const Stock = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserStores();
  }, [user]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchStock();
    }
  }, [selectedStoreId]);

  const fetchUserStores = async () => {
    if (!user) return;

    try {
      // Buscar lojas que o usuário tem acesso
      const { data: userStores, error: userStoresError } = await (supabase as any)
        .from('user_stores')
        .select('store_id')
        .eq('user_id', user.id);

      if (userStoresError) throw userStoresError;

      // Se usuário tem lojas vinculadas, buscar detalhes delas
      // Se não tem (e é admin/operador), buscar todas
      let storesQuery = (supabase as any).from('stores').select('id, name, code').eq('active', true);
      
      if (userStores && userStores.length > 0) {
        const storeIds = userStores.map((us: any) => us.store_id);
        storesQuery = storesQuery.in('id', storeIds);
      }

      const { data: storesData, error: storesError } = await storesQuery.order('name');
      if (storesError) throw storesError;

      setStores(storesData || []);
      
      // Selecionar primeira loja automaticamente
      if (storesData && storesData.length > 0) {
        setSelectedStoreId(storesData[0].id);
      }
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStock = async () => {
    if (!selectedStoreId) return;

    try {
      setLoading(true);
      
      // Buscar estoque
      const { data: stockData, error: stockError } = await (supabase as any)
        .from('product_stock')
        .select(`
          *,
          products (
            internal_code,
            name,
            ean,
            units (abbreviation)
          )
        `)
        .eq('store_id', selectedStoreId)
        .order('products(name)');

      if (stockError) throw stockError;

      // Buscar preços atuais para cada produto
      const stockWithPricing = await Promise.all(
        (stockData || []).map(async (item: any) => {
          const { data: pricing } = await (supabase as any)
            .from('product_pricing')
            .select('cost_price, sale_price, markup')
            .eq('product_id', item.product_id)
            .eq('store_id', selectedStoreId)
            .eq('is_current', true)
            .maybeSingle();

          return {
            ...item,
            current_pricing: pricing,
          };
        })
      );

      setStockItems(stockWithPricing);
    } catch (error) {
      console.error('Erro ao buscar estoque:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar estoque",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStock = stockItems.filter((item) => {
    const search = searchTerm.toLowerCase();
    return (
      item.products.name.toLowerCase().includes(search) ||
      item.products.internal_code.toLowerCase().includes(search) ||
      (item.products.ean && item.products.ean.includes(search))
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatQuantity = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(value);
  };

  const handleViewHistory = (item: StockItem) => {
    setSelectedProductId(item.product_id);
    setSelectedProductName(`${item.products.internal_code} - ${item.products.name}`);
    setHistoryModalOpen(true);
  };

  if (!stores.length && !loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Sem Acesso</h3>
          <p className="text-muted-foreground">Você não tem lojas vinculadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Gestão de Estoque
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-full sm:w-[200px]">
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
            <Button onClick={() => navigate('/stock/receipt')}>
              <PackagePlus className="h-4 w-4 mr-2" />
              Recebimento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou EAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredStock.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto em estoque nesta loja'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-right">Markup</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.map((item) => {
                    const isLowStock = item.min_quantity && item.quantity <= item.min_quantity;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.products.internal_code}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.products.name}</span>
                            {item.products.ean && (
                              <span className="text-xs text-muted-foreground block">
                                EAN: {item.products.ean}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatQuantity(item.quantity)} {item.products.units?.abbreviation || 'UN'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.current_pricing ? formatCurrency(item.current_pricing.cost_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.current_pricing ? formatCurrency(item.current_pricing.sale_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.current_pricing ? `${item.current_pricing.markup.toFixed(2)}%` : '-'}
                        </TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Baixo
                            </Badge>
                          ) : (
                            <Badge variant="default">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewHistory(item)}
                            title="Histórico de Movimentação"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MovementHistoryModal
        productId={selectedProductId}
        storeId={selectedStoreId}
        productName={selectedProductName}
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    </div>
  );
};

export default Stock;
