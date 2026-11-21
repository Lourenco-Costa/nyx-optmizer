# Publicar uma versao

O auto-updater usa **GitHub Releases**. O repositorio tem de ser **publico** para os
clientes verificarem updates sem token.

## Primeira vez

1. Cria um repositorio publico no GitHub chamado `nyx-optmizer` (pode estar vazio).
2. Cria um token em **GitHub → Settings → Developer settings → Personal access tokens**
   com permissao **Contents: Read and write** apenas nesse repositorio.
3. No terminal, define o token so para esta sessao:

```bash
export GH_TOKEN=o_teu_token
npm run release -- --owner O_TEU_UTILIZADOR --repo nyx-optmizer
```

O script configura `release.config.json`, `src/main/update-channel.json` e
`package.json`, gera o instalador e publica o release com `latest.yml`.

Sem `GH_TOKEN`, o mesmo comando gera os ficheiros em `dist/`; nesse caso anexa
`NyxOptmizerSetup.exe`, `NyxOptmizerSetup.exe.blockmap` e `latest.yml` a um release
criado manualmente no GitHub.

## Versoes seguintes

1. Sobe a versao em `package.json` (por exemplo `1.1.1`).
2. Corre outra vez:

```bash
export GH_TOKEN=o_teu_token
npm run release
```

O `release.config.json` ja guarda o owner e o repo. Os clientes com a versao 1.1.0
ou superior recebem a nova versao automaticamente.

## Notas

- O primeiro instalador com updater tem de ser enviado **uma vez** aos amigos.
  Versoes anteriores a 1.1.0 nao tem o mecanismo.
- Nao coloques o token no repositorio nem no instalador.
- O instalador nao esta assinado; o Windows SmartScreen pode avisar. Para remover
  esse aviso e necessario um certificado de code signing.
