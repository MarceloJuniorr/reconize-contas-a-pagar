import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, DollarSign, Clock, CheckCircle, AlertTriangle, Filter, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface AccountReceivable {
  id: string;
  amount: number;
  paid_amount: number | null;
  due_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
    document: string | null;
  };
  sale: {
    id: string;
    sale_number: string;
    total: number;
    store: {
      name: string;
    };
  };
}

const AccountsReceivable = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<AccountReceivable | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Fetch accounts receivable
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select(`
          *,
          customer:customers(id, name, document),
          sale:sales(id, sale_number, total, store:stores(name))
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as unknown as AccountReceivable[];
    }
  });

  // Fetch payment methods
  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Mutation to record payment
  const paymentMutation = useMutation({
    mutationFn: async ({ accountId, amount, methodId, notes }: { 
      accountId: string; 
      amount: number; 
      methodId: string; 
      notes: string 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const account = accounts?.find(a => a.id === accountId);
      if (!account) throw new Error('Conta não encontrada');

      const currentPaid = account.paid_amount || 0;
      const newPaidAmount = currentPaid + amount;
      const remaining = account.amount - newPaidAmount;

      // Update the account
      const { error: updateError } = await supabase
        .from('accounts_receivable')
        .update({
          paid_amount: newPaidAmount,
          status: remaining <= 0 ? 'paid' : 'pending',
          paid_at: remaining <= 0 ? new Date().toISOString() : null,
          paid_by: remaining <= 0 ? user.id : null,
          notes: notes || account.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId);

      if (updateError) throw updateError;

      // Log to customer credit history
      await supabase.from('customer_credit_history').insert({
        customer_id: account.customer.id,
        action_type: 'payment',
        old_value: currentPaid,
        new_value: newPaidAmount,
        reference_type: 'accounts_receivable',
        reference_id: accountId,
        notes: `Pagamento de R$ ${amount.toFixed(2)} - ${notes || 'Sem observações'}`,
        created_by: user.id
      });

      // Record in customer credit payments
      await supabase.from('customer_credit_payments').insert({
        customer_id: account.customer.id,
        amount: amount,
        payment_method_id: methodId || null,
        notes: notes,
        created_by: user.id
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      toast.success('Pagamento registrado com sucesso!');
      setPaymentModalOpen(false);
      resetPaymentForm();
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento: ' + (error as Error).message);
    }
  });

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentMethodId('');
    setPaymentNotes('');
    setSelectedAccount(null);
  };

  const handleRecordPayment = (account: AccountReceivable) => {
    setSelectedAccount(account);
    const remaining = account.amount - (account.paid_amount || 0);
    setPaymentAmount(remaining.toFixed(2));
    setPaymentModalOpen(true);
  };

  const handleSubmitPayment = () => {
    if (!selectedAccount) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    const remaining = selectedAccount.amount - (selectedAccount.paid_amount || 0);
    if (amount > remaining) {
      toast.error('Valor não pode ser maior que o saldo devedor');
      return;
    }

    paymentMutation.mutate({
      accountId: selectedAccount.id,
      amount,
      methodId: paymentMethodId,
      notes: paymentNotes
    });
  };

  // Filter accounts
  const filteredAccounts = accounts?.filter(account => {
    const matchesSearch = 
      account.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.customer.document && account.customer.document.includes(searchTerm));

    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  // Calculate summary
  const totalPending = filteredAccounts
    .filter(a => a.status === 'pending')
    .reduce((sum, a) => sum + (a.amount - (a.paid_amount || 0)), 0);

  const totalPaid = filteredAccounts
    .filter(a => a.status === 'paid')
    .reduce((sum, a) => sum + a.amount, 0);

  const totalOverdue = filteredAccounts
    .filter(a => a.status === 'pending' && new Date(a.due_date) < new Date())
    .reduce((sum, a) => sum + (a.amount - (a.paid_amount || 0)), 0);

  const totalDueToday = filteredAccounts
    .filter(a => {
      const today = format(new Date(), 'yyyy-MM-dd');
      return a.status === 'pending' && a.due_date === today;
    })
    .reduce((sum, a) => sum + (a.amount - (a.paid_amount || 0)), 0);

  const getStatusBadge = (account: AccountReceivable) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    if (account.status === 'paid') {
      return <Badge className="bg-green-500">Pago</Badge>;
    }
    if (account.status === 'cancelled') {
      return <Badge variant="outline">Cancelado</Badge>;
    }
    if (account.due_date < today) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (account.due_date === today) {
      return <Badge className="bg-yellow-500">Vence Hoje</Badge>;
    }
    return <Badge variant="secondary">Em Aberto</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contas a Receber</h1>
          <p className="text-muted-foreground">Gerencie seus recebimentos</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Vence Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Total Recebido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, documento ou venda..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Em Aberto</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            {(searchTerm || statusFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : filteredAccounts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</p>
          ) : isMobile ? (
            // Mobile: Cards
            <div className="space-y-3">
              {filteredAccounts.map((account) => {
                const remaining = account.amount - (account.paid_amount || 0);
                return (
                  <Card 
                    key={account.id}
                    className={`cursor-pointer transition-all ${selectedCardId === account.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedCardId(selectedCardId === account.id ? null : account.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{account.customer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Venda: {account.sale.sale_number}
                          </p>
                        </div>
                        {getStatusBadge(account)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                        <div>
                          <span className="text-muted-foreground">Valor:</span>{' '}
                          <span className="font-medium">R$ {account.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pago:</span>{' '}
                          <span className="font-medium">R$ {(account.paid_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Saldo:</span>{' '}
                          <span className="font-semibold">R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Venc:</span>{' '}
                          {format(new Date(account.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </div>
                      {selectedCardId === account.id && account.status === 'pending' && (
                        <div className="mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleRecordPayment(account); }}
                            className="w-full"
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Receber
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Desktop: Table
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venda</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => {
                    const remaining = account.amount - (account.paid_amount || 0);
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">
                          {account.sale.sale_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{account.customer.name}</p>
                            {account.customer.document && (
                              <p className="text-xs text-muted-foreground">{account.customer.document}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{account.sale.store.name}</TableCell>
                        <TableCell className="text-right">
                          R$ {account.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {(account.paid_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(account.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(account)}</TableCell>
                        <TableCell className="text-right">
                          {account.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleRecordPayment(account)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Receber
                            </Button>
                          )}
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

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Cliente:</span> {selectedAccount.customer.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Venda:</span> {selectedAccount.sale.sale_number}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Saldo Devedor:</span>{' '}
                  R$ {(selectedAccount.amount - (selectedAccount.paid_amount || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Valor do Pagamento</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Método de Pagamento</Label>
                <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods?.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Observações sobre o pagamento..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmitPayment}
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? 'Salvando...' : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsReceivable;
