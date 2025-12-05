import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Store, CalendarIcon, DollarSign, CreditCard, Smartphone, 
  Banknote, Clock, CheckCircle, AlertTriangle, FileText,
  Lock, Unlock, ArrowDownCircle, ArrowUpCircle, Plus, Minus
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DailySummary {
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_pix: number;
  total_credit: number;
  total_other: number;
  sales_count: number;
  credit_sales_count: number;
}

interface CashClosing {
  id: string;
  store_id: string;
  closing_date: string;
  status: string;
  cash_expected: number;
  card_expected: number;
  pix_expected: number;
  credit_expected: number;
  other_expected: number;
  cash_counted: number | null;
  card_counted: number | null;
  pix_counted: number | null;
  difference: number;
  notes: string | null;
  opened_by: string | null;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  store?: { name: string };
  opener?: { full_name: string };
  closer?: { full_name: string };
}

interface Sale {
  id: string;
  sale_number: string;
  total: number;
  created_at: string;
  status: string;
  customer: { name: string };
  sale_payments: Array<{
    amount: number;
    is_credit: boolean;
    payment_method: { name: string; code: string } | null;
  }>;
}

interface CashMovement {
  id: string;
  store_id: string;
  closing_id: string | null;
  movement_type: 'sangria' | 'suprimento';
  amount: number;
  reason: string;
  created_by: string | null;
  created_at: string;
  creator?: { full_name: string };
}

