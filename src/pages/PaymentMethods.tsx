import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  active: boolean;
  allow_installments: boolean;
  max_installments: number;
}

const PaymentMethods = () => {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    active: true,
    allow_installments: false,
    max_installments: 1
  });
  const isMobile = useIsMobile();

  const { data: paymentMethods = [], isLoading } = useQuery({
    queryKey: ['payment-methods-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as PaymentMethod[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('payment_methods')
        .insert({
          ...data,
          created_by: user?.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods-admin'] });
      toast.success('Método de pagamento criado com sucesso');
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('payment_methods')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods-admin'] });
      toast.success('Método de pagamento atualizado');
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods-admin'] });
      toast.success('Método de pagamento excluído');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      active: true,
      allow_installments: false,
      max_installments: 1
    });
    setEditingMethod(null);
    setShowForm(false);
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      name: method.name,
      code: method.code,
      active: method.active,
      allow_installments: method.allow_installments,
      max_installments: method.max_installments
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (editingMethod) {
      updateMutation.mutate({ id: editingMethod.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const canManage = hasRole('admin') || hasRole('operador');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Métodos de Pagamento</h1>
          <p className="text-muted-foreground">Configure as formas de pagamento do PDV</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Método
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0 sm:p-6">
          {isLoading ? (
            <div className="text-center py-10">Carregando...</div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum método de pagamento cadastrado
            </div>
          ) : isMobile ? (
            // Mobile: Cards
            <div className="space-y-3 p-4">
              {paymentMethods.map((method) => (
                <Card key={method.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{method.name}</p>
                        <p className="text-xs text-muted-foreground">{method.code}</p>
                      </div>
                      <Badge variant={method.active ? "default" : "secondary"}>
                        {method.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm mt-2">
                      <span className="text-muted-foreground">Parcelas:</span>{' '}
                      {method.allow_installments ? `Até ${method.max_installments}x` : 'Não'}
                    </p>
                    {canManage && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(method)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        {hasRole('admin') && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja excluir o método "{method.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(method.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop: Table
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-[100px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell className="text-muted-foreground">{method.code}</TableCell>
                    <TableCell>
                      {method.allow_installments ? `Até ${method.max_installments}x` : 'Não'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={method.active ? "default" : "secondary"}>
                        {method.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(method)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {hasRole('admin') && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Deseja excluir o método "{method.name}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(method.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? 'Editar Método de Pagamento' : 'Novo Método de Pagamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Cartão de Crédito"
              />
            </div>
            <div>
              <Label>Código *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="Ex: credit_card"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Permite parcelamento</Label>
              <Switch
                checked={formData.allow_installments}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_installments: checked })}
              />
            </div>
            {formData.allow_installments && (
              <div>
                <Label>Máximo de parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={formData.max_installments}
                  onChange={(e) => setFormData({ ...formData, max_installments: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingMethod ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethods;
