import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuickSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: { id: string; name: string; document: string | null }) => void;
}

export const QuickSupplierModal = ({ open, onOpenChange, onCreated }: QuickSupplierModalProps) => {
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: name.trim(),
          document: document.trim() || null,
          phone: phone.trim() || null,
        })
        .select('id, name, document')
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fornecedor cadastrado com sucesso",
      });

      onCreated(data);
      setName('');
      setDocument('');
      setPhone('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao criar fornecedor:', error);
      toast({
        title: "Erro",
        description: "Falha ao cadastrar fornecedor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Fornecedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome/Razão Social *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do fornecedor"
            />
          </div>
          <div>
            <Label>CNPJ/CPF</Label>
            <Input
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