const CashRegisterClosing = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [cashCounted, setCashCounted] = useState('');
  const [cardCounted, setCardCounted] = useState('');
  const [pixCounted, setPixCounted] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  
  // Sangria/Suprimento states
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'sangria' | 'suprimento'>('sangria');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Set default store
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].id);
    }
  }, [stores, selectedStore]);

  // Fetch daily summary using the database function
  const { data: dailySummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['daily-summary', selectedStore, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedStore) return null;

      const { data, error } = await supabase.rpc('get_daily_sales_summary', {
        p_store_id: selectedStore,
        p_date: format(selectedDate, 'yyyy-MM-dd')
      });

      if (error) throw error;
      return data?.[0] as DailySummary | null;
    },
    enabled: !!selectedStore
  });

  // Fetch existing closing for the day
  const { data: existingClosing } = useQuery({
    queryKey: ['cash-closing', selectedStore, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedStore) return null;

      const { data, error } = await supabase
        .from('cash_register_closings')
        .select(`
          *,
          store:stores(name),
          opener:profiles!cash_register_closings_opened_by_fkey(full_name),
          closer:profiles!cash_register_closings_closed_by_fkey(full_name)
        `)
        .eq('store_id', selectedStore)
        .eq('closing_date', format(selectedDate, 'yyyy-MM-dd'))
        .maybeSingle();

      if (error) throw error;
      return data as CashClosing | null;
    },
    enabled: !!selectedStore
  });

  // Fetch sales for the day
  const { data: dailySales } = useQuery({
    queryKey: ['daily-sales', selectedStore, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedStore) return [];

      const startOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T00:00:00';
      const endOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T23:59:59';

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, sale_number, total, created_at, status,
          customer:customers(name),
          sale_payments(amount, is_credit, payment_method:payment_methods(name, code))
        `)
        .eq('store_id', selectedStore)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Sale[];
    },
    enabled: !!selectedStore
  });

  // Fetch closing history
  const { data: closingHistory } = useQuery({
    queryKey: ['closing-history', selectedStore],
    queryFn: async () => {
      if (!selectedStore) return [];

      const { data, error } = await supabase
        .from('cash_register_closings')
        .select(`
          *,
          store:stores(name),
          opener:profiles!cash_register_closings_opened_by_fkey(full_name),
          closer:profiles!cash_register_closings_closed_by_fkey(full_name)
        `)
        .eq('store_id', selectedStore)
        .order('closing_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      return data as CashClosing[];
    },
    enabled: !!selectedStore
  });

  // Fetch daily cash movements (sangria/suprimento)
  const { data: dailyMovements } = useQuery({
    queryKey: ['daily-movements', selectedStore, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedStore) return [];

      const startOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T00:00:00';
      const endOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T23:59:59';

      const { data, error } = await supabase
        .from('cash_register_movements')
        .select(`
          *,
          creator:profiles!cash_register_movements_created_by_fkey(full_name)
        `)
        .eq('store_id', selectedStore)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CashMovement[];
    },
    enabled: !!selectedStore
  });

  // Calculate totals from movements
  const totalSangria = dailyMovements?.filter(m => m.movement_type === 'sangria').reduce((sum, m) => sum + m.amount, 0) || 0;
  const totalSuprimento = dailyMovements?.filter(m => m.movement_type === 'suprimento').reduce((sum, m) => sum + m.amount, 0) || 0;

  // Mutation to open cash register
  const openMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore || !user) throw new Error('Dados inválidos');

      const { error } = await supabase
        .from('cash_register_closings')
        .insert({
          store_id: selectedStore,
          closing_date: format(selectedDate, 'yyyy-MM-dd'),
          opened_by: user.id,
          status: 'open'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-closing'] });
      toast.success('Caixa aberto com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao abrir caixa: ' + (error as Error).message);
    }
  });

  // Mutation to close cash register
  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!existingClosing || !user) throw new Error('Dados inválidos');

      const cashCountedNum = parseFloat(cashCounted) || 0;
      const cardCountedNum = parseFloat(cardCounted) || 0;
      const pixCountedNum = parseFloat(pixCounted) || 0;

      const expectedCash = dailySummary?.total_cash || 0;
      const difference = cashCountedNum - expectedCash;

      const { error } = await supabase
        .from('cash_register_closings')
        .update({
          status: 'closed',
          closed_by: user.id,
          closed_at: new Date().toISOString(),
          cash_expected: dailySummary?.total_cash || 0,
          card_expected: dailySummary?.total_card || 0,
          pix_expected: dailySummary?.total_pix || 0,
          credit_expected: dailySummary?.total_credit || 0,
          other_expected: dailySummary?.total_other || 0,
          cash_counted: cashCountedNum,
          card_counted: cardCountedNum,
          pix_counted: pixCountedNum,
          difference: difference,
          notes: closingNotes
        })
        .eq('id', existingClosing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-closing'] });
      queryClient.invalidateQueries({ queryKey: ['closing-history'] });
      toast.success('Caixa fechado com sucesso!');
      setCloseModalOpen(false);
      resetCloseForm();
    },
    onError: (error) => {
      toast.error('Erro ao fechar caixa: ' + (error as Error).message);
    }
  });

  const resetCloseForm = () => {
    setCashCounted('');
    setCardCounted('');
    setPixCounted('');
    setClosingNotes('');
  };

  // Mutation to create cash movement (sangria/suprimento)
  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore || !user) throw new Error('Dados inválidos');
      
      const amount = parseFloat(movementAmount);
      if (!amount || amount <= 0) throw new Error('Valor inválido');
      if (!movementReason.trim()) throw new Error('Informe o motivo');

      const { error } = await supabase
        .from('cash_register_movements')
        .insert({
          store_id: selectedStore,
          closing_id: existingClosing?.id || null,
          movement_type: movementType,
          amount: amount,
          reason: movementReason,
          created_by: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-movements'] });
      toast.success(movementType === 'sangria' ? 'Sangria registrada!' : 'Suprimento registrado!');
      setMovementModalOpen(false);
      setMovementAmount('');
      setMovementReason('');
    },
    onError: (error) => {
      toast.error('Erro: ' + (error as Error).message);
    }
  });

  const openMovementModal = (type: 'sangria' | 'suprimento') => {
    setMovementType(type);
    setMovementAmount('');
    setMovementReason('');
    setMovementModalOpen(true);
  };

  const handleOpenClose = () => {
    if (dailySummary) {
      setCashCounted((dailySummary.total_cash || 0).toFixed(2));
      setCardCounted((dailySummary.total_card || 0).toFixed(2));
      setPixCounted((dailySummary.total_pix || 0).toFixed(2));
    }
    setCloseModalOpen(true);
  };

  const getPaymentBreakdown = (sale: Sale) => {
    return sale.sale_payments.map(p => {
      if (p.is_credit) return 'Crediário';
      return p.payment_method?.name || 'N/A';
    }).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fechamento de Caixa</h1>
          <p className="text-muted-foreground">Gerencie o caixa diário por loja</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label className="mb-2 block">Loja</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <Store className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Selecione uma loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="mb-2 block">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedStore && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Resumo do Dia</TabsTrigger>
            <TabsTrigger value="sales">Vendas do Dia</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {existingClosing?.status === 'closed' ? (
                        <>
                          <Lock className="h-5 w-5 text-green-600" />
                          Caixa Fechado
                        </>
                      ) : existingClosing ? (
                        <>
                          <Unlock className="h-5 w-5 text-blue-600" />
                          Caixa Aberto
                        </>
                      ) : (
                        <>
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          Caixa Não Iniciado
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </CardDescription>
                  </div>

                  {!existingClosing && (
                    <Button onClick={() => openMutation.mutate()} disabled={openMutation.isPending}>
                      <Unlock className="h-4 w-4 mr-2" />
                      Abrir Caixa
                    </Button>
                  )}

                  {existingClosing?.status === 'open' && (
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => openMovementModal('suprimento')}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Suprimento
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => openMovementModal('sangria')}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Minus className="h-4 w-4 mr-2" />
                        Sangria
                      </Button>
                      <Button onClick={handleOpenClose}>
                        <Lock className="h-4 w-4 mr-2" />
                        Fechar Caixa
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Sangria/Suprimento Summary */}
            {(totalSangria > 0 || totalSuprimento > 0) && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4" />
                      Total Suprimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-green-600">
                      R$ {totalSuprimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4" />
                      Total Sangrias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-red-600">
                      R$ {totalSangria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">
                    R$ {(dailySummary?.total_sales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dailySummary?.sales_count || 0} vendas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Dinheiro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-green-600">
                    R$ {(dailySummary?.total_cash || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Cartão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-blue-600">
                    R$ {(dailySummary?.total_card || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    PIX
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-purple-600">
                    R$ {(dailySummary?.total_pix || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Crediário
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-orange-600">
                    R$ {(dailySummary?.total_credit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dailySummary?.credit_sales_count || 0} vendas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Outros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-gray-600">
                    R$ {(dailySummary?.total_other || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Closing Details (if closed) */}
            {existingClosing?.status === 'closed' && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes do Fechamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Dinheiro Esperado</p>
                      <p className="font-medium">R$ {(existingClosing.cash_expected || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dinheiro Contado</p>
                      <p className="font-medium">R$ {(existingClosing.cash_counted || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Diferença</p>
                      <p className={cn(
                        "font-medium",
                        existingClosing.difference > 0 ? "text-green-600" : 
                        existingClosing.difference < 0 ? "text-red-600" : ""
                      )}>
                        R$ {(existingClosing.difference || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fechado por</p>
                      <p className="font-medium">{existingClosing.closer?.full_name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">
                        {existingClosing.closed_at && format(new Date(existingClosing.closed_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  {existingClosing.notes && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Observações:</p>
                      <p className="text-sm">{existingClosing.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cash Movements List */}
            {dailyMovements && dailyMovements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Movimentações do Dia
                  </CardTitle>
                  <CardDescription>
                    {dailyMovements.length} movimentação(ões) registrada(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Hora</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Registrado por</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyMovements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>
                              {movement.movement_type === 'sangria' ? (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <Minus className="h-3 w-3" />
                                  Sangria
                                </Badge>
                              ) : (
                                <Badge className="bg-green-500 flex items-center gap-1 w-fit">
                                  <Plus className="h-3 w-3" />
                                  Suprimento
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(movement.created_at), 'HH:mm')}</TableCell>
                            <TableCell className={cn(
                              "text-right font-medium",
                              movement.movement_type === 'sangria' ? "text-red-600" : "text-green-600"
                            )}>
                              {movement.movement_type === 'sangria' ? '-' : '+'} R$ {movement.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{movement.reason}</TableCell>
                            <TableCell>{movement.creator?.full_name || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Vendas do Dia</CardTitle>
                <CardDescription>
                  {dailySales?.length || 0} vendas realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dailySales?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma venda neste dia</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Venda</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Hora</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailySales?.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium">{sale.sale_number}</TableCell>
                            <TableCell>{sale.customer.name}</TableCell>
                            <TableCell>{format(new Date(sale.created_at), 'HH:mm')}</TableCell>
                            <TableCell>{getPaymentBreakdown(sale)}</TableCell>
                            <TableCell className="text-right">
                              R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {sale.status === 'completed' ? (
                                <Badge className="bg-green-500">Concluída</Badge>
                              ) : sale.status === 'cancelled' ? (
                                <Badge variant="destructive">Cancelada</Badge>
                              ) : (
                                <Badge variant="secondary">{sale.status}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Fechamentos</CardTitle>
                <CardDescription>Últimos 30 fechamentos</CardDescription>
              </CardHeader>
              <CardContent>
                {closingHistory?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum fechamento encontrado</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                          <TableHead className="text-right">Dinheiro</TableHead>
                          <TableHead className="text-right">Cartão</TableHead>
                          <TableHead className="text-right">PIX</TableHead>
                          <TableHead className="text-right">Diferença</TableHead>
                          <TableHead>Fechado por</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closingHistory?.map((closing) => (
                          <TableRow key={closing.id}>
                            <TableCell className="font-medium">
                              {format(new Date(closing.closing_date + 'T12:00:00'), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              {closing.status === 'closed' ? (
                                <Badge className="bg-green-500">Fechado</Badge>
                              ) : (
                                <Badge variant="secondary">Aberto</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {((closing.cash_expected || 0) + (closing.card_expected || 0) + (closing.pix_expected || 0) + (closing.credit_expected || 0) + (closing.other_expected || 0)).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {(closing.cash_expected || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {(closing.card_expected || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {(closing.pix_expected || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-medium",
                              (closing.difference || 0) > 0 ? "text-green-600" : 
                              (closing.difference || 0) < 0 ? "text-red-600" : ""
                            )}>
                              R$ {(closing.difference || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>{closing.closer?.full_name || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Close Modal */}
      <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium">Valores Esperados:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Dinheiro:</span>
                <span className="text-right">R$ {(dailySummary?.total_cash || 0).toFixed(2)}</span>
                <span>Cartão:</span>
                <span className="text-right">R$ {(dailySummary?.total_card || 0).toFixed(2)}</span>
                <span>PIX:</span>
                <span className="text-right">R$ {(dailySummary?.total_pix || 0).toFixed(2)}</span>
                <span>Crediário:</span>
                <span className="text-right">R$ {(dailySummary?.total_credit || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dinheiro Contado</Label>
              <Input
                type="number"
                step="0.01"
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                placeholder="0,00"
              />
              {cashCounted && dailySummary && (
                <p className={cn(
                  "text-sm",
                  parseFloat(cashCounted) - dailySummary.total_cash > 0 ? "text-green-600" :
                  parseFloat(cashCounted) - dailySummary.total_cash < 0 ? "text-red-600" : "text-muted-foreground"
                )}>
                  Diferença: R$ {(parseFloat(cashCounted) - dailySummary.total_cash).toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Cartão Conferido</Label>
              <Input
                type="number"
                step="0.01"
                value={cardCounted}
                onChange={(e) => setCardCounted(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>PIX Conferido</Label>
              <Input
                type="number"
                step="0.01"
                value={pixCounted}
                onChange={(e) => setPixCounted(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Observações sobre o fechamento..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement Modal (Sangria/Suprimento) */}
      <Dialog open={movementModalOpen} onOpenChange={setMovementModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {movementType === 'sangria' ? (
                <>
                  <ArrowDownCircle className="h-5 w-5 text-red-600" />
                  Registrar Sangria
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-5 w-5 text-green-600" />
                  Registrar Suprimento
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                type="number"
                step="0.01"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder={movementType === 'sangria' 
                  ? "Ex: Depósito bancário, pagamento fornecedor..." 
                  : "Ex: Troco inicial, reforço de caixa..."}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => movementMutation.mutate()}
              disabled={movementMutation.isPending}
              className={movementType === 'sangria' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {movementMutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashRegisterClosing;
