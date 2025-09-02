import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { CostCenterForm } from '@/components/cost-centers/CostCenterForm';
import { CostCentersList } from '@/components/cost-centers/CostCentersList';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

const CostCenters = () => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from('cost_centers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCostCenters(data || []);
    } catch (error) {
      console.error('Erro ao carregar centros de custo:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar centros de custo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostCenters();
  }, []);

  const handleCostCenterCreated = () => {
    setIsDialogOpen(false);
    fetchCostCenters();
    toast({
      title: "Sucesso",
      description: "Centro de custo cadastrado com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centros de Custo</h1>
          <p className="text-muted-foreground">
            Gerencie os centros de custo para organização das despesas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Centro de Custo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Centro de Custo</DialogTitle>
            </DialogHeader>
            <CostCenterForm onSuccess={handleCostCenterCreated} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Centros de Custo</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os centros de custo cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CostCentersList costCenters={costCenters} loading={loading} onUpdate={fetchCostCenters} />
        </CardContent>
      </Card>
    </div>
  );
};

export default CostCenters;