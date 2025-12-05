import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, CalendarIcon, MapPin, Package, Truck, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PaymentEntry {
  id: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  installments: number;
  isCredit: boolean;
}

interface DeliveryAddress {
  id: string;
  name: string;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_default: boolean | null;
}

interface PDVPaymentStepProps {
  open: boolean;
  onClose: () => void;
  total: number;
  customerId: string;
  customerName: string;
  availableCredit: number;
  onConfirm: (data: {
    deliveryType: 'pickup' | 'delivery';
    deliveryAddressId: string | null;
    deliveryDate: Date | null;
    payments: PaymentEntry[];
    newAddress?: any;
  }) => void;
}

const PDVPaymentStep = ({
  open,
  onClose,
  total,
  customerId,
  customerName,
  availableCredit,
  onConfirm
}: PDVPaymentStepProps) => {
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    contact_name: '',
    contact_phone: ''
  });

  // Payment entries
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentPaymentMethodId, setCurrentPaymentMethodId] = useState<string>('');
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  const [currentInstallments, setCurrentInstallments] = useState<number>(1);
  const [useCredit, setUseCredit] = useState(false);
  const [creditAmount, setCreditAmount] = useState<number>(0);

  // Fetch payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods-step'],
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

  // Fetch delivery addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_delivery_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .eq('active', true)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as DeliveryAddress[];
    },
    enabled: !!customerId
  });

  // Auto-select default address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setPayments([]);
      setCurrentPaymentMethodId('');
      setCurrentAmount(0);
      setCurrentInstallments(1);
      setUseCredit(false);
      setCreditAmount(0);
      setDeliveryType('pickup');
      setDeliveryDate(null);
      setShowNewAddressForm(false);
    }
  }, [open]);

  const selectedPaymentMethod = paymentMethods.find((pm: any) => pm.id === currentPaymentMethodId);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + creditAmount;
  const remaining = total - totalPaid;

  const addPayment = () => {
    if (!currentPaymentMethodId) {
      toast.error('Selecione uma forma de pagamento');
      return;
    }
    if (currentAmount <= 0) {
      toast.error('Informe o valor');
      return;
    }
    if (currentAmount > remaining + 0.01) {
      toast.error('Valor maior que o restante');
      return;
    }

    const method = paymentMethods.find((pm: any) => pm.id === currentPaymentMethodId);
    setPayments([
      ...payments,
      {
        id: crypto.randomUUID(),
        paymentMethodId: currentPaymentMethodId,
        paymentMethodName: method?.name || '',
        amount: currentAmount,
        installments: currentInstallments,
        isCredit: false
      }
    ]);
    setCurrentPaymentMethodId('');
    setCurrentAmount(0);
    setCurrentInstallments(1);
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleCreditToggle = (checked: boolean) => {
    setUseCredit(checked);
    if (checked) {
      const maxCredit = Math.min(remaining, availableCredit);
      setCreditAmount(maxCredit);
    } else {
      setCreditAmount(0);
    }
  };

  const handleConfirm = () => {
    if (remaining > 0.01 && !useCredit) {
      toast.error('O valor total ainda não foi coberto');
      return;
    }

    if (creditAmount > availableCredit) {
      toast.error('Limite de crédito insuficiente');
      return;
    }

    if (deliveryType === 'delivery' && !selectedAddressId && !showNewAddressForm) {
      toast.error('Selecione um endereço de entrega');
      return;
    }

    // Add credit as a payment entry if used
    const finalPayments = [...payments];
    if (creditAmount > 0) {
      finalPayments.push({
        id: crypto.randomUUID(),
        paymentMethodId: '',
        paymentMethodName: 'Crediário',
        amount: creditAmount,
        installments: 1,
        isCredit: true
      });
    }

    onConfirm({
      deliveryType,
      deliveryAddressId: deliveryType === 'delivery' ? (showNewAddressForm ? null : selectedAddressId) : null,
      deliveryDate,
      payments: finalPayments,
      newAddress: showNewAddressForm ? newAddress : undefined
    });
  };

  const formatAddress = (addr: DeliveryAddress) => {
    const parts = [
      addr.address_street,
      addr.address_number,
      addr.address_neighborhood,
      addr.address_city,
      addr.address_state
    ].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamento - {customerName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Delivery Type */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Tipo de Saída</Label>
              <RadioGroup
                value={deliveryType}
                onValueChange={(v) => setDeliveryType(v as 'pickup' | 'delivery')}
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="pickup"
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                    deliveryType === 'pickup' ? "border-primary bg-primary/5" : "hover:bg-accent"
                  )}
                >
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Package className="h-5 w-5" />
                  <span>Retirada</span>
                </Label>
                <Label
                  htmlFor="delivery"
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                    deliveryType === 'delivery' ? "border-primary bg-primary/5" : "hover:bg-accent"
                  )}
                >
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Truck className="h-5 w-5" />
                  <span>Entrega</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Delivery Address (only if delivery) */}
            {deliveryType === 'delivery' && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!showNewAddressForm ? (
                    <>
                      <div className="space-y-2">
                        {addresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={cn(
                              "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                              selectedAddressId === addr.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                            )}
                          >
                            <input
                              type="radio"
                              name="address"
                              value={addr.id}
                              checked={selectedAddressId === addr.id}
                              onChange={() => setSelectedAddressId(addr.id)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium">{addr.name}</div>
                              <div className="text-sm text-muted-foreground">{formatAddress(addr)}</div>
                              {addr.contact_name && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {addr.contact_name} - {addr.contact_phone}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewAddressForm(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Endereço
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nome do Endereço</Label>
                          <Input
                            value={newAddress.name}
                            onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                            placeholder="Casa, Trabalho..."
                          />
                        </div>
                        <div>
                          <Label className="text-xs">CEP</Label>
                          <Input
                            value={newAddress.address_zip}
                            onChange={(e) => setNewAddress({ ...newAddress, address_zip: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Label className="text-xs">Rua</Label>
                          <Input
                            value={newAddress.address_street}
                            onChange={(e) => setNewAddress({ ...newAddress, address_street: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Número</Label>
                          <Input
                            value={newAddress.address_number}
                            onChange={(e) => setNewAddress({ ...newAddress, address_number: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Bairro</Label>
                          <Input
                            value={newAddress.address_neighborhood}
                            onChange={(e) => setNewAddress({ ...newAddress, address_neighborhood: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Cidade</Label>
                          <Input
                            value={newAddress.address_city}
                            onChange={(e) => setNewAddress({ ...newAddress, address_city: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Estado</Label>
                          <Input
                            value={newAddress.address_state}
                            onChange={(e) => setNewAddress({ ...newAddress, address_state: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Contato</Label>
                          <Input
                            value={newAddress.contact_name}
                            onChange={(e) => setNewAddress({ ...newAddress, contact_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Telefone</Label>
                          <Input
                            value={newAddress.contact_phone}
                            onChange={(e) => setNewAddress({ ...newAddress, contact_phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNewAddressForm(false)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                      </Button>
                    </div>
                  )}

                  {/* Delivery Date */}
                  <div>
                    <Label className="text-xs">Data de Entrega</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !deliveryDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {deliveryDate ? format(deliveryDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={deliveryDate || undefined}
                          onSelect={(date) => setDeliveryDate(date || null)}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Methods */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Formas de Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Added payments list */}
                {payments.length > 0 && (
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 bg-accent/50 rounded-lg"
                      >
                        <div>
                          <span className="font-medium">{payment.paymentMethodName}</span>
                          {payment.installments > 1 && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({payment.installments}x)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">R$ {payment.amount.toFixed(2)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removePayment(payment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add payment form */}
                {remaining > 0.01 && (
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div className="col-span-2">
                      <Label className="text-xs">Forma</Label>
                      <Select value={currentPaymentMethodId} onValueChange={setCurrentPaymentMethodId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map((pm: any) => (
                            <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={currentAmount || ''}
                        onChange={(e) => setCurrentAmount(Number(e.target.value))}
                        placeholder={remaining.toFixed(2)}
                      />
                    </div>
                    <Button onClick={addPayment}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Installments */}
                {selectedPaymentMethod?.allow_installments && currentAmount > 0 && (
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Select value={String(currentInstallments)} onValueChange={(v) => setCurrentInstallments(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: selectedPaymentMethod.max_installments || 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x de R$ {(currentAmount / n).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Credit option */}
                {availableCredit > 0 && remaining > 0.01 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useCredit"
                        checked={useCredit}
                        onChange={(e) => handleCreditToggle(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="useCredit" className="text-sm cursor-pointer">
                        Usar crediário (disponível: R$ {availableCredit.toFixed(2)})
                      </Label>
                    </div>
                    {useCredit && (
                      <div className="mt-2">
                        <Label className="text-xs">Valor no Crediário</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={creditAmount || ''}
                          onChange={(e) => setCreditAmount(Math.min(Number(e.target.value), availableCredit, remaining))}
                          max={Math.min(availableCredit, remaining)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total da Venda</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pagamentos</span>
                  <span className="text-green-600">R$ {payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}</span>
                </div>
                {creditAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Crediário</span>
                    <span className="text-orange-600">R$ {creditAmount.toFixed(2)}</span>
                  </div>
                )}
                {remaining > 0.01 && (
                  <div className="flex justify-between text-sm text-destructive font-medium">
                    <span>Restante</span>
                    <span>R$ {remaining.toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={remaining > 0.01}>
            Finalizar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PDVPaymentStep;
