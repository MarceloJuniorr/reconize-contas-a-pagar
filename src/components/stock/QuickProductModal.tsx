import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuickProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: { id: string; internal_code: string; name: string; ean: string | null; units: { abbreviation: string } | null }) => void;
  initialSearch?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

export const QuickProductModal = ({ open, onOpenChange, onCreated, initialSearch }: QuickProductModalProps) => {
  const [name, setName] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [ean, setEan] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchData();
      if (initialSearch) {
        // Check if initialSearch looks like an EAN (only numbers)
        if (/^\d+$/.test(initialSearch)) {
          setEan(initialSearch);
        } else {
          setName(initialSearch);
        }
      }
    }
  }, [open, initialSearch]);

  const fetchData = async () => {
    const [categoriesRes, brandsRes, unitsRes] = await Promise.all([
      supabase.from('categories').select('id, name').eq('active', true).order('name'),
      supabase.from('brands').select('id, name').eq('active', true).order('name'),
      supabase.from('units').select('id, name, abbreviation').eq('active', true).order('name'),
    ]);

    setCategories(categoriesRes.data || []);
    setBrands(brandsRes.data || []);
    setUnits(unitsRes.data || []);

    // Set default unit if exists
    const defaultUnit = (unitsRes.data || []).find(u => u.abbreviation === 'UN');
    if (defaultUnit) {
      setUnitId(defaultUnit.id);
    }
  };

  const generateInternalCode = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('internal_code')
      .order('internal_code', { ascending: false })
      .limit(1);

    if (error) {
      return 'P0001';
    }

    if (!data || data.length === 0) {
      return 'P0001';
    }

    const lastCode = data[0].internal_code;
    const match = lastCode.match(/P(\d+)/);
    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `P${nextNumber.toString().padStart(4, '0')}`;
    }

    return `P${Date.now()}`;
  };

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
      let code = internalCode.trim();
      if (!code) {
        code = await generateInternalCode();
      }

      const selectedUnit = units.find(u => u.id === unitId);

      const { data, error } = await supabase
        .from('products')
        .insert({
          name: name.trim(),
          internal_code: code,
          ean: ean.trim() || null,
          category_id: categoryId || null,
          brand_id: brandId || null,
          unit_id: unitId || null,
        })
        .select('id, internal_code, name, ean')
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produto cadastrado com sucesso",
      });

      onCreated({
        ...data,
        units: selectedUnit ? { abbreviation: selectedUnit.abbreviation } : null,
      });
      
      // Reset form
      setName('');
      setInternalCode('');
      setEan('');
      setCategoryId('');
      setBrandId('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao criar produto:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao cadastrar produto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do produto"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código Interno</Label>
              <Input
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                placeholder="Auto-gerado se vazio"
              />
            </div>
            <div>
              <Label>Código de Barras (EAN)</Label>
              <Input
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="EAN"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marca</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Unidade</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name} ({unit.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
