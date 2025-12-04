import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCog, Shield, Eye, CreditCard, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';

interface StoreType {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: string[];
  stores: string[];
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const { toast } = useToast();
  const { hasRole, user: currentUser } = useAuth();

  useEffect(() => {
    if (hasRole('admin')) {
      fetchUsers();
      fetchStores();
    }
  }, [hasRole]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Buscar todos os perfis
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar papéis e lojas de cada usuário
      const usersWithData = await Promise.all(
        profiles.map(async (profile) => {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          const { data: userStores } = await (supabase as any)
            .from('user_stores')
            .select('store_id')
            .eq('user_id', profile.id);

          return {
            ...profile,
            roles: userRoles?.map(r => r.role) || [],
            stores: userStores?.map((s: any) => s.store_id) || []
          };
        })
      );

      setUsers(usersWithData);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    const { data } = await (supabase as any)
      .from('stores')
      .select('id, name, code')
      .eq('active', true)
      .order('name');
    setStores(data || []);
  };

  const handleManageRoles = (user: User) => {
    setSelectedUser(user);
    setSelectedRole('');
    setIsRoleDialogOpen(true);
  };

  const handleManageStores = (user: User) => {
    setSelectedUser(user);
    setSelectedStores(user.stores);
    setIsStoreDialogOpen(true);
  };

  const handleSaveStores = async () => {
    if (!selectedUser) return;

    try {
      // Remover todas as lojas atuais
      await (supabase as any)
        .from('user_stores')
        .delete()
        .eq('user_id', selectedUser.id);

      // Adicionar novas lojas selecionadas
      if (selectedStores.length > 0) {
        const inserts = selectedStores.map(store_id => ({
          user_id: selectedUser.id,
          store_id
        }));

        const { error } = await (supabase as any)
          .from('user_stores')
          .insert(inserts);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Lojas atualizadas com sucesso",
      });

      setIsStoreDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar lojas:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar lojas",
        variant: "destructive",
      });
    }
  };

  const toggleStore = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;

    try {
      // Verificar se o usuário já tem esse papel
      if (selectedUser.roles.includes(selectedRole)) {
        toast({
          title: "Aviso",
          description: "Usuário já possui este papel",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.id,
          role: selectedRole as 'admin' | 'pagador' | 'operador' | 'leitor'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Papel adicionado com sucesso",
      });

      setIsRoleDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Erro ao adicionar papel:', error);
      toast({
        title: "Erro",
        description: "Falha ao adicionar papel",
        variant: "destructive",
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    // Impedir que o admin remova seu próprio papel de administrador
    if (userId === currentUser?.id && role === 'admin') {
      toast({
        title: "Ação não permitida",
        description: "Você não pode remover seu próprio papel de administrador",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as 'admin' | 'pagador' | 'operador' | 'leitor');

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Papel removido com sucesso",
      });

      fetchUsers();
    } catch (error) {
      console.error('Erro ao remover papel:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover papel",
        variant: "destructive",
      });
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      admin: 'Administrador',
      pagador: 'Pagador',
      operador: 'Operador',
      leitor: 'Leitor'
    };
    return labels[role] || role;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'pagador':
        return <CreditCard className="h-3 w-3" />;
      case 'operador':
        return <UserCog className="h-3 w-3" />;
      case 'leitor':
        return <Eye className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'pagador':
        return 'bg-green-100 text-green-800';
      case 'operador':
        return 'bg-blue-100 text-blue-800';
      case 'leitor':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!hasRole('admin')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Acesso Negado</h3>
          <p className="text-muted-foreground">Apenas administradores podem gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gerenciamento de Usuários
          </CardTitle>
          <CardDescription>
            Gerencie usuários e seus papéis no sistema
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Resumo de Papéis */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Administradores</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users.filter(u => u.roles.includes('admin')).length}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Pagadores</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users.filter(u => u.roles.includes('pagador')).length}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Operadores</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users.filter(u => u.roles.includes('operador')).length}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Leitores</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users.filter(u => u.roles.includes('leitor')).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando usuários...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Lojas</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge
                            key={role}
                            className={`${getRoleColor(role)} flex items-center gap-1`}
                          >
                            {getRoleIcon(role)}
                            {getRoleLabel(role)}
                            {!(user.id === currentUser?.id && role === 'admin') && (
                              <button
                                onClick={() => handleRemoveRole(user.id, role)}
                                className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                                title="Remover papel"
                              >
                                ×
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.stores.length > 0 ? (
                          user.stores.map((storeId) => {
                            const store = stores.find(s => s.id === storeId);
                            return store ? (
                              <Badge key={storeId} variant="outline" className="text-xs">
                                {store.code}
                              </Badge>
                            ) : null;
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">Nenhuma</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageRoles(user)}
                        >
                          <UserCog className="h-4 w-4 mr-1" />
                          Papéis
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageStores(user)}
                        >
                          <Store className="h-4 w-4 mr-1" />
                          Lojas
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Gerenciar Papéis */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Papéis - {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Adicionar Papel:</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="pagador">Pagador</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="leitor">Leitor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddRole} disabled={!selectedRole}>
                Adicionar Papel
              </Button>
            </div>

            {/* Descrição dos Papéis */}
            <div className="mt-6 space-y-3 border-t pt-4">
              <h4 className="font-medium">Descrição dos Papéis:</h4>
              <div className="text-sm space-y-2">
                <div className="flex gap-2">
                  <Shield className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <strong>Admin:</strong> CRUD total, gerencia usuários, fornecedores, centros de custo. Acesso completo aos relatórios.
                  </div>
                </div>
                <div className="flex gap-2">
                  <CreditCard className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <strong>Pagador:</strong> Lança contas, marca como pago, anexa comprovantes. Não pode excluir contas de outros.
                  </div>
                </div>
                <div className="flex gap-2">
                  <UserCog className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <strong>Operador:</strong> Lança contas, não edita no dia do vencimento, não marca como pago.
                  </div>
                </div>
                <div className="flex gap-2">
                  <Eye className="h-4 w-4 text-gray-600 mt-0.5" />
                  <div>
                    <strong>Leitor:</strong> Somente leitura e exportações.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Gerenciar Lojas */}
      <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Lojas - {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione as lojas que este usuário pode gerenciar. Usuários sem lojas vinculadas não terão acesso aos menus de Produtos e Estoque.
            </p>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {stores.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma loja cadastrada.</p>
              ) : (
                stores.map((store) => (
                  <div key={store.id} className="flex items-center space-x-2 p-2 border rounded">
                    <Checkbox
                      id={store.id}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={() => toggleStore(store.id)}
                    />
                    <label htmlFor={store.id} className="text-sm cursor-pointer flex-1">
                      <span className="font-mono">{store.code}</span> - {store.name}
                    </label>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsStoreDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveStores}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;