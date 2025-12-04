import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Store, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface StoreType {
  id: string;
  name: string;
  code: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
}

const Stores = () => {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    cnpj: '',
    address: '',
    phone: '',
    email: '',
  });
  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar lojas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (store?: StoreType) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name,
        code: store.code,
        cnpj: store.cnpj || '',
        address: store.address || '',
        phone: store.phone || '',
        email: store.email || '',
      });
    } else {
      setEditingStore(null);
      setFormData({
        name: '',
        code: '',
        cnpj: '',
        address: '',
        phone: '',
        email: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast({
        title: "Erro",
        description: "Nome e código são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingStore) {
        const { error } = await supabase
          .from('stores')
          .update({
            name: formData.name,
            code: formData.code,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null,
          })
          .eq('id', editingStore.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Loja atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from('stores')
          .insert({
            name: formData.name,
            code: formData.code,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Loja criada com sucesso" });
      }

      setIsDialogOpen(false);
      fetchStores();
    } catch (error: any) {
      console.error('Erro ao salvar loja:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar loja",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Loja excluída com sucesso" });
      fetchStores();
    } catch (error: any) {
      console.error('Erro ao excluir loja:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao excluir loja",
        variant: "destructive",
      });
    }
  };

  const canEdit = hasRole('admin') || hasRole('operador');
  const canDelete = hasRole('admin');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Cadastro de Lojas
          </CardTitle>
          {canEdit && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Loja
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-mono">{store.code}</TableCell>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell>{store.cnpj || '-'}</TableCell>
                    <TableCell>{store.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={store.active ? 'default' : 'secondary'}>
                        {store.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(store)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(store.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStore ? 'Editar Loja' : 'Nova Loja'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Ex: LJ01"
                />
              </div>
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da loja"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@loja.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingStore ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Stores;
