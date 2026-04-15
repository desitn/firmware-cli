/**
 * Simple stdin input handler
 */

import { useEffect, useCallback, useRef } from 'react';

export interface Key {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  return: boolean;
  escape: boolean;
  tab: boolean;
  backspace: boolean;
  ctrl: boolean;
}

function parseKey(input: string): Key {
  return {
    upArrow: input === '\x1b[A' || input === '\x1bOA',
    downArrow: input === '\x1b[B' || input === '\x1bOB',
    leftArrow: input === '\x1b[D' || input === '\x1bOD',
    rightArrow: input === '\x1b[C' || input === '\x1bOC',
    return: input === '\r' || input === '\n',
    escape: input === '\x1b',
    tab: input === '\t',
    backspace: input === '\x7f' || input === '\x08',
    ctrl: input.length === 1 && input.charCodeAt(0) < 32,
  };
}

let rawMode = false;
let listeners: Set<(input: string, key: Key) => void> = new Set();

function setupStdin(): void {
  if (!process.stdin.isTTY) return;

  if (!rawMode) {
    rawMode = true;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on('data', (data: Buffer) => {
      const input = data.toString();
      // Ctrl+C - just pass to listeners, let app handle exit
      const key = parseKey(input);
      listeners.forEach(l => l(input, key));
    });
  }
}

function teardownStdin(): void {
  if (rawMode && process.stdin.isTTY) {
    rawMode = false;
    process.stdin.setRawMode(false);
    process.stdin.pause();
    listeners.clear();
  }
}

export function useInput(handler: (input: string, key: Key) => void, options: { isActive?: boolean } = {}) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (options.isActive === false) return;

    setupStdin();

    const listener = (input: string, key: Key) => savedHandler.current(input, key);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, [options.isActive]);
}

export function useApp() {
  const exit = useCallback(() => {
    teardownStdin();
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.stdout.write('\x1b[2J\x1b[H'); // Clear screen and go home
    process.exit(0);
  }, []);

  return { exit };
}