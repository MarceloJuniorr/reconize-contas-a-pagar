import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowDownCircle, ArrowUpCircle, FileText, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReceiptDetailModal } from './ReceiptDetailModal';

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

interface Props {
  productId: string | null;
  storeId: string | null;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovementHistoryModal({ productId, storeId, productName, open, onOpenChange }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && productId && storeId) {
      fetchMovements();
    }
  }, [open, productId, storeId]);

  const fetchMovements = async () => {
    if (!productId || !storeId) return;

    try {
      setLoading(true);
      
      const { data, error } = await (supabase as any)
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);

      // Fetch user profiles
      const userIds = [...new Set((data || []).map((m: Movement) => m.created_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profilesMap = new Map<string, string>();
        (profilesData || []).forEach((p: any) => {
          profilesMap.set(p.id, p.full_name);
        });
        setProfiles(profilesMap);
      }
    } catch (error) {
      console.error('Erro ao buscar movimentações:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar histórico de movimentações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const getReferenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'receipt': 'Recebimento',
      'receipt_cancellation': 'Cancelamento',
      'sale': 'Venda',
      'adjustment': 'Ajuste',
      'transfer': 'Transferência',
    };
    return labels[type] || type;
  };

  const handleViewDocument = (movement: Movement) => {
    if (movement.reference_type === 'receipt' || movement.reference_type === 'receipt_cancellation') {
      setSelectedReceiptId(movement.reference_id);
      setReceiptModalOpen(true);
    } else {
      toast({
        title: "Informação",
        description: "Visualização deste tipo de documento ainda não disponível.",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Movimentação
            </DialogTitle>
          </DialogHeader>

          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="font-medium">{productName}</p>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma movimentação registrada para este produto.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(movement.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={movement.movement_type === 'entry' ? 'default' : 'secondary'}
                          className="flex items-center gap-1 w-fit"
                        >
                          {movement.movement_type === 'entry' ? (
                            <ArrowDownCircle className="h-3 w-3" />
                          ) : (
                            <ArrowUpCircle className="h-3 w-3" />
                          )}
                          {movement.movement_type === 'entry' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${movement.movement_type === 'entry' ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.movement_type === 'entry' ? '+' : '-'}{movement.quantity.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(movement.unit_cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(movement.unit_price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getReferenceTypeLabel(movement.reference_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {movement.created_by ? profiles.get(movement.created_by) || '-' : '-'}
                      </TableCell>
                      <TableCell>
                        {movement.reference_id && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewDocument(movement)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {movements.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {movements.length} movimentação(ões) encontrada(s)
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptDetailModal
        receiptId={selectedReceiptId}
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
      />
    </>
  );
}
