/**
 * Simple TUI renderer - renders to terminal output
 */

import React from 'react';
import { colors, cursor, colorText } from './ansi';

interface ElementProps {
  children?: React.ReactNode;
  padding?: number;
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginY?: number;
  borderStyle?: 'single' | 'double';
  borderColor?: keyof typeof colors;
  color?: keyof typeof colors;
  bold?: boolean;
  dimColor?: boolean;
  value?: string;
  flexDirection?: 'row' | 'column';
}

interface RenderContext {
  lines: string[];
  width: number;
  height: number;
  offsetY: number;
}

function measureText(text: string): { width: number; height: number } {
  const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
  const lines = cleanText.split('\n');
  return {
    width: Math.max(...lines.map(l => l.length), 0),
    height: lines.length,
  };
}

function ensureLine(ctx: RenderContext, y: number): void {
  while (ctx.lines.length <= y) {
    ctx.lines.push('');
  }
}

function renderElement(element: React.ReactElement, ctx: RenderContext, x: number, y: number): number {
  const props: ElementProps = element.props || {};
  const type = element.type as string;

  // Get children
  const children = React.Children.toArray(props.children);

  // Handle Box (container)
  if (type === 'box') {
    const padding = props.padding || 0;
    const marginTop = props.marginTop ?? props.marginY ?? props.margin ?? 0;
    const marginBottom = props.marginBottom ?? props.marginY ?? props.margin ?? 0;

    let startY = y + marginTop + ctx.offsetY;
    let currentY = startY;

    // Render border if specified
    if (props.borderStyle) {
      const borderChars = {
        single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
        double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      };
      const b = borderChars[props.borderStyle] || borderChars.single;

      // Calculate content dimensions
      let maxWidth = 0;
      let totalHeight = 0;
      children.forEach(child => {
        if (typeof child === 'string' || typeof child === 'number') {
          const m = measureText(String(child));
          maxWidth = Math.max(maxWidth, m.width);
          totalHeight += m.height;
        } else if (React.isValidElement(child)) {
          // Estimate - will be updated during render
          totalHeight += 1;
        }
      });

      const boxWidth = maxWidth + padding * 2 + 2; // +2 for borders
      const boxHeight = totalHeight + padding * 2 + 2; // +2 for borders

      // Top border
      ensureLine(ctx, startY);
      const topLine = b.h.repeat(boxWidth);
      const coloredTop = props.borderColor ? colorText(b.tl + topLine + b.tr, props.borderColor) : b.tl + topLine + b.tr;
      ctx.lines[startY] = ' '.repeat(x) + coloredTop;

      // Side borders and content
      currentY = startY + 1;
      const innerY = currentY + padding;

      // Render children inside
      let childOffsetX = x + 1 + padding;
      children.forEach(child => {
        if (typeof child === 'string' || typeof child === 'number') {
          ensureLine(ctx, innerY);
          const sideLeft = props.borderColor ? colorText(b.v, props.borderColor) : b.v;
          const sideRight = props.borderColor ? colorText(b.v, props.borderColor) : b.v;
          ctx.lines[innerY] = ' '.repeat(x) + sideLeft + ' '.repeat(padding) + String(child) + ' '.repeat(padding) + sideRight;
          currentY++;
        } else if (React.isValidElement(child)) {
          renderElement(child, ctx, childOffsetX, innerY);
          currentY++;
        }
      });

      // Bottom border
      ensureLine(ctx, startY + boxHeight - 1);
      const bottomLine = b.h.repeat(boxWidth);
      const coloredBottom = props.borderColor ? colorText(b.bl + bottomLine + b.br, props.borderColor) : b.bl + bottomLine + b.br;
      ctx.lines[startY + boxHeight - 1] = ' '.repeat(x) + coloredBottom;

      return startY + boxHeight + marginBottom;
    }

    // No border - render children directly
    children.forEach(child => {
      if (typeof child === 'string' || typeof child === 'number') {
        ensureLine(ctx, currentY);
        ctx.lines[currentY] = ' '.repeat(x + padding) + String(child);
        currentY++;
      } else if (React.isValidElement(child)) {
        currentY = renderElement(child, ctx, x + padding, currentY);
      }
    });

    return currentY + marginBottom;
  }

  // Handle Text
  if (type === 'text') {
    ensureLine(ctx, y);

    let styledText = '';
    children.forEach(child => {
      if (typeof child === 'string' || typeof child === 'number') {
        let text = String(child);
        if (props.color) text = colorText(text, props.color);
        if (props.bold) text = colors.bold + text + colors.reset;
        if (props.dimColor) text = colors.dim + text + colors.reset;
        styledText += text;
      }
    });

    ctx.lines[y] = ' '.repeat(x) + styledText;
    return y + 1;
  }

  // Unknown type - render children
  children.forEach(child => {
    if (typeof child === 'string' || typeof child === 'number') {
      ensureLine(ctx, y);
      ctx.lines[y] = ' '.repeat(x) + String(child);
      y++;
    } else if (React.isValidElement(child)) {
      y = renderElement(child, ctx, x, y);
    }
  });

  return y;
}

let renderInterval: NodeJS.Timeout | null = null;
let exitResolve: (() => void) | null = null;
let renderedOnce = false;

export function render(app: React.ReactElement): { waitUntilExit: () => Promise<void> } {
  const exitPromise = new Promise<void>(resolve => { exitResolve = resolve; });

  // Hide cursor
  process.stdout.write(cursor.hide);

  // Render function
  function renderFrame() {
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;

    const ctx: RenderContext = {
      lines: [],
      width,
      height,
      offsetY: 0,
    };

    renderElement(app, ctx, 0, 0);

    // Only render if we have content
    if (ctx.lines.length > 0) {
      // Clear screen once, then update lines
      if (!renderedOnce) {
        process.stdout.write(cursor.clear);
        renderedOnce = true;
      }

      // Output each line
      ctx.lines.forEach((line, i) => {
        process.stdout.write(cursor.to(1, i + 1) + line + colors.reset);
      });
    }
  }

  // Initial render
  renderFrame();

  // Render interval for updates
  renderInterval = setInterval(renderFrame, 200);

  // Handle resize
  process.stdout.on('resize', renderFrame);

  // Exit cleanup
  function cleanup() {
    if (renderInterval) {
      clearInterval(renderInterval);
      renderInterval = null;
    }
    process.stdout.write(cursor.show);
    process.stdout.write(cursor.clear);
    if (exitResolve) {
      exitResolve();
      exitResolve = null;
    }
  }

  // Handle process exit
  process.on('exit', cleanup);

  return {
    waitUntilExit: () => exitPromise,
  };
}