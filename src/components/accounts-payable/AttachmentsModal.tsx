import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Attachment {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  source: 'account' | 'payment';
  payment_date?: string;
}

interface AttachmentsModalProps {
  accountId: string;
  open: boolean;
  onClose: () => void;
}

export const AttachmentsModal = ({ accountId, open, onClose }: AttachmentsModalProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && accountId) {
      fetchAttachments();
    }
  }, [open, accountId]);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      // Buscar anexos da conta
      const { data: accountAttachments, error: accountError } = await supabase
        .from('attachments')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (accountError) throw accountError;

      // Buscar anexos dos pagamentos
      const { data: paymentAttachments, error: paymentError } = await supabase
        .from('payments')
        .select('attachment_url, payment_date, created_at')
        .eq('account_id', accountId)
        .not('attachment_url', 'is', null);

      if (paymentError) throw paymentError;

      // Transformar anexos da conta
      const transformedAccountAttachments: Attachment[] = (accountAttachments || []).map(att => ({
        id: att.id,
        filename: att.filename,
        file_path: att.file_path,
        file_size: att.file_size,
        mime_type: att.mime_type,
        created_at: att.created_at,
        source: 'account' as const
      }));

      // Transformar anexos dos pagamentos
      const transformedPaymentAttachments: Attachment[] = (paymentAttachments || []).map((payment, index) => ({
        id: `payment-${index}`,
        filename: `Comprovante de pagamento`,
        file_path: payment.attachment_url,
        file_size: 0,
        mime_type: 'application/pdf',
        created_at: payment.created_at,
        source: 'payment' as const,
        payment_date: payment.payment_date
      }));

      // Combinar e ordenar todos os anexos
      const allAttachments = [...transformedAccountAttachments, ...transformedPaymentAttachments]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAttachments(allAttachments);
    } catch (error) {
      console.error('Erro ao buscar anexos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar anexos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(attachment.file_path);

      if (error) throw error;

      // Criar URL do blob e fazer download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Sucesso",
        description: "Arquivo baixado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao baixar anexo:', error);
      toast({
        title: "Erro",
        description: "Falha ao baixar arquivo",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anexos da Conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-muted-foreground">Carregando anexos...</div>
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum anexo encontrado para esta conta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileIcon(attachment.mime_type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium truncate">
                          {attachment.filename}
                        </p>
                        <Badge variant={attachment.source === 'account' ? 'default' : 'secondary'}>
                          {attachment.source === 'account' ? 'Conta' : 'Pagamento'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>Tamanho: {formatFileSize(attachment.file_size)}</span>
                        <span>Tipo: {attachment.mime_type}</span>
                        <span>Anexado em: {formatDate(attachment.created_at)}</span>
                        {attachment.payment_date && (
                          <span>
                            Data do pagamento: {
                              (() => {
                                const [year, month, day] = attachment.payment_date.split('-');
                                return `${day}/${month}/${year}`;
                              })()
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadAttachment(attachment)}
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Baixar</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};