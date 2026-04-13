#!/usr/bin/env node

import { flashFirmware, listDevices } from './flash';
import { listFirmware } from './list';
import { compileFirmware, listBuildCommands, setConfig, showConfig } from './compile';
import { loadToolsConfig, loadConfig } from './utils';
import { showSerialList, openAndMonitorPort, sendATCommandCLI, findATPort } from './serial';
import type { MonitorOptions, CLIConfig } from './types';

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
  flash [path] [options]  Flash firmware (auto-find or specify path)
    --list, -l          List available firmware files
    --skip-dl-mode, -s  Skip auto entering download mode
    --progress <mode>   Progress display mode (simple/detailed)
  devices              List USB devices
  serial               List serial port devices
  monitor [options]    Open serial port and monitor data
    -p, --port <port>   Serial port (e.g., COM107)
    --tag <tag>         Select port by tag (e.g., --tag Log, uses comPorts config)
    --baud, -b <rate>   Set baud rate (default 115200)
    --timeout, -t <ms>  Set timeout in milliseconds (default 0 means no timeout)
    --output, -o <file> Output to file
    --append, -a        Append to file (default overwrite)
    --include <keywords> Include keywords (comma separated)
    --exclude <keywords> Exclude keywords (comma separated)
    --until <text>      Exit after receiving this content
    --until-regex <pattern> Exit after regex match
    --lines <n>         Capture n lines then exit
    --json              Output results in JSON format
    --timestamp         Add timestamp to each line
  at [options]          Send AT command and get response
    -c, --command <cmd> AT command to send (required)
    -p, --port <port>   Serial port (auto-detect if not specified)
    --tag <tag>         Select port by tag (e.g., --tag AT, uses comPorts config)
    -t, --timeout <ms>  Set timeout in milliseconds (default 5000)
    --platform <type>   Platform for auto-detect (default asr160x)
    --json              Output results in JSON format
  build [options]       Compile firmware
    --list              List all available commands
    --index <n>         Run command by index (1-based)
    --name <name>       Run command by name
  build-and-flash       Compile and flash latest firmware
  config                Show current configuration
  config set <key> <value>  Set configuration item
  help                  Show help information

