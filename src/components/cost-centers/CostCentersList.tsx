import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Eye, UserX, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CostCenterForm } from './CostCenterForm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CostCenter {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface CostCentersListProps {
  costCenters: CostCenter[];
  loading: boolean;
  onUpdate: () => void;
}

export const CostCentersList = ({ costCenters, loading, onUpdate }: CostCentersListProps) => {
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const { toast } = useToast();

  const handleViewDetails = (costCenter: CostCenter) => {
    setSelectedCostCenter(costCenter);
    setIsEditMode(false);
    setIsDetailsOpen(true);
  };

  const handleEditCostCenter = (costCenter: CostCenter) => {
    setSelectedCostCenter(costCenter);
    setIsEditMode(true);
    setIsDetailsOpen(true);
  };

  const handleToggleActive = async (costCenter: CostCenter) => {
    try {
      const { error } = await supabase
        .from('cost_centers')
        .update({ active: !costCenter.active })
        .eq('id', costCenter.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: costCenter.active ? "Centro de custo inativado" : "Centro de custo reativado",
      });

      onUpdate();
    } catch (error) {
      console.error('Erro ao alterar status do centro de custo:', error);
      toast({
        title: "Erro",
        description: "Falha ao alterar status do centro de custo",
        variant: "destructive",
      });
    }
  };

  const handleCostCenterUpdated = () => {
    setIsDetailsOpen(false);
    setSelectedCostCenter(null);
    setIsEditMode(false);
    onUpdate();
    toast({
      title: "Sucesso",
      description: "Centro de custo atualizado com sucesso",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-muted-foreground">Carregando centros de custo...</div>
      </div>
    );
  }

  if (costCenters.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Nenhum centro de custo cadastrado ainda.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Clique em "Novo Centro de Custo" para cadastrar o primeiro.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costCenters.map((costCenter) => (
              <TableRow key={costCenter.id}>
                <TableCell className="font-medium">
                  {costCenter.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {costCenter.code}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs">
                    {costCenter.description ? (
                      <span className="text-sm truncate block">{costCenter.description}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem descrição</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={costCenter.active ? "default" : "secondary"}>
                    {costCenter.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(costCenter)}
                      title="Visualizar detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditCostCenter(costCenter)}
                      title="Editar centro de custo"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(costCenter)}
                      className={costCenter.active ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}
                      title={costCenter.active ? "Inativar centro de custo" : "Reativar centro de custo"}
                    >
                      {costCenter.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de Detalhes/Edição */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Editar Centro de Custo' : 'Detalhes do Centro de Custo'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCostCenter && (
            <>
              {isEditMode ? (
                <CostCenterForm 
                  onSuccess={handleCostCenterUpdated} 
                  initialData={selectedCostCenter}
                />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3">Informações Básicas</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Nome:</span>
                          <p className="text-base">{selectedCostCenter.name}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Código:</span>
                          <p className="text-base">
                            <Badge variant="outline" className="font-mono">
                              {selectedCostCenter.code}
                            </Badge>
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Status:</span>
                          <p className="text-base">
                            <Badge variant={selectedCostCenter.active ? "default" : "secondary"}>
                              {selectedCostCenter.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3">Datas</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Criado em:</span>
                          <p className="text-sm">
                            {new Date(selectedCostCenter.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Atualizado em:</span>
                          <p className="text-sm">
                            {new Date(selectedCostCenter.updated_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedCostCenter.description && (
                    <div>
                      <h3 className="font-semibold mb-3">Descrição</h3>
                      <p className="text-sm bg-muted p-3 rounded-md">
                        {selectedCostCenter.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};