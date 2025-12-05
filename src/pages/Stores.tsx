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
import { useIsMobile } from '@/hooks/use-mobile';

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
  pdv_auto_print: boolean;
  pdv_print_format: string;
  pdv_max_discount_percent: number;
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
    pdv_auto_print: false,
    pdv_print_format: 'a4',
    pdv_max_discount_percent: 100,
  });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const { toast } = useToast();
  const { hasRole, user } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
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
        pdv_auto_print: store.pdv_auto_print ?? false,
        pdv_print_format: store.pdv_print_format || 'a4',
        pdv_max_discount_percent: store.pdv_max_discount_percent ?? 100,
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
        pdv_auto_print: false,
        pdv_print_format: 'a4',
        pdv_max_discount_percent: 100,
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
        const { error } = await (supabase as any)
          .from('stores')
          .update({
            name: formData.name,
            code: formData.code,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null,
            pdv_auto_print: formData.pdv_auto_print,
            pdv_print_format: formData.pdv_print_format,
            pdv_max_discount_percent: formData.pdv_max_discount_percent,
          })
          .eq('id', editingStore.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Loja atualizada com sucesso" });
      } else {
        const { error } = await (supabase as any)
          .from('stores')
          .insert({
            name: formData.name,
            code: formData.code,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null,
            pdv_auto_print: formData.pdv_auto_print,
            pdv_print_format: formData.pdv_print_format,
            pdv_max_discount_percent: formData.pdv_max_discount_percent,
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
      const { error } = await (supabase as any)
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
          ) : stores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma loja cadastrada
            </div>
          ) : isMobile ? (
            // Mobile: Cards
            <div className="space-y-3">
              {stores.map((store) => (
                <Card 
                  key={store.id}
                  className={`cursor-pointer transition-all ${selectedCardId === store.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedCardId(selectedCardId === store.id ? null : store.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{store.code}</p>
                      </div>
                      <Badge variant={store.active ? 'default' : 'secondary'}>
                        {store.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1 mt-2">
                      {store.cnpj && (
                        <p>
                          <span className="text-muted-foreground">CNPJ:</span> {store.cnpj}
                        </p>
                      )}
                      {store.phone && (
                        <p>
                          <span className="text-muted-foreground">Tel:</span> {store.phone}
                        </p>
                      )}
                    </div>
                    {selectedCardId === store.id && (canEdit || canDelete) && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleOpenDialog(store); }}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDelete(store.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
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
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-sm mb-3">Configurações do PDV</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pdv_auto_print"
                    checked={formData.pdv_auto_print}
                    onChange={(e) => setFormData({ ...formData, pdv_auto_print: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="pdv_auto_print" className="text-sm cursor-pointer">
                    Imprimir pedido automaticamente ao finalizar venda
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pdv_print_format">Formato de Impressão</Label>
                    <select
                      id="pdv_print_format"
                      value={formData.pdv_print_format}
                      onChange={(e) => setFormData({ ...formData, pdv_print_format: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="a4">A4</option>
                      <option value="bobina">Bobina 80mm</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="pdv_max_discount_percent">Desconto Máx. (%)</Label>
                    <Input
                      id="pdv_max_discount_percent"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.pdv_max_discount_percent}
                      onChange={(e) => setFormData({ ...formData, pdv_max_discount_percent: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
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
