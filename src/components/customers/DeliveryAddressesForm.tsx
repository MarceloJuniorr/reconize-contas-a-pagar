import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, MapPin, Edit2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeliveryAddress {
  id?: string;
  customer_id?: string;
  name: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  contact_name: string;
  contact_phone: string;
  is_default: boolean;
  active: boolean;
}

interface DeliveryAddressesFormProps {
  customerId: string | null;
  onAddressesChange?: (addresses: DeliveryAddress[]) => void;
}

const emptyAddress: DeliveryAddress = {
  name: "",
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
  contact_name: "",
  contact_phone: "",
  is_default: false,
  active: true,
};

export function DeliveryAddressesForm({ customerId, onAddressesChange }: DeliveryAddressesFormProps) {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress>(emptyAddress);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      loadAddresses();
    }
  }, [customerId]);

  const loadAddresses = async () => {
    if (!customerId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_delivery_addresses")
      .select("*")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false })
      .order("name");

    if (error) {
      toast.error("Erro ao carregar endereços de entrega");
    } else {
      setAddresses(data || []);
      onAddressesChange?.(data || []);
    }
    setLoading(false);
  };

  const handleAddNew = () => {
    setEditingAddress({ ...emptyAddress });
    setIsAdding(true);
    setEditingIndex(null);
  };

  const handleEdit = (index: number) => {
    setEditingAddress({ ...addresses[index] });
    setEditingIndex(index);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setEditingAddress(emptyAddress);
    setEditingIndex(null);
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!editingAddress.name.trim()) {
      toast.error("Nome do endereço é obrigatório");
      return;
    }

    if (!customerId) {
      toast.error("Salve o cliente primeiro antes de adicionar endereços de entrega");
      return;
    }

    setLoading(true);

    // If setting as default, unset other defaults first
    if (editingAddress.is_default) {
      await supabase
        .from("customer_delivery_addresses")
        .update({ is_default: false })
        .eq("customer_id", customerId);
    }

    if (isAdding) {
      const { error } = await supabase
        .from("customer_delivery_addresses")
        .insert({
          ...editingAddress,
          customer_id: customerId,
        });

      if (error) {
        toast.error("Erro ao adicionar endereço");
      } else {
        toast.success("Endereço adicionado com sucesso");
        loadAddresses();
      }
    } else if (editingIndex !== null && addresses[editingIndex].id) {
      const { error } = await supabase
        .from("customer_delivery_addresses")
        .update({
          name: editingAddress.name,
          address_zip: editingAddress.address_zip,
          address_street: editingAddress.address_street,
          address_number: editingAddress.address_number,
          address_complement: editingAddress.address_complement,
          address_neighborhood: editingAddress.address_neighborhood,
          address_city: editingAddress.address_city,
          address_state: editingAddress.address_state,
          contact_name: editingAddress.contact_name,
          contact_phone: editingAddress.contact_phone,
          is_default: editingAddress.is_default,
          active: editingAddress.active,
        })
        .eq("id", addresses[editingIndex].id);

      if (error) {
        toast.error("Erro ao atualizar endereço");
      } else {
        toast.success("Endereço atualizado com sucesso");
        loadAddresses();
      }
    }

    handleCancel();
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!addressToDelete) return;

    setLoading(true);
    const { error } = await supabase
      .from("customer_delivery_addresses")
      .delete()
      .eq("id", addressToDelete);

    if (error) {
      toast.error("Erro ao excluir endereço");
    } else {
      toast.success("Endereço excluído com sucesso");
      loadAddresses();
    }
    setDeleteDialogOpen(false);
    setAddressToDelete(null);
    setLoading(false);
  };

  const confirmDelete = (id: string) => {
    setAddressToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleChange = (field: keyof DeliveryAddress, value: string | boolean) => {
    setEditingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const renderAddressForm = () => (
    <Card className="border-primary/50">
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="addr_name">Nome do Endereço *</Label>
            <Input
              id="addr_name"
              value={editingAddress.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Ex: Casa, Trabalho, Loja"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingAddress.is_default}
                onCheckedChange={(checked) => handleChange("is_default", checked)}
              />
              <Label>Endereço Padrão</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingAddress.active}
                onCheckedChange={(checked) => handleChange("active", checked)}
              />
              <Label>Ativo</Label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="addr_zip">CEP</Label>
            <Input
              id="addr_zip"
              value={editingAddress.address_zip}
              onChange={(e) => handleChange("address_zip", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="addr_street">Rua</Label>
            <Input
              id="addr_street"
              value={editingAddress.address_street}
              onChange={(e) => handleChange("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="addr_number">Número</Label>
            <Input
              id="addr_number"
              value={editingAddress.address_number}
              onChange={(e) => handleChange("address_number", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="addr_complement">Complemento</Label>
            <Input
              id="addr_complement"
              value={editingAddress.address_complement}
              onChange={(e) => handleChange("address_complement", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="addr_neighborhood">Bairro</Label>
            <Input
              id="addr_neighborhood"
              value={editingAddress.address_neighborhood}
              onChange={(e) => handleChange("address_neighborhood", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="addr_city">Cidade</Label>
            <Input
              id="addr_city"
              value={editingAddress.address_city}
              onChange={(e) => handleChange("address_city", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="addr_state">Estado</Label>
            <Input
              id="addr_state"
              value={editingAddress.address_state}
              onChange={(e) => handleChange("address_state", e.target.value)}
              maxLength={2}
              placeholder="UF"
            />
          </div>
          <div>
            <Label htmlFor="contact_name">Contato (Nome)</Label>
            <Input
              id="contact_name"
              value={editingAddress.contact_name}
              onChange={(e) => handleChange("contact_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="contact_phone">Contato (Telefone)</Label>
            <Input
              id="contact_phone"
              value={editingAddress.contact_phone}
              onChange={(e) => handleChange("contact_phone", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Check className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (!customerId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Endereços de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Salve o cliente primeiro para adicionar endereços de entrega.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          Endereços de Entrega
        </CardTitle>
        {!isAdding && editingIndex === null && (
          <Button onClick={handleAddNew} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(isAdding || editingIndex !== null) && renderAddressForm()}

        {addresses.length === 0 && !isAdding ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhum endereço de entrega cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {addresses.map((addr, index) => (
              editingIndex !== index && (
                <div
                  key={addr.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    addr.is_default ? "border-primary bg-primary/5" : "border-border"
                  } ${!addr.active ? "opacity-50" : ""}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{addr.name}</span>
                      {addr.is_default && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          Padrão
                        </span>
                      )}
                      {!addr.active && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[
                        addr.address_street,
                        addr.address_number,
                        addr.address_neighborhood,
                        addr.address_city,
                        addr.address_state,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Endereço não informado"}
                    </p>
                    {addr.contact_name && (
                      <p className="text-xs text-muted-foreground">
                        Contato: {addr.contact_name} {addr.contact_phone && `- ${addr.contact_phone}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(index)}
                      disabled={isAdding || editingIndex !== null}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirmDelete(addr.id!)}
                      disabled={isAdding || editingIndex !== null}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este endereço de entrega?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
