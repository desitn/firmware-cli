/**
 * Dove TUI - Interactive Terminal UI
 */

import { findWorkspacePath, loadConfig } from '../utils';
import { compileFirmware } from '../compile';
import { flashFirmware } from '../flash';
import { listFirmware } from '../list';

let currentView = 'main';
let selectedMenu = 0;
let outputBuffer: string[] = [];
let isExecuting = false;

const menuItems = [
  { label: 'Build Firmware', action: 'build' },
  { label: 'Flash Firmware', action: 'flash' },
  { label: 'List Firmware', action: 'list' },
  { label: 'List Ports', action: 'ports' },
  { label: 'Show Config', action: 'config' },
  { label: 'Quit', action: 'quit' },
];

function renderScreen(): void {
  process.stdout.write('\x1b[?25l'); // Hide cursor
  process.stdout.write('\x1b[2J\x1b[H'); // Clear screen

  const workspace = findWorkspacePath() || 'not found';
  const config = loadConfig() || {};

  let lines: string[] = [];

  // Header
  lines.push('\x1b[36m┌──────────────────────────────────────────────┐\x1b[0m');
  lines.push('\x1b[36m│\x1b[0m \x1b[1m\x1b[36m🕊 Dove TUI\x1b[0m                             \x1b[36m│\x1b[0m');
  lines.push('\x1b[36m└──────────────────────────────────────────────┘\x1b[0m');
  lines.push('');

  if (currentView === 'main') {
    lines.push('\x1b[1mWhat would you like to do?\x1b[0m');
    lines.push('');

    menuItems.forEach((item, i) => {
      const isSelected = i === selectedMenu;
      const prefix = isSelected ? '\x1b[36m▶\x1b[0m ' : '  ';
      const color = isSelected ? '\x1b[1m\x1b[36m' : '';
      const reset = isSelected ? '\x1b[0m' : '\x1b[0m';
      lines.push(`${prefix}${color}${i + 1}. ${item.label}${reset}`);
    });

    lines.push('');
    lines.push('\x1b[2m↑/↓ navigate | Enter select | Q quit\x1b[0m');
  } else if (currentView === 'build') {
    lines.push('\x1b[1m\x1b[36mBuild Commands\x1b[0m');
    lines.push('');
    const commands = config.buildCommands || [];
    if (commands.length === 0) {
      lines.push('\x1b[2mNo build commands configured\x1b[0m');
    } else {
      commands.forEach((cmd) => {
        const activeMark = cmd.isActive ? '\x1b[32m●\x1b[0m' : '○';
        lines.push(`${activeMark} ${cmd.name}: ${cmd.command}`);
      });
    }
    lines.push('');
    lines.push('\x1b[2m[Esc] back to menu\x1b[0m');
  } else if (currentView === 'list') {
    lines.push('\x1b[1m\x1b[36mFirmware List\x1b[0m');
    lines.push('');
    if (outputBuffer.length > 0) {
      outputBuffer.slice(-8).forEach(line => {
        lines.push(line);
      });
    } else {
      lines.push('\x1b[2mPress Enter to list firmware files\x1b[0m');
    }
    lines.push('');
    lines.push('\x1b[2m[Esc] back to menu\x1b[0m');
  } else if (currentView === 'ports') {
    lines.push('\x1b[1m\x1b[36mSerial Ports\x1b[0m');
    lines.push('');
    const comPorts = config.comPorts || [];
    if (comPorts.length > 0) {
      comPorts.forEach(port => {
        const activeMark = port.isActive ? '\x1b[32m●\x1b[0m' : '○';
        const tags = port.tags ? ` [${port.tags.join(', ')}]` : '';
        lines.push(`${activeMark} ${port.port}${tags}`);
      });
    } else {
      lines.push('\x1b[2mNo COM ports configured\x1b[0m');
    }
    if (config.defaultComPort) {
      lines.push(`\x1b[2mDefault: ${config.defaultComPort}\x1b[0m`);
    }
    lines.push('');
    lines.push('\x1b[2m[Esc] back to menu\x1b[0m');
  } else if (currentView === 'flash') {
    lines.push('\x1b[1m\x1b[36mFlash Firmware\x1b[0m');
    lines.push('');
    if (isExecuting) {
      lines.push('\x1b[33m⏳ Flashing...\x1b[0m');
    } else {
      lines.push('Auto-find and flash firmware');
    }
    lines.push('');
    lines.push('\x1b[2m[Esc] back to menu\x1b[0m');
  } else if (currentView === 'config') {
    lines.push('\x1b[1m\x1b[36mConfiguration\x1b[0m');
    lines.push('');
    lines.push(`Firmware Path: ${config.firmwarePath || '\x1b[2m(not set)\x1b[0m'}`);
    lines.push(`Git Bash Path: ${config.buildGitBashPath || '\x1b[2m(not set)\x1b[0m'}`);
    lines.push(`Default COM: ${config.defaultComPort || '\x1b[2m(not set)\x1b[0m'}`);
    lines.push('');
    lines.push('\x1b[2m[Esc] back to menu\x1b[0m');
  } else if (currentView === 'output') {
    lines.push('\x1b[1m\x1b[36mOutput\x1b[0m');
    lines.push('');
    outputBuffer.slice(-10).forEach(line => {
      lines.push(line);
    });
    lines.push('');
    lines.push('\x1b[2m[Esc] back to menu\x1b[0m');
  }

  // Status bar
  lines.push('');
  lines.push('\x1b[36m──────────────────────────────────────────────\x1b[0m');
  lines.push(`\x1b[2mWorkspace: ${workspace}\x1b[0m`);

  // Output
  lines.forEach((line, idx) => {
    process.stdout.write(`\x1b[${idx + 1}H${line}`);
  });
}

