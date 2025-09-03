import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Check, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface CSVRow {
  nome_fornecedor: string;
  cnpj_cpf?: string;
  descricao: string;
  valor: string;
  vencimento: string;
  tipo_pagamento: string;
  centro_custo: string;
  dados_pagamento?: string; // linha digitável do boleto ou chave pix
}

interface ProcessResult {
  success: number;
  errors: { row: number; error: string }[];
  created_suppliers: string[];
  created_cost_centers: string[];
}

interface CSVImportProps {
  onSuccess: () => void;
}

export const CSVImport = ({ onSuccess }: CSVImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResult(null);
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Selecione um arquivo CSV válido",
        variant: "destructive",
      });
    }
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      return row as CSVRow;
    });
  };

  const findOrCreateSupplier = async (nome: string, documento?: string) => {
    // Procurar fornecedor existente
    let query = supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', nome);

    if (documento) {
      query = query.or(`document.eq.${documento}`);
    }

    const { data: existing } = await query.single();
    
    if (existing) {
      return existing.id;
    }

    // Criar novo fornecedor
    const { data: newSupplier, error } = await supabase
      .from('suppliers')
      .insert([{
        name: nome,
        document: documento || null,
        active: true,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }])
      .select()
      .single();

    if (error) throw error;
    return newSupplier.id;
  };

  const findOrCreateCostCenter = async (nome: string) => {
    // Procurar centro de custo existente
    const { data: existing } = await supabase
      .from('cost_centers')
      .select('id, name, code')
      .ilike('name', nome)
      .single();

    if (existing) {
      return existing.id;
    }

    // Criar novo centro de custo
    const code = nome.substring(0, 3).toUpperCase();
    
    const { data: newCostCenter, error } = await supabase
      .from('cost_centers')
      .insert([{
        name: nome,
        code: code,
        description: nome,
        active: true,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }])
      .select()
      .single();

    if (error) throw error;
    return newCostCenter.id;
  };

  const validatePaymentType = (tipo: string): 'boleto' | 'pix' | 'transferencia' | 'cartao' => {
    const normalized = tipo.toLowerCase().trim();
    const typeMap: { [key: string]: 'boleto' | 'pix' | 'transferencia' | 'cartao' } = {
      'boleto': 'boleto',
      'pix': 'pix',
      'transferencia': 'transferencia',
      'transferência': 'transferencia',
      'cartao': 'cartao',
      'cartão': 'cartao',
    };

    return typeMap[normalized] || 'boleto';
  };

  const parseAmount = (valor: string): number => {
    return parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.'));
  };

  const parseDate = (data: string): string => {
    // Formato esperado: DD/MM/YYYY ou YYYY-MM-DD
    if (data.includes('/')) {
      const [day, month, year] = data.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return data; // Assume que já está no formato correto
  };

  const processCSV = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      const result: ProcessResult = {
        success: 0,
        errors: [],
        created_suppliers: [],
        created_cost_centers: [],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setProgress(((i + 1) / rows.length) * 100);

        try {
          // Validar campos obrigatórios
          if (!row.nome_fornecedor || !row.descricao || !row.valor || !row.vencimento || !row.centro_custo) {
            result.errors.push({
              row: i + 2, // +2 porque começamos do índice 0 e pulamos o cabeçalho
              error: 'Campos obrigatórios não preenchidos'
            });
            continue;
          }

          // Criar/encontrar fornecedor
          const supplierId = await findOrCreateSupplier(row.nome_fornecedor, row.cnpj_cpf);
          if (!result.created_suppliers.includes(row.nome_fornecedor)) {
            result.created_suppliers.push(row.nome_fornecedor);
          }

          // Criar/encontrar centro de custo
          const costCenterId = await findOrCreateCostCenter(row.centro_custo);
          if (!result.created_cost_centers.includes(row.centro_custo)) {
            result.created_cost_centers.push(row.centro_custo);
          }

          // Criar conta a pagar
          const paymentType = validatePaymentType(row.tipo_pagamento);
          const accountData = {
            supplier_id: supplierId,
            cost_center_id: costCenterId,
            payment_type: paymentType,
            description: row.descricao,
            amount: parseAmount(row.valor),
            due_date: parseDate(row.vencimento),
            status: 'em_aberto' as const,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            // Campos específicos do tipo de pagamento
            boleto_barcode: paymentType === 'boleto' ? row.dados_pagamento : null,
            pix_key: paymentType === 'pix' ? row.dados_pagamento : null,
            pix_receiver_name: paymentType === 'pix' && supplierId ? 
              (await supabase.from('suppliers').select('name').eq('id', supplierId).single()).data?.name : null,
          };

          const { error } = await supabase
            .from('accounts_payable')
            .insert(accountData);

          if (error) throw error;
          result.success++;

        } catch (error: any) {
          result.errors.push({
            row: i + 2,
            error: error.message || 'Erro desconhecido'
          });
        }
      }

      setResult(result);
      
      if (result.success > 0) {
        toast({
          title: "Importação concluída",
          description: `${result.success} contas importadas com sucesso`,
        });
        onSuccess();
      }

    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const resetImport = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Contas via CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Formato esperado do CSV:</strong></p>
            <p>Colunas: nome_fornecedor, cnpj_cpf, descricao, valor, vencimento, tipo_pagamento, centro_custo, dados_pagamento</p>
            <p><strong>Tipos de pagamento:</strong> boleto, pix, transferencia, cartao</p>
            <p><strong>Dados de pagamento:</strong> linha digitável (boleto) ou chave PIX</p>
            <p><strong>Formato de data:</strong> DD/MM/YYYY</p>
            <p><strong>Formato de valor:</strong> 1000,50 ou 1.000,50</p>
          </div>

          <div className="border-2 border-dashed border-border rounded-lg p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {file ? file.name : 'Clique para selecionar o arquivo CSV'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Máximo 10MB
                </p>
              </div>
            </label>
          </div>

          {processing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processando...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={processCSV}
              disabled={!file || processing}
              className="flex-1"
            >
              {processing ? 'Processando...' : 'Importar CSV'}
            </Button>
            {(file || result) && (
              <Button variant="outline" onClick={resetImport}>
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.success}</div>
                <p className="text-sm text-muted-foreground">Contas importadas</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {result.created_suppliers.length + result.created_cost_centers.length}
                </div>
                <p className="text-sm text-muted-foreground">Novos cadastros</p>
              </div>
            </div>

            {result.created_suppliers.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Fornecedores criados:</h4>
                <div className="flex flex-wrap gap-1">
                  {result.created_suppliers.map((supplier, index) => (
                    <Badge key={index} variant="secondary">{supplier}</Badge>
                  ))}
                </div>
              </div>
            )}

            {result.created_cost_centers.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Centros de custo criados:</h4>
                <div className="flex flex-wrap gap-1">
                  {result.created_cost_centers.map((center, index) => (
                    <Badge key={index} variant="secondary">{center}</Badge>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Erros encontrados:
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Linha {error.row}: {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};