import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, ShoppingCart, Trash2, Percent, DollarSign, User, Store, Plus, Minus, Barcode, Printer, Copy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PDVDeliveryModal from '@/components/pdv/PDVDeliveryModal';
import PDVItemActions from '@/components/pdv/PDVItemActions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  internal_code: string;
  ean: string | null;
  quantity: number;
  unit_price: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number;
  discount_amount: number;
  total: number;
}

interface Customer {
  id: string;
  name: string;
  document: string | null;
  credit_limit: number;
  phone: string | null;
}

interface Product {
  id: string;
  name: string;
  internal_code: string;
  ean: string | null;
  current_price: number;
  stock_quantity: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  allow_installments: boolean;
  max_installments: number;
}

const PDV = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [globalDiscountType, setGlobalDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [installments, setInstallments] = useState(1);
  const [amountPaid, setAmountPaid] = useState(0);
  const [useCredit, setUseCredit] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState<CartItem | null>(null);
  const [customerUsedCredit, setCustomerUsedCredit] = useState(0);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [showReplicateModal, setShowReplicateModal] = useState(false);
  const [replicateOrderCode, setReplicateOrderCode] = useState('');
  const [recentSales, setRecentSales] = useState<any[]>([]);

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ['stores-pdv'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*, pdv_auto_print, pdv_print_format, pdv_max_discount_percent')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Auto-select store if user has only one
  useEffect(() => {
    if (stores.length === 1 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const selectedStore = stores.find((s: any) => s.id === selectedStoreId);
  const maxDiscountPercent = selectedStore?.pdv_max_discount_percent ?? 100;

  // Fetch payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as PaymentMethod[];
    }
  });

  // Fetch customers based on search
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () => {
      if (!customerSearch || customerSearch.length < 2) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, document, credit_limit, phone')
        .eq('active', true)
        .or(`name.ilike.%${customerSearch}%,document.ilike.%${customerSearch}%`)
        .limit(10);
      if (error) throw error;
      return data as Customer[];
    },
    enabled: customerSearch.length >= 2
  });

  // Fetch customer used credit
  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerUsedCredit();
    }
  }, [selectedCustomer]);

  const fetchCustomerUsedCredit = async () => {
    if (!selectedCustomer) return;
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('amount, paid_amount')
      .eq('customer_id', selectedCustomer.id)
      .eq('status', 'pending');
    
    if (!error && data) {
      const usedCredit = data.reduce((sum, ar) => sum + (Number(ar.amount) - Number(ar.paid_amount || 0)), 0);
      setCustomerUsedCredit(usedCredit);
    }
  };

  // Fetch products based on search (by name, code or EAN)
  const { data: searchResults = [] } = useQuery({
    queryKey: ['products-search', productSearch, selectedStoreId],
    queryFn: async () => {
      if (!productSearch || productSearch.length < 2 || !selectedStoreId) return [];
      
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id, name, internal_code, ean,
          product_pricing!inner(sale_price, is_current, store_id),
          product_stock(quantity, store_id)
        `)
        .eq('active', true)
        .eq('product_pricing.store_id', selectedStoreId)
        .eq('product_pricing.is_current', true)
        .or(`name.ilike.%${productSearch}%,internal_code.ilike.%${productSearch}%,ean.ilike.%${productSearch}%`)
        .limit(20);
      
      if (error) throw error;
      
      return (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        internal_code: p.internal_code,
        ean: p.ean,
        current_price: p.product_pricing?.[0]?.sale_price || 0,
        stock_quantity: p.product_stock?.find((s: any) => s.store_id === selectedStoreId)?.quantity || 0
      })) as Product[];
    },
    enabled: productSearch.length >= 2 && !!selectedStoreId
  });

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const globalDiscountAmount = globalDiscountType === 'percentage' 
    ? (subtotal * globalDiscountValue / 100) 
    : globalDiscountValue;
  const total = Math.max(0, subtotal - globalDiscountAmount);
  const availableCredit = (selectedCustomer?.credit_limit || 0) - customerUsedCredit;
  const creditAmount = useCredit ? Math.min(total - amountPaid, availableCredit) : 0;

  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.product_id === product.id 
          ? { 
              ...item, 
              quantity: item.quantity + 1,
              total: (item.quantity + 1) * item.unit_price - item.discount_amount
            }
          : item
      ));
    } else {
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        product_id: product.id,
        name: product.name,
        internal_code: product.internal_code,
        ean: product.ean,
        quantity: 1,
        unit_price: product.current_price,
        discount_type: null,
        discount_value: 0,
        discount_amount: 0,
        total: product.current_price
      };
      setCart([...cart, newItem]);
    }
    setProductSearch('');
    searchInputRef.current?.focus();
  };

  const updateItemQuantity = (itemId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        const baseTotal = newQuantity * item.unit_price;
        const discountAmount = item.discount_type === 'percentage'
          ? baseTotal * item.discount_value / 100
          : item.discount_value;
        return {
          ...item,
          quantity: newQuantity,
          discount_amount: discountAmount,
          total: baseTotal - discountAmount
        };
      }
      return item;
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
    setSelectedItemForAction(null);
  };

  const applyItemDiscount = (itemId: string, type: 'percentage' | 'fixed', value: number) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const baseTotal = item.quantity * item.unit_price;
        const discountAmount = type === 'percentage' ? baseTotal * value / 100 : value;
        return {
          ...item,
          discount_type: type,
          discount_value: value,
          discount_amount: discountAmount,
          total: baseTotal - discountAmount
        };
      }
      return item;
    }));
    setSelectedItemForAction(null);
  };

  const handleFinalizeSale = () => {
    if (!selectedCustomer) {
      toast.error('Selecione um cliente');
      return;
    }
    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho');
      return;
    }
    if (!selectedPaymentMethodId) {
      toast.error('Selecione um método de pagamento');
      return;
    }

    const remaining = total - amountPaid - creditAmount;
    if (remaining > 0.01 && !useCredit) {
      toast.error('Valor pago é menor que o total. Use crediário ou ajuste o valor.');
      return;
    }

    if (creditAmount > availableCredit) {
      toast.error('Limite de crédito insuficiente');
      return;
    }

    setShowDeliveryModal(true);
  };

  const handleSaleComplete = async (deliveryAddressId: string | null, deliveryDate: Date | null, newAddress?: any) => {
    try {
      // Generate sale number
      const { data: saleNumber } = await supabase.rpc('generate_sale_number', { p_store_id: selectedStoreId });

      // Create delivery address if new
      let finalDeliveryAddressId = deliveryAddressId;
      if (newAddress && selectedCustomer) {
        const { data: newAddrData, error: addrError } = await supabase
          .from('customer_delivery_addresses')
          .insert({
            customer_id: selectedCustomer.id,
            name: newAddress.name,
            address_street: newAddress.address_street,
            address_number: newAddress.address_number,
            address_complement: newAddress.address_complement,
            address_neighborhood: newAddress.address_neighborhood,
            address_city: newAddress.address_city,
            address_state: newAddress.address_state,
            address_zip: newAddress.address_zip,
            contact_name: newAddress.contact_name,
            contact_phone: newAddress.contact_phone
          })
          .select()
          .single();
        
        if (addrError) throw addrError;
        finalDeliveryAddressId = newAddrData.id;
      }

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          store_id: selectedStoreId,
          customer_id: selectedCustomer!.id,
          delivery_address_id: finalDeliveryAddressId,
          delivery_date: deliveryDate?.toISOString().split('T')[0],
          subtotal,
          discount_type: globalDiscountValue > 0 ? globalDiscountType : null,
          discount_value: globalDiscountValue,
          discount_amount: globalDiscountAmount,
          total,
          payment_method_id: selectedPaymentMethodId,
          payment_status: creditAmount > 0 ? 'credit' : 'paid',
          amount_paid: amountPaid,
          amount_credit: creditAmount,
          installments,
          created_by: user?.id
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        discount_amount: item.discount_amount,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Create stock movements (exits)
      for (const item of cart) {
        // Use RPC to properly decrement stock
        await (supabase as any).rpc('update_stock_quantity', {
          p_product_id: item.product_id,
          p_store_id: selectedStoreId,
          p_quantity: -item.quantity
        });

        // Create movement record
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          store_id: selectedStoreId,
          movement_type: 'exit',
          quantity: item.quantity,
          unit_price: item.unit_price,
          reference_type: 'sale',
          reference_id: sale.id,
          created_by: user?.id
        });
      }

      // Create account receivable if using credit
      if (creditAmount > 0) {
        await supabase.from('accounts_receivable').insert({
          sale_id: sale.id,
          customer_id: selectedCustomer!.id,
          amount: creditAmount,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          created_by: user?.id
        });
      }

      toast.success(`Venda ${saleNumber} finalizada com sucesso!`);

      // Generate PDF only if auto-print is enabled
      if (selectedStore?.pdv_auto_print) {
        generateSalePDF(sale, saleItems, selectedStore?.pdv_print_format || 'a4');
      }

      // Reset form
      resetSale();

    } catch (error: any) {
      toast.error('Erro ao finalizar venda: ' + error.message);
    }
  };

  const generateSalePDF = async (sale: any, items: any[], printFormat: string = 'a4') => {
    // Fetch complete data for PDF
    const { data: saleData } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers(*),
        store:stores(*),
        delivery_address:customer_delivery_addresses(*),
        payment_method:payment_methods(*)
      `)
      .eq('id', sale.id)
      .single();

    if (!saleData) return;

    const isReceipt = printFormat === 'bobina';

    // Styles for A4 or Receipt (bobina 80mm)
    const styles = isReceipt ? `
      body { font-family: 'Courier New', monospace; width: 80mm; padding: 5mm; margin: 0; font-size: 10px; }
      .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
      .header h2 { font-size: 14px; margin: 0; }
      .header p { margin: 2px 0; }
      .info { margin-bottom: 8px; font-size: 9px; }
      .info h3 { font-size: 10px; margin: 5px 0 3px 0; border-bottom: 1px dashed #000; }
      .info p { margin: 2px 0; }
      .items { width: 100%; margin: 10px 0; }
      .item { border-bottom: 1px dotted #ccc; padding: 3px 0; }
      .item-name { font-weight: bold; }
      .item-details { display: flex; justify-content: space-between; font-size: 9px; }
      .totals { border-top: 1px dashed #000; padding-top: 5px; margin-top: 10px; }
      .totals p { display: flex; justify-content: space-between; margin: 2px 0; }
      .totals .total { font-weight: bold; font-size: 12px; }
      .footer { text-align: center; margin-top: 15px; font-size: 9px; border-top: 1px dashed #000; padding-top: 5px; }
      @media print { @page { size: 80mm auto; margin: 0; } }
    ` : `
      body { font-family: Arial, sans-serif; padding: 20px; }
      .header { text-align: center; margin-bottom: 20px; }
      .info { margin-bottom: 15px; }
      .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f4f4f4; }
      .total-row { font-weight: bold; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; }
    `;

    // Create PDF content
    const pdfContent = isReceipt ? generateReceiptContent(saleData, items, styles) : generateA4Content(saleData, items, styles);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const generateReceiptContent = (saleData: any, items: any[], styles: string) => `
    <html>
    <head><style>${styles}</style></head>
    <body>
      <div class="header">
        <h2>${saleData.store?.name || 'Loja'}</h2>
        <p>Pedido: ${saleData.sale_number}</p>
        <p>${new Date(saleData.created_at).toLocaleDateString('pt-BR')} ${new Date(saleData.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      
      <div class="info">
        <h3>Cliente</h3>
        <p>${saleData.customer?.name}</p>
        ${saleData.customer?.document ? `<p>${saleData.customer.document}</p>` : ''}
        ${saleData.customer?.phone ? `<p>Tel: ${saleData.customer.phone}</p>` : ''}
      </div>
      
      ${saleData.delivery_address ? `
      <div class="info">
        <h3>Entrega</h3>
        <p>${saleData.delivery_address.address_street}, ${saleData.delivery_address.address_number}</p>
        <p>${saleData.delivery_address.address_neighborhood}</p>
        <p>${saleData.delivery_address.address_city}/${saleData.delivery_address.address_state}</p>
        ${saleData.delivery_address.contact_name ? `<p>${saleData.delivery_address.contact_name} - ${saleData.delivery_address.contact_phone}</p>` : ''}
      </div>
      ` : ''}
      
      ${saleData.delivery_date ? `<p><strong>Entrega:</strong> ${new Date(saleData.delivery_date).toLocaleDateString('pt-BR')}</p>` : ''}
      
      <div class="items">
        ${items.map((item: any) => `
          <div class="item">
            <div class="item-name">${item.name || item.product?.name || 'Produto'}</div>
            <div class="item-details">
              <span>${item.quantity}x R$ ${Number(item.unit_price).toFixed(2)}</span>
              <span>R$ ${Number(item.total).toFixed(2)}</span>
            </div>
            ${Number(item.discount_amount) > 0 ? `<div style="font-size:8px;color:#666;">Desc: -R$ ${Number(item.discount_amount).toFixed(2)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="totals">
        <p><span>Subtotal:</span><span>R$ ${Number(saleData.subtotal).toFixed(2)}</span></p>
        ${Number(saleData.discount_amount) > 0 ? `<p><span>Desconto:</span><span>-R$ ${Number(saleData.discount_amount).toFixed(2)}</span></p>` : ''}
        <p class="total"><span>TOTAL:</span><span>R$ ${Number(saleData.total).toFixed(2)}</span></p>
        <p><span>${saleData.payment_method?.name || 'Pagamento'}:</span><span>R$ ${Number(saleData.amount_paid).toFixed(2)}</span></p>
        ${Number(saleData.amount_credit) > 0 ? `<p><span>Crediário:</span><span>R$ ${Number(saleData.amount_credit).toFixed(2)}</span></p>` : ''}
      </div>
      
      <div class="footer">
        <p>Obrigado pela preferência!</p>
      </div>
    </body>
    </html>
  `;

  const generateA4Content = (saleData: any, items: any[], styles: string) => `
    <html>
    <head><style>${styles}</style></head>
      <body>
        <div class="header">
          <h2>${saleData.store?.name || 'Loja'}</h2>
          <p>Pedido: ${saleData.sale_number}</p>
          <p>Data: ${new Date(saleData.created_at).toLocaleDateString('pt-BR')}</p>
        </div>
        
        <div class="info">
          <h3>Cliente</h3>
          <p><strong>Nome:</strong> ${saleData.customer?.name}</p>
          <p><strong>Documento:</strong> ${saleData.customer?.document || '-'}</p>
          <p><strong>Telefone:</strong> ${saleData.customer?.phone || '-'}</p>
        </div>
        
        ${saleData.delivery_address ? `
        <div class="info">
          <h3>Endereço de Entrega</h3>
          <p>${saleData.delivery_address.address_street}, ${saleData.delivery_address.address_number}</p>
          <p>${saleData.delivery_address.address_neighborhood} - ${saleData.delivery_address.address_city}/${saleData.delivery_address.address_state}</p>
          <p>CEP: ${saleData.delivery_address.address_zip}</p>
          ${saleData.delivery_address.contact_name ? `<p>Contato: ${saleData.delivery_address.contact_name} - ${saleData.delivery_address.contact_phone}</p>` : ''}
        </div>
        ` : ''}
        
        ${saleData.delivery_date ? `<p><strong>Data de Entrega:</strong> ${new Date(saleData.delivery_date).toLocaleDateString('pt-BR')}</p>` : ''}
        
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd</th>
              <th>Valor Unit.</th>
              <th>Desconto</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => `
              <tr>
                <td>${item.name || item.product?.name || 'Produto'}</td>
                <td>${item.quantity}</td>
                <td>R$ ${Number(item.unit_price).toFixed(2)}</td>
                <td>R$ ${Number(item.discount_amount).toFixed(2)}</td>
                <td>R$ ${Number(item.total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align: right;">Subtotal:</td>
              <td>R$ ${Number(saleData.subtotal).toFixed(2)}</td>
            </tr>
            ${Number(saleData.discount_amount) > 0 ? `
            <tr>
              <td colspan="4" style="text-align: right;">Desconto:</td>
              <td>R$ ${Number(saleData.discount_amount).toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">Total:</td>
              <td>R$ ${Number(saleData.total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        <div class="info">
          <h3>Pagamento</h3>
          <p><strong>Forma:</strong> ${saleData.payment_method?.name || '-'}</p>
          <p><strong>Valor Pago:</strong> R$ ${Number(saleData.amount_paid).toFixed(2)}</p>
          ${Number(saleData.amount_credit) > 0 ? `<p><strong>Crediário:</strong> R$ ${Number(saleData.amount_credit).toFixed(2)}</p>` : ''}
        </div>
        
        <div class="footer">
          <p>Obrigado pela preferência!</p>
        </div>
      </body>
      </html>
    `;

  const resetSale = () => {
    setCart([]);
    setSelectedCustomer(null);
    setGlobalDiscountValue(0);
    setGlobalDiscountType('fixed');
    setSelectedPaymentMethodId('');
    setInstallments(1);
    setAmountPaid(0);
    setUseCredit(false);
    setShowDeliveryModal(false);
    setProductSearch('');
    setCustomerSearch('');
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-4">
      {/* Left Panel - Products and Search */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Store and Customer Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Loja</Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <Store className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store: any) => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Label className="text-xs text-muted-foreground">Cliente *</Label>
            <div className="relative">
              <Input
                placeholder="Buscar cliente por nome ou documento..."
                value={selectedCustomer ? selectedCustomer.name : customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setSelectedCustomer(null);
                  setShowCustomerSearch(true);
                }}
                onFocus={() => setShowCustomerSearch(true)}
                className="pr-10"
              />
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {showCustomerSearch && customers.length > 0 && (
              <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto">
                <CardContent className="p-2">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      className="w-full text-left p-2 hover:bg-accent rounded-md"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setShowCustomerSearch(false);
                        setCustomerSearch('');
                      }}
                    >
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {customer.document} • Limite: R$ {customer.credit_limit?.toFixed(2) || '0.00'}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Customer Credit Info */}
        {selectedCustomer && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{selectedCustomer.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{selectedCustomer.phone}</span>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Limite Total: </span>
                  <span className="font-medium">R$ {selectedCustomer.credit_limit?.toFixed(2) || '0.00'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Disponível: </span>
                  <span className={`font-medium ${availableCredit < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    R$ {availableCredit.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Search */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar produto por nome, código ou EAN..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
                disabled={!selectedStoreId}
              />
            </div>
            <Button variant="outline" size="icon" disabled={!selectedStoreId}>
              <Barcode className="h-4 w-4" />
            </Button>
          </div>

          {searchResults.length > 0 && (
            <Card className="absolute z-40 w-full mt-1 max-h-80 overflow-auto">
              <CardContent className="p-2">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    className="w-full text-left p-3 hover:bg-accent rounded-md flex items-center justify-between"
                    onClick={() => addToCart(product)}
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Cód: {product.internal_code} {product.ean && `• EAN: ${product.ean}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">R$ {product.current_price.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">Estoque: {product.stock_quantity}</div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Cart Items */}
        <Card className="flex-1 overflow-hidden">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Itens ({cart.length})
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100%-60px)]">
            <div className="p-2 space-y-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedItemForAction(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.internal_code} • R$ {item.unit_price.toFixed(2)} un
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateItemQuantity(item.id, -1);
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateItemQuantity(item.id, 1);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right ml-4 min-w-[80px]">
                      {item.discount_amount > 0 && (
                        <div className="text-xs text-destructive line-through">
                          R$ {(item.quantity * item.unit_price).toFixed(2)}
                        </div>
                      )}
                      <div className="font-bold">R$ {item.total.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Carrinho vazio</p>
                  <p className="text-xs">Busque produtos para adicionar</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Right Panel - Payment and Total */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Discount Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowDiscountModal(true)}
          disabled={cart.length === 0}
        >
          <Percent className="h-4 w-4 mr-2" />
          Desconto Geral
          {globalDiscountValue > 0 && (
            <Badge variant="secondary" className="ml-2">
              {globalDiscountType === 'percentage' ? `${globalDiscountValue}%` : `R$ ${globalDiscountValue.toFixed(2)}`}
            </Badge>
          )}
        </Button>

        {/* Payment Method */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPaymentMethod?.allow_installments && (
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: selectedPaymentMethod.max_installments }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x de R$ {(total / n).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Valor Pago</Label>
              <Input
                type="number"
                step="0.01"
                value={amountPaid || ''}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>

            {selectedCustomer && availableCredit > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useCredit"
                  checked={useCredit}
                  onChange={(e) => setUseCredit(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useCredit" className="text-xs cursor-pointer">
                  Usar crediário (disponível: R$ {availableCredit.toFixed(2)})
                </Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            {globalDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Desconto</span>
                <span>- R$ {globalDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            {amountPaid > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Pago</span>
                <span>R$ {amountPaid.toFixed(2)}</span>
              </div>
            )}
            {creditAmount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Crediário</span>
                <span>R$ {creditAmount.toFixed(2)}</span>
              </div>
            )}
            {(amountPaid + creditAmount < total) && total > 0 && (
              <div className="flex justify-between text-sm text-destructive font-medium">
                <span>Restante</span>
                <span>R$ {(total - amountPaid - creditAmount).toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleFinalizeSale}
            disabled={cart.length === 0 || !selectedCustomer || !selectedPaymentMethodId}
          >
            <DollarSign className="h-5 w-5 mr-2" />
            Finalizar Venda
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!selectedStoreId) {
                  toast.error('Selecione uma loja');
                  return;
                }
                const { data } = await supabase
                  .from('sales')
                  .select('id, sale_number, total, created_at, customer:customers(name)')
                  .eq('store_id', selectedStoreId)
                  .order('created_at', { ascending: false })
                  .limit(10);
                setRecentSales(data || []);
                setShowReprintModal(true);
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              Reimprimir
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowReplicateModal(true)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Replicar
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={resetSale}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Global Discount Modal */}
      <Dialog open={showDiscountModal} onOpenChange={setShowDiscountModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconto Geral</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={globalDiscountType === 'percentage' ? 'default' : 'outline'}
                onClick={() => setGlobalDiscountType('percentage')}
                className="flex-1"
              >
                <Percent className="h-4 w-4 mr-2" />
                Percentual
              </Button>
              <Button
                variant={globalDiscountType === 'fixed' ? 'default' : 'outline'}
                onClick={() => setGlobalDiscountType('fixed')}
                className="flex-1"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Valor Fixo
              </Button>
            </div>
            <div>
              <Label>{globalDiscountType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}</Label>
              <Input
                type="number"
                step={globalDiscountType === 'percentage' ? '1' : '0.01'}
                value={globalDiscountValue || ''}
                onChange={(e) => setGlobalDiscountValue(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            {globalDiscountValue > 0 && (
              <div className="text-sm text-muted-foreground">
                Desconto: R$ {globalDiscountAmount.toFixed(2)} • Novo Total: R$ {total.toFixed(2)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setGlobalDiscountValue(0);
              setShowDiscountModal(false);
            }}>
              Limpar
            </Button>
            <Button onClick={() => setShowDiscountModal(false)}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Actions Modal */}
      <PDVItemActions
        item={selectedItemForAction}
        onClose={() => setSelectedItemForAction(null)}
        onRemove={removeFromCart}
        onApplyDiscount={applyItemDiscount}
      />

      {/* Delivery Modal */}
      <PDVDeliveryModal
        open={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        customerId={selectedCustomer?.id || ''}
        onConfirm={handleSaleComplete}
      />

      {/* Reprint Modal */}
      <Dialog open={showReprintModal} onOpenChange={setShowReprintModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reimprimir Pedido</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales.map((sale: any) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono">{sale.sale_number}</TableCell>
                    <TableCell>{sale.customer?.name}</TableCell>
                    <TableCell>R$ {Number(sale.total).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={async () => {
                        const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
                        generateSalePDF(sale, items || [], selectedStore?.pdv_print_format || 'a4');
                        setShowReprintModal(false);
                      }}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Replicate Order Modal */}
      <Dialog open={showReplicateModal} onOpenChange={setShowReplicateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replicar Pedido</DialogTitle>
            <DialogDescription>Digite o código do pedido para copiar os itens</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Código do Pedido</Label>
            <Input
              value={replicateOrderCode}
              onChange={(e) => setReplicateOrderCode(e.target.value.toUpperCase())}
              placeholder="Ex: LJ01-000001"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReplicateModal(false);
              setReplicateOrderCode('');
            }}>Cancelar</Button>
            <Button onClick={async () => {
              if (!replicateOrderCode) return;
              const { data: sale } = await supabase
                .from('sales')
                .select('id, customer_id, customer:customers(id, name, document, credit_limit, phone)')
                .eq('sale_number', replicateOrderCode)
                .single();
              
              if (!sale) {
                toast.error('Pedido não encontrado');
                return;
              }
              
              const { data: items } = await supabase
                .from('sale_items')
                .select('product_id, quantity, unit_price, product:products(name, internal_code, ean)')
                .eq('sale_id', sale.id);
              
              if (items && items.length > 0) {
                const newCart = items.map((item: any) => ({
                  id: crypto.randomUUID(),
                  product_id: item.product_id,
                  name: item.product?.name,
                  internal_code: item.product?.internal_code,
                  ean: item.product?.ean,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  discount_type: null,
                  discount_value: 0,
                  discount_amount: 0,
                  total: item.quantity * item.unit_price
                }));
                setCart(newCart);
                if (sale.customer) {
                  setSelectedCustomer(sale.customer as any);
                }
                toast.success('Itens do pedido carregados');
              }
              setShowReplicateModal(false);
              setReplicateOrderCode('');
            }}>
              Carregar Itens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PDV;
