import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PackagePlus, ArrowLeft, Search, Plus, Trash2, Save } from 'lucide-react';
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

interface Supplier {
  id: string;
  name: string;
  document: string | null;
}

interface ReceiptItem {
  id: string;
  product: Product;
  quantity: string;
  new_cost_price: string;
  new_sale_price: string;
  current_pricing: { cost_price: number; sale_price: number } | null;
}

const StockReceipt = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [productSearch, setProductSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const [storeId, setStoreId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);

  // Formulário do item atual sendo adicionado
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    quantity: '',
    new_cost_price: '',
    new_sale_price: '',
  });
  const [currentPricing, setCurrentPricing] = useState<{ cost_price: number; sale_price: number } | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchInitialData();
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
    if (storeId && currentItem.product_id) {
      fetchCurrentPricing(currentItem.product_id);
    } else {
      setCurrentPricing(null);
    }
  }, [storeId, currentItem.product_id]);

  const fetchInitialData = async () => {
    if (!user) return;

    try {
      // Buscar lojas do usuário
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

      if (storesData && storesData.length > 0) {
        setStoreId(storesData[0].id);
      }

      // Buscar produtos
      const { data: productsData } = await (supabase as any)
        .from('products')
        .select('id, internal_code, name, ean, units(abbreviation)')
        .eq('active', true)
        .order('name');

      setProducts(productsData || []);

      // Buscar fornecedores
      const { data: suppliersData } = await (supabase as any)
        .from('suppliers')
        .select('id, name, document')
        .eq('active', true)
        .order('name');

      setSuppliers(suppliersData || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPricing = async (productId: string) => {
    const { data } = await (supabase as any)
      .from('product_pricing')
      .select('cost_price, sale_price')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .eq('is_current', true)
      .maybeSingle();

    setCurrentPricing(data);
  };

  const calculateMarkup = (costPrice: string, salePrice: string) => {
    const cost = parseFloat(costPrice.replace(',', '.')) || 0;
    const sale = parseFloat(salePrice.replace(',', '.')) || 0;
    
    if (cost <= 0) return 0;
    return ((sale - cost) / cost) * 100;
  };

  const handleAddItem = () => {
    if (!currentItem.product_id || !currentItem.quantity || !currentItem.new_cost_price || !currentItem.new_sale_price) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos do item",
        variant: "destructive",
      });
      return;
    }

    const product = products.find(p => p.id === currentItem.product_id);
    if (!product) return;

    // Verificar se produto já está na lista
    if (items.some(item => item.product.id === currentItem.product_id)) {
      toast({
        title: "Atenção",
        description: "Este produto já foi adicionado à lista",
        variant: "destructive",
      });
      return;
    }

    const newItem: ReceiptItem = {
      id: crypto.randomUUID(),
      product,
      quantity: currentItem.quantity,
      new_cost_price: currentItem.new_cost_price,
      new_sale_price: currentItem.new_sale_price,
      current_pricing: currentPricing,
    };

    setItems([...items, newItem]);
    setCurrentItem({
      product_id: '',
      quantity: '',
      new_cost_price: '',
      new_sale_price: '',
    });
    setCurrentPricing(null);
    setProductSearch('');
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleSubmit = async () => {
    if (!storeId) {
      toast({
        title: "Erro",
        description: "Selecione a loja",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item ao recebimento",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Generate receipt number
      const { data: receiptNumber, error: receiptNumberError } = await (supabase as any)
        .rpc('generate_receipt_number', { p_store_id: storeId });

      if (receiptNumberError) throw receiptNumberError;

      // Create receipt header
      const { data: headerData, error: headerError } = await (supabase as any)
        .from('stock_receipt_headers')
        .insert({
          store_id: storeId,
          supplier_id: supplierId || null,
          receipt_number: receiptNumber,
          invoice_number: invoiceNumber || null,
          notes: notes || null,
          received_by: user?.id,
        })
        .select()
        .single();

      if (headerError) throw headerError;

      // Insert all items with header_id
      const receipts = items.map(item => ({
        header_id: headerData.id,
        store_id: storeId,
        product_id: item.product.id,
        quantity: parseFloat(item.quantity.replace(',', '.')),
        old_sale_price: item.current_pricing?.sale_price || null,
        new_cost_price: parseFloat(item.new_cost_price.replace(',', '.')),
        new_sale_price: parseFloat(item.new_sale_price.replace(',', '.')),
        notes: notes || null,
        received_by: user?.id,
      }));

      const { error: itemsError } = await (supabase as any).from('stock_receipts').insert(receipts);

      if (itemsError) throw itemsError;

      toast({
        title: "Sucesso",
        description: `Recebimento ${receiptNumber} registrado com ${items.length} item(s)`,
      });

      // Limpar e voltar
      navigate(`/stock/receipt?store=${storeId}`);
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

  const selectedProduct = products.find(p => p.id === currentItem.product_id);
  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const currentMarkup = calculateMarkup(currentItem.new_cost_price, currentItem.new_sale_price);

  const filteredProducts = products.filter(p => {
    const search = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(search) ||
      p.internal_code.toLowerCase().includes(search) ||
      (p.ean && p.ean.includes(search))
    );
  });

  const filteredSuppliers = suppliers.filter(s => {
    const search = supplierSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(search) ||
      (s.document && s.document.includes(search))
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalItems = items.length;
  const totalValue = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity.replace(',', '.')) || 0;
    const cost = parseFloat(item.new_cost_price.replace(',', '.')) || 0;
    return sum + (qty * cost);
  }, 0);

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/stock/receipt?store=${storeId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Novo Recebimento de Mercadorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Cabeçalho: Loja, Fornecedor e Nota Fiscal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Loja *</Label>
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

              <div>
                <Label>Fornecedor</Label>
                <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {selectedSupplier ? (
                        <span>{selectedSupplier.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Selecione (opcional)</span>
                      )}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar por nome ou documento..."
                        value={supplierSearch}
                        onValueChange={setSupplierSearch}
                      />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                        <CommandGroup>
                          {filteredSuppliers.map((supplier) => (
                            <CommandItem
                              key={supplier.id}
                              value={`${supplier.name} ${supplier.document || ''}`}
                              onSelect={() => {
                                setSupplierId(supplier.id);
                                setSupplierPopoverOpen(false);
                                setSupplierSearch('');
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{supplier.name}</span>
                                {supplier.document && (
                                  <span className="text-xs text-muted-foreground">{supplier.document}</span>
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

              <div>
                <Label>Número da Nota Fiscal</Label>
                <Input
                  placeholder="Número da NF (opcional)"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Adicionar Item */}
            <Card className="border-dashed">
              <CardHeader className="py-4">
                <CardTitle className="text-base">Adicionar Item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Seleção de Produto com busca */}
                  <div className="md:col-span-2">
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
                            <span className="text-muted-foreground">Buscar por nome ou código de barras...</span>
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
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                            <CommandGroup>
                              {filteredProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name} ${product.internal_code} ${product.ean || ''}`}
                                  onSelect={() => {
                                    setCurrentItem({ ...currentItem, product_id: product.id });
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
                    <div className="md:col-span-2 p-3 bg-muted rounded-lg">
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
                    <Label>Quantidade *</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="text"
                        placeholder="0"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                      />
                      {selectedProduct && (
                        <span className="text-sm text-muted-foreground">
                          {selectedProduct.units?.abbreviation || 'UN'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preço de Custo */}
                  <div>
                    <Label>Preço de Custo *</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={currentItem.new_cost_price}
                      onChange={(e) => setCurrentItem({ ...currentItem, new_cost_price: e.target.value })}
                    />
                  </div>

                  {/* Preço de Venda */}
                  <div>
                    <Label>Preço de Venda *</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={currentItem.new_sale_price}
                      onChange={(e) => setCurrentItem({ ...currentItem, new_sale_price: e.target.value })}
                    />
                  </div>

                  {/* Markup calculado */}
                  <div>
                    <Label>Markup</Label>
                    <div className="h-10 flex items-center px-3 bg-muted rounded-md">
                      <span className={`font-medium ${currentMarkup > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {currentMarkup.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                <Button onClick={handleAddItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Itens */}
            {items.length > 0 && (
              <div>
                <Label className="mb-2 block">Itens do Recebimento ({totalItems})</Label>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo Unit.</TableHead>
                        <TableHead className="text-right">Venda Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const qty = parseFloat(item.quantity.replace(',', '.')) || 0;
                        const cost = parseFloat(item.new_cost_price.replace(',', '.')) || 0;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{item.product.name}</span>
                                <span className="text-xs text-muted-foreground">{item.product.internal_code}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity} {item.product.units?.abbreviation || 'UN'}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(cost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(parseFloat(item.new_sale_price.replace(',', '.')) || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(qty * cost)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Totais */}
                <div className="flex justify-end gap-6 mt-4 p-4 bg-muted rounded-lg">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total de Itens:</span>
                    <span className="font-medium ml-2">{totalItems}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Valor Total:</span>
                    <span className="font-medium ml-2">{formatCurrency(totalValue)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div>
              <Label>Observações Gerais</Label>
              <Textarea
                placeholder="Observações sobre o recebimento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Botão de Salvar */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || items.length === 0}
              className="w-full"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {submitting ? 'Salvando...' : 'Finalizar Recebimento'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockReceipt;
