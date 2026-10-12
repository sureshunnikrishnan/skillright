/**
 * Catppuccin Mocha-inspired 256-color theme.
 * Honors NO_COLOR, FORCE_COLOR, and TTY (stdout for logs, stderr for errors).
 */
const RESET = '\x1b[0m';

const palette = {
  mauve: 183,
  blue: 111,
  sky: 117,
  teal: 116,
  green: 151,
  peach: 216,
  red: 211,
  yellow: 229,
  overlay: 243,
  subtext: 146,
  lavender: 147,
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
  label: (text: string) => out(palette.blue, text),
  value: (text: string) => out(palette.subtext, text),
  muted: (text: string) => out(palette.overlay, text),
  name: (text: string) => out(palette.teal, text, '1;'),
  path: (text: string) => out(palette.sky, text),
  hash: (text: string) => out(palette.lavender, text),
  tag: (text: string) => out(palette.mauve, text),
  count: (text: string) => out(palette.yellow, text),
  success: (text: string) => out(palette.green, text),
  warning: (text: string) => out(palette.peach, text),
  error: (text: string) => err(palette.red, text, '1;'),
  errorMuted: (text: string) => err(palette.overlay, text),
  errorName: (text: string) => err(palette.teal, text, '1;'),
  errorPath: (text: string) => err(palette.sky, text),
  command: (text: string) => out(palette.teal, text, '1;'),
  option: (text: string) => out(palette.blue, text),
  argument: (text: string) => out(palette.peach, text),
  prompt: (text: string) => err(palette.peach, text),
};

export function field(label: string, value: string, labelWidth = 14): string {
  const padded = label.padEnd(labelWidth);
  return `${theme.label(padded)}${theme.value(value)}`;
}

export function section(title: string): string {
  return theme.heading(title);
}

export function stdoutHasColors(): boolean {
  return colorEnabled(process.stdout);
}

export function stderrHasColors(): boolean {
  return colorEnabled(process.stderr);
}
