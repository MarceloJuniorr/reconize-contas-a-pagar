import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Quote {
  id: string;
  sale_number: string;
  total: number;
  created_at: string;
  customer: { id: string; name: string; document: string | null; credit_limit: number; phone: string | null } | null;
}

interface PDVQuoteSearchModalProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  onLoadQuote: (quote: Quote, items: any[]) => void;
}

export default function PDVQuoteSearchModal({ open, onClose, storeId, onLoadQuote }: PDVQuoteSearchModalProps) {
  const [search, setSearch] = useState('');

  const { data: quotes = [], refetch } = useQuery({
    queryKey: ['quotes', storeId, search],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`
          id, sale_number, total, created_at,
          customer:customers(id, name, document, credit_limit, phone)
        `)
        .eq('store_id', storeId)
        .eq('status', 'quote')
        .order('created_at', { ascending: false })
        .limit(50);

      if (search) {
        query = query.or(`sale_number.ilike.%${search}%,customer.name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Quote[];
    },
    enabled: open && !!storeId
  });

  const handleLoadQuote = async (quote: Quote) => {
    const { data: items } = await supabase
      .from('sale_items')
      .select('product_id, quantity, unit_price, discount_type, discount_value, discount_amount, total, product:products(name, internal_code, ean)')
      .eq('sale_id', quote.id);

    if (items && items.length > 0) {
      onLoadQuote(quote, items);
      onClose();
    } else {
      toast.error('Orçamento sem itens');
    }
  };

  const handleDeleteQuote = async (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir este orçamento?')) return;

    // Delete sale items first
    await supabase.from('sale_items').delete().eq('sale_id', quoteId);
    // Delete sale payments
    await supabase.from('sale_payments').delete().eq('sale_id', quoteId);
    // Delete the sale/quote
    const { error } = await supabase.from('sales').delete().eq('id', quoteId);
    
    if (error) {
      toast.error('Erro ao excluir orçamento');
    } else {
      toast.success('Orçamento excluído');
      refetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Buscar Orçamento
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow 
                  key={quote.id} 
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => handleLoadQuote(quote)}
                >
                  <TableCell className="font-mono font-medium">{quote.sale_number}</TableCell>
                  <TableCell>{quote.customer?.name || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(quote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    R$ {Number(quote.total).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteQuote(quote.id, e)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum orçamento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
