'use strict';

/**
 * Catalogo de tweaks.
 *
 * Cada entrada é declarativa: valores de registo (aplicado / revertido) e,
 * quando necessario, comandos PowerShell extra. O estado é lido numa unica
 * chamada ao PowerShell para manter a UI instantanea.
 */

const { ps, psJson, quote } = require('./ps');

const CATEGORIES = [
  { id: 'desempenho', name: 'Desempenho' },
  { id: 'gaming', name: 'Gaming' },
  { id: 'privacidade', name: 'Privacidade' },
  { id: 'sistema', name: 'Sistema' },
];

const TWEAKS = [
  {
    id: 'visual-effects',
    category: 'desempenho',
    name: 'Efeitos visuais leves',
    desc: 'Remove animacoes, sombras e transparencias do Windows. Mais fluidez em maquinas modestas.',
    risk: 'seguro',
    recommended: true,
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects',
        name: 'VisualFXSetting',
        type: 'DWord',
        on: 2,
        off: 0,
      },
    ],
  },
  {
    id: 'menu-delay',
    category: 'desempenho',
    name: 'Menus instantaneos',
    desc: 'Elimina o atraso de 400 ms ao abrir menus do Explorador.',
    risk: 'seguro',
    recommended: true,
    reg: [{ hive: 'HKCU', path: 'Control Panel\\Desktop', name: 'MenuShowDelay', type: 'String', on: '0', off: '400' }],
  },
  {
    id: 'startup-delay',
    category: 'desempenho',
    name: 'Arranque sem atraso',
    desc: 'Remove o atraso artificial aplicado as apps de arranque.',
    risk: 'seguro',
    admin: true,
    recommended: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize',
        name: 'StartupDelayInMSec',
        type: 'DWord',
        on: 0,
        off: null,
      },
    ],
  },
  {
    id: 'bg-apps',
    category: 'desempenho',
    name: 'Apps em segundo plano',
    desc: 'Impede apps da Store de consumirem RAM e CPU fora de foco.',
    risk: 'seguro',
    recommended: true,
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications',
        name: 'GlobalUserDisabled',
        type: 'DWord',
        on: 1,
        off: 0,
      },
    ],
  },
  {
    id: 'hibernation',
    category: 'desempenho',
    name: 'Desativar hibernacao',
    desc: 'Liberta varios GB em disco (igual ao tamanho da RAM). O Fast Startup deixa de funcionar.',
    risk: 'moderado',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Control\\Power',
        name: 'HibernateEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
    cmdOn: ['powercfg -h off'],
    cmdOff: ['powercfg -h on'],
  },
  {
    id: 'ultimate-perf',
    category: 'desempenho',
    name: 'Plano Ultimate Performance',
    desc: 'Ativa o plano de energia de maximo desempenho da Microsoft.',
    risk: 'moderado',
    admin: true,
    probeCmd: `$g = 'e9a42b02-d5df-448d-aa00-03f14749eb61'; if ((powercfg /getactivescheme) -match $g) { 'ON' } else { 'OFF' }`,
    cmdOn: [
      `$g = 'e9a42b02-d5df-448d-aa00-03f14749eb61'`,
      `if (-not (powercfg /list | Select-String $g)) { powercfg -duplicatescheme $g | Out-Null }`,
      `powercfg /setactive $g`,
    ],
    cmdOff: ['powercfg /setactive SCHEME_BALANCED'],
  },
  {
    id: 'gamebar',
    category: 'gaming',
    name: 'Desativar Game Bar e captura',
    desc: 'Remove a gravacao em segundo plano do Xbox Game Bar, que custa FPS.',
    risk: 'seguro',
    recommended: true,
    reg: [
      { hive: 'HKCU', path: 'System\\GameConfigStore', name: 'GameDVR_Enabled', type: 'DWord', on: 0, off: 1 },
      { hive: 'HKCU', path: 'System\\GameConfigStore', name: 'GameDVR_FSEBehaviorMode', type: 'DWord', on: 2, off: 0 },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR',
        name: 'AppCaptureEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'game-mode',
    category: 'gaming',
    name: 'Game Mode ativo',
    desc: 'Da prioridade de CPU e GPU ao jogo em primeiro plano.',
    risk: 'seguro',
    reg: [
      { hive: 'HKCU', path: 'Software\\Microsoft\\GameBar', name: 'AutoGameModeEnabled', type: 'DWord', on: 1, off: null },
      { hive: 'HKCU', path: 'Software\\Microsoft\\GameBar', name: 'AllowAutoGameMode', type: 'DWord', on: 1, off: null },
    ],
  },
  {
    id: 'mouse-accel',
    category: 'gaming',
    name: 'Sem aceleracao do rato',
    desc: 'Movimento 1:1 — melhora a precisao em shooters.',
    risk: 'seguro',
    reg: [
      { hive: 'HKCU', path: 'Control Panel\\Mouse', name: 'MouseSpeed', type: 'String', on: '0', off: '1' },
      { hive: 'HKCU', path: 'Control Panel\\Mouse', name: 'MouseThreshold1', type: 'String', on: '0', off: '6' },
      { hive: 'HKCU', path: 'Control Panel\\Mouse', name: 'MouseThreshold2', type: 'String', on: '0', off: '10' },
    ],
  },
  {
    id: 'multimedia-profile',
    category: 'gaming',
    name: 'Prioridade multimedia',
    desc: 'Remove o throttling de rede para jogos e baixa a reserva de CPU do sistema.',
    risk: 'moderado',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
        name: 'NetworkThrottlingIndex',
        type: 'DWord',
        on: -1,
        off: 10,
      },
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
        name: 'SystemResponsiveness',
        type: 'DWord',
        on: 10,
        off: 20,
      },
    ],
  },
  {
    id: 'gpu-scheduling',
    category: 'gaming',
    name: 'Agendamento de GPU',
    desc: 'Ativa o hardware-accelerated GPU scheduling. Requer reiniciar.',
    risk: 'moderado',
    admin: true,
    restart: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
        name: 'HwSchMode',
        type: 'DWord',
        on: 2,
        off: 1,
      },
    ],
  },
  {
    id: 'telemetry',
    category: 'privacidade',
    name: 'Telemetria minima',
    desc: 'Reduz o envio de diagnosticos para a Microsoft ao nivel minimo.',
    risk: 'seguro',
    admin: true,
    recommended: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection',
        name: 'AllowTelemetry',
        type: 'DWord',
        on: 0,
        off: null,
      },
    ],
  },
  {
    id: 'diagtrack',
    category: 'privacidade',
    name: 'Desativar servico DiagTrack',
    desc: 'Desliga o servico de telemetria "Connected User Experiences". Requer reiniciar.',
    risk: 'moderado',
    admin: true,
    restart: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Services\\DiagTrack',
        name: 'Start',
        type: 'DWord',
        on: 4,
        off: 2,
      },
    ],
    cmdOn: ['Stop-Service DiagTrack -Force -ErrorAction SilentlyContinue'],
  },
  {
    id: 'tips',
    category: 'privacidade',
    name: 'Sem sugestoes e anuncios',
    desc: 'Remove sugestoes, dicas e apps promovidas no Menu Iniciar.',
    risk: 'seguro',
    recommended: true,
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager',
        name: 'SubscribedContent-338388Enabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager',
        name: 'SubscribedContent-338389Enabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager',
        name: 'SystemPaneSuggestionsEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager',
        name: 'SoftLandingEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'advertising-id',
    category: 'privacidade',
    name: 'Desativar ID de publicidade',
    desc: 'As apps deixam de usar o teu ID de publicidade para te rastrear.',
    risk: 'seguro',
    recommended: true,
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo',
        name: 'Enabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'cortana',
    category: 'privacidade',
    name: 'Desativar Cortana',
    desc: 'Bloqueia a assistente e a recolha de voz associada.',
    risk: 'seguro',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search',
        name: 'AllowCortana',
        type: 'DWord',
        on: 0,
        off: null,
      },
    ],
  },
  {
    id: 'long-paths',
    category: 'sistema',
    name: 'Caminhos longos',
    desc: 'Permite caminhos acima de 260 caracteres (compatibilidade com ferramentas modernas).',
    risk: 'seguro',
    admin: true,
    restart: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Control\\FileSystem',
        name: 'LongPathsEnabled',
        type: 'DWord',
        on: 1,
        off: 0,
      },
    ],
  },

  {
    id: 'keyboard-repeat',
    category: 'desempenho',
    name: 'Teclado responsivo',
    desc: 'Remove o atraso inicial das teclas. A escrita e os atalhos respondem de imediato.',
    risk: 'seguro',
    reg: [
      { hive: 'HKCU', path: 'Control Panel\\Keyboard', name: 'KeyboardDelay', type: 'String', on: '0', off: '1' },
    ],
  },
  {
    id: 'transparency',
    category: 'desempenho',
    name: 'Sem transparencias',
    desc: 'Desliga o efeito acrilico das janelas e do Menu Iniciar. Poupa GPU em portateis.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
        name: 'EnableTransparency',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'high-performance',
    category: 'desempenho',
    name: 'Plano Alto Desempenho',
    desc: 'Fixa o plano de energia Alto Desempenho, sem baixar a frequencia do CPU. Em portateis gasta mais bateria.',
    risk: 'moderado',
    admin: true,
    probeCmd: `$g = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'; if ((powercfg /getactivescheme) -match $g) { 'ON' } else { 'OFF' }`,
    cmdOn: ['powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'],
    cmdOff: ['powercfg /setactive SCHEME_BALANCED'],
  },
  {
    id: 'autoplay',
    category: 'privacidade',
    name: 'Bloquear autoplay',
    desc: 'Impede que pens USB, CDs e media arranquem sozinhos ao serem ligados.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\AutoplayHandlers',
        name: 'DisableAutoplay',
        type: 'DWord',
        on: 1,
        off: 0,
      },
    ],
  },
  {
    id: 'web-search',
    category: 'privacidade',
    name: 'Sem pesquisa web no Iniciar',
    desc: 'O Menu Iniciar deixa de enviar o que escreves para a pesquisa da Microsoft.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Search',
        name: 'BingSearchEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Search',
        name: 'CortanaConsent',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'edge-background',
    category: 'sistema',
    name: 'Edge sem segundo plano',
    desc: 'Impede o Edge de continuar a correr depois de fechares as janelas.',
    risk: 'seguro',
    reg: [
      { hive: 'HKCU', path: 'Software\\Microsoft\\Edge', name: 'BackgroundModeEnabled', type: 'DWord', on: 0, off: 1 },
      {
        hive: 'HKCU',
        path: 'Software\\Policies\\Microsoft\\Edge',
        name: 'BackgroundModeEnabled',
        type: 'DWord',
        on: 0,
        off: null,
      },
    ],
  },
  {
    id: 'widgets',
    category: 'desempenho',
    name: 'Sem Widgets no Windows',
    desc: 'Desliga o painel de widgets da barra de tarefas e reduz processos em segundo plano.',
    risk: 'seguro',
    recommended: true,
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        name: 'TaskbarDa',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'start-tracking',
    category: 'privacidade',
    name: 'Sem rastreio no Iniciar',
    desc: 'O Windows deixa de registar as apps que abres para personalizar sugestoes.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        name: 'Start_TrackProgs',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'mouse-hover',
    category: 'desempenho',
    name: 'Hover instantaneo',
    desc: 'Remove o atraso de 400 ms ao passar o rato por menus e barras.',
    risk: 'seguro',
    recommended: true,
    reg: [
      {
        hive: 'HKCU',
        path: 'Control Panel\\Mouse',
        name: 'MouseHoverTime',
        type: 'String',
        on: '0',
        off: '400',
      },
    ],
  },
  {
    id: 'remote-assist',
    category: 'privacidade',
    name: 'Sem Assistencia Remota',
    desc: 'Impede pedidos de assistencia remota nao solicitados.',
    risk: 'seguro',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Control\\Remote Assistance',
        name: 'fAllowToGetHelp',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'error-reporting',
    category: 'privacidade',
    name: 'Sem relatorios de erros',
    desc: 'Desativa o Windows Error Reporting e reduz trabalho em segundo plano.',
    risk: 'seguro',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting',
        name: 'Disabled',
        type: 'DWord',
        on: 1,
        off: 0,
      },
    ],
  },

  {
    id: 'taskbar-animations',
    category: 'desempenho',
    name: 'Sem animacoes na barra de tarefas',
    desc: 'Remove as animacoes de abertura e destaque da barra de tarefas.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        name: 'TaskbarAnimations',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'window-animations',
    category: 'desempenho',
    name: 'Janelas sem animacao',
    desc: 'Desliga a animacao ao minimizar, maximizar e restaurar janelas.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Control Panel\\Desktop\\WindowMetrics',
        name: 'MinAnimate',
        type: 'String',
        on: '0',
        off: '1',
      },
    ],
  },
  {
    id: 'aero-peek',
    category: 'desempenho',
    name: 'Sem Aero Peek',
    desc: 'Remove a pre-visualizacao do ambiente de trabalho ao passar na barra.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        name: 'DisablePreviewDesktop',
        type: 'DWord',
        on: 1,
        off: 0,
      },
    ],
  },
  {
    id: 'chat-taskbar',
    category: 'desempenho',
    name: 'Sem Chat na barra de tarefas',
    desc: 'Esconde o icone do Chat/Teams e impede o arranque do painel rapido.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        name: 'TaskbarMn',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'search-taskbar',
    category: 'desempenho',
    name: 'Sem caixa de pesquisa',
    desc: 'Esconde a pesquisa da barra de tarefas. A pesquisa do Iniciar continua disponivel.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Search',
        name: 'SearchboxTaskbarMode',
        type: 'DWord',
        on: 0,
        off: 2,
      },
    ],
  },
  {
    id: 'news-interests',
    category: 'desempenho',
    name: 'Sem noticias na barra',
    desc: 'Remove o painel de noticias e interesses da barra de tarefas (Windows 10).',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Feeds',
        name: 'ShellFeedsTaskbarViewMode',
        type: 'DWord',
        on: 2,
        off: 0,
      },
    ],
  },
  {
    id: 'lock-screen-ads',
    category: 'privacidade',
    name: 'Sem anuncios no ecra de bloqueio',
    desc: 'Remove as sugestoes e promocoes do Windows Spotlight no ecra de bloqueio.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager',
        name: 'RotatingLockScreenOverlayEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'settings-suggestions',
    category: 'privacidade',
    name: 'Sem sugestoes nas Definicoes',
    desc: 'Remove cartoes e sugestoes promovidas dentro das Definicoes do Windows.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager',
        name: 'SubscribedContent-338393Enabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'activity-history',
    category: 'privacidade',
    name: 'Sem historico de atividade',
    desc: 'Impede o Windows de publicar e enviar o historico de apps e ficheiros.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Privacy',
        name: 'PublishUserActivities',
        type: 'DWord',
        on: 0,
        off: 1,
      },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Privacy',
        name: 'UploadUserActivities',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'clipboard-sync',
    category: 'privacidade',
    name: 'Sem sincronizacao da area de transferencia',
    desc: 'O que copias deixa de ser enviado para a nuvem entre dispositivos.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Clipboard',
        name: 'CloudClipboardAutomaticUpload',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'tailored-experiences',
    category: 'privacidade',
    name: 'Sem experiencias personalizadas',
    desc: 'Impede a Microsoft de usar diagnosticos para personalizar dicas e anuncios.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Privacy',
        name: 'TailoredExperiencesWithDiagnosticDataEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'online-speech',
    category: 'privacidade',
    name: 'Sem reconhecimento de voz online',
    desc: 'Mantem o reconhecimento de voz local e evita o envio de audio para a Microsoft.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Speech_OneCore\\Settings\\OnlineSpeechPrivacy',
        name: 'HasAccepted',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'inking-personalization',
    category: 'privacidade',
    name: 'Sem personalizacao de escrita',
    desc: 'Desativa a recolha de tinta, texto e contactos para personalizar a escrita.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\InputPersonalization',
        name: 'RestrictImplicitInkCollection',
        type: 'DWord',
        on: 1,
        off: 0,
      },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\InputPersonalization',
        name: 'RestrictImplicitTextCollection',
        type: 'DWord',
        on: 1,
        off: 0,
      },
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\InputPersonalization',
        name: 'HarvestContacts',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'recent-files',
    category: 'privacidade',
    name: 'Sem ficheiros recentes',
    desc: 'O Menu Iniciar deixa de listar documentos e ficheiros abertos recentemente.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        name: 'Start_TrackDocs',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'copilot',
    category: 'privacidade',
    name: 'Desativar Copilot',
    desc: 'Remove o Copilot da barra de tarefas e impede o painel de arrancar (Windows 11).',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Policies\\Microsoft\\Windows\\WindowsCopilot',
        name: 'TurnOffWindowsCopilot',
        type: 'DWord',
        on: 1,
        off: 0,
      },
    ],
  },
  {
    id: 'edge-startup-boost',
    category: 'sistema',
    name: 'Edge sem arranque antecipado',
    desc: 'Impede o Edge de arrancar processos antes de abrires o browser.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Policies\\Microsoft\\Edge',
        name: 'StartupBoostEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'storage-sense',
    category: 'sistema',
    name: 'Desativar Sensor de Armazenamento',
    desc: 'Impede limpezas automaticas e remocao de ficheiros sem o teu controlo.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy',
        name: '01',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'xbox-tips',
    category: 'gaming',
    name: 'Sem dicas da Xbox Game Bar',
    desc: 'Remove o painel de boas-vindas e dicas da Game Bar ao abrir um jogo.',
    risk: 'seguro',
    reg: [
      {
        hive: 'HKCU',
        path: 'Software\\Microsoft\\GameBar',
        name: 'ShowStartupPanel',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'delivery-optimization',
    category: 'sistema',
    name: 'Windows Update sem P2P',
    desc: 'Impede o Windows de usar a largura de banda de outros PCs para atualizacoes.',
    risk: 'seguro',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization',
        name: 'DODownloadMode',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'fast-startup',
    category: 'desempenho',
    name: 'Desativar Fast Startup',
    desc: 'Forca um arranque limpo em vez de retomar o kernel antigo. Requer reiniciar.',
    risk: 'moderado',
    admin: true,
    restart: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
        name: 'HiberbootEnabled',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'smb1',
    category: 'sistema',
    name: 'Desativar SMB1 antigo',
    desc: 'Fecha o protocolo de partilha legado, alvo de ransomware. Pode quebrar NAS muito antigos.',
    risk: 'moderado',
    admin: true,
    restart: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters',
        name: 'SMB1',
        type: 'DWord',
        on: 0,
        off: 1,
      },
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters',
        name: 'SMB1',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },
  {
    id: 'llmnr',
    category: 'privacidade',
    name: 'Desativar LLMNR',
    desc: 'Impede respostas de nome multicast usadas para intercetar credenciais na rede local.',
    risk: 'seguro',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient',
        name: 'EnableMulticast',
        type: 'DWord',
        on: 0,
        off: 1,
      },
    ],
  },

  /* ---------------- Beta (Owner / testadores) ---------------- */

  {
    id: 'win32-priority',
    category: 'desempenho',
    beta: true,
    name: 'Prioridade de CPU para jogos',
    desc: 'Encurta os intervalos de CPU do Windows para dar resposta mais rapida ao que esta em primeiro plano.',
    risk: 'moderado',
    admin: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Control\\PriorityControl',
        name: 'Win32PrioritySeparation',
        type: 'DWord',
        on: 26,
        off: 2,
      },
    ],
  },
  {
    id: 'power-throttling',
    category: 'desempenho',
    beta: true,
    name: 'Desativar Power Throttling',
    desc: 'Impede o Windows de baixar a frequencia de apps em segundo plano. Em portateis gasta mais bateria.',
    risk: 'moderado',
    admin: true,
    restart: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling',
        name: 'PowerThrottlingOff',
        type: 'DWord',
        on: 1,
        off: 0,
      },
    ],
  },
  {
    id: 'mouse-queue',
    category: 'gaming',
    beta: true,
    name: 'Latencia do rato (fila curta)',
    desc: 'Reduz o buffer de eventos do rato de 100 para 20 pacotes. Requer reiniciar.',
    risk: 'moderado',
    admin: true,
    restart: true,
    reg: [
      {
        hive: 'HKLM',
        path: 'SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters',
        name: 'MouseDataQueueSize',
        type: 'DWord',
        on: 20,
        off: 100,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Estado                                                             */
/* ------------------------------------------------------------------ */

const BY_ID = new Map(TWEAKS.map((t) => [t.id, t]));

function buildStateScript() {
  const lines = ['$o = [ordered]@{}'];
  for (const tweak of TWEAKS) {
    (tweak.reg || []).forEach((entry, index) => {
      const key = `${tweak.id}|${index}`;
      lines.push(
        `$o['${key}'] = (Get-ItemProperty -LiteralPath '${quote(`${entry.hive}:\\${entry.path}`)}' -Name '${quote(
          entry.name
        )}' -ErrorAction SilentlyContinue).'${quote(entry.name)}'`
      );
    });
  }
  lines.push('$o | ConvertTo-Json -Compress');
  return lines.join('; ');
}

function valueMatches(actual, expected) {
  if (expected === null || expected === undefined) return actual === null || actual === undefined;
  if (typeof expected === 'number') return Number(actual) === expected;
  return String(actual) === String(expected);
}

/** Devolve o estado (aplicado ou nao) de todos os tweaks. */
async function getState() {
  const data = (await psJson(buildStateScript(), { timeout: 20000 })) || {};
  const state = {};

  for (const tweak of TWEAKS) {
    const entries = tweak.reg || [];
    if (entries.length) {
      const applied = entries.every((entry, index) => {
        const key = `${tweak.id}|${index}`;
        return valueMatches(data[key], entry.on);
      });
      state[tweak.id] = { applied, supported: true };
      continue;
    }

    if (tweak.probeCmd) {
      const probe = await ps(tweak.probeCmd, { timeout: 15000 });
      state[tweak.id] = { applied: probe.ok && probe.stdout.includes('ON'), supported: true };
      continue;
    }

    state[tweak.id] = { applied: false, supported: false };
  }

  return state;
}

/* ------------------------------------------------------------------ */
/* Aplicar / reverter                                                 */
/* ------------------------------------------------------------------ */

function buildRegScript(tweak, mode) {
  const lines = [];
  for (const entry of tweak.reg || []) {
    const raw = mode === 'on' ? entry.on : entry.off;
    const keyPath = `${entry.hive}:\\${entry.path}`;

    if (raw === null || raw === undefined) {
      lines.push(
        `Remove-ItemProperty -LiteralPath '${quote(keyPath)}' -Name '${quote(entry.name)}' -ErrorAction SilentlyContinue`
      );
      continue;
    }

    const literal = entry.type === 'String' ? `'${quote(String(raw))}'` : String(raw);
    lines.push(`if (-not (Test-Path -LiteralPath '${quote(keyPath)}')) { New-Item -Path '${quote(keyPath)}' -Force | Out-Null }`);
    lines.push(`Set-ItemProperty -LiteralPath '${quote(keyPath)}' -Name '${quote(entry.name)}' -Value ${literal} -Type ${entry.type}`);
  }

  const extra = (mode === 'on' ? tweak.cmdOn : tweak.cmdOff) || [];
  lines.push(...extra);
  return lines.join('; ');
}

/**
 * Aplica ou reverte um tweak.
 * @param {string} id
 * @param {'on'|'off'} mode
 */
async function setTweak(id, mode) {
  const tweak = BY_ID.get(id);
  if (!tweak) return { ok: false, message: 'Tweak desconhecido.' };

  const script = buildRegScript(tweak, mode);
  if (!script) return { ok: false, message: 'Este tweak nao tem acoes definidas.' };

  const result = await ps(script, { timeout: 45000 });
  if (!result.ok) {
    return { ok: false, message: cleanError(result.stderr), raw: result.stderr };
  }
  return { ok: true, restart: Boolean(tweak.restart), message: mode === 'on' ? 'Tweak aplicado.' : 'Tweak revertido.' };
}

function cleanError(text) {
  if (!text) return 'Nao foi possivel concluir a operacao.';
  if (/Access is denied|Acesso negado|UnauthorizedAccess/i.test(text)) {
    return 'Precisas de executar a app como administrador para este tweak.';
  }
  if (/The system cannot find the path/i.test(text)) {
    return 'Esta versao do Windows nao suporta este tweak.';
  }
  return text.split('\n')[0].slice(0, 240);
}

/** Catalogo publico (sem funcoes). */
function list() {
  return TWEAKS.map((tweak) => ({
    id: tweak.id,
    category: tweak.category,
    name: tweak.name,
    desc: tweak.desc,
    risk: tweak.risk,
    admin: Boolean(tweak.admin),
    restart: Boolean(tweak.restart),
    recommended: Boolean(tweak.recommended),
    beta: Boolean(tweak.beta),
  }));
}

module.exports = { list, getState, setTweak, CATEGORIES, TWEAKS };
