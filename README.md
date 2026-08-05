# Vinello

Um quadro Kanban pessoal, responsivo e colorido para organizar ideias, prioridades e projetos no computador e no celular.

## O que já funciona

- cartões editáveis com etiqueta, prioridade, prazo, descrição e checklist;
- arrastar e soltar cartões entre colunas;
- criação, edição e exclusão de cartões e colunas;
- busca e filtro por prioridade;
- quatro temas visuais e cores personalizáveis;
- persistência online com Cloudflare D1;
- layout adaptado para desktop e celular.

## Desenvolvimento local

Requer Node.js 22.13 ou mais recente.

```bash
pnpm install
pnpm dev
```

Para validar a versão de produção:

```bash
pnpm build
pnpm test
```

As migrations do banco ficam em `drizzle/` e são geradas com `pnpm db:generate`.
