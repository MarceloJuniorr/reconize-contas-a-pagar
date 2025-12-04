import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Percent, DollarSign } from 'lucide-react';

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  internal_code: string;
  ean: string | null;
  quantity: number;
  unit_price: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number;
  discount_amount: number;
  total: number;
}

interface PDVItemActionsProps {
  item: CartItem | null;
  onClose: () => void;
  onRemove: (itemId: string) => void;
  onApplyDiscount: (itemId: string, type: 'percentage' | 'fixed', value: number) => void;
}

const PDVItemActions = ({ item, onClose, onRemove, onApplyDiscount }: PDVItemActionsProps) => {
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [showDiscountForm, setShowDiscountForm] = useState(false);

  useEffect(() => {
    if (item) {
      setDiscountType(item.discount_type || 'percentage');
      setDiscountValue(item.discount_value);
      setShowDiscountForm(false);
    }
  }, [item]);

  if (!item) return null;

  const baseTotal = item.quantity * item.unit_price;
  const previewDiscount = discountType === 'percentage' 
    ? baseTotal * discountValue / 100 
    : discountValue;
  const previewTotal = baseTotal - previewDiscount;

  const handleApplyDiscount = () => {
    onApplyDiscount(item.id, discountType, discountValue);
  };

  const handleRemoveDiscount = () => {
    onApplyDiscount(item.id, 'fixed', 0);
  };

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Código: {item.internal_code}</p>
            <p>Quantidade: {item.quantity}</p>
            <p>Preço unitário: R$ {item.unit_price.toFixed(2)}</p>
            <p className="font-medium text-foreground">Total: R$ {item.total.toFixed(2)}</p>
          </div>

          {!showDiscountForm ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDiscountForm(true)}
              >
                <Percent className="h-4 w-4 mr-2" />
                {item.discount_value > 0 ? 'Editar Desconto' : 'Aplicar Desconto'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onRemove(item.id);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            </div>
          ) : (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex gap-2">
                <Button
                  variant={discountType === 'percentage' ? 'default' : 'outline'}
                  onClick={() => setDiscountType('percentage')}
                  className="flex-1"
                  size="sm"
                >
                  <Percent className="h-4 w-4 mr-2" />
                  Percentual
                </Button>
                <Button
                  variant={discountType === 'fixed' ? 'default' : 'outline'}
                  onClick={() => setDiscountType('fixed')}
                  className="flex-1"
                  size="sm"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Valor Fixo
                </Button>
              </div>
              <div>
                <Label className="text-xs">
                  {discountType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
                </Label>
                <Input
                  type="number"
                  step={discountType === 'percentage' ? '1' : '0.01'}
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              {discountValue > 0 && (
                <div className="text-sm">
                  <p className="text-muted-foreground">
                    Desconto: R$ {previewDiscount.toFixed(2)}
                  </p>
                  <p className="font-medium">
                    Novo total: R$ {previewTotal.toFixed(2)}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                {item.discount_value > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleRemoveDiscount}
                    size="sm"
                  >
                    Remover Desconto
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowDiscountForm(false)}
                  size="sm"
                >
                  Cancelar
                </Button>
                <Button onClick={handleApplyDiscount} size="sm">
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PDVItemActions;
