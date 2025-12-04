# RECONIZE - Sistema de Contas a Pagar

Sistema completo para gerenciamento de contas a pagar, fornecedores e centros de custo, com funcionalidades avançadas de filtros, scanner de boletos e controle de permissões.

## 🚀 Funcionalidades

### Gestão de Contas a Pagar
- ✅ Cadastro completo de contas com múltiplos tipos de pagamento (Boleto, PIX, Transferência, Cartão)
- ✅ **Scanner de código de barras** para leitura automática de boletos via câmera
- ✅ Upload e visualização de anexos (comprovantes, notas fiscais, etc.)
- ✅ Controle de status (Em Aberto, Pago, Cancelado, Vencido)
- ✅ Histórico completo de alterações e pagamentos
- ✅ Importação em massa via CSV
- ✅ Filtros avançados por data, fornecedor, centro de custo, status e tipo de pagamento
- ✅ Totalizadores dinâmicos que se ajustam aos filtros aplicados

### Dashboard Analítico
- 📊 Visão geral de contas em aberto, vencidas e pagas
- 📊 Cards interativos com filtros rápidos
- 📊 Estatísticas por tipo de pagamento
- 📊 Análise de contas a vencer (hoje, amanhã, próximos 7 dias)

### Gestão de Fornecedores
- 👥 Cadastro completo de fornecedores
- 👥 Histórico de contas por fornecedor com filtros avançados
- 👥 Status ativo/inativo

### Centros de Custo
- 🏢 Organização por centros de custo
- 🏢 Vinculação de contas a centros específicos
- 🏢 Relatórios por centro de custo

### Controle de Acesso
- 🔐 Sistema de autenticação seguro (Supabase Auth)
- 🔐 Múltiplos níveis de permissão:
  - **Admin**: Acesso total ao sistema
  - **Pagador**: Visualizar e marcar contas como pagas
  - **Visualizador**: Apenas visualização
- 🔐 Troca de senha
- 🔐 Gestão de usuários (apenas admin)

### Interface Responsiva
- 📱 Layout mobile otimizado com cards
- 📱 Menu hambúrguer em todas as resoluções
- 📱 Filtros específicos para dispositivos móveis
- 💻 Tabela completa com ordenação e filtros no desktop
- 💻 Colunas com largura otimizada

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset tipado do JavaScript
- **Vite** - Build tool e dev server ultrarrápido
- **TailwindCSS** - Framework CSS utilitário
- **shadcn/ui** - Componentes de UI modernos e acessíveis
- **React Router** - Roteamento de páginas

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL Database
  - Authentication
  - Storage (para anexos)
  - Row Level Security (RLS)

### Bibliotecas Principais
- **@zxing/browser** - Scanner de código de barras/QR code
- **date-fns** - Manipulação de datas
- **lucide-react** - Ícones modernos
- **react-hot-toast** - Notificações elegantes

## 📋 Pré-requisitos

- Node.js 18+ e npm/yarn/pnpm
- Conta no [Supabase](https://supabase.com)

## 🔧 Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/MarceloJuniorr/reconize-contas-a-pagar.git
cd reconize-contas-a-pagar
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

4. **Configure o banco de dados**

Execute as migrations do Supabase localizadas em `/supabase/migrations/` na ordem cronológica.

5. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:8080`

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

- **profiles** - Perfis de usuários com roles
- **suppliers** - Fornecedores
- **cost_centers** - Centros de custo
- **accounts_payable** - Contas a pagar
- **payments** - Histórico de pagamentos
- **account_history** - Histórico de alterações
- **account_attachments** - Anexos das contas

## 📱 Funcionalidades Mobile

### Scanner de Boletos
- Acesso à câmera do dispositivo
- Seleção de câmera (frontal/traseira)
- ROI (Região de Interesse) para melhor detecção
- Suporte a múltiplos formatos de código de barras (ITF, Code 128, Code 39)
- Validação automática de boletos (44/47/48 dígitos)

### Cards Mobile
- Interface otimizada em cards para melhor experiência em telas pequenas
- Filtros específicos para mobile (data, fornecedor, tipo de pagamento, status)
- Ordenação (mais recente, mais antigo, valor)
- Totalizadores responsivos

## 🔒 Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Autenticação via Supabase Auth
- Controle de permissões por role
- HTTPS obrigatório para funcionalidades de câmera

## 📦 Build para Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `dist/`

## 🚀 Deploy

### Opção 1: Lovable (Recomendado)
1. Acesse [Lovable](https://lovable.dev/projects/3227b312-5131-4cbf-84a3-a48c046442e6)
2. Clique em Share → Publish

### Opção 2: Vercel/Netlify
1. Conecte o repositório GitHub
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

### Opção 3: Manual
1. Execute `npm run build`
2. Faça upload da pasta `dist/` para seu servidor
3. Configure um servidor web (nginx, apache, etc.)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

**Marcelo Junior**
- GitHub: [@MarceloJuniorr](https://github.com/MarceloJuniorr)

## 🐛 Reportar Bugs

Encontrou um bug? Abra uma [issue](https://github.com/MarceloJuniorr/reconize-contas-a-pagar/issues) descrevendo:
- O que aconteceu
- O que você esperava que acontecesse
- Passos para reproduzir
- Screenshots (se aplicável)

## 📞 Suporte

Para dúvidas e suporte, abra uma [discussão](https://github.com/MarceloJuniorr/reconize-contas-a-pagar/discussions) ou entre em contato.
marcelojunior.07@live.com
---

**RECONIZE** - Gestão inteligente de contas a pagar 💰
