export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
  sidebar: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarRing: string
}

export interface ThemeDefinition {
  id: string
  nome: string
  descricao: string
  previewColors: [string, string, string]
  cores: ThemeColors
  backgroundImage?: string
  backgroundOpacity?: number
  backgroundSize?: string
  backgroundRepeat?: string
  backgroundMask?: string
  scrollbarTrack?: string
  scrollbarThumb?: string
  scrollbarThumbHover?: string
}

const TEMA_PADRAO: ThemeDefinition = {
  id: 'padrao',
  nome: 'Padrão',
  descricao: 'Tema escuro clássico',
  previewColors: ['#000000', '#111111', '#ffffff'],
  cores: {
    background: '#000000',
    foreground: '#e5e5e5',
    card: '#0a0a0a',
    cardForeground: '#e5e5e5',
    popover: '#0a0a0a',
    popoverForeground: '#e5e5e5',
    primary: '#ffffff',
    primaryForeground: '#000000',
    secondary: '#111111',
    secondaryForeground: '#e5e5e5',
    muted: '#171717',
    mutedForeground: '#737373',
    accent: '#ffffff',
    accentForeground: '#000000',
    destructive: '#ff4444',
    destructiveForeground: '#ffffff',
    border: '#1a1a1a',
    input: '#1a1a1a',
    ring: '#ffffff',
    sidebar: '#050505',
    sidebarForeground: '#e5e5e5',
    sidebarPrimary: '#ffffff',
    sidebarPrimaryForeground: '#000000',
    sidebarAccent: '#111111',
    sidebarAccentForeground: '#e5e5e5',
    sidebarBorder: '#1a1a1a',
    sidebarRing: '#ffffff',
  },
}

const TEMA_HELLO_KITTY: ThemeDefinition = {
  id: 'hello-kitty',
  nome: 'Hello Kitty',
  descricao: 'Rosa fofo com decorações da Hello Kitty',
  previewColors: ['#1a0a10', '#ff6b9d', '#ffb3d1'],
  cores: {
    background: '#0d0608',
    foreground: '#f5e6ec',
    card: '#150a0f',
    cardForeground: '#f5e6ec',
    popover: '#150a0f',
    popoverForeground: '#f5e6ec',
    primary: '#ff6b9d',
    primaryForeground: '#1a0a10',
    secondary: '#1f0e15',
    secondaryForeground: '#f5e6ec',
    muted: '#1a0c12',
    mutedForeground: '#b87a94',
    accent: '#ff6b9d',
    accentForeground: '#1a0a10',
    destructive: '#ff4466',
    destructiveForeground: '#ffffff',
    border: '#2a1520',
    input: '#2a1520',
    ring: '#ff6b9d',
    sidebar: '#0a0507',
    sidebarForeground: '#f5e6ec',
    sidebarPrimary: '#ff6b9d',
    sidebarPrimaryForeground: '#1a0a10',
    sidebarAccent: '#1f0e15',
    sidebarAccentForeground: '#f5e6ec',
    sidebarBorder: '#2a1520',
    sidebarRing: '#ff6b9d',
  },
  backgroundImage: '/themes/hellokittybg.jpg',
  backgroundOpacity: 0.18,
  backgroundSize: 'cover',
  backgroundRepeat: 'no-repeat',
  backgroundMask: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 90%)',
  scrollbarTrack: '#150a0f',
  scrollbarThumb: '#2a1520',
  scrollbarThumbHover: '#3d1f30',
}

const TEMA_CYBERPUNK: ThemeDefinition = {
  id: 'cyberpunk',
  nome: 'Cyberpunk',
  descricao: 'Neon com visual futurista',
  previewColors: ['#0a0a14', '#00ffcc', '#ff0066'],
  cores: {
    background: '#05050d',
    foreground: '#e0f0ef',
    card: '#0a0a16',
    cardForeground: '#e0f0ef',
    popover: '#0a0a16',
    popoverForeground: '#e0f0ef',
    primary: '#00ffcc',
    primaryForeground: '#050d0b',
    secondary: '#0f0f1e',
    secondaryForeground: '#e0f0ef',
    muted: '#12122a',
    mutedForeground: '#6b8a85',
    accent: '#00ffcc',
    accentForeground: '#050d0b',
    destructive: '#ff0066',
    destructiveForeground: '#ffffff',
    border: '#1a1a35',
    input: '#1a1a35',
    ring: '#00ffcc',
    sidebar: '#040410',
    sidebarForeground: '#e0f0ef',
    sidebarPrimary: '#00ffcc',
    sidebarPrimaryForeground: '#050d0b',
    sidebarAccent: '#0f0f1e',
    sidebarAccentForeground: '#e0f0ef',
    sidebarBorder: '#1a1a35',
    sidebarRing: '#00ffcc',
  },
  scrollbarTrack: '#0a0a16',
  scrollbarThumb: '#1a1a35',
  scrollbarThumbHover: '#2a2a4a',
}

const TEMA_DRACULA: ThemeDefinition = {
  id: 'dracula',
  nome: 'Dracula',
  descricao: 'Tema escuro roxo clássico',
  previewColors: ['#282a36', '#bd93f9', '#ff79c6'],
  cores: {
    background: '#1a1b26',
    foreground: '#f8f8f2',
    card: '#21222e',
    cardForeground: '#f8f8f2',
    popover: '#21222e',
    popoverForeground: '#f8f8f2',
    primary: '#bd93f9',
    primaryForeground: '#1a1b26',
    secondary: '#282a36',
    secondaryForeground: '#f8f8f2',
    muted: '#2a2c3a',
    mutedForeground: '#6272a4',
    accent: '#bd93f9',
    accentForeground: '#1a1b26',
    destructive: '#ff5555',
    destructiveForeground: '#f8f8f2',
    border: '#343746',
    input: '#343746',
    ring: '#bd93f9',
    sidebar: '#171822',
    sidebarForeground: '#f8f8f2',
    sidebarPrimary: '#bd93f9',
    sidebarPrimaryForeground: '#1a1b26',
    sidebarAccent: '#282a36',
    sidebarAccentForeground: '#f8f8f2',
    sidebarBorder: '#343746',
    sidebarRing: '#bd93f9',
  },
  scrollbarTrack: '#21222e',
  scrollbarThumb: '#343746',
  scrollbarThumbHover: '#44475a',
}

export const TEMAS: ThemeDefinition[] = [
  TEMA_PADRAO,
  TEMA_HELLO_KITTY,
  TEMA_CYBERPUNK,
  TEMA_DRACULA,
]

export function getTema(id: string): ThemeDefinition | undefined {
  return TEMAS.find((t) => t.id === id)
}
