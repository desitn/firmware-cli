#!/usr/bin/env node

import { flashFirmware, listDevices } from './flash';
import { listFirmware } from './list';
import { compileFirmware, listBuildCommands, setConfig, showConfig } from './compile';
import { loadToolsConfig, loadConfig } from './utils';
import { showSerialList, openAndMonitorPort, sendATCommandCLI, findATPort } from './serial';
import type { MonitorOptions, CLIConfig } from './types';

// TUI is optional - dynamic import to avoid bundling issues
async function startTUI(): Promise<void> {
  const { startTUI: tui } = await import('./tui');
  await tui();
}

/**
 * Generate list of supported firmware types (read from JSON config)
 */
function generateSupportedTypes(): string {
  try {
    const config = loadToolsConfig();
    const platforms = config.platforms || {};

    const lines: string[] = [];
    for (const [key, platform] of Object.entries(platforms)) {
      const extensions = platform.extensions || [];
      const extStr = extensions.map(e => `*${e}`).join(', ');
      lines.push(`  - ${platform.description || key}: ${extStr}`);
    }

    return lines.join('\n') || '  - No config';
  } catch (error) {
    const err = error as Error;
    console.error('Config load error:', err.message);
    return '  - Config load failed';
  }
}

/**
 * Show help information
 */
function showHelp(): void {
  const supportedTypes = generateSupportedTypes();

  console.log(`
Dove Firmware Compilation and Flashing CLI Tool v1.0.0

Usage:
  dove.exe <command> [arguments]

Commands:
  tui                   Start interactive TUI mode
  build [options]       Compile firmware (outputs tool result directly)
    --list              List all available commands (JSON output)
    --index <n>         Run command by index (1-based)
    --name <name>       Run command by name
  build-and-flash       Compile and flash latest firmware
  flash [path] [options]  Flash firmware (auto-find or specify path)
    --list, -l          List available firmware files (JSON output)
    --skip-dl-mode, -s  Skip auto entering download mode
    --progress <mode>   Progress display mode (simple/detailed)
  port <subcommand>      Port operations
    list [options]      List ports (JSON output)
      --usb             List USB devices only
      --serial          List serial ports only
      --all             List both USB and serial ports
    monitor [options]   Monitor serial port
      -p, --port <port>   Serial port (e.g., COM9)
      --tag <tag>         Select port by tag (uses comPorts config)
      -b, --baud <rate>   Set baud rate (default 115200)
      -t, --timeout <ms>  Set timeout in milliseconds (default 0 = no timeout)
      -o, --output <file> Output to file
      -a, --append        Append to file (default overwrite)
      --include <keywords> Include keywords (comma separated)
      --exclude <keywords> Exclude keywords (comma separated)
      --until <text>      Exit after receiving this content
      --until-regex <pattern> Exit after regex match
      --lines <n>         Capture n lines then exit
      --json              Output results in JSON format
      --timestamp         Add timestamp to each line
    at [options]        Send AT command (JSON output)
      -c, --command <cmd> AT command to send (required)
      -p, --port <port>   Serial port (auto-detect if not specified)
      --tag <tag>         Select port by tag (uses comPorts config)
      -t, --timeout <ms>  Set timeout (default 5000)
      --platform <type>   Platform for auto-detect (default asr160x)
  config                Show current configuration (JSON output)
  config set <key> <value>  Set configuration item (JSON output)
  help                  Show help information

Examples:
  dove.exe build              # Run default build command
  dove.exe build --list       # List all build commands (JSON)
  dove.exe flash              # Flash firmware (auto-find)
  dove.exe flash --list       # List available firmware (JSON)
  dove.exe port list          # List all ports (JSON)
  dove.exe port list --serial # List serial ports only (JSON)
  dove.exe port monitor -p COM9
  dove.exe port monitor --tag Log --timeout 30000
  dove.exe port at -c "ATI"
  dove.exe port at -c "AT+CGMI" --json
  dove.exe config             # Show config (JSON)

Configuration file:
  dove.json (in project root directory)

Supported firmware types:
${supportedTypes}
`);
}

/**
 * Parse command line arguments for monitor command
 */
