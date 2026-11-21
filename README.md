# Nyx Optmizer

Otimizador premium para Windows. Interface preta e branca, tweaks reais e reversiveis,
limpeza de caches e diagnostico de latencia. Construido em Electron, sem frameworks de UI
e sem build step.

## O que inclui

**Smart scan** — score do sistema, CPU, RAM, disco, tweaks recomendados e um fluxo de
otimizacao com passos, progresso e resumo do que foi feito.

**Performance** — 53 tweaks de desempenho, gaming, privacidade e sistema (50 base + 3 experimentais). Cada um le o
estado real do Windows e pode ser revertido. Inclui plano Ultimate Performance, Game Mode,
sem aceleracao do rato, prioridade multimedia, widgets desligados e desativacao de telemetria.

**Network** — teste de latencia real com `ping` do Windows, cache DNS e ajustes de rede
e gaming.

**Cleanup** — 14 categorias de temporarios, caches e ficheiros orfaos. Mede o espaco antes
de apagar e pede confirmacao. Ficheiros em uso sao ignorados.

**Atualizacoes** — verifica o GitHub Releases ao arrancar e a cada 50 minutos, descarrega a versao
nova em segundo plano e instala ao fechar. O canal fica em `src/main/update-channel.json` e
é configurado pelo `tools/release.js`.

**Licenca** — 7 dias de avaliacao, ativacao offline por chave. As chaves antigas continuam
a funcionar. As chaves `STAFF` sao permanentes e incluem as funcoes experimentais. O estado
fica em `%APPDATA%\nyx-optmizer\license.json`.

## Instalar no Windows

O instalador oficial e **`dist/NyxOptmizerSetup.exe`**. Duplo clique, escolhe o idioma
(Portugues ou Ingles), a pasta e instala. Cria atalhos no ambiente de trabalho e no menu
Iniciar. Nao precisas de Node.js, terminal ou ficheiros `.bat`.

## Desenvolvimento

```bash
npm install
npm start          # abre a app
npm run preview    # pre-visualiza a UI no navegador (modo simulado)
npm run dist       # gera dist/NyxOptmizerSetup.exe (NSIS x64)
```

## Atualizacoes automaticas

O auto-updater usa **GitHub Releases**. O repositorio tem de ser publico. Para ligar:

1. Cria um repositorio publico chamado `nyx-optmizer` na tua conta GitHub.
2. Cria um token com permissao **Contents: Read and write**.
3. Corre:

```bash
GH_TOKEN=o_teu_token npm run release -- --owner O_TEU_UTILIZADOR --repo nyx-optmizer
```

Sem token, o comando gera apenas os ficheiros em `dist/` para anexares manualmente ao
release (instalador, `.blockmap` e `latest.yml`). Depois do primeiro release, os amigos
recebem as versoes seguintes sem precisares de enviar o instalador outra vez.

Guia completo: [RELEASES.md](RELEASES.md).

Os tweaks de sistema (chaves `HKLM`, servicos, plano de energia) precisam de
administrador: usa **Definicoes → Reiniciar como admin**.

## Chaves

Formato: `OTZ-PLANO-XXXX-XXXX-XXXX` (`PRO`, `ELITE`, `STAFF`, `OWNER`, `BETA`). O primeiro
bloco codifica a validade e o ultimo e a assinatura. A validacao e local.

```bash
./tools/node/node.exe tools/gen-license.js 1 OWNER 365 --name "Nyx"
./tools/node/node.exe tools/gen-license.js 1 STAFF --perpetual --name "Staff"
./tools/node/node.exe tools/gen-license.js --list
./tools/node/node.exe tools/gen-license.js --revoke OTZ-OWNER-XXXX-XXXX-XXXX
```

`--perpetual` gera uma chave que nunca expira; sem a flag, a chave usa os dias indicados.

`--single-use` gera uma chave de uso unico: depois da primeira ativacao, a mesma chave
nao pode ser reativada nesse PC. O controlo fica em `license.json`; como a validacao e
local, nao impede copiar a chave para outro computador.

Exemplo de chaves STAFF beta de uso unico:

```bash
./tools/node/node.exe tools/gen-license.js 10 STAFF --perpetual --single-use --name "Staff beta"
```

O registo fica em `tools/licenses-issued.json`. Nao publiques esse ficheiro.

## Estrutura

```
src/main/            processo principal Electron (IPC, tweaks, limpeza, licenca)
src/renderer/        interface (HTML, CSS e JS sem build)
assets/              icones gerados por tools/make-icon.js
tools/               gerador de chaves, icones e servidor de preview
```
