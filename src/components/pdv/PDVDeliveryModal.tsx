import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarIcon, Plus, MapPin, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DeliveryAddress {
  id: string;
  name: string;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_default: boolean;
}

interface PDVDeliveryModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  onConfirm: (addressId: string | null, deliveryDate: Date | null, newAddress?: any) => void;
}

const PDVDeliveryModal = ({ open, onClose, customerId, onConfirm }: PDVDeliveryModalProps) => {
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    contact_name: '',
    contact_phone: ''
  });

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['customer-delivery-addresses', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_delivery_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .eq('active', true)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as DeliveryAddress[];
    },
    enabled: !!customerId && open
  });

  // Set default address when addresses load
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find(a => a.is_default);
      setSelectedAddressId(defaultAddr?.id || addresses[0].id);
    }
  }, [addresses]);

  const handleConfirm = () => {
    if (showNewAddressForm) {
      onConfirm(null, deliveryDate || null, newAddress);
    } else {
      onConfirm(selectedAddressId || null, deliveryDate || null);
    }
    onClose();
  };

  const formatAddress = (addr: DeliveryAddress) => {
    const parts = [
      addr.address_street,
      addr.address_number,
      addr.address_complement,
      addr.address_neighborhood,
      addr.address_city && addr.address_state ? `${addr.address_city}/${addr.address_state}` : null,
      addr.address_zip
    ].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Entrega
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Delivery Date */}
            <div>
              <Label className="text-sm font-medium">Data de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !deliveryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryDate ? format(deliveryDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={setDeliveryDate}
                    locale={ptBR}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Delivery Address */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Endereço de Entrega</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {showNewAddressForm ? 'Usar existente' : 'Novo endereço'}
                </Button>
              </div>

              {!showNewAddressForm ? (
                <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId}>
                  <div className="space-y-2">
                    {isLoading ? (
                      <div className="text-center py-4 text-muted-foreground">Carregando...</div>
                    ) : addresses.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center text-muted-foreground">
                          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhum endereço cadastrado</p>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => setShowNewAddressForm(true)}
                          >
                            Cadastrar endereço
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      addresses.map((addr) => (
                        <Card
                          key={addr.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedAddressId === addr.id && "border-primary bg-primary/5"
                          )}
                          onClick={() => setSelectedAddressId(addr.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                              <div className="flex-1">
                                <div className="font-medium text-sm flex items-center gap-2">
                                  {addr.name}
                                  {addr.is_default && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                      Padrão
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatAddress(addr)}
                                </p>
                                {addr.contact_name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Contato: {addr.contact_name} {addr.contact_phone && `- ${addr.contact_phone}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </RadioGroup>
              ) : (
                <div className="space-y-3 border rounded-lg p-4">
                  <div>
                    <Label className="text-xs">Nome do endereço *</Label>
                    <Input
                      placeholder="Ex: Casa, Trabalho, Filial..."
                      value={newAddress.name}
                      onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Rua</Label>
                      <Input
                        value={newAddress.address_street}
                        onChange={(e) => setNewAddress({ ...newAddress, address_street: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Número</Label>
                      <Input
                        value={newAddress.address_number}
                        onChange={(e) => setNewAddress({ ...newAddress, address_number: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Complemento</Label>
                    <Input
                      value={newAddress.address_complement}
                      onChange={(e) => setNewAddress({ ...newAddress, address_complement: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={newAddress.address_neighborhood}
                        onChange={(e) => setNewAddress({ ...newAddress, address_neighborhood: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CEP</Label>
                      <Input
                        value={newAddress.address_zip}
                        onChange={(e) => setNewAddress({ ...newAddress, address_zip: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={newAddress.address_city}
                        onChange={(e) => setNewAddress({ ...newAddress, address_city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">UF</Label>
                      <Input
                        maxLength={2}
                        value={newAddress.address_state}
                        onChange={(e) => setNewAddress({ ...newAddress, address_state: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nome do contato</Label>
                      <Input
                        value={newAddress.contact_name}
                        onChange={(e) => setNewAddress({ ...newAddress, contact_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        value={newAddress.contact_phone}
                        onChange={(e) => setNewAddress({ ...newAddress, contact_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar e Gerar Pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PDVDeliveryModal;
