import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PackagePlus, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Store {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  internal_code: string;
  name: string;
  ean: string | null;
  units: { abbreviation: string } | null;
}

const StockReceipt = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const [formData, setFormData] = useState({
    store_id: '',
    product_id: '',
    quantity: '',
    new_cost_price: '',
    new_sale_price: '',
    notes: '',
  });

  const [currentPricing, setCurrentPricing] = useState<{
    cost_price: number;
    sale_price: number;
  } | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (formData.store_id && formData.product_id) {
      fetchCurrentPricing();
    } else {
      setCurrentPricing(null);
    }
  }, [formData.store_id, formData.product_id]);

  const fetchInitialData = async () => {
    if (!user) return;

    try {
      // Buscar lojas do usuário
      const { data: userStores } = await supabase
        .from('user_stores')
        .select('store_id')
        .eq('user_id', user.id);

      let storesQuery = supabase.from('stores').select('id, name, code').eq('active', true);
      
      if (userStores && userStores.length > 0) {
        const storeIds = userStores.map(us => us.store_id);
        storesQuery = storesQuery.in('id', storeIds);
      }

      const { data: storesData } = await storesQuery.order('name');
      setStores(storesData || []);

      if (storesData && storesData.length > 0) {
        setFormData(prev => ({ ...prev, store_id: storesData[0].id }));
      }

      // Buscar produtos
      const { data: productsData } = await supabase
        .from('products')
        .select('id, internal_code, name, ean, units(abbreviation)')
        .eq('active', true)
        .order('name');

      setProducts(productsData || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPricing = async () => {
    const { data } = await supabase
      .from('product_pricing')
      .select('cost_price, sale_price')
      .eq('product_id', formData.product_id)
      .eq('store_id', formData.store_id)
      .eq('is_current', true)
      .maybeSingle();

    setCurrentPricing(data);
  };

  const calculateMarkup = () => {
    const cost = parseFloat(formData.new_cost_price.replace(',', '.')) || 0;
    const sale = parseFloat(formData.new_sale_price.replace(',', '.')) || 0;
    
    if (cost <= 0) return 0;
    return ((sale - cost) / cost) * 100;
  };

  const handleSubmit = async () => {
    if (!formData.store_id || !formData.product_id || !formData.quantity || !formData.new_cost_price || !formData.new_sale_price) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const quantity = parseFloat(formData.quantity.replace(',', '.'));
      const newCostPrice = parseFloat(formData.new_cost_price.replace(',', '.'));
      const newSalePrice = parseFloat(formData.new_sale_price.replace(',', '.'));

      const { error } = await supabase.from('stock_receipts').insert({
        store_id: formData.store_id,
        product_id: formData.product_id,
        quantity,
        old_sale_price: currentPricing?.sale_price || null,
        new_cost_price: newCostPrice,
        new_sale_price: newSalePrice,
        notes: formData.notes || null,
        received_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Recebimento registrado com sucesso",
      });

      // Limpar formulário e voltar
      setFormData({
        store_id: formData.store_id,
        product_id: '',
        quantity: '',
        new_cost_price: '',
        new_sale_price: '',
        notes: '',
      });
      setCurrentPricing(null);
    } catch (error: any) {
      console.error('Erro ao registrar recebimento:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao registrar recebimento",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find(p => p.id === formData.product_id);
  const markup = calculateMarkup();

  const filteredProducts = products.filter(p => {
    const search = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(search) ||
      p.internal_code.toLowerCase().includes(search) ||
      (p.ean && p.ean.includes(search))
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/stock')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Recebimento de Mercadorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 max-w-2xl">
            {/* Seleção de Loja */}
            <div>
              <Label>Loja *</Label>
              <Select value={formData.store_id} onValueChange={(v) => setFormData({ ...formData, store_id: v })}>
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

            {/* Seleção de Produto com busca */}
            <div>
              <Label>Produto *</Label>
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedProduct ? (
                      <span>{selectedProduct.internal_code} - {selectedProduct.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Selecione o produto</span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar por nome, código ou EAN..."
                      value={productSearch}
                      onValueChange={setProductSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.slice(0, 50).map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id}
                            onSelect={() => {
                              setFormData({ ...formData, product_id: product.id });
                              setProductPopoverOpen(false);
                              setProductSearch('');
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{product.internal_code} - {product.name}</span>
                              {product.ean && (
                                <span className="text-xs text-muted-foreground">EAN: {product.ean}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Preço atual (se existir) */}
            {currentPricing && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Preço Atual:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Custo:</span>
                    <p className="font-medium">{formatCurrency(currentPricing.cost_price)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Venda:</span>
                    <p className="font-medium">{formatCurrency(currentPricing.sale_price)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quantidade */}
            <div>
              <Label>Quantidade de Entrada *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="text"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0"
                  className="w-40"
                />
                <span className="text-muted-foreground">
                  {selectedProduct?.units?.abbreviation || 'UN'}
                </span>
              </div>
            </div>

            {/* Preços */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Novo Preço de Custo *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    value={formData.new_cost_price}
                    onChange={(e) => setFormData({ ...formData, new_cost_price: e.target.value })}
                    placeholder="0,00"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Novo Preço de Venda *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    value={formData.new_sale_price}
                    onChange={(e) => setFormData({ ...formData, new_sale_price: e.target.value })}
                    placeholder="0,00"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Markup calculado */}
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">Markup:</span>
                <span className={`text-2xl font-bold ${markup >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {markup.toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Calculado como: (Venda - Custo) / Custo × 100
              </p>
            </div>

            {/* Observações */}
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre o recebimento..."
              />
            </div>

            {/* Botões */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/stock')} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                {submitting ? 'Salvando...' : 'Registrar Recebimento'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockReceipt;
