# ZANIMA TATTOO — Plataforma Web Sob Medida

Plataforma web completa desenvolvida sob medida pela **P-CON CONSTRUNET** para o estúdio **ZANIMA TATTOO**, administrado por **Leticia Zanini Macalossi**, especializado em tatuagens **Fine Line, Floral e Minimalista**.

## Ambientes e Módulos

1. **Portal Público (`/`)**: apresentação do estúdio, portfólio exclusivamente autorizado, catálogo de desenhos exclusivos, solicitação de orçamento com referências, agendamento online sem conflitos, cuidados, FAQ e política LGPD.
2. **Área Exclusiva do Cliente (`/minha-conta`)**: acompanhamento de projetos e agenda, aprovação digital de orçamentos, passaporte digital *Minha História na Pele*, planejamento privado *Minha Próxima Tattoo*, acompanhamento pós-tatuagem (com aviso orientativo não-médico), pagamentos, assinatura eletrônica de termos (com autorização de uso de imagem separada) e direitos LGPD.
3. **Painel Administrativo (`/admin`)**: dashboard objetivo com modo privacidade, agenda inteligente com prevenção transacional de conflitos (`SERIALIZABLE`), prontuário de clientes com observações privadas, projetos em 9 etapas, orçamentos com geração real de PDF, **Central Financeira Unificada** (*Visão Geral* | *Estúdio* | *Pessoal* exclusivo da proprietária, transferências sem dupla contagem e exportação PDF/CSV), estoque com custo estimado por sessão, documentos versionados, fidelização, notificações e auditoria.

## Padrões Técnicos e Segurança

- **Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM (`Decimal(12,2)` para valores monetários).
- **Regionalização:** Português brasileiro (`pt-BR`), moeda `BRL` (`R$`) e fuso `America/Sao_Paulo`.
- **Segurança:** Senhas com `scrypt` + salt aleatório, sessões HTTP-only assinadas com HMAC e validadas em banco, RBAC estrito (financeiro pessoal acessível apenas pela `OWNER`), arquivos privados servidos via `/api/files/[id]` com controle de autorização, rate limiting e PWA sem cache offline de dados financeiros, de saúde ou privados.

## Desenvolvimento Local

1. Copie `.env.example` para `.env` e ajuste as variáveis conforme seu ambiente.
2. Inicie um PostgreSQL (ou localmente com `npx pglite-server --db=./.local-pgdata --port=5433 -m 5`).
3. Execute as migrações e o seed operacional inicial (cria conta da proprietária e configurações padrão sem dados fictícios):

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

## Deploy em VPS com Docker + HTTPS

1. Configure `.env` em produção com `DATABASE_URL`, `AUTH_SESSION_SECRET` (64+ caracteres) e credenciais administrativas iniciais.
2. Suba os serviços e execute as migrações:

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npx tsx prisma/seed.ts
```

3. Configure Nginx ou Caddy como proxy reverso com certificado TLS/HTTPS apontando para `127.0.0.1:3000`.
4. Agende backups automáticos via `cron`:

```bash
0 3 * * * cd /opt/zanima-tattoo && ./scripts/backup-db.sh >> /var/log/zanima-backup.log 2>&1
```