export async function startTUI(): Promise<void> {
  renderScreen();

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on('data', async (data: Buffer) => {
      const input = data.toString();

      // Global: Exit
      if (input === '\x03' || input === '\x1b' || (input === 'q' && currentView === 'main')) {
        if (input === '\x1b' && currentView !== 'main') {
          currentView = 'main';
          renderScreen();
          return;
        }
        if (input === '\x1b' && currentView === 'main') {
          // Esc on main - could show confirm, but just exit for simplicity
        }
        if (input === '\x03' || (input === 'q' && currentView === 'main') || (input === '\x1b' && currentView === 'main')) {
          process.stdout.write('\x1b[?25h\x1b[2J\x1b[H');
          process.exit(0);
        }
      }

      // Navigation
      if (currentView === 'main') {
        if (input === '\x1b[A') { // Up
          selectedMenu = Math.max(0, selectedMenu - 1);
          renderScreen();
        } else if (input === '\x1b[B') { // Down
          selectedMenu = Math.min(menuItems.length - 1, selectedMenu + 1);
          renderScreen();
        } else if (input === '\r' || input === '\n') { // Enter
          const item = menuItems[selectedMenu];
          if (item.action === 'quit') {
            process.stdout.write('\x1b[?25h\x1b[2J\x1b[H');
            process.exit(0);
          } else {
            currentView = item.action;
            if (item.action === 'build' || item.action === 'flash') {
              // Execute action
              isExecuting = true;
              renderScreen();
              try {
                if (item.action === 'build') {
                  await compileFirmware(null);
                } else if (item.action === 'flash') {
                  await flashFirmware(null);
                }
              } catch (err) {
                outputBuffer.push(`\x1b[31mError: ${(err as Error).message}\x1b[0m`);
              }
              isExecuting = false;
              currentView = 'main';
              renderScreen();
            } else if (item.action === 'list') {
              // List firmware
              renderScreen();
              try {
                const result = await listFirmware({ returnResult: true }) as string;
                outputBuffer = result.split('\n').map(line => `\x1b[2m${line}\x1b[0m`);
              } catch (err) {
                outputBuffer = [`\x1b[31mError: ${(err as Error).message}\x1b[0m`];
              }
              renderScreen();
            } else if (item.action === 'ports') {
              // List ports - already shown in view
              renderScreen();
            }
            renderScreen();
          }
        } else if (input >= '1' && input <= '6') {
          // Number keys
          const idx = parseInt(input) - 1;
          if (idx >= 0 && idx < menuItems.length) {
            selectedMenu = idx;
            const item = menuItems[idx];
            if (item.action === 'quit') {
              process.stdout.write('\x1b[?25h\x1b[2J\x1b[H');
              process.exit(0);
            } else {
              currentView = item.action;
              // Also execute for list action
              if (item.action === 'list') {
                renderScreen();
                try {
                  const result = await listFirmware({ returnResult: true }) as string;
                  outputBuffer = result.split('\n').map(line => `\x1b[2m${line}\x1b[0m`);
                } catch (err) {
                  outputBuffer = [`\x1b[31mError: ${(err as Error).message}\x1b[0m`];
                }
              }
              renderScreen();
            }
          }
        }
      }
    });
  }

  // Keep running
  await new Promise(() => {});
}