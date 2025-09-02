import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const costCenterSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  code: z.string().min(1, 'Código é obrigatório').regex(/^[a-zA-Z0-9_-]+$/, 'Código deve conter apenas letras, números, hífens e underscores'),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

type CostCenterFormData = z.infer<typeof costCenterSchema>;

interface CostCenter {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface CostCenterFormProps {
  onSuccess: () => void;
  initialData?: CostCenter;
}

export const CostCenterForm = ({ onSuccess, initialData }: CostCenterFormProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<CostCenterFormData>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      description: initialData?.description || '',
      active: initialData?.active ?? true,
    },
  });

  const onSubmit = async (data: CostCenterFormData) => {
    setLoading(true);
    try {
      const costCenterData = {
        name: data.name,
        code: data.code,
        description: data.description || null,
        active: data.active,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      const { error } = initialData 
        ? await supabase
            .from('cost_centers')
            .update(costCenterData)
            .eq('id', initialData.id)
        : await supabase
            .from('cost_centers')
            .insert([costCenterData]);

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar centro de custo:', error);
      
      // Check for unique constraint violation
      if (error.code === '23505' && error.message.includes('code')) {
        toast({
          title: "Erro",
          description: "Já existe um centro de custo com este código",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: `Falha ao ${initialData ? 'atualizar' : 'cadastrar'} centro de custo`,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Centro de Custo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Administrativo, Vendas, Marketing" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código *</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Ex: ADM, VND, MKT" 
                      onChange={(e) => {
                        // Convert to uppercase and remove invalid characters
                        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Descrição detalhada do centro de custo (opcional)"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Status Ativo
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Centro de custo disponível para uso
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : (initialData ? 'Atualizar Centro de Custo' : 'Salvar Centro de Custo')}
          </Button>
        </div>
      </form>
    </Form>
  );
};