function parseMonitorArgs(args: string[]): { portPath: string; options: Partial<MonitorOptions> } {
  const getArgValue = (short: string | null, long: string): string | null => {
    const index = args.findIndex(arg => arg === short || arg === long);
    return index !== -1 ? args[index + 1] : null;
  };

  const hasFlag = (short: string | null, long: string): boolean => {
    return args.includes(short || '') || args.includes(long);
  };

  const getAvailableTags = (config: CLIConfig): string => {
    if (!config.comPorts || config.comPorts.length === 0) return 'none';
    const allTags = config.comPorts.flatMap(p => p.tags);
    return [...new Set(allTags)].join(', ');
  };

  let portPath = getArgValue('-p', '--port');
  let portSource = 'user_input';
  let tag = getArgValue(null, '--tag');

  if (!portPath) {
    const config = loadConfig() as CLIConfig;

    if (tag) {
      if (config.comPorts && config.comPorts.length > 0) {
        const portConfig = config.comPorts.find(p => p.tags.includes(tag));
        if (portConfig) {
          portPath = portConfig.port;
          portSource = 'config_tag';
        } else {
          throw new Error(`No port found with tag '${tag}'. Available tags: ${getAvailableTags(config)}`);
        }
      } else {
        throw new Error(`No comPorts configured in dove.json. Please configure ports with tags first.`);
      }
    }

    if (!portPath && config.defaultComPort) {
      portPath = config.defaultComPort;
      portSource = 'config_default';
    }

    if (!portPath && config.comPorts && config.comPorts.length > 0) {
      const activePort = config.comPorts.find(p => p.isActive);
      if (activePort) {
        portPath = activePort.port;
        portSource = 'config_active';
      }
    }
  }

  if (!portPath) {
    throw new Error('Please specify serial port with -p (e.g., -p COM9), or use --tag to select by tag, or configure defaultComPort in dove.json');
  }

  const monitorOptions: Partial<MonitorOptions> = {
    baudRate: parseInt(getArgValue('-b', '--baud') || '') || 115200,
    timeout: parseInt(getArgValue('-t', '--timeout') || '') || 0,
    output: getArgValue('-o', '--output') || undefined,
    append: hasFlag('-a', '--append'),
    include: getArgValue(null, '--include') || undefined,
    exclude: getArgValue(null, '--exclude') || undefined,
    until: getArgValue(null, '--until') || undefined,
    untilRegex: getArgValue(null, '--until-regex') ? new RegExp(getArgValue(null, '--until-regex') || '') : undefined,
    lines: parseInt(getArgValue(null, '--lines') || '') || 0,
    json: hasFlag(null, '--json'),
    timestamp: hasFlag(null, '--timestamp')
  };

  if (portSource !== 'user_input' && !monitorOptions.json) {
    if (portSource === 'config_tag') {
      console.log(`\nUsing port with tag '${tag}': ${portPath}\n`);
    } else if (portSource === 'config_active') {
      console.log(`\nUsing active port: ${portPath}\n`);
    } else {
      console.log(`\nUsing configured default serial port: ${portPath}\n`);
    }
  }

  return { portPath, options: monitorOptions };
}

/**
 * Parse command line arguments for AT command
 */
function parseATArgs(args: string[]): {
  portPath: string | null;
  command: string;
  timeout: number;
  platform: string;
  tag?: string;
} {
  const getArgValue = (short: string | null, long: string): string | null => {
    const index = args.findIndex(arg => arg === short || arg === long);
    return index !== -1 ? args[index + 1] : null;
  };

  const command = getArgValue('-c', '--command');
  if (!command) {
    throw new Error('AT command is required. Use -c or --command to specify (e.g., -c "ATI")');
  }

  const tag = getArgValue(null, '--tag');

  return {
    portPath: getArgValue('-p', '--port'),
    command,
    timeout: parseInt(getArgValue('-t', '--timeout') || '') || 5000,
    platform: getArgValue(null, '--platform') || 'asr160x',
    tag: tag || undefined
  };
}

/**
 * Handle port list command (JSON output)
 */
async function handlePortList(args: string[]): Promise<number> {
  const hasFlag = (flag: string): boolean => args.includes(flag);
  const showUsb = hasFlag('--usb');
  const showSerial = hasFlag('--serial');
  const showAll = hasFlag('--all');

  // Default to serial if no specific flag
  const listSerial = showAll || showSerial || (!showUsb && !showSerial && !showAll);
  const listUsb = showAll || showUsb;

  if (listUsb && listSerial) {
    // Combine both into single JSON output
    await listDevices({ json: true, returnResult: true });
    await showSerialList({ json: true });
  } else if (listUsb) {
    await listDevices({ json: true, returnResult: true });
  } else if (listSerial) {
    await showSerialList({ json: true });
  }

  return 0;
}

/**
 * Handle port monitor command
 */
async function handlePortMonitor(args: string[]): Promise<number> {
  const { portPath, options } = parseMonitorArgs(args);
  await openAndMonitorPort(portPath, options);
  return 0;
}

