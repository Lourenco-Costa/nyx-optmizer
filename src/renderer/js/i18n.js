'use strict';

(function () {
  const OTZ = (window.OTZ = window.OTZ || {});

  const params = new URLSearchParams(window.location.search);
  const requested = String(params.get('lang') || '').toLowerCase();
  const language = requested === 'en'
    ? 'en'
    : requested === 'pt'
      ? 'pt'
      : String(navigator.language || 'en').toLowerCase().startsWith('pt') ? 'pt' : 'en';

  const EN = {
    /* Shell */
    'Navegacao Nyx': 'Nyx navigation',
    'Navegacao': 'Navigation',
    'Paginas': 'Pages',
    'Areas do Nyx': 'Nyx areas',
    'Licenca': 'License',
    'Definicoes': 'Settings',
    'Minimizar': 'Minimize',
    'Maximizar': 'Maximize',
    'Fechar': 'Close',
    'Sistema pronto': 'System ready',
    'Administrador ativo': 'Administrator active',
    'Modo limitado': 'Limited mode',
    'A processar…': 'Processing…',
    'A processar...': 'Processing...',
    'Confirmar': 'Confirm',
    'Cancelar': 'Cancel',
    'ERRO': 'ERROR',
    'OFFLINE': 'OFFLINE',
    'ONLINE': 'ONLINE',
    'LIMITADO': 'LIMITED',
    'PREVIEW': 'PREVIEW',
    'ADMIN': 'ADMIN',
    'ATIVO': 'ACTIVE',
    'REINICIO': 'RESTART',
    'BETA': 'BETA',
    'PRO': 'PRO',
    'LOCAL': 'LOCAL',

    /* App / shared */
    'agora': 'now',
    'Ativar ou gerir licenca': 'Activate or manage license',
    'Licenca ativa': 'License active',
    'Ocorreu um erro a abrir esta pagina.': 'An error occurred while opening this page.',
    'Erro na interface': 'Interface error',
    'Administrador ativo': 'Administrator active',
    'Atualizacao pronta': 'Update ready',
    'Atualizacao': 'Update',
    'Atualizacoes': 'Updates',
    'A atualizacao ainda nao esta pronta.': 'The update is not ready yet.',
    'A versao nova instala quando fechares a app.': 'The new version installs when you close the app.',
    'Tweak aplicado': 'Tweak applied',
    'Tweak revertido': 'Tweak reverted',
    'Tweak aplicado.': 'Tweak applied.',
    'Tweak revertido.': 'Tweak reverted.',
    'Tweak desconhecido.': 'Unknown tweak.',
    'Precisas de administrador para reverter este tweak.': 'You need administrator rights to revert this tweak.',
    'A reposicao total precisa de administrador.': 'A full restore requires administrator rights.',
    'Este tweak escreve no sistema. Reinicia a app como administrador.': 'This tweak writes to the system. Restart the app as administrator.',
    'Funcao beta. Ativa uma chave STAFF, Owner ou Beta Tester para usar este tweak.': 'Beta feature. Activate a STAFF, Owner or Beta Tester key to use this tweak.',
    'Ativa uma licenca para limpar caches avancadas.': 'Activate a license to clean advanced caches.',
    'O periodo de avaliacao terminou. Ativa uma licenca para continuar.': 'The trial has ended. Activate a license to continue.',
    'Cache DNS limpa.': 'DNS cache cleared.',
    'Ponto de restauro criado.': 'Restore point created.',
    'Falha ao limpar o cache DNS.': 'Failed to clear the DNS cache.',
    'Disponivel apenas na app instalada, com administrador.': 'Available only in the installed app, with administrator rights.',
    'Canal GitHub configurado; atualizacoes apenas na app instalada.': 'GitHub channel configured; updates only in the installed app.',
    'Nao foi possivel guardar a licenca (sem permissao de escrita).': 'Could not save the license (no write permission).',
    'Acesso beta associado ao servidor e cargo indicados. Cada tester tem de voltar a ligar o Discord.': 'Beta access linked to the selected server and role. Each tester must reconnect Discord.',
    'Otimizacao concluida.': 'Optimization complete.',
    'Limpeza concluida.': 'Cleanup complete.',
    'Reinicia o PC para o efeito completo.': 'Restart the PC for the full effect.',
    'Nao foi possivel': 'Could not complete',
    'Erro': 'Error',
    'Comecar': 'Start',
    'Ver licenca': 'View license',

    /* Dashboard */
    'Visao inteligente do sistema': 'Smart system overview',
    'Atualizar': 'Refresh',
    'Analise concluida': 'Analysis complete',
    'Analisado': 'Analyzed',
    'Mais FPS.': 'More FPS.',
    'Menos latencia.': 'Less latency.',
    'O Nyx le o teu sistema, limpa o que sobra e aplica apenas ajustes seguros.': 'Nyx reads your system, cleans what is left over and applies only safe tweaks.',
    'Tu mantens o controlo — tudo pode ser revertido.': 'You stay in control — everything can be reverted.',
    'Otimizar agora': 'Optimize now',
    'A preparar recomendacoes…': 'Preparing recommendations…',
    'Tweaks reversiveis': 'Reversible tweaks',
    'A ler o processador…': 'Reading the processor…',
    'A ler a memoria…': 'Reading memory…',
    'A ler o disco…': 'Reading the disk…',
    'A ler o sistema…': 'Reading the system…',
    'Memoria': 'Memory',
    'Disco': 'Disk',
    'Tempo ligado': 'Uptime',
    'Recomendado para ti': 'Recommended for you',
    'Ver todos': 'View all',
    'Atividade': 'Activity',
    'Sessao atual': 'Current session',
    'Sem atividade ainda. Aplica um tweak ou corre uma otimizacao.': 'No activity yet. Apply a tweak or run an optimization.',
    'Tudo em ordem. Nao ha ajustes recomendados pendentes.': 'All good. There are no pending recommended tweaks.',
    'Nao foi possivel carregar os ajustes.': 'Could not load tweaks.',
    'Ajuste bloqueado': 'Tweak locked',
    'O periodo de avaliacao terminou. Ativa uma licenca para continuares a aplicar tweaks.': 'The trial has ended. Activate a license to keep applying tweaks.',
    'Funcao Owner/Beta': 'Owner/Beta feature',
    'Este ajuste faz parte do acesso experimental. Precisa de uma chave Owner ou Beta.': 'This tweak is part of experimental access. It requires an Owner or Beta key.',
    'Dados atualizados': 'Data updated',
    'A atualizar…': 'Updating…',
    'A analisar o sistema': 'Analyzing the system',
    'A limpar ficheiros temporarios': 'Cleaning temporary files',
    'A aplicar tweaks recomendados': 'Applying recommended tweaks',
    'A atualizar a rede': 'Updating the network',
    'A finalizar': 'Finishing',
    'Otimizacao Nyx': 'Nyx optimization',
    'Nyx smart optimization': 'Nyx smart optimization',
    'A afinar o teu PC': 'Tuning your PC',
    'Analisar o sistema': 'Analyze the system',
    'A ler CPU, memoria e disco': 'Reading CPU, memory and disk',
    'Limpar temporarios': 'Clean temporary files',
    'Caches seguras e ficheiros orfaos': 'Safe caches and orphan files',
    'Aplicar tweaks': 'Apply tweaks',
    'Apenas ajustes recomendados': 'Recommended tweaks only',
    'Otimizar a rede': 'Optimize the network',
    'Cache DNS e prioridade de rede': 'DNS cache and network priority',
    'Finalizar': 'Finish',
    'A confirmar o resultado': 'Confirming the result',
    'Seguranca': 'Safety',
    'Podes restaurar todos os ajustes na pagina Performance.': 'You can restore every tweak on the Performance page.',
    'Nada sai deste PC': 'Nothing leaves this PC',
    'Sem telemetria, sem envio de dados para servidores.': 'No telemetry, no data sent to servers.',
    'Todos os ajustes compativeis podem ser aplicados.': 'Every compatible tweak can be applied.',
    'Ajustes que precisam de admin sao ignorados sem bloquear o resto.': 'Tweaks that need admin are skipped without blocking the rest.',
    'Libertado': 'Freed',
    'Tweaks aplicados': 'Tweaks applied',
    'Concluir': 'Done',
    'Otimizacao interrompida': 'Optimization interrupted',
    'Nao foi possivel concluir a otimizacao.': 'Could not complete the optimization.',
    'Otimizacao nao concluida': 'Optimization not completed',
    'Otimizacao concluida': 'Optimization complete',
    'Sistema analisado': 'System analyzed',
    'Ficheiros temporarios': 'Temporary files',
    'Tweaks recomendados': 'Recommended tweaks',
    'Tudo em ordem': 'All good',
    'Sistema otimizado': 'System optimized',
    'Otimizar o teu PC?': 'Optimize your PC?',
    'Vamos limpar caches seguras, aplicar os tweaks recomendados e atualizar a cache DNS. Podes reverter tudo depois.': 'We will clean safe caches, apply recommended tweaks and refresh the DNS cache. You can revert everything later.',
    'A otimizar o sistema': 'Optimizing the system',
    'Otimizacao concluida': 'Optimization complete',

    /* Tweaks */
    'Ajustes reais do Windows, todos reversiveis': 'Real Windows tweaks, all reversible',
    'Ajustes do sistema': 'System tweaks',
    'Cada tweak le e escreve o estado real do Windows. Nada e simulado.': 'Every tweak reads and writes the real Windows state. Nothing is simulated.',
    'A carregar…': 'Loading…',
    'Restaurar': 'Restore',
    'Alguns tweaks precisam de administrador.': 'Some tweaks require administrator rights.',
    'Reiniciar como admin': 'Restart as admin',
    'Reiniciar como administrador': 'Restart as administrator',
    'Procurar ajuste…': 'Search tweaks…',
    'Todos': 'All',
    'Seguro': 'Safe',
    'Moderado': 'Moderate',
    'Nenhum ajuste corresponde a procura.': 'No tweak matches your search.',
    'A avaliacao terminou. Ativa uma licenca para aplicar tweaks.': 'The trial has ended. Activate a license to apply tweaks.',
    'Ativar licenca': 'Activate license',
    'Modo limitado: os ajustes que escrevem no sistema precisam de administrador.': 'Limited mode: tweaks that write to the system require administrator rights.',
    'Tweak bloqueado': 'Tweak locked',
    'Este ajuste faz parte do Nyx Pro. Ativa uma licenca para continuar.': 'This tweak is part of Nyx Pro. Activate a license to continue.',
    'Este tweak faz parte do acesso experimental Owner/Beta.': 'This tweak is part of Owner/Beta experimental access.',
    'Restaurar predefinicoes?': 'Restore defaults?',
    'Todos os tweaks aplicados voltam ao estado original do Windows.': 'Every applied tweak returns to the original Windows state.',
    'Predefinicoes restauradas': 'Defaults restored',
    'Tweaks revertidos': 'Tweaks reverted',
    'A restaurar…': 'Restoring…',
    'Este tweak nao tem acoes definidas.': 'This tweak has no actions defined.',
    'Precisas de executar a app como administrador para este tweak.': 'Run the app as administrator to use this tweak.',
    'Esta versao do Windows nao suporta este tweak.': 'This Windows version does not support this tweak.',
    'Nao foi possivel concluir a operacao.': 'Could not complete the operation.',

    /* Network */
    'Latencia e resposta da ligacao': 'Connection latency and response',
    'Latencia sob controlo.': 'Latency under control.',
    'Mede a resposta real da tua ligacao e aplica ajustes de rede e gaming.': 'Measure your real connection response and apply network and gaming tweaks.',
    'SEM TESTE': 'NOT TESTED',
    'Teste de latencia': 'Latency test',
    'Testa a resposta da tua ligacao.': 'Test your connection response.',
    'Jitter': 'Jitter',
    'Perda': 'Loss',
    'Pacotes': 'Packets',
    'Testar latencia': 'Test latency',
    'Ping real via Windows': 'Real ping via Windows',
    'Cache DNS': 'DNS cache',
    'Remove resolucoes antigas e forca o Windows a procurar os servidores atuais.': 'Removes old resolutions and forces Windows to look up current servers.',
    'Limpar cache': 'Clear cache',
    'Modo gaming': 'Gaming mode',
    'Prioridade para o jogo em primeiro plano, sem throttling de rede.': 'Priority for the foreground game, without network throttling.',
    'GPU + CPU': 'GPU + CPU',
    'Ver ajustes': 'View tweaks',
    'Ajustes de latencia': 'Latency tweaks',
    'Recomendado para gaming': 'Recommended for gaming',
    'Teste indisponivel': 'Test unavailable',
    'Esta versao da app nao expoe o teste de latencia.': 'This app version does not expose the latency test.',
    'A medir…': 'Measuring…',
    'A medir a latencia': 'Measuring latency',
    'Sem resposta do servidor.': 'No response from the server.',
    'Sem resposta': 'No response',
    'Ligacao instavel. Repete o teste.': 'Unstable connection. Run the test again.',
    'Resposta rapida. Boa ligacao para jogar.': 'Fast response. Good connection for gaming.',
    'Resposta aceitavel, mas ha margem para melhorar.': 'Acceptable response, but there is room for improvement.',
    'Falha no teste': 'Test failed',
    'Nao foi possivel medir agora.': 'Could not measure right now.',
    'Ativa uma licenca para aplicares ajustes de rede e gaming.': 'Activate a license to apply network and gaming tweaks.',
    'Este ajuste faz parte do acesso experimental.': 'This tweak is part of experimental access.',
    'Ajuste aplicado': 'Tweak applied',
    'Ajuste revertido': 'Tweak reverted',
    'Ajuste de rede aplicado': 'Network tweak applied',
    'Ajuste de rede revertido': 'Network tweak reverted',
    'Precisas de administrador': 'Administrator required',
    'Reinicia a app como admin nas Definicoes para aplicares este ajuste.': 'Restart the app as admin in Settings to apply this tweak.',
    'Falha ao limpar DNS': 'Failed to clear DNS',
    'Cache DNS limpa': 'DNS cache cleared',
    'Sem ajustes de rede disponiveis neste Windows.': 'No network tweaks available on this Windows.',
    'Nao foi possivel carregar os ajustes de rede.': 'Could not load network tweaks.',
    'Sem resposta do servidor. Verifica a ligacao e tenta de novo.': 'No response from the server. Check your connection and try again.',

    /* Cleaner */
    'Caches, temporarios e ficheiros orfaos': 'Caches, temporary and orphan files',
    'Espaco sem peso.': 'Space without the weight.',
    'Caches, temporarios e ficheiros que ja nao servem. Nada e apagado sem confirmares.': 'Caches, temporary files and files you no longer need. Nothing is deleted without confirmation.',
    'A ANALISAR': 'SCANNING',
    'Espaco recuperavel': 'Recoverable space',
    'A procurar ficheiros…': 'Looking for files…',
    'Limpar selecionados': 'Clean selected',
    'Analisar novamente': 'Scan again',
    'Ficheiros em uso pelo sistema sao ignorados automaticamente.': 'Files in use by the system are ignored automatically.',
    'Categorias': 'Categories',
    'O que queres limpar': 'What do you want to clean',
    'Selecionar tudo': 'Select all',
    'A analisar': 'Scanning',
    'Nada para limpar por agora': 'Nothing to clean right now',
    'CATEGORIAS': 'CATEGORIES',
    'PRONTO': 'READY',
    'Pronto': 'Ready',
    'Nao foi possivel analisar agora.': 'Could not scan right now.',
    'Falha na analise': 'Scan failed',
    'Categoria Pro': 'Pro category',
    'As caches avancadas fazem parte do Nyx Pro. Ativa uma licenca para as limpar.': 'Advanced caches are part of Nyx Pro. Activate a license to clean them.',
    'Vamos remover temporarios, caches e o conteudo da reciclagem. Ficheiros em uso sao ignorados.': 'We will remove temporary files, caches and Recycle Bin contents. Files in use are ignored.',
    'Limpar agora': 'Clean now',
    'A limpar…': 'Cleaning…',
    'Limpeza bloqueada': 'Cleanup blocked',
    'Limpeza concluida': 'Cleanup complete',
    'Falha na limpeza': 'Cleanup failed',
    'Ativa uma licenca para limpar caches avancadas.': 'Activate a license to clean advanced caches.',
    'Limpeza concluida nos itens disponiveis. As caches avancadas precisam de licenca.': 'Cleanup complete for available items. Advanced caches require a license.',

    /* License */
    'Ativa ou gere o teu acesso Nyx': 'Activate or manage your Nyx access',
    'Nao foi possivel ler o estado da licenca.': 'Could not read the license status.',
    'Chave permanente.': 'Permanent key.',
    'Acesso beta ativo': 'Beta access active',
    'Licenca expirada': 'License expired',
    'Avaliacao Nyx': 'Nyx trial',
    'Avaliacao terminada': 'Trial ended',
    'Todos os tweaks e limpezas avancadas estao desbloqueados neste PC.': 'All tweaks and advanced cleanups are unlocked on this PC.',
    'O acesso experimental esta ativo neste PC. Mantem o teu acesso para continuares a receber funcoes novas.': 'Experimental access is active on this PC. Keep your access to continue receiving new features.',
    'Ativa uma chave para continuares depois disso.': 'Activate a key to continue after that.',
    'Ativa uma chave nova para voltares a aplicar tweaks.': 'Activate a new key to apply tweaks again.',
    'O periodo de avaliacao terminou. Ativa uma chave para voltares a aplicar tweaks e limpar caches avancadas.': 'The trial has ended. Activate a key to apply tweaks and clean advanced caches again.',
    '1 USO': '1 USE',
    'EXPERIMENTAL': 'EXPERIMENTAL',
    'TRIAL': 'TRIAL',
    'EXPIRADA': 'EXPIRED',
    'Nyx membership': 'Nyx membership',
    'A tua licenca.': 'Your license.',
    'Ativacao local. A chave nunca sai deste computador.': 'Local activation. The key never leaves this computer.',
    'Estado atual': 'Current status',
    'Ativar chave': 'Activate key',
    'Introduz a tua chave': 'Enter your key',
    'Cola a chave para desbloquear todos os tweaks e as caches avancadas.': 'Paste the key to unlock all tweaks and advanced caches.',
    'Ativar': 'Activate',
    'Validacao offline — a chave fica apenas neste PC.': 'Offline validation — the key stays on this PC only.',
    'Desativar licenca deste PC': 'Deactivate license on this PC',
    'Todos os tweaks': 'All tweaks',
    'Ajustes reais de desempenho, gaming e privacidade.': 'Real performance, gaming and privacy tweaks.',
    'Limpeza profunda': 'Deep cleanup',
    'Caches avancadas e ficheiros que o Windows esquece.': 'Advanced caches and files Windows forgets.',
    'Sem telemetria': 'No telemetry',
    'Tudo local. Nenhum dado sai deste computador.': 'Everything local. No data leaves this computer.',
    'Introduz a tua chave primeiro.': 'Enter your key first.',
    'A validar…': 'Validating…',
    'Chave recusada': 'Key rejected',
    'Licenca ativada com sucesso.': 'License activated successfully.',
    'Licenca ativada': 'License activated',
    'Desativar licenca?': 'Deactivate license?',
    'A app volta ao modo de avaliacao neste PC. Podes reativar com a mesma chave.': 'The app returns to trial mode on this PC. You can reactivate with the same key.',
    'Desativar': 'Deactivate',
    'Licenca removida deste PC': 'License removed from this PC',
    'Esta chave expirou em': 'This key expired on',
    'Pede uma chave nova ao Santos.': 'Ask Santos for a new key.',
    'Esta chave de uso unico ja foi ativada.': 'This single-use key has already been activated.',
    'Nao foi possivel guardar a licenca (sem permissao de escrita).': 'Could not save the license (no write permission).',
    'Licenca ativada.': 'License activated.',

    /* Settings */
    'Permissoes, seguranca e sobre a app': 'Permissions, security and about the app',
    'Controlo total.': 'Total control.',
    'Permissoes, seguranca e os detalhes tecnicos do Nyx.': 'Permissions, security and technical details about Nyx.',
    'Sistema': 'System',
    'Permissoes': 'Permissions',
    'Com privilegios de administrador': 'With administrator privileges',
    'Sem privilegios — ajustes de sistema bloqueados': 'Without privileges — system tweaks blocked',
    'Admin ativo': 'Admin active',
    'Ponto de restauro': 'Restore point',
    'Cria um ponto antes de aplicar alteracoes (requer admin)': 'Creates a restore point before applying changes (requires admin)',
    'Criar': 'Create',
    'Restaurar tweaks': 'Restore tweaks',
    'Devolve o Windows ao estado original': 'Returns Windows to its original state',
    'Limpa resolucoes antigas de nomes': 'Clears old name resolutions',
    'Limpar': 'Clear',
    'Pasta de dados': 'Data folder',
    'Licenca e configuracoes locais': 'License and local settings',
    'Abrir': 'Open',
    'Gerir': 'Manage',
    'A preparar o canal...': 'Preparing the channel...',
    'Verificar': 'Check',
    'Versao': 'Version',
    'Maquina': 'Machine',
    'Autor': 'Author',
    'Otimizacao real para Windows. Preto no branco, sem atalhos.': 'Real optimization for Windows. Black and white, no shortcuts.',
    'Estado indisponivel': 'Status unavailable',
    'Plano': 'Plan',
    'Avaliacao —': 'Trial —',
    'dias restantes': 'days left',
    'Reinicio cancelado': 'Restart cancelled',
    'A app fecha e abre novamente com o pedido de administrador.': 'The app closes and opens again with an administrator request.',
    'Ponto de restauro criado': 'Restore point created',
    'Nao criado': 'Not created',
    'Falhou': 'Failed',
    'Disponivel na app instalada.': 'Available in the installed app.',
    'Modulo de atualizacoes indisponivel.': 'Update module unavailable.',
    'Ainda nao verificou atualizacoes.': 'Updates have not been checked yet.',
    'Indisponivel em modo de desenvolvimento.': 'Unavailable in development mode.',
    'Canal GitHub por configurar.': 'GitHub channel not configured.',
    'Canal de atualizacoes desativado.': 'Update channel disabled.',
    'A procurar uma versao nova...': 'Looking for a new version...',
    'Estas na versao mais recente.': 'You are on the latest version.',
    'Nao foi possivel verificar.': 'Could not check.',
    'Instalar': 'Install',
    'Atualizacao pronta': 'Update ready',
    'A descarregar atualizacao...': 'Downloading update...',
    'Versao': 'Version',
    'pronta a instalar.': 'ready to install.',
    'Reinicia para instalar.': 'Restart to install.',

    /* Stats / risk */
    'Excelente': 'Excellent',
    'Bom': 'Good',
    'A melhorar': 'Needs improvement',
    'Critico': 'Critical',

    /* Categories */
    'Desempenho': 'Performance',
    'Gaming': 'Gaming',
    'Privacidade': 'Privacy',
    'Sistema': 'System',

    /* Cleaner targets */
    'Temporarios do utilizador': 'User temporary files',
    'Restos de instaladores, caches de apps e ficheiros .tmp': 'Installer leftovers, app caches and .tmp files',
    'Miniaturas e icones': 'Thumbnails and icons',
    'Cache de miniaturas do Explorador (recriada automaticamente)': 'Explorer thumbnail cache (recreated automatically)',
    'Cache de internet (Windows)': 'Internet cache (Windows)',
    'Ficheiros temporarios da Internet do sistema': 'System Internet temporary files',
    'Cache de shaders DirectX': 'DirectX shader cache',
    'Shaders compilados — libertam espaco e reduzem stutter': 'Compiled shaders — free space and reduce stutter',
    'Relatorios de erros': 'Error reports',
    'Crash dumps e relatorios do Windows Error Reporting': 'Crash dumps and Windows Error Reporting files',
    'Reciclagem': 'Recycle Bin',
    'Conteudo do caixote do lixo de todas as unidades': 'Recycle Bin contents on all drives',
    'Caches dos navegadores': 'Browser caches',
    'Chrome, Edge, Brave, Vivaldi, Opera e Firefox': 'Chrome, Edge, Brave, Vivaldi, Opera and Firefox',
    'Temporarios do Windows': 'Windows temporary files',
    'Cache partilhada do sistema (requer administrador)': 'Shared system cache (requires administrator)',
    'Prefetch': 'Prefetch',
    'Dados de pre-carregamento antigos': 'Old preload data',
    'Cache do Windows Update': 'Windows Update cache',
    'Instaladores ja aplicados pelo sistema': 'Installers already applied by the system',
    'Otimizacao de entrega': 'Delivery Optimization',
    'Fragmentos de atualizacoes partilhados entre PCs': 'Update fragments shared between PCs',
    'Cache de shaders da GPU': 'GPU shader cache',
    'Caches DirectX da NVIDIA e AMD (recriados no proximo jogo)': 'NVIDIA and AMD DirectX caches (recreated on the next game)',
    'Caches de Discord e Teams': 'Discord and Teams caches',
    'Imagens, codigo e shaders temporarios das apps de conversa': 'Temporary images, code and shaders from chat apps',
    'Logs antigos do Windows': 'Old Windows logs',
    'Registos de instalacao e diagnostico que ja nao sao necessarios': 'Installation and diagnostic logs that are no longer needed',

    /* Tweak names and descriptions */
    'Efeitos visuais leves': 'Light visual effects',
    'Remove animacoes, sombras e transparencias do Windows. Mais fluidez em maquinas modestas.': 'Removes Windows animations, shadows and transparency. Smoother on modest machines.',
    'Menus instantaneos': 'Instant menus',
    'Elimina o atraso de 400 ms ao abrir menus do Explorador.': 'Removes the 400 ms delay when opening Explorer menus.',
    'Arranque sem atraso': 'Startup without delay',
    'Remove o atraso artificial aplicado as apps de arranque.': 'Removes the artificial delay applied to startup apps.',
    'Apps em segundo plano': 'Background apps',
    'Impede apps da Store de consumirem RAM e CPU fora de foco.': 'Stops Store apps from using RAM and CPU when out of focus.',
    'Desativar hibernacao': 'Disable hibernation',
    'Liberta varios GB em disco (igual ao tamanho da RAM). O Fast Startup deixa de funcionar.': 'Frees several GB of disk (equal to RAM size). Fast Startup stops working.',
    'Plano Ultimate Performance': 'Ultimate Performance plan',
    'Ativa o plano de energia de maximo desempenho da Microsoft.': 'Enables Microsoft maximum performance power plan.',
    'Desativar Game Bar e captura': 'Disable Game Bar and capture',
    'Remove a gravacao em segundo plano do Xbox Game Bar, que custa FPS.': 'Removes Xbox Game Bar background recording, which costs FPS.',
    'Game Mode ativo': 'Game Mode enabled',
    'Da prioridade de CPU e GPU ao jogo em primeiro plano.': 'Gives CPU and GPU priority to the foreground game.',
    'Sem aceleracao do rato': 'No mouse acceleration',
    'Movimento 1:1 — melhora a precisao em shooters.': '1:1 movement — improves precision in shooters.',
    'Prioridade multimedia': 'Multimedia priority',
    'Remove o throttling de rede para jogos e baixa a reserva de CPU do sistema.': 'Removes network throttling for games and lowers the system CPU reserve.',
    'Agendamento de GPU': 'GPU scheduling',
    'Ativa o hardware-accelerated GPU scheduling. Requer reiniciar.': 'Enables hardware-accelerated GPU scheduling. Requires a restart.',
    'Telemetria minima': 'Minimal telemetry',
    'Reduz o envio de diagnosticos para a Microsoft ao nivel minimo.': 'Reduces diagnostic data sent to Microsoft to the minimum.',
    'Desativar servico DiagTrack': 'Disable DiagTrack service',
    'Desliga o servico de telemetria "Connected User Experiences". Requer reiniciar.': 'Turns off the "Connected User Experiences" telemetry service. Requires a restart.',
    'Sem sugestoes e anuncios': 'No suggestions or ads',
    'Remove sugestoes, dicas e apps promovidas no Menu Iniciar.': 'Removes suggestions, tips and promoted apps from the Start menu.',
    'Desativar ID de publicidade': 'Disable advertising ID',
    'As apps deixam de usar o teu ID de publicidade para te rastrear.': 'Apps can no longer use your advertising ID to track you.',
    'Desativar Cortana': 'Disable Cortana',
    'Bloqueia a assistente e a recolha de voz associada.': 'Blocks the assistant and associated voice collection.',
    'Caminhos longos': 'Long paths',
    'Permite caminhos acima de 260 caracteres (compatibilidade com ferramentas modernas).': 'Allows paths longer than 260 characters (compatible with modern tools).',
    'Teclado responsivo': 'Responsive keyboard',
    'Remove o atraso inicial das teclas. A escrita e os atalhos respondem de imediato.': 'Removes the initial key delay. Typing and shortcuts respond immediately.',
    'Sem transparencias': 'No transparency',
    'Desliga o efeito acrilico das janelas e do Menu Iniciar. Poupa GPU em portateis.': 'Turns off the acrylic effect on windows and the Start menu. Saves GPU on laptops.',
    'Plano Alto Desempenho': 'High Performance plan',
    'Fixa o plano de energia Alto Desempenho, sem baixar a frequencia do CPU. Em portateis gasta mais bateria.': 'Locks the High Performance power plan without lowering CPU frequency. Uses more battery on laptops.',
    'Bloquear autoplay': 'Block autoplay',
    'Impede que pens USB, CDs e media arranquem sozinhos ao serem ligados.': 'Stops USB drives, CDs and media from starting automatically when connected.',
    'Sem pesquisa web no Iniciar': 'No web search in Start',
    'O Menu Iniciar deixa de enviar o que escreves para a pesquisa da Microsoft.': 'The Start menu no longer sends what you type to Microsoft search.',
    'Edge sem segundo plano': 'Edge without background mode',
    'Impede o Edge de continuar a correr depois de fechares as janelas.': 'Stops Edge from running after you close its windows.',
    'Sem Widgets no Windows': 'No Windows widgets',
    'Desliga o painel de widgets da barra de tarefas e reduz processos em segundo plano.': 'Turns off the taskbar widgets panel and reduces background processes.',
    'Sem rastreio no Iniciar': 'No Start tracking',
    'O Windows deixa de registar as apps que abres para personalizar sugestoes.': 'Windows stops recording the apps you open to personalise suggestions.',
    'Hover instantaneo': 'Instant hover',
    'Remove o atraso de 400 ms ao passar o rato por menus e barras.': 'Removes the 400 ms delay when hovering over menus and bars.',
    'Sem Assistencia Remota': 'No Remote Assistance',
    'Impede pedidos de assistencia remota nao solicitados.': 'Blocks unsolicited remote assistance requests.',
    'Sem relatorios de erros': 'No error reports',
    'Desativa o Windows Error Reporting e reduz trabalho em segundo plano.': 'Disables Windows Error Reporting and reduces background work.',
    'Sem animacoes na barra de tarefas': 'No taskbar animations',
    'Remove as animacoes de abertura e destaque da barra de tarefas.': 'Removes taskbar opening and highlight animations.',
    'Janelas sem animacao': 'Windows without animation',
    'Desliga a animacao ao minimizar, maximizar e restaurar janelas.': 'Turns off animations when minimising, maximising and restoring windows.',
    'Sem Aero Peek': 'No Aero Peek',
    'Remove a pre-visualizacao do ambiente de trabalho ao passar na barra.': 'Removes the desktop preview when hovering over the taskbar.',
    'Sem Chat na barra de tarefas': 'No Chat on the taskbar',
    'Esconde o icone do Chat/Teams e impede o arranque do painel rapido.': 'Hides the Chat/Teams icon and stops the quick panel from starting.',
    'Sem caixa de pesquisa': 'No search box',
    'Esconde a pesquisa da barra de tarefas. A pesquisa do Iniciar continua disponivel.': 'Hides taskbar search. Start menu search remains available.',
    'Sem noticias na barra': 'No news on the taskbar',
    'Remove o painel de noticias e interesses da barra de tarefas (Windows 10).': 'Removes the news and interests panel from the taskbar (Windows 10).',
    'Sem anuncios no ecra de bloqueio': 'No lock screen ads',
    'Remove as sugestoes e promocoes do Windows Spotlight no ecra de bloqueio.': 'Removes Windows Spotlight suggestions and promotions from the lock screen.',
    'Sem sugestoes nas Definicoes': 'No Settings suggestions',
    'Remove cartoes e sugestoes promovidas dentro das Definicoes do Windows.': 'Removes promoted cards and suggestions inside Windows Settings.',
    'Sem historico de atividade': 'No activity history',
    'Impede o Windows de publicar e enviar o historico de apps e ficheiros.': 'Stops Windows from publishing and uploading app and file history.',
    'Sem sincronizacao da area de transferencia': 'No clipboard sync',
    'O que copias deixa de ser enviado para a nuvem entre dispositivos.': 'What you copy is no longer sent to the cloud between devices.',
    'Sem experiencias personalizadas': 'No personalised experiences',
    'Impede a Microsoft de usar diagnosticos para personalizar dicas e anuncios.': 'Stops Microsoft from using diagnostics to personalise tips and ads.',
    'Sem reconhecimento de voz online': 'No online speech recognition',
    'Mantem o reconhecimento de voz local e evita o envio de audio para a Microsoft.': 'Keeps speech recognition local and avoids sending audio to Microsoft.',
    'Sem personalizacao de escrita': 'No writing personalisation',
    'Desativa a recolha de tinta, texto e contactos para personalizar a escrita.': 'Disables collection of ink, text and contacts for writing personalisation.',
    'Sem ficheiros recentes': 'No recent files',
    'O Menu Iniciar deixa de listar documentos e ficheiros abertos recentemente.': 'The Start menu stops listing recently opened documents and files.',
    'Desativar Copilot': 'Disable Copilot',
    'Remove o Copilot da barra de tarefas e impede o painel de arrancar (Windows 11).': 'Removes Copilot from the taskbar and stops the panel from starting (Windows 11).',
    'Edge sem arranque antecipado': 'Edge without startup boost',
    'Impede o Edge de arrancar processos antes de abrires o browser.': 'Stops Edge from starting processes before you open the browser.',
    'Desativar Sensor de Armazenamento': 'Disable Storage Sense',
    'Impede limpezas automaticas e remocao de ficheiros sem o teu controlo.': 'Stops automatic cleanups and file removal without your control.',
    'Sem dicas da Xbox Game Bar': 'No Xbox Game Bar tips',
    'Remove o painel de boas-vindas e dicas da Game Bar ao abrir um jogo.': 'Removes the Game Bar welcome panel and tips when a game starts.',
    'Windows Update sem P2P': 'Windows Update without P2P',
    'Impede o Windows de usar a largura de banda de outros PCs para atualizacoes.': 'Stops Windows from using other PCs bandwidth for updates.',
    'Desativar Fast Startup': 'Disable Fast Startup',
    'Forca um arranque limpo em vez de retomar o kernel antigo. Requer reiniciar.': 'Forces a clean boot instead of resuming the old kernel. Requires a restart.',
    'Desativar SMB1 antigo': 'Disable legacy SMB1',
    'Fecha o protocolo de partilha legado, alvo de ransomware. Pode quebrar NAS muito antigos.': 'Closes the legacy sharing protocol targeted by ransomware. May break very old NAS devices.',
    'Desativar LLMNR': 'Disable LLMNR',
    'Impede respostas de nome multicast usadas para intercetar credenciais na rede local.': 'Blocks multicast name responses used to intercept credentials on the local network.',
    'Prioridade de CPU para jogos': 'CPU priority for games',
    'Encurta os intervalos de CPU do Windows para dar resposta mais rapida ao que esta em primeiro plano.': 'Shortens Windows CPU intervals to respond faster to foreground apps.',
    'Desativar Power Throttling': 'Disable Power Throttling',
    'Impede o Windows de baixar a frequencia de apps em segundo plano. Em portateis gasta mais bateria.': 'Stops Windows from lowering background app frequency. Uses more battery on laptops.',
    'Latencia do rato (fila curta)': 'Mouse latency (short queue)',
    'Reduz o buffer de eventos do rato de 100 para 20 pacotes. Requer reiniciar.': 'Reduces the mouse event buffer from 100 to 20 packets. Requires a restart.',
  };

  const PATTERNS = [
    [/^(\d[\d.,]*) ficheiros selecionados$/i, '$1 files selected'],
    [/^(\d+) CATEGORIAS$/i, '$1 CATEGORIES'],
    [/^(\d+) de (\d+) ajustes$/i, '$1 of $2 tweaks'],
    [/^(\d+) ajustes$/i, '$1 tweaks'],
    [/^TRIAL (\d+)D$/i, 'TRIAL $1D'],
    [/^(\d+) DE (\d+) DIAS$/i, '$1 OF $2 DAYS'],
    [/^Avaliacao — (\d+) dias restantes$/i, 'Trial — $1 days left'],
    [/^(\d+) dias restantes$/i, '$1 days left'],
    [/^Valida ate (.*) \((\d+) dias\)\.$/i, 'Valid until $1 ($2 days).'],
    [/^CHAVE (.+)$/i, 'KEY $1'],
    [/^(\d+) tweaks revertidos para o estado original\.$/i, '$1 tweaks reverted to the original state.'],
    [/^(\d+) ficheiros removidos$/i, '$1 files removed'],
    [/^(\d+) aplicados$/i, '$1 applied'],
    [/^Limpar (.*)\?$/i, 'Clean $1?'],
    [/^Limpar (.+)$/i, 'Clean $1'],
    [/^Tens acesso completo a tudo durante mais 1 dia\. Ativa uma chave para continuares depois disso\.$/i, 'You have full access to everything for 1 more day. Activate a key to continue after that.'],
    [/^Tens acesso completo a tudo durante mais (\d+) dias\. Ativa uma chave para continuares depois disso\.$/i, 'You have full access to everything for $1 more days. Activate a key to continue after that.'],
    [/^A chave (.+) expirou em (.+)\. Ativa uma chave nova para voltares a aplicar tweaks\.$/i, 'The $1 key expired on $2. Activate a new key to apply tweaks again.'],
    [/^(.+) libertados · (\d[\d.,]*) ficheiros\.$/i, '$1 freed · $2 files.'],
    [/^(.+) libertados · (.+) tweaks$/i, '$1 freed · $2 tweaks'],
    [/^(.+) libertados · (.+) tweaks aplicados\.$/i, '$1 freed · $2 tweaks applied.'],
    [/^(.+) · (\d+) ajustes por aplicar$/i, '$1 · $2 tweaks left to apply'],
    [/^([\d.,]+ (?:B|KB|MB|GB|TB)) de ([\d.,]+ (?:B|KB|MB|GB|TB))$/i, '$1 of $2'],
    [/^(.+) livres em (.+)$/i, '$1 free on $2'],
    [/^Versao (.+) pronta a instalar\.$/i, 'Version $1 ready to install.'],
    [/^Versao (.+) encontrada\. A descarregar\.\.\.$/i, 'Version $1 found. Downloading...'],
    [/^A descarregar atualizacao\.\.\. (\d+)%$/i, 'Downloading update... $1%'],
    [/^Versao (.+) pronta\. Reinicia para instalar\.$/i, 'Version $1 ready. Restart to install.'],
    [/^Plano (.+) ativo$/i, 'Plan $1 active'],
    [/^(.+) de (.+) ficheiros$/i, '$1 of $2 files'],
  ];

  function preserve(original, translated) {
    const lead = original.match(/^\s*/)[0];
    const trail = original.match(/\s*$/)[0];
    return lead + translated + trail;
  }

  function translateLine(trimmed) {
    if (Object.prototype.hasOwnProperty.call(EN, trimmed)) return EN[trimmed];
    for (const [pattern, replacement] of PATTERNS) {
      if (pattern.test(trimmed)) return trimmed.replace(pattern, replacement);
    }
    return trimmed;
  }

  function translate(value) {
    if (language !== 'en') return value;
    const original = String(value == null ? '' : value);
    const trimmed = original.trim();
    if (!trimmed) return original;

    if (original.includes('\n')) {
      let changed = false;
      const translatedLines = original.split('\n').map((line) => {
        const text = line.trim();
        if (!text) return line;
        const translated = translateLine(text);
        if (translated !== text) changed = true;
        return preserve(line, translated);
      });
      if (changed) return translatedLines.join('\n');
    }

    return preserve(original, translateLine(trimmed));
  }

  function localizeTweak(tweak) {
    if (!tweak) return tweak;
    return {
      ...tweak,
      name: translate(tweak.name),
      desc: translate(tweak.desc),
    };
  }

  function localizeCatalog(data) {
    if (!data) return data;
    return {
      ...data,
      categories: Array.isArray(data.categories)
        ? data.categories.map((category) => ({ ...category, name: translate(category.name) }))
        : data.categories,
      tweaks: Array.isArray(data.tweaks) ? data.tweaks.map(localizeTweak) : data.tweaks,
    };
  }

  function localizeTargets(targets) {
    return Array.isArray(targets)
      ? targets.map((target) => ({
          ...target,
          name: translate(target.name),
          desc: translate(target.desc),
        }))
      : targets;
  }

  const ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'data-tip', 'alt'];

  function translateElementAttributes(element) {
    if (!(element instanceof Element)) return;
    for (const attribute of ATTRIBUTES) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translate(current);
      if (next !== current) element.setAttribute(attribute, next);
    }
  }

  function apply(root) {
    if (language !== 'en' || !root) return;
    const scope = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!scope) return;

    if (scope instanceof Element) translateElementAttributes(scope);
    scope.querySelectorAll?.('*').forEach(translateElementAttributes);

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|TEXTAREA)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      const next = translate(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      node = walker.nextNode();
    }
  }

  function init() {
    document.documentElement.lang = language === 'en' ? 'en' : 'pt-PT';
    apply(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          apply(mutation.target);
          continue;
        }
        if (mutation.type === 'attributes') {
          translateElementAttributes(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) apply(node);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
  }

  OTZ.i18n = {
    lang: language,
    t: translate,
    translate,
    localizeTweak,
    localizeCatalog,
    localizeTargets,
    apply,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
