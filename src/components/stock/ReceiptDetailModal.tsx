import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { XCircle, User, Calendar, Building2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReceiptHeader {
  id: string;
  receipt_number: string;
  invoice_number: string | null;
  notes: string | null;
  status: string;
  received_at: string;
  received_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  store: { name: string; code: string };
  supplier: { name: string } | null;
}

interface ReceiptItem {
  id: string;
  quantity: number;
  new_cost_price: number;
  new_sale_price: number;
  old_sale_price: number | null;
  product: {
    internal_code: string;
    name: string;
  };
}

interface Props {
  receiptId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void;
}

export function ReceiptDetailModal({ receiptId, open, onOpenChange, onCancelled }: Props) {
  const [header, setHeader] = useState<ReceiptHeader | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [receiverName, setReceiverName] = useState<string>('');
  const [cancellerName, setCancellerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && receiptId) {
      fetchReceiptDetails();
    }
  }, [open, receiptId]);

  const fetchReceiptDetails = async () => {
    if (!receiptId) return;

    try {
      setLoading(true);
      
      // Fetch header
      const { data: headerData, error: headerError } = await (supabase as any)
        .from('stock_receipt_headers')
        .select(`
          id,
          receipt_number,
          invoice_number,
          notes,
          status,
          received_at,
          received_by,
          cancelled_at,
          cancelled_by,
          cancellation_reason,
          store:stores(name, code),
          supplier:suppliers(name)
        `)
        .eq('id', receiptId)
        .single();

      if (headerError) throw headerError;
      setHeader(headerData);

      // Fetch receiver name
      if (headerData.received_by) {
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('full_name')
          .eq('id', headerData.received_by)
          .single();
        setReceiverName(profile?.full_name || '');
      }

      // Fetch canceller name
      if (headerData.cancelled_by) {
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('full_name')
          .eq('id', headerData.cancelled_by)
          .single();
        setCancellerName(profile?.full_name || '');
      }

      // Fetch items
      const { data: itemsData, error: itemsError } = await (supabase as any)
        .from('stock_receipts')
        .select(`
          id,
          quantity,
          new_cost_price,
          new_sale_price,
          old_sale_price,
          product:products(internal_code, name)
        `)
        .eq('header_id', receiptId);

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar detalhes do recebimento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!receiptId || !user || !cancelReason.trim()) {
      toast({
        title: "Erro",
        description: "Informe o motivo do cancelamento",
        variant: "destructive",
      });
      return;
    }

    try {
      setCancelling(true);
      
      const { data, error } = await (supabase as any).rpc('cancel_stock_receipt', {
        p_header_id: receiptId,
        p_user_id: user.id,
        p_reason: cancelReason.trim()
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Recebimento cancelado com sucesso. O estoque foi revertido.",
      });
      
      setCancelReason('');
      onOpenChange(false);
      onCancelled?.();
    } catch (error: any) {
      console.error('Erro ao cancelar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao cancelar recebimento",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.new_cost_price), 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes do Recebimento
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : header ? (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Número:</span>
                  <span className="font-mono">{header.receipt_number}</span>
                </div>
                {header.invoice_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Nota Fiscal:</span>
                    <span>{header.invoice_number}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Loja:</span>
                  <span>{header.store.code} - {header.store.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Fornecedor:</span>
                  <span>{header.supplier?.name || '-'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Data:</span>
                  <span>{formatDate(header.received_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Recebido por:</span>
                  <span>{receiverName || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Status:</span>
                  <Badge variant={header.status === 'active' ? 'default' : 'destructive'}>
                    {header.status === 'active' ? 'Ativo' : 'Cancelado'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Cancellation info */}
            {header.status === 'cancelled' && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-2">Recebimento Cancelado</p>
                <p className="text-sm"><strong>Data:</strong> {header.cancelled_at ? formatDate(header.cancelled_at) : '-'}</p>
                <p className="text-sm"><strong>Cancelado por:</strong> {cancellerName || '-'}</p>
                <p className="text-sm"><strong>Motivo:</strong> {header.cancellation_reason || '-'}</p>
              </div>
            )}

            {/* Notes */}
            {header.notes && (
              <div>
                <Label className="text-sm font-medium">Observações:</Label>
                <p className="text-sm text-muted-foreground mt-1">{header.notes}</p>
              </div>
            )}

            {/* Items Table */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Itens ({items.length})</Label>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Venda Unit.</TableHead>
                      <TableHead className="text-right">Total Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{item.product.name}</span>
                            <span className="text-xs text-muted-foreground">{item.product.internal_code}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.new_cost_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.new_sale_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.quantity * item.new_cost_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end gap-6 p-4 bg-muted rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">Total de Itens:</span>
                <span className="font-medium ml-2">{totalItems.toLocaleString('pt-BR')}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Valor Total:</span>
                <span className="font-medium ml-2">{formatCurrency(totalCost)}</span>
              </div>
            </div>

            {/* Cancel Button */}
            {header.status === 'active' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <XCircle className="h-4 w-4 mr-2" />
                    Desfazer Recebimento
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá cancelar o recebimento e reverter todo o estoque adicionado. 
                      Esta operação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <Label>Motivo do cancelamento *</Label>
                    <Textarea
                      placeholder="Informe o motivo do cancelamento..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCancel}
                      disabled={cancelling || !cancelReason.trim()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Recebimento não encontrado.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
