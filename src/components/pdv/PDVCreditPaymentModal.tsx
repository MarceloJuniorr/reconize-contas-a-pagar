import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, CreditCard, User, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  document: string | null;
  credit_limit: number;
  phone: string | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
}

interface PDVCreditPaymentModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PDVCreditPaymentModal({ open, onClose }: PDVCreditPaymentModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [usedCredit, setUsedCredit] = useState(0);
  const [amount, setAmount] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Fetch customers based on search
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-credit-search', customerSearch],
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

  // Fetch payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods-credit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name, code')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as PaymentMethod[];
    }
  });

  // Fetch customer used credit when selected
  useEffect(() => {
    if (selectedCustomer) {
      fetchUsedCredit();
    }
  }, [selectedCustomer]);

  const fetchUsedCredit = async () => {
    if (!selectedCustomer) return;
    const { data } = await supabase
      .from('accounts_receivable')
      .select('amount, paid_amount')
      .eq('customer_id', selectedCustomer.id)
      .eq('status', 'pending');
    
    if (data) {
      const used = data.reduce((sum, ar) => sum + (Number(ar.amount) - Number(ar.paid_amount || 0)), 0);
      setUsedCredit(used);
    }
  };

  const availableCredit = usedCredit; // The amount the customer owes

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer || !user) throw new Error('Dados incompletos');
      
      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) throw new Error('Valor inválido');
      if (paymentAmount > usedCredit) throw new Error('Valor maior que o saldo devedor');

      // Get pending accounts receivable for this customer, oldest first
      const { data: pendingAR } = await supabase
        .from('accounts_receivable')
        .select('*')
        .eq('customer_id', selectedCustomer.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (!pendingAR || pendingAR.length === 0) {
        throw new Error('Nenhum crediário em aberto');
      }

      let remainingPayment = paymentAmount;

      // Apply payment to accounts receivable (oldest first)
      for (const ar of pendingAR) {
        if (remainingPayment <= 0) break;

        const pendingAmount = Number(ar.amount) - Number(ar.paid_amount || 0);
        const paymentForThis = Math.min(remainingPayment, pendingAmount);
        const newPaidAmount = Number(ar.paid_amount || 0) + paymentForThis;
        const isFullyPaid = newPaidAmount >= Number(ar.amount);

        await supabase
          .from('accounts_receivable')
          .update({
            paid_amount: newPaidAmount,
            status: isFullyPaid ? 'paid' : 'pending',
            paid_at: isFullyPaid ? new Date().toISOString() : null,
            paid_by: isFullyPaid ? user.id : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', ar.id);

        remainingPayment -= paymentForThis;
      }

      // Record the credit payment
      const { error: paymentError } = await supabase
        .from('customer_credit_payments')
        .insert({
          customer_id: selectedCustomer.id,
          amount: paymentAmount,
          payment_method_id: paymentMethodId || null,
          notes,
          created_by: user.id
        });

      if (paymentError) throw paymentError;

      // Log in credit history
      await supabase.from('customer_credit_history').insert({
        customer_id: selectedCustomer.id,
        action_type: 'payment',
        old_value: usedCredit,
        new_value: usedCredit - paymentAmount,
        reference_type: 'credit_payment',
        notes: `Pagamento de crediário: R$ ${paymentAmount.toFixed(2)}`,
        created_by: user.id
      });

      return paymentAmount;
    },
    onSuccess: (paymentAmount) => {
      toast.success(`Pagamento de R$ ${paymentAmount.toFixed(2)} registrado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    }
  });

  const handleClose = () => {
    setCustomerSearch('');
    setSelectedCustomer(null);
    setUsedCredit(0);
    setAmount('');
    setPaymentMethodId('');
    setNotes('');
    onClose();
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamento de Crediário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Search */}
          {!selectedCustomer ? (
            <div className="space-y-2">
              <Label>Buscar Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou documento..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {customers.length > 0 && (
                <Card>
                  <CardContent className="p-2 max-h-48 overflow-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        className="w-full text-left p-2 hover:bg-accent rounded-md"
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {customer.document} • {customer.phone}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <>
              {/* Selected Customer Info */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedCustomer.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                      Trocar
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Limite Total:</span>
                      <p className="font-medium">R$ {selectedCustomer.credit_limit?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Saldo Devedor:</span>
                      <p className="font-medium text-destructive">R$ {usedCredit.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {usedCredit > 0 ? (
                <>
                  {/* Payment Amount */}
                  <div className="space-y-2">
                    <Label>Valor do Pagamento</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={usedCredit}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-10"
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(usedCredit.toFixed(2))}
                    >
                      Pagar Tudo (R$ {usedCredit.toFixed(2)})
                    </Button>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações do pagamento..."
                      rows={2}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Este cliente não possui saldo devedor
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => paymentMutation.mutate()}
            disabled={!selectedCustomer || !amount || Number(amount) <= 0 || paymentMutation.isPending}
          >
            {paymentMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
