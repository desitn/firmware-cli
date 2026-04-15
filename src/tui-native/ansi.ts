/**
 * ANSI escape codes
 */

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

export const cursor = {
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  clear: '\x1b[2J',
  clearLine: '\x1b[2K',
  to: (x: number, y: number) => `\x1b[${y};${x}H`,
};

export function colorText(text: string, color: keyof typeof colors): string {
  return colors[color] + text + colors.reset;
}