# QA Next — Landing Page

LP da imersão **QA Next · Qualidade, Automação e Inteligência Artificial** (Impacta × Olhar Digital).

- **Produção:** https://qanext.impacta.com.br
- **Hospedagem:** Coolify (VPS Hetzner, `159.69.240.1`) — container nginx via `Dockerfile`.
- **Checkout:** Engaged — `https://impacta.site.engaged.com.br/p/checkout/tm8cdtdrbf` (turma agosto/2026).
- **IRIS:** produto `qa-next`, turma `qa-next-agosto-2026`.

## Como funciona

`app.js` captura os `utm_*` (+ `gclid`/`fbclid`) da URL, persiste na sessão e **repassa
para todos os links de saída** (`a[data-cta]` — checkout e WhatsApp), preservando a
atribuição do anúncio até o Engaged. WhatsApp e checkout vão direto, sem barreira de captura.

Pixel Meta fica como no-op até `CFG.META_PIXEL_ID` ser preenchido em `app.js`.

## Deploy

Build estático servido por nginx (porta 80, healthcheck `/healthz`). Editar conteúdo →
commit → push → Coolify redeploya automático.