Examples:
  dove.exe build              # Run default build command
  dove.exe build --list       # List all build commands
  dove.exe build --index 1    # Run command by index
  dove.exe build --name install # Run command by name
  dove.exe build-and-flash
  dove.exe flash              # Flash firmware (auto-find)
  dove.exe flash --list       # List available firmware
  dove.exe serial
  dove.exe monitor -p COM9
  dove.exe monitor --tag Log --timeout 30000  # Use port with Log tag
  dove.exe monitor -p COM9 -b 9600 -t 5000
  dove.exe monitor -p COM9 --include "ERROR,WARN" -o errors.log
  dove.exe monitor -p COM9 --until "Done" -o boot.log
  dove.exe monitor -p COM9 --lines 100 -o debug.log
  dove.exe monitor -p COM9 --json --timeout 5000
  dove.exe at -c "ATI"
  dove.exe at -p COM107 -c "AT+CGMI"
  dove.exe at -c "AT+CFUN=1,1" --timeout 10000
  dove.exe at -c "ATI" --json

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

  // Helper function to get available tags from config
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

    // Check if --tag is specified, find port by tag
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

    // Fall back to defaultComPort for backward compatibility
    if (!portPath && config.defaultComPort) {
      portPath = config.defaultComPort;
      portSource = 'config_default';
    }

    // Try active port from comPorts if no defaultComPort
    if (!portPath && config.comPorts && config.comPorts.length > 0) {
      const activePort = config.comPorts.find(p => p.isActive);
      if (activePort) {
        portPath = activePort.port;
        portSource = 'config_active';
      }
    }
  }

  if (!portPath) {
    throw new Error('Please specify serial port with -p (e.g., -p COM107), or use --tag to select by tag, or configure defaultComPort in dove.json');
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
  json: boolean;
  tag?: string;
} {
  const getArgValue = (short: string | null, long: string): string | null => {
    const index = args.findIndex(arg => arg === short || arg === long);
    return index !== -1 ? args[index + 1] : null;
  };

  const hasFlag = (short: string | null, long: string): boolean => {
    return args.includes(short || '') || args.includes(long);
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
    json: hasFlag(null, '--json'),
    tag: tag || undefined
  };
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

        // Check for --list or -l flag to list firmware
        if (hasFlag('--list') || hasFlag('-l')) {
          const jsonMode = hasFlag('--json');
          await listFirmware({ json: jsonMode });
          return 0;
        }

        const skipDlMode = args.includes('--skip-dl-mode') || args.includes('-s');
        const progressIndex = args.findIndex(arg => arg === '--progress');
        const progressMode = progressIndex !== -1 ? args[progressIndex + 1] : null;
        const firmwarePath = args.find(arg => !arg.startsWith('-') && (progressIndex === -1 || args.indexOf(arg) !== progressIndex + 1)) || null;
        await flashFirmware(firmwarePath, { skipDlMode, progressMode });
        return 0;
      }
      case 'list': {
        // Keep as alias for flash --list
        const jsonMode = args.includes('--json');
        await listFirmware({ json: jsonMode });
        return 0;
      }
      case 'devices': {
        const jsonMode = args.includes('--json');
        await listDevices({ json: jsonMode });
        return 0;
      }
      case 'serial':
        await showSerialList();
        return 0;
      case 'monitor': {
        const { portPath, options } = parseMonitorArgs(args);
        await openAndMonitorPort(portPath, options);
        return 0;
      }
      case 'at': {
        const { portPath, command, timeout, platform, json, tag } = parseATArgs(args);

        let actualPortPath = portPath;
        let portSource = 'user_input';

        if (!actualPortPath) {
          const config = loadConfig() as CLIConfig;

          // Check if --tag is specified, find port by tag
          if (tag) {
            if (config.comPorts && config.comPorts.length > 0) {
              const portConfig = config.comPorts.find(p => p.tags.includes(tag));
              if (portConfig) {
                actualPortPath = portConfig.port;
                portSource = 'config_tag';
              } else {
                const allTags = config.comPorts.flatMap(p => p.tags);
                const uniqueTags = [...new Set(allTags)];
                throw new Error(`No port found with tag '${tag}'. Available tags: ${uniqueTags.join(', ')}`);
              }
            } else {
              throw new Error('No comPorts configured in dove.json. Please configure ports with tags first.');
            }
          }

          // Fall back to auto-detect
          if (!actualPortPath) {
            const atPort = await findATPort(platform);
            if (atPort) {
              actualPortPath = atPort.path;
              portSource = 'auto_detect';
            }
          }

          // Fall back to defaultComPort for backward compatibility
          if (!actualPortPath && config.defaultComPort) {
            actualPortPath = config.defaultComPort;
            portSource = 'config_default';
          }

          // Try active port from comPorts if no defaultComPort
          if (!actualPortPath && config.comPorts && config.comPorts.length > 0) {
            const activePort = config.comPorts.find(p => p.isActive);
            if (activePort) {
              actualPortPath = activePort.port;
              portSource = 'config_active';
            }
          }
        }

        if (!actualPortPath) {
          throw new Error('Please specify serial port with -p (e.g., -p COM107), or use --tag to select by tag, or use --platform to auto-detect AT port');
        }

        if (portSource !== 'user_input' && !json) {
          if (portSource === 'config_tag') {
            console.log(`\nUsing port with tag '${tag}': ${actualPortPath}\n`);
          } else if (portSource === 'config_active') {
            console.log(`\nUsing active port: ${actualPortPath}\n`);
          } else if (portSource === 'auto_detect') {
            console.log(`\nAuto-detected AT port: ${actualPortPath}\n`);
          } else {
            console.log(`\nUsing configured default serial port: ${actualPortPath}\n`);
          }
        }

        const result = await sendATCommandCLI(actualPortPath, command, timeout);
        
        if (json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`AT Command Result`);
          console.log('='.repeat(50));
          console.log(`Port: ${result.port}`);
          console.log(`Command: ${command}`);
          console.log(`Duration: ${result.duration}ms`);
          console.log(`\nResponse:\n${result.response}`);
          
          if (result.success === true) {
            console.log('\nStatus: OK');
          } else if (result.success === false) {
            console.log('\nStatus: ERROR');
          } else if (result.timeout) {
            console.log('\nStatus: TIMEOUT');
          }
        }
        
        return 0;
      }
      case 'build': {
        // Parse build command arguments (only full parameter names)
        const getArgValue = (long: string): string | null => {
          const index = args.findIndex(arg => arg === long);
          return index !== -1 ? args[index + 1] : null;
        };

        const hasFlag = (long: string): boolean => {
          return args.includes(long);
        };

        // Check for --list flag
        if (hasFlag('--list')) {
          await listBuildCommands();
          return 0;
        }

        // Check for --index
        const indexValue = getArgValue('--index');
        if (indexValue) {
          await compileFirmware(indexValue);
          return 0;
        }

        // Check for --name
        const nameValue = getArgValue('--name');
        if (nameValue) {
          await compileFirmware(nameValue);
          return 0;
        }

        // No options provided, run default command
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
      case 'help':
        showHelp();
        return 0;
      default:
        if (!command) {
          showHelp();
          return 0;
        } else {
          console.error('Error:', `Unknown command: ${command}`);
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