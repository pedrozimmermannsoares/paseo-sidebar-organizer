# AGENTS.md — paseo-sidebar-organizer

Plugin do Paseo (TypeScript) que rotula e fixa workspaces na barra lateral. Repo público, licença MIT. Comportamento e configuração: `README.md` e `OVERVIEW.md`.

## Layout

- `index.server.ts`: entrada do servidor, ouve os eventos de ciclo de vida do agente.
- `server/`, `client/`, `shared/`, `index.client.tsx`: código do plugin e da tela de configurações.
- `paseo-plugin.json`: manifesto.

## Rodar

```bash
npm install
npm run typecheck
paseo plugin install "$PWD"
paseo plugin logs paseo-sidebar-organizer
```

Instalação por usuário: `paseo plugin add git:pedrozimmermannsoares/paseo-sidebar-organizer`.

## Travas

- Repo público: nada pessoal, nenhum caminho de máquina, nenhum nome de terceiro, nenhum segredo em código, docs ou commits.
- O plugin usa `@getpaseo/client/internal/daemon-client` (módulo interno) e a credencial local do daemon em `$PASEO_HOME/local-credential`. Não envia nada para fora do daemon. Uma versão nova do Paseo pode quebrar isso.
- Requer Paseo 0.11.2 ou mais novo.
- `README.md` e `OVERVIEW.md` descrevem o mesmo comportamento: mudou um, confira o outro.