/**
 * Handle port at command (JSON output)
 */
async function handlePortAt(args: string[]): Promise<number> {
  const { portPath, command, timeout, platform, tag } = parseATArgs(args);

  let actualPortPath = portPath;

  if (!actualPortPath) {
    const config = loadConfig() as CLIConfig;

    if (tag) {
      if (config.comPorts && config.comPorts.length > 0) {
        const portConfig = config.comPorts.find(p => p.tags.includes(tag));
        if (portConfig) {
          actualPortPath = portConfig.port;
        } else {
          const allTags = config.comPorts.flatMap(p => p.tags);
          const uniqueTags = [...new Set(allTags)];
          throw new Error(`No port found with tag '${tag}'. Available tags: ${uniqueTags.join(', ')}`);
        }
      } else {
        throw new Error('No comPorts configured in dove.json. Please configure ports with tags first.');
      }
    }

    if (!actualPortPath) {
      const atPort = await findATPort(platform);
      if (atPort) actualPortPath = atPort.path;
    }

    if (!actualPortPath && config.defaultComPort) {
      actualPortPath = config.defaultComPort;
    }

    if (!actualPortPath && config.comPorts && config.comPorts.length > 0) {
      const activePort = config.comPorts.find(p => p.isActive);
      if (activePort) actualPortPath = activePort.port;
    }
  }

  if (!actualPortPath) {
    throw new Error('Please specify serial port with -p (e.g., -p COM9), or use --tag to select by tag, or use --platform to auto-detect AT port');
  }

  const result = await sendATCommandCLI(actualPortPath, command, timeout);
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

/**
 * Handle port subcommand
 */
async function handlePortCommand(subcommand: string, args: string[]): Promise<number> {
  switch (subcommand) {
    case 'list':
      return await handlePortList(args);
    case 'monitor':
      return await handlePortMonitor(args);
    case 'at':
      return await handlePortAt(args);
    default:
      console.error('Error:', `Unknown port subcommand: ${subcommand}`);
      console.error('Available subcommands: list, monitor, at');
      return 1;
  }
}

/**
 * Main function
 */
async function main(): Promise<number> {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'flash': {
        const hasFlag = (flag: string): boolean => args.includes(flag);

        if (hasFlag('--list') || hasFlag('-l')) {
          await listFirmware({ json: true });
          return 0;
        }

        const skipDlMode = args.includes('--skip-dl-mode') || args.includes('-s');
        const progressIndex = args.findIndex(arg => arg === '--progress');
        const progressMode = progressIndex !== -1 ? args[progressIndex + 1] : null;
        const firmwarePath = args.find(arg => !arg.startsWith('-') && (progressIndex === -1 || args.indexOf(arg) !== progressIndex + 1)) || null;
        await flashFirmware(firmwarePath, { skipDlMode, progressMode });
        return 0;
      }
      case 'port': {
        const subcommand = args[0];
        const subArgs = args.slice(1);
        if (!subcommand) {
          console.error('Error:', 'port requires a subcommand (list, monitor, at)');
          return 1;
        }
        return await handlePortCommand(subcommand, subArgs);
      }
      case 'build': {
        const getArgValue = (long: string): string | null => {
          const index = args.findIndex(arg => arg === long);
          return index !== -1 ? args[index + 1] : null;
        };

        const hasFlag = (long: string): boolean => args.includes(long);

        if (hasFlag('--list')) {
          await listBuildCommands();
          return 0;
        }

        const indexValue = getArgValue('--index');
        if (indexValue) {
          await compileFirmware(indexValue);
          return 0;
        }

        const nameValue = getArgValue('--name');
        if (nameValue) {
          await compileFirmware(nameValue);
          return 0;
        }

        await compileFirmware(null);
        return 0;
      }
      case 'build-and-flash':
        await compileFirmware(args[0] || null);
        await flashFirmware(null);
        return 0;
      case 'config':
        if (args[0] === 'set' && args.length >= 3) {
          await setConfig(args[1], args[2]);
        } else {
          await showConfig();
        }
        return 0;
      case 'tui':
        await startTUI();
        return 0;
      case 'help':
        showHelp();
        return 0;
      default:
        if (!command) {
          showHelp();
          return 0;
        } else {
          console.error('Error:', `Unknown command: ${command}`);
          console.error('Available commands: build, flash, port, config, tui, help');
          return 1;
        }
    }
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message);
    return 1;
  }
}

if (require.main === module) {
  main().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, showHelp };