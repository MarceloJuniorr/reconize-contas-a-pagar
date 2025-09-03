import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Clock, User, FileEdit, CreditCard, Plus } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
  };
}

interface AccountHistoryModalProps {
  accountId: string;
  open: boolean;
  onClose: () => void;
}

export const AccountHistoryModal = ({ accountId, open, onClose }: AccountHistoryModalProps) => {
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && accountId) {
      fetchHistory();
    }
  }, [open, accountId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          old_values,
          new_values,
          created_at,
          user_id,
          profiles:user_id (
            full_name
          )
        `)
        .eq('record_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'UPDATE':
        return <FileEdit className="h-4 w-4 text-blue-600" />;
      case 'DELETE':
        return <CreditCard className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'Criou';
      case 'UPDATE':
        return 'Editou';
      case 'DELETE':
        return 'Pagou';
      default:
        return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getChangedFields = (oldValues: any, newValues: any) => {
    if (!oldValues || !newValues) return [];
    
    const changes: { field: string; from: any; to: any }[] = [];
    const fieldsToCheck = ['description', 'amount', 'due_date', 'status', 'payment_type'];
    
    fieldsToCheck.forEach(field => {
      if (oldValues[field] !== newValues[field]) {
        changes.push({
          field,
          from: oldValues[field],
          to: newValues[field]
        });
      }
    });
    
    return changes;
  };

  const getFieldLabel = (field: string) => {
    const labels: { [key: string]: string } = {
      description: 'Descrição',
      amount: 'Valor',
      due_date: 'Vencimento',
      status: 'Status',
      payment_type: 'Tipo de Pagamento'
    };
    return labels[field] || field;
  };

  const formatValue = (field: string, value: any) => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (field) {
      case 'amount':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(value);
      case 'due_date':
        if (typeof value === 'string' && value.includes('-')) {
          const [year, month, day] = value.split('-');
          return `${day}/${month}/${year}`;
        }
        return value;
      default:
        return value;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico da Conta
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">Carregando histórico...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum histórico encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((log, index) => (
                <div key={log.id} className="relative">
                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      {getActionIcon(log.action)}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getActionColor(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.profiles?.full_name || 'Usuário desconhecido'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>
                      
                      {log.action === 'UPDATE' && log.old_values && log.new_values && (
                        <div className="space-y-2">
                          {getChangedFields(log.old_values, log.new_values).map((change) => (
                            <div key={change.field} className="text-sm bg-gray-50 p-3 rounded">
                              <div className="font-medium text-gray-900 mb-1">
                                {getFieldLabel(change.field)}:
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-red-600 line-through">
                                  {formatValue(change.field, change.from)}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-600 font-medium">
                                  {formatValue(change.field, change.to)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {log.action === 'INSERT' && (
                        <div className="text-sm text-green-700">
                          Conta criada no sistema
                        </div>
                      )}
                      
                      {log.action === 'DELETE' && (
                        <div className="text-sm text-red-700">
                          Conta marcada como paga
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {index < history.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};