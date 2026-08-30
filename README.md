# Documento de Entrega - Nova Acrópole PDV

## 1. Visão geral

Este projeto é uma aplicação web para gestão de estoque, controle de vendas e operação de PDV de uma livraria / loja integrada à base de dados em Firebase.

O sistema foi desenvolvido em React + TypeScript + Vite, com arquitetura focada em operação interna, cadastro de produtos, controle de cupons, gestão de usuários, relatórios e finalização de vendas no ponto de venda.

Repositório público:
- https://github.com/victordesouza/novaacropolepdv

## 2. Objetivo do sistema

O sistema permite:
- controlar cadastro de produtos e estoque;
- registrar vendas em PDV;
- aplicar cupons e descontos;
- validar usuários por perfil;
- acompanhar indicadores e relatórios;
- manter histórico de ações do sistema;
- disponibilizar um catálogo público para consulta.

## 3. Estrutura do projeto

```text
novaacropolepdv/
├── src/
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   ├── integrations/
│   ├── lib/
│   ├── pages/
│   └── test/
├── public/
├── supabase/
├── package.json
├── vite.config.ts
├── firebase.json
├── firestore.rules
├── components.json
├── README.md
├── FIREBASE_SETUP.md
└── ...
```

## 4. Áreas do sistema

### 4.1 Login
- Rota: `/login`
- Responsável pela autenticação dos usuários.
- Usuários têm perfis diferentes e acesso controlado por regra de autorização.
- A autenticação usa dados de usuário salvos em Firebase e sessão local no navegador.

### 4.2 Dashboard
- Rota principal protegida: `/`
- Apresenta visão geral do negócio.
- Pode mostrar indicadores de vendas, movimentação e alertas de estoque.
- Visa dar contexto rápido para administração.

### 4.3 Produtos
- Rota: `/products`
- Área de cadastro e manutenção de itens.
- Permite:
  - adicionar produto;
  - editar dados;
  - definir preço;
  - controlar estoque atual;
  - definir estoque mínimo;
  - incluir categoria, tags e imagem.
- Também há suporte para alertas de estoque baixo.

### 4.4 PDV (Ponto de Venda)
- Rota: `/pos`
- Local de fechamento de vendas.
- Funcionalidades principais:
  - busca de produtos;
  - leitura de código de barras;
  - adição ao carrinho;
  - cupom por item;
  - desconto total;
  - seleção de vendedor;
  - forma de pagamento;
  - finalização da venda;
  - atualização automática de estoque.

### 4.5 Relatórios
- Rota: `/reports`
- Centraliza dados de estoque, financeiro e logs.
- Permite exportação em planilha Excel (.xlsx).
- Útil para auditoria e acompanhamento operacional.

### 4.6 Usuários
- Rota: `/users`
- Cadastro e gerenciamento de usuários do sistema.
- Controle de perfil: Administrador, Recepção, etc.
- Importante para separar permissões e garantir acesso adequado por cargo.

### 4.7 Cupons
- Rota: `/coupons`
- Gestão de campanhas e descontos.
- Permite determinar tipo de desconto, valor, vigência e status.

### 4.8 Catálogo público
- Rota: `/catalogo`
- Vista externa para consulta de produtos.
- Pode ser usada para apresentar itens publicamente sem expor painel administrativo.

### 4.9 Logs e auditoria
- O sistema registra ações importantes em log.
- Isso ajuda a rastrear:
  - usuários que acessaram;
  - alterações em produtos;
  - vendas concluídas;
  - ações relevantes do sistema.

## 5. Tecnologias usadas

### Frontend
- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui
- React Query

### Backend / dados
- Firebase Firestore
- Firebase Storage
- Firebase SDK

### Outras integrações / utilidades
- Supabase (presente no projeto, com configuração inicial)
- XLSX para exportação de relatórios
- Sonner para notificações
- Lucide React para ícones

### Ambiente de desenvolvimento
- Node.js
- npm / yarn
- Vite dev server

## 6. Configuração do ambiente

No arquivo de ambiente do projeto, devem existir variáveis de configuração do Firebase e outros serviços, conforme os arquivos carregados no projeto.

Exemplo de variáveis esperadas:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Observação:
- essas variáveis devem ser configuradas no ambiente do projeto antes do build;
- o código usa `import.meta.env` para carregar estes valores;
- sem as variáveis corretas, o sistema não conecta ao Firebase/Supabase.

## 7. Como rodar localmente

### Instalar dependências

```bash
npm install
# ou
yarn
```

### Iniciar em desenvolvimento

```bash
npm run dev
# ou
yarn dev
```

### Build de produção

```bash
npm run build
# ou
yarn build
```

### Rodar testes

```bash
npm run test
# ou
yarn test
```

## 8. Fluxo de desenvolvimento e versionamento com Git

### 8.1 Clonar o repositório

```bash
git clone https://github.com/victordesouza/novaacropolepdv.git
cd novaacropolepdv
```

### 8.2 Criar branch para desenvolvimento

```bash
git checkout -b feature/nova-funcionalidade
```

### 8.3 Fazer commits

```bash
git add .
git commit -m "feat: adiciona nova funcionalidade"
```

