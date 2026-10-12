/**
 * Catppuccin Mocha-inspired 256-color theme for backend pipeline logs.
 * Honors NO_COLOR, FORCE_COLOR, and TTY.
 */
const RESET = '\x1b[0m';

const palette = {
  mauve: 183,
  blue: 111,
  sky: 117,
  green: 151,
  red: 211,
  overlay: 243,
} as const;

function colorEnabled(stream: NodeJS.WriteStream): boolean {
  const force = process.env.FORCE_COLOR;
  if (force === '0' || force === 'false') return false;
  if (force !== undefined && force !== '') return true;
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  if (typeof stream.hasColors === 'function') return stream.hasColors();
  return Boolean(stream.isTTY);
}

function paint(code: number, text: string, stream: NodeJS.WriteStream, extra = ''): string {
  if (!colorEnabled(stream)) return text;
  return `\x1b[${extra}38;5;${code}m${text}${RESET}`;
}

function out(code: number, text: string, extra = ''): string {
  return paint(code, text, process.stdout, extra);
}

function err(code: number, text: string, extra = ''): string {
  return paint(code, text, process.stderr, extra);
}

export const theme = {
  heading: (text: string) => out(palette.mauve, text, '1;'),
  info: (text: string) => out(palette.blue, text),
  path: (text: string) => out(palette.sky, text),
  muted: (text: string) => out(palette.overlay, text),
  success: (text: string) => out(palette.green, text),
  error: (text: string) => err(palette.red, text, '1;'),
};
