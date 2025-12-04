import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Package, Plus, Pencil, Trash2, Tag, Layers, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Product {
  id: string;
  internal_code: string;
  ean: string | null;
  name: string;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  unit_id: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  brands?: { name: string } | null;
  categories?: { name: string } | null;
  units?: { abbreviation: string } | null;
}

interface Brand {
  id: string;
  name: string;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  active: boolean;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('products');
  
  // Product dialog
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    internal_code: '',
    ean: '',
    name: '',
    description: '',
    brand_id: '',
    category_id: '',
    unit_id: '',
  });

  // Simple dialogs for brand, category, unit
  const [isSimpleDialogOpen, setIsSimpleDialogOpen] = useState(false);
  const [simpleDialogType, setSimpleDialogType] = useState<'brand' | 'category' | 'unit'>('brand');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [simpleFormData, setSimpleFormData] = useState({ name: '', description: '', abbreviation: '' });

  const { toast } = useToast();
  const { hasRole, user } = useAuth();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchBrands(), fetchCategories(), fetchUnits()]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await (supabase as any)
      .from('products')
      .select('*, brands(name), categories(name), units(abbreviation)')
      .order('name');
    if (error) console.error(error);
    else setProducts(data || []);
  };

  const fetchBrands = async () => {
    const { data, error } = await (supabase as any).from('brands').select('*').order('name');
    if (error) console.error(error);
    else setBrands(data || []);
  };

  const fetchCategories = async () => {
    const { data, error } = await (supabase as any).from('categories').select('*').order('name');
    if (error) console.error(error);
    else setCategories(data || []);
  };

  const fetchUnits = async () => {
    const { data, error } = await (supabase as any).from('units').select('*').order('name');
    if (error) console.error(error);
    else setUnits(data || []);
  };

  const generateInternalCode = async () => {
    // Buscar o maior código existente e incrementar
    const { data } = await (supabase as any)
      .from('products')
      .select('internal_code')
      .like('internal_code', 'P%')
      .order('internal_code', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastCode = data[0].internal_code;
      const numPart = parseInt(lastCode.replace('P', ''), 10) || 1000;
      return `P${(numPart + 1).toString().padStart(6, '0')}`;
    }
    return `P001000`;
  };

  const handleOpenProductDialog = async (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        internal_code: product.internal_code,
        ean: product.ean || '',
        name: product.name,
        description: product.description || '',
        brand_id: product.brand_id || '',
        category_id: product.category_id || '',
        unit_id: product.unit_id || '',
      });
    } else {
      setEditingProduct(null);
      const code = await generateInternalCode();
      setProductForm({
        internal_code: code,
        ean: '',
        name: '',
        description: '',
        brand_id: '',
        category_id: '',
        unit_id: '',
      });
    }
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.internal_code) {
      toast({ title: "Erro", description: "Nome e código interno são obrigatórios", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        internal_code: productForm.internal_code,
        ean: productForm.ean || null,
        name: productForm.name,
        description: productForm.description || null,
        brand_id: productForm.brand_id || null,
        category_id: productForm.category_id || null,
        unit_id: productForm.unit_id || null,
        created_by: user?.id,
      };

      if (editingProduct) {
        // Não permite alterar internal_code após criação
        const { internal_code, ...updatePayload } = payload;
        const { error } = await (supabase as any).from('products').update(updatePayload).eq('id', editingProduct.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Produto atualizado" });
      } else {
        const { error } = await (supabase as any).from('products').insert(payload);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Produto criado" });
      }

      setIsProductDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    const { error } = await (supabase as any).from('products').delete().eq('id', id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Sucesso", description: "Produto excluído" });
      fetchProducts();
    }
  };

  // Simple CRUD for brands, categories, units
  const handleOpenSimpleDialog = (type: 'brand' | 'category' | 'unit', item?: any) => {
    setSimpleDialogType(type);
    setEditingItem(item || null);
    setSimpleFormData({
      name: item?.name || '',
      description: item?.description || '',
      abbreviation: item?.abbreviation || '',
    });
    setIsSimpleDialogOpen(true);
  };

  const handleSaveSimple = async () => {
    if (!simpleFormData.name) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    try {
      const table = simpleDialogType === 'brand' ? 'brands' : simpleDialogType === 'category' ? 'categories' : 'units';
      
      let payload: any = { name: simpleFormData.name, created_by: user?.id };
      if (simpleDialogType === 'category') payload.description = simpleFormData.description || null;
      if (simpleDialogType === 'unit') payload.abbreviation = simpleFormData.abbreviation;

      if (editingItem) {
        const { created_by, ...updatePayload } = payload;
        const { error } = await (supabase as any).from(table).update(updatePayload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
      }

      toast({ title: "Sucesso", description: `${simpleDialogType === 'brand' ? 'Marca' : simpleDialogType === 'category' ? 'Categoria' : 'Unidade'} salva` });
      setIsSimpleDialogOpen(false);
      if (simpleDialogType === 'brand') fetchBrands();
      else if (simpleDialogType === 'category') fetchCategories();
      else fetchUnits();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteSimple = async (type: 'brand' | 'category' | 'unit', id: string) => {
    if (!confirm('Excluir este item?')) return;
    const table = type === 'brand' ? 'brands' : type === 'category' ? 'categories' : 'units';
    const { error } = await (supabase as any).from(table).delete().eq('id', id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Sucesso", description: "Item excluído" });
      if (type === 'brand') fetchBrands();
      else if (type === 'category') fetchCategories();
      else fetchUnits();
    }
  };

  const canEdit = hasRole('admin') || hasRole('operador');
  const canDelete = hasRole('admin');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Cadastro de Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="brands">Marcas</TabsTrigger>
              <TabsTrigger value="categories">Categorias</TabsTrigger>
              <TabsTrigger value="units">Unidades</TabsTrigger>
            </TabsList>

            {/* Products Tab */}
            <TabsContent value="products">
              <div className="flex justify-end mb-4">
                {canEdit && (
                  <Button onClick={() => handleOpenProductDialog()}>
                    <Plus className="h-4 w-4 mr-2" /> Novo Produto
                  </Button>
                )}
              </div>
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>EAN</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>UN</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono">{product.internal_code}</TableCell>
                        <TableCell>{product.ean || '-'}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.brands?.name || '-'}</TableCell>
                        <TableCell>{product.categories?.name || '-'}</TableCell>
                        <TableCell>{product.units?.abbreviation || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {canEdit && (
                              <Button variant="outline" size="sm" onClick={() => handleOpenProductDialog(product)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteProduct(product.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Brands Tab */}
            <TabsContent value="brands">
              <div className="flex justify-end mb-4">
                {canEdit && (
                  <Button onClick={() => handleOpenSimpleDialog('brand')}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Marca
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell className="font-medium">{brand.name}</TableCell>
                      <TableCell>
                        <Badge variant={brand.active ? 'default' : 'secondary'}>
                          {brand.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => handleOpenSimpleDialog('brand', brand)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteSimple('brand', brand.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories">
              <div className="flex justify-end mb-4">
                {canEdit && (
                  <Button onClick={() => handleOpenSimpleDialog('category')}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Categoria
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={category.active ? 'default' : 'secondary'}>
                          {category.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => handleOpenSimpleDialog('category', category)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteSimple('category', category.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Units Tab */}
            <TabsContent value="units">
              <div className="flex justify-end mb-4">
                {canEdit && (
                  <Button onClick={() => handleOpenSimpleDialog('unit')}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Unidade
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Abreviação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell className="font-mono">{unit.abbreviation}</TableCell>
                      <TableCell>
                        <Badge variant={unit.active ? 'default' : 'secondary'}>
                          {unit.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => handleOpenSimpleDialog('unit', unit)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteSimple('unit', unit.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código Interno *</Label>
                <Input
                  value={productForm.internal_code}
                  onChange={(e) => setProductForm({ ...productForm, internal_code: e.target.value })}
                  disabled={!!editingProduct}
                  className={editingProduct ? 'bg-muted' : ''}
                />
                {editingProduct && (
                  <p className="text-xs text-muted-foreground mt-1">Código não pode ser alterado</p>
                )}
              </div>
              <div>
                <Label>EAN</Label>
                <Input
                  value={productForm.ean}
                  onChange={(e) => setProductForm({ ...productForm, ean: e.target.value })}
                  placeholder="Código de barras"
                />
              </div>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Nome do produto"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Descrição do produto"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Marca</Label>
                <Select value={productForm.brand_id} onValueChange={(v) => setProductForm({ ...productForm, brand_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.filter(b => b.active).map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={productForm.category_id} onValueChange={(v) => setProductForm({ ...productForm, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.active).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={productForm.unit_id} onValueChange={(v) => setProductForm({ ...productForm, unit_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.filter(u => u.active).map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveProduct}>{editingProduct ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Simple Dialog for Brand/Category/Unit */}
      <Dialog open={isSimpleDialogOpen} onOpenChange={setIsSimpleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar' : 'Nova'} {simpleDialogType === 'brand' ? 'Marca' : simpleDialogType === 'category' ? 'Categoria' : 'Unidade'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={simpleFormData.name}
                onChange={(e) => setSimpleFormData({ ...simpleFormData, name: e.target.value })}
              />
            </div>
            {simpleDialogType === 'category' && (
              <div>
                <Label>Descrição</Label>
                <Input
                  value={simpleFormData.description}
                  onChange={(e) => setSimpleFormData({ ...simpleFormData, description: e.target.value })}
                />
              </div>
            )}
            {simpleDialogType === 'unit' && (
              <div>
                <Label>Abreviação *</Label>
                <Input
                  value={simpleFormData.abbreviation}
                  onChange={(e) => setSimpleFormData({ ...simpleFormData, abbreviation: e.target.value.toUpperCase() })}
                  maxLength={5}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSimpleDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSimple}>{editingItem ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
