import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, ShoppingCart, CreditCard, DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CustomerCreditHistoryModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

export default function CustomerCreditHistoryModal({ 
  open, 
  onClose, 
  customerId,
  customerName 
}: CustomerCreditHistoryModalProps) {
  // Fetch credit history (limit changes, payments)
  const { data: creditHistory = [] } = useQuery({
    queryKey: ['customer-credit-history', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_credit_history')
        .select(`
          *,
          created_by_user:profiles!customer_credit_history_created_by_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!customerId
  });

  // Fetch credit payments
  const { data: creditPayments = [] } = useQuery({
    queryKey: ['customer-credit-payments', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_credit_payments')
        .select(`
          *,
          created_by_user:profiles!customer_credit_payments_created_by_fkey(full_name),
          payment_method:payment_methods(name)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!customerId
  });

  // Fetch sales (purchases)
  const { data: sales = [] } = useQuery({
    queryKey: ['customer-sales', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          store:stores(name),
          created_by_user:profiles!sales_created_by_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .neq('status', 'quote')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: open && !!customerId
  });

  // Fetch accounts receivable
  const { data: receivables = [] } = useQuery({
    queryKey: ['customer-receivables', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select(`
          *,
          sale:sales(sale_number),
          created_by_user:profiles!accounts_receivable_created_by_fkey(full_name),
          paid_by_user:profiles!accounts_receivable_paid_by_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!customerId
  });

  const totalPurchases = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalCredit = sales.filter(s => s.payment_status === 'credit').reduce((sum, s) => sum + Number(s.amount_credit || 0), 0);
  const totalPaid = creditPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingBalance = receivables.filter(r => r.status === 'pending').reduce((sum, r) => sum + (Number(r.amount) - Number(r.paid_amount || 0)), 0);

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'limit_change': return 'Alteração de Limite';
      case 'purchase': return 'Compra';
      case 'payment': return 'Pagamento';
      default: return type;
    }
  };

  const getActionTypeBadge = (type: string) => {
    switch (type) {
      case 'limit_change': return <Badge variant="outline"><TrendingUp className="h-3 w-3 mr-1" />Limite</Badge>;
      case 'purchase': return <Badge variant="secondary"><ShoppingCart className="h-3 w-3 mr-1" />Compra</Badge>;
      case 'payment': return <Badge variant="default"><CreditCard className="h-3 w-3 mr-1" />Pagamento</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Crédito - {customerName}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Compras</p>
              <p className="text-lg font-bold">R$ {totalPurchases.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Crediário</p>
              <p className="text-lg font-bold text-orange-600">R$ {totalCredit.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="text-lg font-bold text-green-600">R$ {totalPaid.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Saldo Devedor</p>
              <p className="text-lg font-bold text-destructive">R$ {pendingBalance.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="history" className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="purchases">Compras</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
            <TabsTrigger value="receivables">Contas</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Anterior</TableHead>
                    <TableHead>Novo</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditHistory.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">
                        {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getActionTypeBadge(item.action_type)}</TableCell>
                      <TableCell>
                        {item.old_value != null ? `R$ ${Number(item.old_value).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {item.new_value != null ? `R$ ${Number(item.new_value).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs">{item.created_by_user?.full_name || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{item.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {creditHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum histórico encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="purchases" className="mt-4">
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Crédito</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-xs">
                        {format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono">{sale.sale_number}</TableCell>
                      <TableCell className="text-xs">{sale.store?.name}</TableCell>
                      <TableCell>R$ {Number(sale.total).toFixed(2)}</TableCell>
                      <TableCell className="text-orange-600">
                        {Number(sale.amount_credit) > 0 ? `R$ ${Number(sale.amount_credit).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.status === 'cancelled' ? 'destructive' : 'outline'}>
                          {sale.status === 'completed' ? 'Concluída' : sale.status === 'cancelled' ? 'Cancelada' : sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{sale.created_by_user?.full_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {sales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma compra encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Forma de Pgto</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-xs">
                        {format(new Date(payment.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        R$ {Number(payment.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>{payment.payment_method?.name || '-'}</TableCell>
                      <TableCell className="text-xs">{payment.created_by_user?.full_name || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{payment.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {creditPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum pagamento de crediário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="receivables" className="mt-4">
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pago por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.map((ar: any) => (
                    <TableRow key={ar.id}>
                      <TableCell className="text-xs">
                        {format(new Date(ar.due_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono">{ar.sale?.sale_number || '-'}</TableCell>
                      <TableCell>R$ {Number(ar.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-green-600">
                        R$ {Number(ar.paid_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ar.status === 'paid' ? 'default' : ar.status === 'cancelled' ? 'destructive' : 'secondary'}>
                          {ar.status === 'paid' ? 'Pago' : ar.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{ar.paid_by_user?.full_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {receivables.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma conta a receber encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
