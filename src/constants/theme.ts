export const COLORS = {
  // Base Obsidian & Deep Space Theme
  background: '#080C15', // Deep Obsidian
  backgroundSecondary: '#0D131F', // Slightly lighter background
  surface: '#111827',    // Elevated card surface
  surfaceElevated: '#162032', // Higher elevation / hovered cards
  surfaceLight: '#1E293B', // Highlight surface / chips
  
  // Text Tokens
  text: '#F8FAFC',       // Crisp bright white
  textSecondary: '#CBD5E1', // Slate 300
  textMuted: '#64748B',  // Slate 500
  textSubtle: '#475569', // Slate 600
  
  // Neon Financial Accents
  primary: '#0284C7',    // Vibrant Sky Blue
  primaryGlow: 'rgba(2, 132, 199, 0.25)',
  cyan: '#00E5FF',       // Cyber Cyan Accent
  cyanBg: 'rgba(0, 229, 255, 0.12)',
  
  // Profit / Bullish (Emerald)
  success: '#10B981',
  profit: '#10B981',
  profitBg: 'rgba(16, 185, 129, 0.14)',
  profitBorder: 'rgba(16, 185, 129, 0.35)',
  buyBg: 'rgba(16, 185, 129, 0.15)',
  buyFg: '#34D399',
  
  // Loss / Bearish (Crimson Rose)
  danger: '#F43F5E',
  loss: '#F43F5E',
  lossBg: 'rgba(244, 63, 94, 0.14)',
  lossBorder: 'rgba(244, 63, 94, 0.35)',
  sellBg: 'rgba(244, 63, 94, 0.15)',
  sellFg: '#FB7185',
  
  // Warning / Neutral / Hold (Gold Amber)
  warning: '#F59E0B',
  holdBg: 'rgba(245, 158, 11, 0.15)',
  holdFg: '#FBBF24',
  
  // Whale / Bandarmology / AI (Royal Purple)
  whale: '#A855F7',
  whaleBg: 'rgba(168, 85, 247, 0.15)',
  whaleBorder: 'rgba(168, 85, 247, 0.35)',
  
  // Borders & Dividers
  border: '#1E293B',
  borderLight: '#334155',
  borderGlass: 'rgba(255, 255, 255, 0.08)',
};

export const SIZES = {
  base: 8,
  font: 14,
  radius: 12,
  radiusSm: 8,
  radiusLg: 16,
  padding: 16,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  glowPrimary: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  glowSuccess: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
};
