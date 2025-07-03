# MCP Calendar Server - OpenAI Compatible

Este servidor implementa o Model Context Protocol (MCP) para gerenciamento de calendário, compatível com as especificações da OpenAI Tools Remote MCP.

## Recursos

- ✅ **Criar eventos** - Adicionar novos eventos ao calendário
- ✅ **Listar eventos** - Visualizar eventos com filtros de data
- ✅ **Obter evento** - Detalhes de um evento específico
- ✅ **Atualizar evento** - Modificar eventos existentes
- ✅ **Deletar evento** - Remover eventos do calendário
- ✅ **Pesquisar eventos** - Buscar eventos por título ou descrição

## Instalação Local

### 1. Instalar dependências
```bash
npm install
```

### 2. Executar o servidor
```bash
npm start
```

### 3. Modo desenvolvimento
```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

## Deploy no Railway

### 1. Conectar ao Railway
1. Acesse [Railway](https://railway.app)
2. Crie uma nova conta ou faça login
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Conecte seu repositório

### 2. Configurar variáveis de ambiente
No Railway, vá para a aba "Variables" e adicione:
- `PORT`: será definido automaticamente pelo Railway
- Outras variáveis conforme necessário

### 3. Deploy automático
O Railway fará o deploy automaticamente usando o `package.json` e `railway.json`

## Uso com OpenAI

### 1. Configurar no OpenAI
Use a URL do seu deploy Railway como endpoint MCP:
```
https://seu-app.railway.app/mcp
```

### 2. Exemplo de configuração
```json
{
  "mcp_servers": {
    "calendar": {
      "url": "https://seu-app.railway.app/mcp",
      "transport": "http"
    }
  }
}
```

## Endpoints

### MCP Principal
- `POST /mcp` - Endpoint principal do MCP (JSON-RPC 2.0)

### Informações
- `GET /` - Informações básicas do servidor
- `GET /health` - Health check
- `GET /info` - Informações detalhadas + lista de tools

## Ferramentas Disponíveis

### 1. create_event
Cria um novo evento no calendário.

**Parâmetros:**
- `title` (obrigatório): Título do evento
- `start_time` (obrigatório): Data/hora de início (ISO 8601)
- `end_time` (obrigatório): Data/hora de fim (ISO 8601)
- `description` (opcional): Descrição do evento
- `location` (opcional): Local do evento
- `attendees` (opcional): Lista de emails dos participantes

### 2. list_events
Lista eventos com filtros opcionais.

**Parâmetros:**
- `start_date` (opcional): Data de início do filtro (YYYY-MM-DD)
- `end_date` (opcional): Data de fim do filtro (YYYY-MM-DD)
- `limit` (opcional): Número máximo de eventos (padrão: 10)

### 3. get_event
Obtém detalhes de um evento específico.

**Parâmetros:**
- `event_id` (obrigatório): ID do evento

### 4. update_event
Atualiza um evento existente.

**Parâmetros:**
- `event_id` (obrigatório): ID do evento
- Outros campos opcionais para atualização

### 5. delete_event
Remove um evento do calendário.

**Parâmetros:**
- `event_id` (obrigatório): ID do evento

### 6. search_events
Pesquisa eventos por título ou descrição.

**Parâmetros:**
- `query` (obrigatório): Termo de pesquisa
- `limit` (opcional): Número máximo de resultados (padrão: 10)

## Exemplo de Uso

### Criar um evento
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_event",
    "arguments": {
      "title": "Reunião de Equipe",
      "description": "Reunião semanal da equipe de desenvolvimento",
      "start_time": "2024-01-15T10:00:00Z",
      "end_time": "2024-01-15T11:00:00Z",
      "location": "Sala de Conferências",
      "attendees": ["joao@empresa.com", "maria@empresa.com"]
    }
  },
  "id": 1
}
```

### Listar eventos
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_events",
    "arguments": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "limit": 5
    }
  },
  "id": 2
}
```

## Estrutura do Projeto

```
mcp-calendar-server/
├── server.js          # Servidor principal
├── package.json       # Dependências
├── railway.json       # Configuração Railway
├── README.md          # Este arquivo
└── .gitignore         # Arquivos ignorados pelo Git
```

## Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **JSON-RPC 2.0** - Protocolo de comunicação
- **UUID** - Geração de IDs únicos
- **CORS** - Controle de acesso cross-origin

## Considerações de Produção

### Armazenamento
- Atualmente usa armazenamento em memória
- Para produção, integre com um banco de dados (MongoDB, PostgreSQL, etc.)

### Autenticação
- Adicione autenticação adequada para produção
- Considere usar JWT ou OAuth2

### Validação
- Validação de dados de entrada mais robusta
- Sanitização de dados

### Logging
- Implementar logging adequado
- Monitoramento de erros

### Rate Limiting
- Implementar rate limiting para evitar abuso
- Considere usar Redis para controle distribuído

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do Railway
2. Teste os endpoints usando o health check
3. Valide a configuração MCP no OpenAI

## Licença

MIT License - veja o arquivo LICENSE para detalhes.
