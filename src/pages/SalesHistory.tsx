import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Eye, Printer, XCircle, ShoppingBag, Calendar, Store } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface Sale {
  id: string;
  sale_number: string;
  status: string;
  total: number;
  created_at: string;
  customer: { id: string; name: string; document: string | null };
  store: { id: string; name: string; code: string; pdv_print_format: string };
  payment_method: { name: string } | null;
  amount_paid: number;
  amount_credit: number;
  cancellation_reason: string | null;
}

interface SaleItem {
  id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total: number;
  product: { name: string; internal_code: string };
}

const SalesHistory = () => {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [printFormat, setPrintFormat] = useState<'a4' | 'bobina'>('a4');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code, pdv_print_format')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales-history', selectedStoreId, searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`
          id, sale_number, status, total, created_at, amount_paid, amount_credit, cancellation_reason,
          customer:customers(id, name, document),
          store:stores(id, name, code, pdv_print_format),
          payment_method:payment_methods(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        query = query.or(`sale_number.ilike.%${searchTerm}%,customers.name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Sale[];
    }
  });

  const fetchSaleItems = async (saleId: string) => {
    const { data, error } = await supabase
      .from('sale_items')
      .select(`
        id, quantity, unit_price, discount_amount, total,
        product:products(name, internal_code)
      `)
      .eq('sale_id', saleId);
    
    if (error) throw error;
    return data as SaleItem[];
  };

  const handleViewDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    const items = await fetchSaleItems(sale.id);
    setSaleItems(items);
    setShowDetailsModal(true);
  };

  const handlePrintClick = (sale: Sale) => {
    setSelectedSale(sale);
    setPrintFormat(sale.store?.pdv_print_format as 'a4' | 'bobina' || 'a4');
    setShowPrintModal(true);
  };

  const handlePrint = async () => {
    if (!selectedSale) return;
    
    const items = await fetchSaleItems(selectedSale.id);
    generatePDF(selectedSale, items, printFormat);
    setShowPrintModal(false);
  };

  const cancelMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      const { data, error } = await (supabase as any).rpc('cancel_sale', {
        p_sale_id: saleId,
        p_user_id: user?.id,
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Venda cancelada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedSale(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao cancelar venda: ' + error.message);
    }
  });

  const handleCancelSale = (sale: Sale) => {
    if (sale.status === 'cancelled') {
      toast.error('Venda já está cancelada');
      return;
    }
    setSelectedSale(sale);
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    if (!cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }
    if (selectedSale) {
      cancelMutation.mutate({ saleId: selectedSale.id, reason: cancelReason });
    }
  };

  const generatePDF = (sale: Sale, items: SaleItem[], printFormat: 'a4' | 'bobina') => {
    const isTicket = printFormat === 'bobina';
    const formattedDate = format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    const saleTotal = Number(sale.total).toFixed(2);
    const salePaid = Number(sale.amount_paid).toFixed(2);
    const saleCredit = Number(sale.amount_credit).toFixed(2);
    
    const styles = isTicket ? `
      body { font-family: 'Courier New', monospace; padding: 5px; max-width: 280px; font-size: 10px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
      .header h2 { font-size: 12px; margin: 0; }
      .header p { margin: 2px 0; }
      .info { margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
      .info p { margin: 2px 0; }
      .item { display: flex; justify-content: space-between; margin: 2px 0; }
      .item-name { flex: 1; }
      .item-qty { width: 30px; text-align: center; }
      .item-price { width: 60px; text-align: right; }
      .total { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; font-weight: bold; }
      .footer { text-align: center; margin-top: 10px; font-size: 9px; }
    ` : `
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; margin-bottom: 20px; }
      .info { margin-bottom: 15px; }
      .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f4f4f4; }
      .total-row { font-weight: bold; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; }
    `;

    const content = isTicket ? `
      <html><head><style>${styles}</style></head><body>
        <div class="header">
          <h2>${sale.store?.name || 'Loja'}</h2>
          <p>Pedido: ${sale.sale_number}</p>
          <p>${formattedDate}</p>
        </div>
        <div class="info">
          <p><strong>Cliente:</strong> ${sale.customer?.name}</p>
          <p>${sale.customer?.document || ''}</p>
        </div>
        ${items.map(item => `
          <div class="item">
            <span class="item-name">${item.product?.name}</span>
            <span class="item-qty">${item.quantity}</span>
            <span class="item-price">R$ ${Number(item.total).toFixed(2)}</span>
          </div>
        `).join('')}
        <div class="total">
          <div class="item">
            <span>TOTAL</span>
            <span>R$ ${saleTotal}</span>
          </div>
          <div class="item">
            <span>Pago</span>
            <span>R$ ${salePaid}</span>
          </div>
          ${Number(sale.amount_credit) > 0 ? `
          <div class="item">
            <span>Crediário</span>
            <span>R$ ${saleCredit}</span>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>${sale.payment_method?.name || '-'}</p>
          <p>Obrigado pela preferência!</p>
        </div>
      </body></html>
    ` : `
      <html><head><style>${styles}</style></head><body>
        <div class="header">
          <h2>${sale.store?.name || 'Loja'}</h2>
          <p>Pedido: ${sale.sale_number}</p>
          <p>Data: ${formattedDate}</p>
        </div>
        <div class="info">
          <h3>Cliente</h3>
          <p><strong>Nome:</strong> ${sale.customer?.name}</p>
          <p><strong>Documento:</strong> ${sale.customer?.document || '-'}</p>
        </div>
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
            ${items.map(item => `
              <tr>
                <td>${item.product?.name}</td>
                <td>${item.quantity}</td>
                <td>R$ ${Number(item.unit_price).toFixed(2)}</td>
                <td>R$ ${Number(item.discount_amount).toFixed(2)}</td>
                <td>R$ ${Number(item.total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">Total:</td>
              <td>R$ ${saleTotal}</td>
            </tr>
          </tfoot>
        </table>
        <div class="info">
          <h3>Pagamento</h3>
          <p><strong>Forma:</strong> ${sale.payment_method?.name || '-'}</p>
          <p><strong>Valor Pago:</strong> R$ ${salePaid}</p>
          ${Number(sale.amount_credit) > 0 ? `<p><strong>Crediário:</strong> R$ ${saleCredit}</p>` : ''}
        </div>
        <div class="footer">
          <p>Obrigado pela preferência!</p>
        </div>
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Concluída</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Histórico de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Loja</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <Store className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lojas</SelectItem>
                  {stores.map((store: any) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Número do pedido ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Sales List */}
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : sales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda encontrada
            </div>
          ) : isMobile ? (
            // Mobile: Cards
            <div className="space-y-3">
              {sales.map((sale) => (
                <Card 
                  key={sale.id} 
                  className={`cursor-pointer transition-all ${sale.status === 'cancelled' ? 'opacity-60' : ''} ${selectedCardId === sale.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedCardId(selectedCardId === sale.id ? null : sale.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono font-medium">{sale.sale_number}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(sale.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      {getStatusBadge(sale.status)}
                    </div>
                    <div className="text-sm space-y-1 mt-2">
                      <p>
                        <span className="text-muted-foreground">Cliente:</span> {sale.customer?.name}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Loja:</span> {sale.store?.name}
                      </p>
                      <p className="font-medium text-lg mt-2">
                        {formatCurrency(sale.total)}
                      </p>
                    </div>
                    {selectedCardId === sale.id && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetails(sale); }}>
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handlePrintClick(sale); }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        {sale.status !== 'cancelled' && (hasRole('admin') || hasRole('operador')) && (
                          <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); handleCancelSale(sale); }}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop: Table
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id} className={sale.status === 'cancelled' ? 'opacity-60' : ''}>
                      <TableCell className="font-mono font-medium">{sale.sale_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(sale.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>{sale.store?.name}</TableCell>
                      <TableCell>{sale.customer?.name}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(sale.total)}</TableCell>
                      <TableCell>{sale.payment_method?.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(sale)} title="Ver detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePrintClick(sale)} title="Imprimir">
                            <Printer className="h-4 w-4" />
                          </Button>
                          {sale.status !== 'cancelled' && (hasRole('admin') || hasRole('operador')) && (
                            <Button variant="destructive" size="sm" onClick={() => handleCancelSale(sale)} title="Cancelar">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda {selectedSale?.sale_number}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Data</Label>
                  <p>{format(new Date(selectedSale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Loja</Label>
                  <p>{selectedSale.store?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p>{selectedSale.customer?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Pagamento</Label>
                  <p>{selectedSale.payment_method?.name || '-'}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground mb-2 block">Itens</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  {selectedSale.status === 'cancelled' && selectedSale.cancellation_reason && (
                    <p className="text-sm text-destructive">
                      <strong>Motivo cancelamento:</strong> {selectedSale.cancellation_reason}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatCurrency(selectedSale.total)}</p>
                  {Number(selectedSale.amount_credit) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Crediário: {formatCurrency(selectedSale.amount_credit)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Venda</DialogTitle>
            <DialogDescription>
              Esta ação irá cancelar a venda e devolver os itens ao estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo do cancelamento *</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Formato de impressão</Label>
              <Select value={printFormat} onValueChange={(v) => setPrintFormat(v as 'a4' | 'bobina')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="bobina">Bobina 80mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrintModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesHistory;
