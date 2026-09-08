/**
 * APEX — Dynamic Accent Theme Engine
 * 
 * Manages the global secondary/accent theme color applied across the entire app
 * while keeping black (#050505 / #0c0c0c / #121212) as the primary base.
 */

export interface ThemeAccentConfig {
  id: string;
  label: string;
  hex: string;
}

export const THEME_ACCENT_PALETTES: ThemeAccentConfig[] = [
  { id: 'red', label: 'Apex Red', hex: '#E50914' },
  { id: 'orange', label: 'Papaya', hex: '#FF5722' },
  { id: 'gold', label: 'Gold Rush', hex: '#F59E0B' },
  { id: 'green', label: 'Nürburgring', hex: '#10B981' },
  { id: 'cyan', label: 'Riviera Cyan', hex: '#06B6D4' },
  { id: 'purple', label: 'Ultraviolet', hex: '#8B5CF6' },
  { id: 'carbon', label: 'Stealth Carbon', hex: '#71717A' }
];

/**
 * Converts a hex color string (#RRGGBB or #RGB) into RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace(/^#/, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) {
    return { r: 229, g: 9, b: 20 }; // Fallback to Apex Red
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Computes a slightly darker shade of a hex color for active/hover states.
 */
function darkenHex(r: number, g: number, b: number, factor = 0.85): string {
  const dr = Math.max(0, Math.floor(r * factor));
  const dg = Math.max(0, Math.floor(g * factor));
  const db = Math.max(0, Math.floor(b * factor));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

/**
 * Injects dynamic CSS variables on document.documentElement to immediately
 * restyle all accent elements throughout the application.
 */
export function applyAppTheme(hexColor: string): void {
  if (typeof document === 'undefined') return;

  const validHex = hexColor && hexColor.startsWith('#') ? hexColor : '#E50914';
  const { r, g, b } = hexToRgb(validHex);
  const hoverHex = darkenHex(r, g, b, 0.85);

  const root = document.documentElement;
  root.style.setProperty('--accent-color', validHex);
  root.style.setProperty('--accent-hover', hoverHex);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.4)`);
  root.style.setProperty('--accent-glow-strong', `rgba(${r}, ${g}, ${b}, 0.75)`);
  root.style.setProperty('--accent-subtle', `rgba(${r}, ${g}, ${b}, 0.12)`);
  root.style.setProperty('--accent-border', `rgba(${r}, ${g}, ${b}, 0.28)`);
}
