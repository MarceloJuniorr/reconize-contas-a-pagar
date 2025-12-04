import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DeliveryAddressesForm } from "./DeliveryAddressesForm";

interface Customer {
  id: string;
  name: string;
  document: string | null;
  document_type: string | null;
  email: string | null;
  phone: string | null;
  phone_secondary: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  responsible_user_id: string | null;
  observations: string | null;
  credit_limit: number | null;
  active: boolean | null;
}

interface CustomerFormProps {
  customer: Customer | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function CustomerForm({ customer, onSuccess, onCancel }: CustomerFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    document: "",
    document_type: "cpf",
    email: "",
    phone: "",
    phone_secondary: "",
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    responsible_user_id: "",
    observations: "",
    credit_limit: "0",
    active: true,
  });

  // Fetch users for responsible selection
  const { data: users = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        document: customer.document || "",
        document_type: customer.document_type || "cpf",
        email: customer.email || "",
        phone: customer.phone || "",
        phone_secondary: customer.phone_secondary || "",
        address_street: customer.address_street || "",
        address_number: customer.address_number || "",
        address_complement: customer.address_complement || "",
        address_neighborhood: customer.address_neighborhood || "",
        address_city: customer.address_city || "",
        address_state: customer.address_state || "",
        address_zip: customer.address_zip || "",
        responsible_user_id: customer.responsible_user_id || "",
        observations: customer.observations || "",
        credit_limit: String(customer.credit_limit || 0),
        active: customer.active ?? true,
      });
    }
  }, [customer]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.slice(0, 11);
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.slice(0, 14);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.slice(0, 11);
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.slice(0, 8);
  };

  const handleDocumentChange = (value: string) => {
    const formatted = formData.document_type === "cnpj" 
      ? formatCNPJ(value) 
      : formatCPF(value);
    handleChange("document", formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsLoading(true);

    try {
      const dataToSave = {
        name: formData.name.trim(),
        document: formData.document || null,
        document_type: formData.document_type,
        email: formData.email || null,
        phone: formData.phone || null,
        phone_secondary: formData.phone_secondary || null,
        address_street: formData.address_street || null,
        address_number: formData.address_number || null,
        address_complement: formData.address_complement || null,
        address_neighborhood: formData.address_neighborhood || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        responsible_user_id: formData.responsible_user_id || null,
        observations: formData.observations || null,
        credit_limit: parseFloat(formData.credit_limit) || 0,
        active: formData.active,
      };

      if (customer) {
        const { error } = await supabase
          .from("customers")
          .update(dataToSave)
          .eq("id", customer.id);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({ ...dataToSave, created_by: user?.id });

        if (error) throw error;
        toast.success("Cliente criado com sucesso");
      }

      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar cliente: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Nome completo ou razão social"
          />
        </div>

        <div>
          <Label htmlFor="document_type">Tipo de Documento</Label>
          <Select
            value={formData.document_type}
            onValueChange={(value) => {
              handleChange("document_type", value);
              handleChange("document", "");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="document">
            {formData.document_type === "cnpj" ? "CNPJ" : "CPF"}
          </Label>
          <Input
            id="document"
            value={formData.document}
            onChange={(e) => handleDocumentChange(e.target.value)}
            placeholder={formData.document_type === "cnpj" ? "00000000000000" : "00000000000"}
          />
        </div>

        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>

        <div>
          <Label htmlFor="phone">Telefone Principal</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
            placeholder="11999999999"
          />
        </div>

        <div>
          <Label htmlFor="phone_secondary">Telefone Secundário</Label>
          <Input
            id="phone_secondary"
            value={formData.phone_secondary}
            onChange={(e) => handleChange("phone_secondary", formatPhone(e.target.value))}
            placeholder="11999999999"
          />
        </div>

        <div>
          <Label htmlFor="responsible_user_id">Usuário Responsável</Label>
          <Select
            value={formData.responsible_user_id || "none"}
            onValueChange={(value) => handleChange("responsible_user_id", value === "none" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Address */}
      <div className="border-t pt-4">
        <h3 className="font-medium mb-4">Endereço Principal</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="address_zip">CEP</Label>
            <Input
              id="address_zip"
              value={formData.address_zip}
              onChange={(e) => handleChange("address_zip", formatCEP(e.target.value))}
              placeholder="00000000"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="address_street">Logradouro</Label>
            <Input
              id="address_street"
              value={formData.address_street}
              onChange={(e) => handleChange("address_street", e.target.value)}
              placeholder="Rua, Avenida, etc."
            />
          </div>

          <div>
            <Label htmlFor="address_number">Número</Label>
            <Input
              id="address_number"
              value={formData.address_number}
              onChange={(e) => handleChange("address_number", e.target.value)}
              placeholder="123"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="address_complement">Complemento</Label>
            <Input
              id="address_complement"
              value={formData.address_complement}
              onChange={(e) => handleChange("address_complement", e.target.value)}
              placeholder="Apto, Sala, etc."
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="address_neighborhood">Bairro</Label>
            <Input
              id="address_neighborhood"
              value={formData.address_neighborhood}
              onChange={(e) => handleChange("address_neighborhood", e.target.value)}
              placeholder="Bairro"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="address_city">Cidade</Label>
            <Input
              id="address_city"
              value={formData.address_city}
              onChange={(e) => handleChange("address_city", e.target.value)}
              placeholder="Cidade"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="address_state">Estado</Label>
            <Select
              value={formData.address_state}
              onValueChange={(value) => handleChange("address_state", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_BR.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Delivery Addresses */}
      <DeliveryAddressesForm customerId={customer?.id || null} />

      {/* Additional Info */}
      <div className="border-t pt-4">
        <h3 className="font-medium mb-4">Informações Adicionais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="credit_limit">Limite de Crédito (R$)</Label>
            <Input
              id="credit_limit"
              type="number"
              step="0.01"
              min="0"
              value={formData.credit_limit}
              onChange={(e) => handleChange("credit_limit", e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => handleChange("active", checked)}
            />
            <Label htmlFor="active">Cliente Ativo</Label>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={formData.observations}
              onChange={(e) => handleChange("observations", e.target.value)}
              placeholder="Observações sobre o cliente..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {customer ? "Salvar" : "Criar Cliente"}
        </Button>
      </div>
    </form>
  );
}
