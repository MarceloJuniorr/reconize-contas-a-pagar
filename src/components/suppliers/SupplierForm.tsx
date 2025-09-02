import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const supplierSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  document: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  observations: z.string().optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_zip: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface BankData {
  bank: string;
  agency: string;
  account: string;
  account_type: string;
  holder_name: string;
  holder_document: string;
}

interface SupplierFormProps {
  onSuccess: () => void;
  initialData?: Supplier;
}

interface Supplier {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  observations: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  pix_keys: string[] | null;
  bank_data: any;
  active: boolean;
  created_at: string;
}

export const SupplierForm = ({ onSuccess, initialData }: SupplierFormProps) => {
  const [pixKeys, setPixKeys] = useState<string[]>(
    initialData?.pix_keys && initialData.pix_keys.length > 0 ? initialData.pix_keys : ['']
  );
  const [bankData, setBankData] = useState<BankData[]>(
    initialData?.bank_data && Array.isArray(initialData.bank_data) && initialData.bank_data.length > 0 
      ? initialData.bank_data 
      : [{
          bank: '',
          agency: '',
          account: '',
          account_type: '',
          holder_name: '',
          holder_document: ''
        }]
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: initialData?.name || '',
      document: initialData?.document || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      observations: initialData?.observations || '',
      address_street: initialData?.address_street || '',
      address_number: initialData?.address_number || '',
      address_complement: initialData?.address_complement || '',
      address_neighborhood: initialData?.address_neighborhood || '',
      address_city: initialData?.address_city || '',
      address_state: initialData?.address_state || '',
      address_zip: initialData?.address_zip || '',
    },
  });

  const addPixKey = () => {
    setPixKeys([...pixKeys, '']);
  };

  const removePixKey = (index: number) => {
    if (pixKeys.length > 1) {
      setPixKeys(pixKeys.filter((_, i) => i !== index));
    }
  };

  const updatePixKey = (index: number, value: string) => {
    const updated = [...pixKeys];
    updated[index] = value;
    setPixKeys(updated);
  };

  const addBankData = () => {
    setBankData([...bankData, {
      bank: '',
      agency: '',
      account: '',
      account_type: '',
      holder_name: '',
      holder_document: ''
    }]);
  };

  const removeBankData = (index: number) => {
    if (bankData.length > 1) {
      setBankData(bankData.filter((_, i) => i !== index));
    }
  };

  const updateBankData = (index: number, field: keyof BankData, value: string) => {
    const updated = [...bankData];
    updated[index] = { ...updated[index], [field]: value };
    setBankData(updated);
  };

  const onSubmit = async (data: SupplierFormData) => {
    setLoading(true);
    try {
      // Filter out empty PIX keys and bank data
      const filteredPixKeys = pixKeys.filter(key => key.trim() !== '');
      const filteredBankData = bankData.filter(bank => 
        bank.bank.trim() !== '' || bank.agency.trim() !== '' || bank.account.trim() !== ''
      );

      const supplierData = {
        name: data.name,
        email: data.email || null,
        document: data.document || null,
        phone: data.phone || null,
        observations: data.observations || null,
        address_street: data.address_street || null,
        address_number: data.address_number || null,
        address_complement: data.address_complement || null,
        address_neighborhood: data.address_neighborhood || null,
        address_city: data.address_city || null,
        address_state: data.address_state || null,
        address_zip: data.address_zip || null,
        pix_keys: filteredPixKeys.length > 0 ? filteredPixKeys : null,
        bank_data: filteredBankData.length > 0 ? JSON.parse(JSON.stringify(filteredBankData)) : null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      const { error } = initialData 
        ? await supabase
            .from('suppliers')
            .update(supplierData)
            .eq('id', initialData.id)
        : await supabase
            .from('suppliers')
            .insert([supplierData]);

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      toast({
        title: "Erro",
        description: `Falha ao ${initialData ? 'atualizar' : 'cadastrar'} fornecedor`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Dados Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Básicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome/Razão Social *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ/CPF</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço (Opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="address_street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address_complement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="address_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Chaves PIX */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Chaves PIX (Opcional)
              <Button type="button" variant="outline" size="sm" onClick={addPixKey}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Chave
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pixKeys.map((key, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={key}
                  onChange={(e) => updatePixKey(index, e.target.value)}
                  placeholder="Digite a chave PIX"
                />
                {pixKeys.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removePixKey(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Dados Bancários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Dados Bancários (Opcional)
              <Button type="button" variant="outline" size="sm" onClick={addBankData}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conta
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bankData.map((bank, index) => (
              <div key={index} className="space-y-4 p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Conta {index + 1}</h4>
                  {bankData.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeBankData(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Banco</label>
                    <Input
                      value={bank.bank}
                      onChange={(e) => updateBankData(index, 'bank', e.target.value)}
                      placeholder="Nome do banco"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Agência</label>
                    <Input
                      value={bank.agency}
                      onChange={(e) => updateBankData(index, 'agency', e.target.value)}
                      placeholder="Número da agência"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Conta</label>
                    <Input
                      value={bank.account}
                      onChange={(e) => updateBankData(index, 'account', e.target.value)}
                      placeholder="Número da conta"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tipo de Conta</label>
                    <Input
                      value={bank.account_type}
                      onChange={(e) => updateBankData(index, 'account_type', e.target.value)}
                      placeholder="Corrente/Poupança"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Titular</label>
                    <Input
                      value={bank.holder_name}
                      onChange={(e) => updateBankData(index, 'holder_name', e.target.value)}
                      placeholder="Nome do titular"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">CPF/CNPJ do Titular</label>
                    <Input
                      value={bank.holder_document}
                      onChange={(e) => updateBankData(index, 'holder_document', e.target.value)}
                      placeholder="Documento do titular"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : (initialData ? 'Atualizar Fornecedor' : 'Salvar Fornecedor')}
          </Button>
        </div>
      </form>
    </Form>
  );
};