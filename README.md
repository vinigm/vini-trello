# Vinello

Um quadro Kanban pessoal, responsivo e colorido para organizar ideias, prioridades e projetos no computador e no celular.

## O que já funciona

- cartões editáveis com etiqueta, prioridade, prazo, descrição e checklist;
- desktops independentes para separar projetos como Pessoal, Itália, Panvel e Mestrado;
- arrastar e soltar o cartão inteiro entre colunas;
- criação, edição e exclusão de cartões e colunas;
- busca e filtro por prioridade;
- quatro temas visuais e cores personalizáveis;
- autenticação com Google e persistência online com Firebase;
- layout adaptado para desktop e celular.

O site é publicado automaticamente no GitHub Pages a cada atualização da branch `main`.

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

As regras do banco ficam em `firestore.rules` e garantem que cada pessoa acesse apenas o próprio quadro.