### 8.4 Enviar para o GitHub

```bash
git push origin feature/nova-funcionalidade
```

### 8.5 Mesclar alterações na branch principal

```bash
git checkout main
git pull origin main
git merge feature/nova-funcionalidade
git push origin main
```

### 8.6 Boas práticas
- sempre trabalhar em branch separada;
- manter commits pequenos e objetivos;
- testar antes de subir mudanças;
- evitar commitar arquivos locais sensíveis como `.env` sem necessidade;
- revisar a funcionalidade antes do merge final.

## 9. Atualização via FTP no site

A atualização via FTP é utilizada quando o site é hospedado em servidor web tradicional e os arquivos gerados do build precisam ser enviados manualmente.

### 9.1 Gerar build de produção

```bash
npm run build
```

Esse comando gera a pasta de saída do projeto, normalmente dentro de `dist/`.

### 9.2 Verificar o conteúdo gerado

Confirme que a pasta `dist/` contém:
- `index.html`
- arquivos CSS e JS
- assets e imagens
- arquivos públicos necessários

### 9.3 Conectar ao FTP do cliente

Usar um cliente FTP/FTPS como:
- FileZilla
- Cyberduck
- WinSCP

Configurar no cliente com:
- host do servidor;
- usuário FTP;
- senha;
- porta (normalmente 21 ou 22/FTPs conforme o servidor).

### 9.4 Enviar os arquivos

No servidor, normalmente a pasta pública do site deve receber os arquivos do build, por exemplo:
- `/public_html/`
- `/www/`
- `/site/`

Recomendação:
- enviar os arquivos do build para a pasta correta do site;
- remover versões antigas que não forem mais necessárias;
- verificar se o servidor está apontando para a pasta certa do projeto.

### 9.5 Observações importantes
- o deploy por FTP não substitui o versionamento em Git;
- o Git é usado para controlar código e histórico;
- o FTP é usado para publicar a versão final no servidor;
- sempre validar no navegador após upload.

### 9.6 Checklist pós-publicação
- abrir a URL do site;
- validar login;
- testar cadastro de produtos;
- testar venda no PDV;
- validar estoque e relatórios;
- confirmar que imagens e arquivos estáticos carregam corretamente;
- verificar se a API do Firebase está acessível.

## 10. Deploy e publicação em produção

A aplicação é front-end e depende do Firebase para dados e arquivos. Isso significa que a produção exige:
- ambiente com variáveis configuradas;
- Firebase com projeto ativo;
- regras de Firestore/Storage corretamente aplicadas;
- domínio ou hosting apontando para o build final.

Se a publicação for em hosting estático, normalmente basta enviar os arquivos da pasta `dist` para o servidor do cliente ou para a plataforma escolhida.

## 11. Segurança e boas práticas

- nunca commitar arquivos `.env` com segredos reais;
- manter regras e permissões do Firebase revisadas;
- validar acesso por perfil antes liberar operações críticas;
- restringir acesso de administração ao mínimo necessário;
- manter backups periódicos do banco e da estrutura de dados;
- usar autenticação e controle de permissões de forma explícita.

## 12. Responsabilidades do projeto

### Administração
- configura usuários e perfis;
- valida regras de negócio;
- acompanha relatórios e estoque;
- define descontos e campanhas.

### Operação
- cadastro e manutenção de produtos;
- atendimento no PDV;
- controle de estoque em vendas;
- atualização de dados diários.

## 13. Pontos de atenção

- o projeto depende de configuração correta do Firebase;
- qualquer mudança na estrutura de dados precisa ser testada antes do deploy;
- a lógica de estoque mínimo e estoque zerado precisa seguir a regra de negócio definida pela operação;
- atualizações do front-end devem ser verificadas em navegador antes da publicação final;
- a publicação em FTP deve ser feita sempre com build limpo e validado.

## 14. Checklist de entrega

Antes de entregar ao cliente, confirmar:
- [ ] repositório no GitHub atualizado;
- [ ] README final documentado;
- [ ] variáveis de ambiente configuradas;
- [ ] Firebase conectado e funcionando;
- [ ] login funcionando;
- [ ] cadastro de produtos funcionando;
- [ ] PDV finalizando vendas corretamente;
- [ ] estoque atualizando corretamente;
- [ ] relatórios exportando sem erro;
- [ ] build de produção gerado;
- [ ] arquivos enviados ao servidor via FTP;
- [ ] site validado em produção;
- [ ] usuário administrativo com acesso correto.

## 15. Informações finais

Este documento serve como base de entrega e manutenção do sistema.

Ele deve ser mantido atualizado sempre que:
- novas funcionalidades forem adicionadas;
- novos ambientes forem criados;
- a estrutura de dados mudar;
- o processo de deploy mudar.

Para mais detalhes técnicos do projeto, consulte também:
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- [package.json](./package.json)
- [src/App.tsx](./src/App.tsx)

## 16. Resumo executivo

O sistema é um painel administrativo e de PDV para livraria/loja, com foco em controle operacional, vendas, estoque e relatórios. Ele combina a rapidez do frontend em React com a robustez do banco e armazenamento em Firebase, oferecendo uma base sólida para gestão diária e entrega em produção.
