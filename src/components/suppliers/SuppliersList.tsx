import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, CreditCard, MapPin, Eye, UserX, UserCheck, History, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SupplierForm } from './SupplierForm';
import { SupplierHistoryModal } from './SupplierHistoryModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface SuppliersListProps {
  suppliers: Supplier[];
  loading: boolean;
  onUpdate: () => void;
}

export const SuppliersList = ({ suppliers, loading, onUpdate }: SuppliersListProps) => {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySupplier, setHistorySupplier] = useState<{ id: string; name: string } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const { toast } = useToast();

  const filteredSuppliers = useMemo(() => {
    if (!searchFilter.trim()) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [suppliers, searchFilter]);

  const handleViewHistory = (supplier: Supplier) => {
    setHistorySupplier({ id: supplier.id, name: supplier.name });
    setIsHistoryOpen(true);
  };

  const formatAddress = (supplier: Supplier) => {
    const parts = [
      supplier.address_street,
      supplier.address_number,
      supplier.address_neighborhood,
      supplier.address_city,
      supplier.address_state
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'Não informado';
  };

  const handleViewDetails = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsEditMode(false);
    setIsDetailsOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsEditMode(true);
    setIsDetailsOpen(true);
  };

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ active: !supplier.active })
        .eq('id', supplier.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: supplier.active ? "Fornecedor inativado" : "Fornecedor reativado",
      });

      onUpdate();
    } catch (error) {
      console.error('Erro ao alterar status do fornecedor:', error);
      toast({
        title: "Erro",
        description: "Falha ao alterar status do fornecedor",
        variant: "destructive",
      });
    }
  };

  const handleSupplierUpdated = () => {
    setIsDetailsOpen(false);
    setSelectedSupplier(null);
    setIsEditMode(false);
    onUpdate();
    toast({
      title: "Sucesso",
      description: "Fornecedor atualizado com sucesso",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-muted-foreground">Carregando fornecedores...</div>
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Nenhum fornecedor cadastrado ainda.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Clique em "Novo Fornecedor" para cadastrar o primeiro.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filteredSuppliers.length === 0 && suppliers.length > 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Nenhum fornecedor encontrado com "{searchFilter}"</p>
          <Button variant="outline" size="sm" onClick={() => setSearchFilter('')} className="mt-2">
            Limpar busca
          </Button>
        </div>
      ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome/Razão Social</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">
                  <div>
                    <div>{supplier.name}</div>
                    {supplier.observations && (
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {supplier.observations}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {supplier.document || 'Não informado'}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {supplier.email && (
                      <div className="text-sm">{supplier.email}</div>
                    )}
                    {supplier.phone && (
                      <div className="text-sm text-muted-foreground">{supplier.phone}</div>
                    )}
                    {!supplier.email && !supplier.phone && (
                      <div className="text-sm text-muted-foreground">Não informado</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={supplier.active ? "default" : "secondary"}>
                    {supplier.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(supplier)}
                      title="Visualizar detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewHistory(supplier)}
                      title="Histórico de contas"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSupplier(supplier)}
                      title="Editar fornecedor"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(supplier)}
                      className={supplier.active ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}
                      title={supplier.active ? "Inativar fornecedor" : "Reativar fornecedor"}
                    >
                      {supplier.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Dialog de Detalhes */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Editar Fornecedor' : 'Detalhes do Fornecedor'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSupplier && (
            <>
              {isEditMode ? (
                <SupplierForm 
                  onSuccess={handleSupplierUpdated} 
                  initialData={selectedSupplier}
                />
              ) : (
                <div className="space-y-6">
                  {/* Dados Básicos */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3">Dados Básicos</h3>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-medium">Nome:</span>
                          <p className="text-sm">{selectedSupplier.name}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">Documento:</span>
                          <p className="text-sm">{selectedSupplier.document || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">E-mail:</span>
                          <p className="text-sm">{selectedSupplier.email || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">Telefone:</span>
                          <p className="text-sm">{selectedSupplier.phone || 'Não informado'}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3 flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        Endereço
                      </h3>
                      <p className="text-sm">{formatAddress(selectedSupplier)}</p>
                      {selectedSupplier.address_zip && (
                        <p className="text-sm text-muted-foreground">CEP: {selectedSupplier.address_zip}</p>
                      )}
                    </div>
                  </div>

                  {/* Observações */}
                  {selectedSupplier.observations && (
                    <div>
                      <h3 className="font-semibold mb-3">Observações</h3>
                      <p className="text-sm">{selectedSupplier.observations}</p>
                    </div>
                  )}

                  {/* Chaves PIX */}
                  {selectedSupplier.pix_keys && selectedSupplier.pix_keys.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Chaves PIX
                      </h3>
                      <div className="space-y-1">
                        {selectedSupplier.pix_keys.map((key, index) => (
                          <p key={index} className="text-sm font-mono bg-muted p-2 rounded">
                            {key}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dados Bancários */}
                  {selectedSupplier.bank_data && Array.isArray(selectedSupplier.bank_data) && selectedSupplier.bank_data.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Dados Bancários
                      </h3>
                      <div className="space-y-4">
                        {selectedSupplier.bank_data.map((bank: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <h4 className="font-medium mb-2">Conta {index + 1}</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Banco:</span> {bank.bank || 'Não informado'}
                              </div>
                              <div>
                                <span className="font-medium">Agência:</span> {bank.agency || 'Não informado'}
                              </div>
                              <div>
                                <span className="font-medium">Conta:</span> {bank.account || 'Não informado'}
                              </div>
                              <div>
                                <span className="font-medium">Tipo:</span> {bank.account_type || 'Não informado'}
                              </div>
                              <div>
                                <span className="font-medium">Titular:</span> {bank.holder_name || 'Não informado'}
                              </div>
                              <div>
                                <span className="font-medium">CPF/CNPJ:</span> {bank.holder_document || 'Não informado'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico */}
      {historySupplier && (
        <SupplierHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistorySupplier(null);
          }}
          supplierId={historySupplier.id}
          supplierName={historySupplier.name}
        />
      )}
    </>
  );
};