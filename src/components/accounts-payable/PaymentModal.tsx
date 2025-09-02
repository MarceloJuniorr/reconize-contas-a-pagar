import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const paymentSchema = z.object({
  payment_date: z.string().min(1, 'Data do pagamento é obrigatória'),
  amount_paid: z.string().min(1, 'Valor pago é obrigatório'),
  payment_method: z.string().min(1, 'Método de pagamento é obrigatório'),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentModalProps {
  account: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal = ({ account, open, onClose, onSuccess }: PaymentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const { toast } = useToast();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      amount_paid: account?.amount?.toString() || '',
      payment_method: '',
      notes: '',
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Erro",
          description: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG",
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo muito grande. Máximo 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setAttachment(file);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, '');
    const formattedValue = (parseFloat(numericValue) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formattedValue;
  };

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      let attachmentUrl = null;

      // Upload attachment if provided
      if (attachment) {
        const fileName = `payments/${account.id}/${Date.now()}-${attachment.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(fileName, attachment);

        if (uploadError) throw uploadError;
        
        attachmentUrl = fileName;
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          account_id: account.id,
          payment_date: data.payment_date,
          amount_paid: parseFloat(data.amount_paid.replace(',', '.')),
          payment_method: data.payment_method,
          notes: data.notes || null,
          attachment_url: attachmentUrl,
          paid_by: (await supabase.auth.getUser()).data.user?.id,
        }]);

      if (paymentError) throw paymentError;

      // Update account status
      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({ status: 'pago' })
        .eq('id', account.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao registrar pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAccountCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Marcar como Pago</DialogTitle>
        </DialogHeader>

        {account && (
          <div className="space-y-6">
            {/* Informações da Conta */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Dados da Conta</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Descrição:</span> {account.description}
                </div>
                <div>
                  <span className="font-medium">Fornecedor:</span> {account.suppliers?.name}
                </div>
                <div>
                  <span className="font-medium">Valor Original:</span> {formatAccountCurrency(account.amount)}
                </div>
                <div>
                  <span className="font-medium">Vencimento:</span> {new Date(account.due_date).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data do Pagamento *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount_paid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Pago *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="0,00"
                            onChange={(e) => {
                              const formatted = formatCurrency(e.target.value);
                              field.onChange(formatted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pagamento *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o método" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Observações sobre o pagamento" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Comprovante */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Comprovante (Opcional)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                      id="payment-file-upload"
                    />
                    <label htmlFor="payment-file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                      <Upload className="h-6 w-6 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Clique para anexar comprovante (PDF, JPG, PNG - máx. 10MB)
                      </span>
                    </label>
                  </div>

                  {attachment && (
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{attachment.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeAttachment}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Registrando...' : 'Confirmar Pagamento'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};