'use strict';

/**
 * Configura o canal GitHub e gera o instalador.
 *
 * Uso:
 *   npm run release -- --owner sensei-oficial --repo nyx-optmizer
 *
 * Com GH_TOKEN definido, tenta publicar diretamente no GitHub Releases.
 * Sem token, gera os ficheiros em dist/ para anexar a um release manual.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'release.config.json');
const channelPath = path.join(root, 'src', 'main', 'update-channel.json');
const packagePath = path.join(root, 'package.json');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const config = readJson(configPath, { owner: '', repo: 'nyx-optmizer' });
const owner = (arg('owner') || config.owner || '').trim();
const repo = (arg('repo') || config.repo || 'nyx-optmizer').trim();

if (!owner || !/^[a-z0-9-]+$/i.test(owner)) {
  console.log('');
  console.log('Falta o utilizador ou organizacao do GitHub.');
  console.log('');
  console.log('1. Cria um repositorio publico no GitHub chamado ' + repo + '.');
  console.log('2. Corre:');
  console.log('');
  console.log('   npm run release -- --owner O_TEU_UTILIZADOR --repo ' + repo);
  console.log('');
  console.log('O repositorio tem de ser publico para os teus amigos receberem');
  console.log('as atualizacoes sem token.');
  process.exit(1);
}

writeJson(configPath, { owner, repo });
writeJson(channelPath, { owner, repo, enabled: true });

const pkg = readJson(packagePath, {});
pkg.repository = { type: 'git', url: `https://github.com/${owner}/${repo}.git` };
pkg.build = pkg.build || {};
pkg.build.publish = [{ provider: 'github', owner, repo, releaseType: 'release' }];
writeJson(packagePath, pkg);

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const publish = Boolean(token);
const script = publish ? 'dist:publish' : 'dist';
const npmCli = process.env.npm_execpath;

console.log('');
console.log(`Canal: github.com/${owner}/${repo}`);
console.log(`Modo: ${publish ? 'gerar e publicar no GitHub Releases' : 'gerar instalador para publicar manualmente'}`);
console.log('');

let result;
if (npmCli) {
  result = spawnSync(process.execPath, [npmCli, 'run', script], { cwd: root, stdio: 'inherit' });
} else {
  result = spawnSync(publish ? 'npx' : 'npm', publish ? ['electron-builder', '--win', 'nsis', '--x64', '--publish', 'always'] : ['run', 'dist'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

if (result.status !== 0) {
  console.error('');
  console.error('A compilacao falhou. O canal ficou configurado, mas o release nao foi gerado.');
  process.exit(result.status || 1);
}

console.log('');
console.log('Ficheiros gerados em dist/:');
console.log('  NyxOptmizerSetup.exe');
console.log('  NyxOptmizerSetup.exe.blockmap');
console.log('  latest.yml');
console.log('');
if (!publish) {
  console.log('Falta o GH_TOKEN para publicar automaticamente. Cria um token');
  console.log('com permissao de Contents: Read and write e corre:');
  console.log('');
  console.log('  GH_TOKEN=o_teu_token npm run release');
  console.log('');
  console.log('Ou anexa os tres ficheiros a um release no GitHub.');
}
