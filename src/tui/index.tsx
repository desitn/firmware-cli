/**
 * Dove TUI - Interactive Terminal UI
 */

import fs from 'fs';
import { spawn } from 'child_process';
import readline from 'readline';
import iconvLite from 'iconv-lite';
import { findWorkspacePath, loadConfig, saveConfig, getToolPath, buildToolArgs, getGlobalSettings, loadToolsConfig, isWindows, determineFirmwareType, killProcessTree, findConfigPath } from '../utils';
import { compileFirmware } from '../compile';
import { findAllFirmwares, formatSize } from '../utils';
import { listSerialPorts, enterDownloadMode, findDownloadPort } from '../serial';
import type { FirmwareInfo, SerialPortInfo, PlatformConfig, ProgressPatterns } from '../types';

// ============================================================
// List Selector - Universal partial refresh for list navigation
// ============================================================

type ListType = 'main' | 'build' | 'flash' | 'ports' | 'port-tag' | 'settings' | 'theme';

// List base line offsets (line number where first item appears)
const listBaseLines: Record<ListType, number> = {
  'main':       5,  // After header 1-3, title 4
  'build':      6,  // After header 1-3, title 4, count 5
  'flash':      6,  // After header 1-3, title 4, count 5
  'ports':      6,  // After header 1-3, title 4, count 5
  'port-tag':   7,  // After header 1-3, title 4, info 5-6
  'settings':   5,  // After header 1-3, title 4
  'theme':      6,  // After header 1-3, title 4, blank 5
};

// Render item line for each list type
function renderListItem(type: ListType, index: number, isSelected: boolean): string {
  const theme = getThemeColor();
  const config = loadConfig() as any || {};
  const mark = isSelected ? theme.primary + '❯' + COLOR_RESET : ' ';

  switch (type) {
    case 'main':
      const mainPrefix = isSelected ? theme.primary + '❯' + COLOR_RESET + ' ' : '  ';
      const mainColor = isSelected ? COLOR_BOLD + theme.primary : '';
      return `${mainPrefix}${mainColor}${index + 1}. ${menuItems[index].label}${COLOR_RESET}`;

    case 'build':
      if (index < buildCommands.length && index < 7) {
        const cmd = buildCommands[index];
        const activeBuild = cmd.isActive ? COLOR_GREEN + ' *' + COLOR_RESET : '';
        return ` ${mark} ${index + 1}. ${cmd.name}: ${cmd.command}${activeBuild}`;
      } else if (index === Math.min(7, buildCommands.length)) {
        // Add option
        return ` ${mark} ${index + 1}. ${COLOR_GREEN}+ Add Command${COLOR_RESET}`;
      }
      return '';

    case 'flash':
      if (firmwareList.length === 0) return '';
      const fw = firmwareList[index];
      const recFlash = index === 0 ? COLOR_GREEN + ' *' + COLOR_RESET : '';
      return ` ${mark} ${index + 1}. ${fw.name} (${fw.type}) ${formatSize(fw.size)}${recFlash}`;

    case 'ports':
      if (portList.length === 0) return '';
      const port = portList[index];
      const maxNameWidth = Math.max(35, ...portList.slice(0, 8).map(p => displayWidth(p.friendlyName)));
      const paddedName = padDisplay(port.friendlyName, maxNameWidth);
      const tagsPort = port.tags.length > 0 ? COLOR_GREEN + '[' + port.tags.join(', ') + ']' + COLOR_RESET : COLOR_DIM + '[未标记]' + COLOR_RESET;
      return ` ${mark} ${index + 1}. ${paddedName} ${tagsPort}`;

    case 'port-tag':
      const portForTag = portList[selectedPort];
      const tagItem = portTags[index];
      const hasTag = portForTag?.tags.includes(tagItem);
      const checkTag = hasTag ? COLOR_GREEN + '✓' + COLOR_RESET : ' ';
      return ` ${mark} ${index + 1}. ${tagItem} ${checkTag}`;

    case 'settings':
      const settingItem = settingsItems[index];
      let valueStr: string;
      if (settingItem.type === 'ports') {
        valueStr = COLOR_DIM + '(' + portList.length + ' ports)' + COLOR_RESET;
      } else if (settingItem.type === 'array') {
        const value = getConfigValue(config, settingItem.key, settingItem.type);
        valueStr = COLOR_DIM + '(' + value + ' items)' + COLOR_RESET;
      } else if (settingItem.type === 'theme') {
        const currentTheme = config.theme?.color || 'cyan';
        const themeColorCode = themeColorMap[currentTheme]?.primary || themeColorMap.cyan.primary;
        valueStr = themeColorCode + currentTheme + COLOR_RESET;
      } else if (settingItem.type === 'action') {
        valueStr = COLOR_DIM + 'dove.json' + COLOR_RESET;
      } else {
        const value = getConfigValue(config, settingItem.key, settingItem.type);
        valueStr = value ? COLOR_DIM + truncate(value, 30) + COLOR_RESET : COLOR_DIM + '(not set)' + COLOR_RESET;
      }
      return ` ${mark} ${index + 1}. ${settingItem.label}: ${valueStr}`;

    case 'theme':
      const currentTheme = (config as any).theme?.color || 'cyan';
      const colorName = themeColorNames[index];
      const colorCode = themeColorMap[colorName]?.primary || '';
      const checkTheme = colorName === currentTheme ? COLOR_GREEN + ' ✓' + COLOR_RESET : '';
      return ` ${mark} ${index + 1}. ${colorCode}${colorName}${COLOR_RESET}${checkTheme}`;

    default:
      return '';
  }
}

// Universal update selection - partial refresh without full screen render
function updateListSelection(type: ListType, oldIndex: number, newIndex: number): void {
  const baseLine = listBaseLines[type];

  // Get list length for bounds check
  const listLengths: Record<ListType, number> = {
    'main': menuItems.length,
    'build': Math.min(7, buildCommands.length) + 1, // +1 for Add option
    'flash': Math.min(8, firmwareList.length),
    'ports': Math.min(8, portList.length),
    'port-tag': portTags.length,
    'settings': settingsItems.length,
    'theme': themeColorNames.length,
  };

  const maxLen = listLengths[type];

  // Clear old selection
  if (oldIndex >= 0 && oldIndex < maxLen) {
    const oldLine = renderListItem(type, oldIndex, false);
    process.stdout.write(`\x1b[${baseLine + oldIndex}H\x1b[2K${oldLine}`);
  }

  // Set new selection
  if (newIndex >= 0 && newIndex < maxLen) {
    const newLine = renderListItem(type, newIndex, true);
    process.stdout.write(`\x1b[${baseLine + newIndex}H\x1b[2K${newLine}`);
  }
}

// ============================================================
// Theme & Color Configuration
// ============================================================

// Theme colors - ANSI escape codes
const themeColorMap: Record<string, { primary: string; accent: string }> = {
  cyan:    { primary: '\x1b[36m', accent: '\x1b[36m' },
  blue:    { primary: '\x1b[34m', accent: '\x1b[34m' },
  green:   { primary: '\x1b[32m', accent: '\x1b[32m' },
  magenta: { primary: '\x1b[35m', accent: '\x1b[35m' },
  yellow:  { primary: '\x1b[33m', accent: '\x1b[33m' },
  red:     { primary: '\x1b[31m', accent: '\x1b[31m' },
  white:   { primary: '\x1b[37m', accent: '\x1b[37m' }
};

// Get theme color from config
function getThemeColor(): { primary: string; accent: string } {
  const config = loadConfig() as any;
  const theme = config?.theme?.color || 'cyan';
  return themeColorMap[theme] || themeColorMap.cyan;
}

// Color constants
const COLOR_RESET = '\x1b[0m';
const COLOR_BOLD = '\x1b[1m';
const COLOR_DIM = '\x1b[2m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_RED = '\x1b[31m';
const COLOR_YELLOW = '\x1b[33m';

// State variables
let currentView: 'main' | 'build' | 'build-add' | 'flash' | 'ports' | 'port-tag' | 'settings' | 'settings-detail' | 'settings-edit' | 'theme-select' = 'main';
let selectedMenu = 0;
let outputBuffer: string[] = [];
let isExecuting = false;
let firmwareList: FirmwareInfo[] = [];
let selectedFirmware = 0;
let buildCommands: any[] = [];
let selectedBuild = 0;

// Ports state
let portList: (SerialPortInfo & { tags: string[], isActive: boolean })[] = [];
let selectedPort = 0;

// Flash state
let flashProgress = 0;
let flashStatus = 'idle';
let flashLogBuffer: string[] = [];
let showFlashLog = false;
let spinnerIndex = 0;

// Spinner characters
const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Menu items
const menuItems: { label: string; action: 'build' | 'flash' | 'settings' | 'quit' }[] = [
  { label: 'Build', action: 'build' },
  { label: 'Flash', action: 'flash' },
  { label: 'Settings', action: 'settings' },
  { label: 'Quit', action: 'quit' },
];

// Predefined port tags
const portTags = ['AT', 'DBG', 'Invalid'];
let selectedTag = 0;

// Settings items
const settingsItems = [
  { key: 'workspacePath', label: 'Workspace Path', type: 'path' },
  { key: 'firmwarePath', label: 'Firmware Path', type: 'path' },
  { key: 'theme', label: 'Theme Color', type: 'theme' },
  { key: 'ports', label: 'Ports', type: 'ports' },
  { key: 'openConfig', label: 'Open Config File', type: 'action' },
];
let selectedSetting = 0;

// Theme color options (color names array)
const themeColorNames = ['cyan', 'blue', 'green', 'magenta', 'yellow', 'red', 'white'];
let selectedThemeColor = 0;

// Settings edit state
let editingSettingKey = '';
let editInputBuffer = '';

// Build add command state
let buildAddStep = 0; // 0: name, 1: command, 2: description
let buildAddName = '';
let buildAddCommand = '';
let buildAddDescription = '';

// Load firmware list
async function loadFirmwareList(): Promise<void> {
  firmwareList = findAllFirmwares();
  // Sort: non-factory first, then by mtime descending
  firmwareList.sort((a, b) => {
    const aIsFactory = a.name.toLowerCase().includes('factory');
    const bIsFactory = b.name.toLowerCase().includes('factory');
    if (aIsFactory && !bIsFactory) return 1;
    if (!aIsFactory && bIsFactory) return -1;
    return b.mtime.getTime() - a.mtime.getTime();
  });
  selectedFirmware = 0;
}

// Load build commands from config
function loadBuildCommands(): void {
  const config = loadConfig() as any || {};
  buildCommands = config.buildCommands || [];
  // Find active command as default selection
  const activeIndex = buildCommands.findIndex(cmd => cmd.isActive);
  selectedBuild = activeIndex >= 0 ? activeIndex : 0;
}

// Load port list with user tags
async function loadPortList(): Promise<void> {
  const ports = await listSerialPorts();
  const config = loadConfig() as any || {};
  const comPorts = config.comPorts || [];

  portList = ports.map(port => {
    const portConfig = comPorts.find((p: any) => p.port === port.path);
    return {
      ...port,
      tags: portConfig?.tags || [],
      isActive: portConfig?.isActive || false
    };
  });
  selectedPort = 0;
}

// Save port tag to config
function savePortTag(portPath: string, tag: string): void {
  const config = loadConfig() as any || {};
  if (!config.comPorts) {
    config.comPorts = [];
  }

  const existing = config.comPorts.find((p: any) => p.port === portPath);
  if (existing) {
    if (!existing.tags.includes(tag)) {
      existing.tags.push(tag);
    }
  } else {
    config.comPorts.push({
      port: portPath,
      tags: [tag],
      isActive: false
    });
  }

  saveConfig(config);
}

// Remove port tag from config
function removePortTag(portPath: string, tag: string): void {
  const config = loadConfig() as any || {};
  if (!config.comPorts) return;

  const existing = config.comPorts.find((p: any) => p.port === portPath);
  if (existing) {
    existing.tags = existing.tags.filter((t: string) => t !== tag);
    if (existing.tags.length === 0) {
      config.comPorts = config.comPorts.filter((p: any) => p.port !== portPath);
    }
  }

  saveConfig(config);
}

// Get terminal width with minimum constraint
function getTerminalWidth(): number {
  const width = process.stdout.columns || 80;
  return Math.max(40, Math.min(width, 120)); // min 40, max 120
}

// Helper: get config value by key
function getConfigValue(config: any, key: string, type: string): string | number {
  if (type === 'array') {
    const arr = config[key] || [];
    return arr.length;
  }
  return config[key] || '';
}

// Helper: truncate string
function truncate(str: string | number, maxLen: number): string {
  if (typeof str === 'number') return String(str);
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

// Helper: calculate display width (Chinese chars take 2 columns)
function displayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    // Chinese and other wide characters
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

// Helper: pad string for display alignment
function padDisplay(str: string, targetWidth: number): string {
  const currentWidth = displayWidth(str);
  if (currentWidth >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - currentWidth);
}

// Helper: get spinner character
function getSpinner(): string {
  spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
  return spinnerChars[spinnerIndex];
}

function updateProgressLine(): void {
  // If log is shown, need full render to update log content
  if (showFlashLog) {
    renderScreen();
    return;
  }

  const spinner = getSpinner();
  const statusText = getFlashStatusText(flashStatus);
  const statusColor = flashStatus === 'completed' ? COLOR_GREEN : flashStatus === 'error' ? COLOR_RED : COLOR_YELLOW;
  // Progress is on line 6: (header 1-3, title 4, firmware info 5, progress 6)
  const line = `\x1b[6H\x1b[2K${spinner} ${flashProgress}% ${statusColor}${statusText}${COLOR_RESET}`;
  process.stdout.write(line);
}

// Helper: get flash status text
function getFlashStatusText(status: string): string {
  switch (status) {
    case 'idle': return 'Preparing...';
    case 'started': return 'Initializing...';
    case 'downloading': return 'Downloading...';
    case 'completed': return 'Completed!';
    case 'error': return 'Error!';
    default: return '';
  }
}

// Get progress patterns for platform
function getProgressPatterns(toolType: string): ProgressPatterns {
  const config = loadToolsConfig();
  let platformKey: string | null = null;
  for (const [key, platform] of Object.entries(config.platforms || {})) {
    if (platform.type === toolType) {
      platformKey = key;
      break;
    }
  }
  const platformConfig = platformKey ? config.platforms[platformKey] : null;
  return platformConfig?.progressPatterns || {
    started: ['init', 'start', 'begin'],
    downloading: ['downloading', 'running', 'burning', 'flashing'],
    completed: ['complete', 'finished', 'succeeded'],
    error: ['error', 'fail', 'timeout']
  };
}

// Flash firmware with progress updates for TUI
async function flashFirmwareWithProgress(firmwarePath: string): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    try {
      if (!fs.existsSync(firmwarePath)) {
        throw new Error(`Firmware file does not exist: ${firmwarePath}`);
      }

      const firmwareInfo = determineFirmwareType(firmwarePath);
      const toolPath = getToolPath(firmwareInfo.type);

      if (!fs.existsSync(toolPath)) {
        throw new Error(`Download tool does not exist: ${toolPath}`);
      }

      const config = loadToolsConfig();
      let platformKey: string | null = null;
      let platformConfig: PlatformConfig | null = null;

      for (const [key, platform] of Object.entries(config.platforms || {})) {
        if (platform.type === firmwareInfo.type) {
          platformKey = key;
          platformConfig = platform;
          break;
        }
      }

      // Check download mode
      if (platformConfig?.serial?.autoEnterDlMode) {
        const dlPort = await findDownloadPort(platformKey);
        if (!dlPort) {
          await enterDownloadMode(platformKey || firmwareInfo.type, false, 2);
        }
      }

      const settings = getGlobalSettings();
      const port = settings.defaultPort || 'auto';
      const toolArgs = buildToolArgs(firmwareInfo.type, 'flash', {
        firmwarePath: firmwarePath,
        port: port
      });

      const cmdStr = `"${toolPath}" ${toolArgs.join(' ')}`;
      const command = 'cmd';
      const args = ['/c', cmdStr];

      flashLogBuffer.push(`Executing: ${cmdStr}`);
      flashStatus = 'started';
      flashProgress = 5;
      renderScreen(); // Initial render

      const child = spawn(command, args, {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let downloadComplete = false;
      let hasStarted = false;
      const patterns = getProgressPatterns(firmwareInfo.type);

      // Get download duration for progress estimation
      const platformDuration = platformConfig?.downloadDuration || 30000;
      const startTime = Date.now();

      // Progress estimation timer - only update progress line
      const progressTimer = setInterval(() => {
        if (!downloadComplete && flashStatus === 'downloading') {
          const elapsed = Date.now() - startTime;
          const estimatedProgress = 5 + Math.min(90, (elapsed / platformDuration) * 90);
          if (estimatedProgress > flashProgress) {
            flashProgress = Math.floor(estimatedProgress);
            updateProgressLine();
          }
        }
      }, 500);

      // Timeout
      const timeout = setTimeout(() => {
        if (!downloadComplete) {
          clearInterval(progressTimer);
          killProcessTree(child, 'SIGKILL');
          flashStatus = 'error';
          flashLogBuffer.push('Timeout - download terminated');
          updateProgressLine();
          reject(new Error('Timeout'));
        }
      }, 60000);

      const stdoutRl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity
      });

      stdoutRl.on('line', (line: string) => {
        let output: string;
        if (isWindows()) {
          output = iconvLite.decode(Buffer.from(line, 'binary'), 'gbk');
        } else {
          output = line;
        }

        flashLogBuffer.push(output);
        const lowerOutput = output.toLowerCase();

        // Detect status from output - only update progress line
        for (const pattern of patterns.started) {
          if (lowerOutput.includes(pattern.toLowerCase()) && !hasStarted) {
            hasStarted = true;
            flashStatus = 'started';
            flashProgress = 5;
            clearTimeout(timeout);
            updateProgressLine();
            break;
          }
        }

        for (const pattern of patterns.downloading) {
          if (lowerOutput.includes(pattern.toLowerCase())) {
            flashStatus = 'downloading';
            clearTimeout(timeout);
            updateProgressLine();
            break;
          }
        }

        for (const pattern of patterns.completed) {
          if (lowerOutput.includes(pattern.toLowerCase())) {
            flashStatus = 'completed';
            flashProgress = 100;
            downloadComplete = true;
            clearInterval(progressTimer);
            clearTimeout(timeout);
            updateProgressLine();
            break;
          }
        }

        for (const pattern of patterns.error) {
          if (lowerOutput.includes(pattern.toLowerCase())) {
            flashStatus = 'error';
            downloadComplete = true;
            clearInterval(progressTimer);
            clearTimeout(timeout);
            updateProgressLine();
            break;
          }
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const output = iconvLite.decode(data, 'gbk');
        flashLogBuffer.push(`[ERR] ${output}`);
      });

      child.on('close', (code: number) => {
        clearInterval(progressTimer);
        clearTimeout(timeout);
        downloadComplete = true;

        if (code === 0 && flashStatus !== 'error') {
          flashStatus = 'completed';
          flashProgress = 100;
        } else if (flashStatus !== 'completed') {
          flashStatus = 'error';
        }
        // Final render to show completion/error and allow user interaction
        renderScreen();
        resolve();
      });

      child.on('error', (err: Error) => {
        clearInterval(progressTimer);
        clearTimeout(timeout);
        flashStatus = 'error';
        flashLogBuffer.push(`Process error: ${err.message}`);
        updateProgressLine();
        reject(err);
      });

    } catch (err) {
      flashStatus = 'error';
      const error = err as Error;
      flashLogBuffer.push(`Error: ${error.message}`);
      renderScreen();
      reject(err);
    }
  });
}

// Track previous view line count for clearing extra lines
let prevViewLines = 0;

function renderScreen(fullClear: boolean = false): void {
  process.stdout.write('\x1b[?25l'); // Hide cursor

  // Only clear screen on exit (fullClear=true)
  if (fullClear) {
    process.stdout.write('\x1b[2J\x1b[H');
  } else {
    // Move cursor to home position without clearing
    process.stdout.write('\x1b[H');
  }

  const workspace = findWorkspacePath() || 'not found';
  // Extract only the last folder name for display
  const workspaceName = workspace !== 'not found' ? workspace.split(/[\\/]/).pop() || workspace : 'not found';
  const config = loadConfig() as any || {};
  const termWidth = getTerminalWidth();

  // Get theme color
  const theme = getThemeColor();

  let lines: string[] = [];

  // Header - centered title with emoji (emoji takes 2 display columns)
  const title = '🕊 Dove TUI';
  const titleWidth = 11;
  const padding = Math.floor((termWidth - titleWidth) / 2);

  lines.push(theme.primary + '─'.repeat(termWidth) + COLOR_RESET);
  lines.push(COLOR_BOLD + theme.primary + ' '.repeat(padding) + title + ' '.repeat(termWidth - padding - titleWidth) + COLOR_RESET);
  lines.push(theme.primary + '─'.repeat(termWidth) + COLOR_RESET);

  if (currentView === 'main') {
    lines.push(COLOR_BOLD + theme.primary + 'What would you like to do?' + COLOR_RESET);
    menuItems.forEach((item, i) => {
      const isSelected = i === selectedMenu;
      const prefix = isSelected ? theme.primary + '❯' + COLOR_RESET + ' ' : '  ';
      const color = isSelected ? COLOR_BOLD + theme.primary : '';
      lines.push(`${prefix}${color}${i + 1}. ${item.label}${COLOR_RESET}`);
    });
    lines.push('');
    lines.push(COLOR_DIM + '↑/↓ navigate | Enter select | Q quit' + COLOR_RESET);
  } else if (currentView === 'build') {
    lines.push(COLOR_BOLD + theme.primary + 'Build Commands' + COLOR_RESET);
    if (isExecuting) {
      lines.push(COLOR_YELLOW + '⏳ Building...' + COLOR_RESET);
      lines.push(COLOR_DIM + 'Please wait...' + COLOR_RESET);
    } else {
      lines.push(`Found ${buildCommands.length} build command(s):`);
      buildCommands.slice(0, 7).forEach((cmd, i) => {
        const mark = i === selectedBuild ? theme.primary + '❯' + COLOR_RESET : ' ';
        const active = cmd.isActive ? COLOR_GREEN + ' *' + COLOR_RESET : '';
        lines.push(` ${mark} ${i + 1}. ${cmd.name}: ${cmd.command}${active}`);
      });
      if (buildCommands.length > 7) {
        lines.push(`   ... and ${buildCommands.length - 7} more`);
      }
      // Add "Add Command" option as last item
      const addIndex = Math.min(7, buildCommands.length);
      const addMark = selectedBuild === addIndex ? theme.primary + '❯' + COLOR_RESET : ' ';
      lines.push(` ${addMark} ${addIndex + 1}. ${COLOR_GREEN}+ Add Command${COLOR_RESET}`);
      lines.push('');
      lines.push(COLOR_DIM + '[↑/↓] navigate | [1-8] select | [Enter] build/add | [D] delete | [Esc] back' + COLOR_RESET);
    }
  } else if (currentView === 'build-add') {
    // Add command view
    lines.push(COLOR_BOLD + theme.primary + 'Build Commands' + COLOR_RESET);
    lines.push(COLOR_DIM + 'Add New Build Command' + COLOR_RESET);
    lines.push('');
    const steps = ['Name', 'Command', 'Description (for AI context)'];
    const values = [buildAddName, buildAddCommand, buildAddDescription];
    steps.forEach((step, i) => {
      const isActive = i === buildAddStep;
      const mark = isActive ? theme.primary + '❯' + COLOR_RESET : ' ';
      const value = values[i] || '';
      lines.push(` ${mark} ${i + 1}. ${step}: ${value}${isActive ? '\x1b[5m_' + COLOR_RESET : ''}`);
    });
    lines.push('');
    lines.push(COLOR_DIM + '[↑/↓] switch field | [Enter] save | [Esc] cancel' + COLOR_RESET);
  } else if (currentView === 'flash') {
    lines.push(COLOR_BOLD + theme.primary + 'Flash Firmware' + COLOR_RESET);
    if (isExecuting) {
      // Show firmware info
      const fw = firmwareList[selectedFirmware];
      if (fw) {
        lines.push(COLOR_DIM + 'Firmware: ' + COLOR_RESET + truncate(fw.name, 40) + ' (' + fw.type + ', ' + formatSize(fw.size) + ')');
      }

      // Show progress line
      const spinner = spinnerChars[spinnerIndex];
      const statusText = getFlashStatusText(flashStatus);
      const statusColor = flashStatus === 'completed' ? COLOR_GREEN : flashStatus === 'error' ? COLOR_RED : COLOR_YELLOW;
      lines.push(`${spinner} ${flashProgress}% ${statusColor}${statusText}${COLOR_RESET}`);

      // Show log if enabled (Ctrl+O) - fill remaining terminal space
      if (showFlashLog && flashLogBuffer.length > 0) {
        lines.push('');
        lines.push(COLOR_DIM + '─── Output Log (Ctrl+O to hide) ───' + COLOR_RESET);
        // Show up to 15 lines of log to fill more terminal space
        flashLogBuffer.slice(-15).forEach(line => {
          lines.push(COLOR_DIM + truncate(line, termWidth - 4) + COLOR_RESET);
        });
      } else {
        lines.push('');
        lines.push(COLOR_DIM + 'Press Ctrl+O to view output log' + COLOR_RESET);
      }
      lines.push('');
      lines.push(COLOR_DIM + '[Ctrl+O] toggle log | [Esc] cancel' + COLOR_RESET);
    } else if (firmwareList.length > 0) {
      lines.push(`Found ${firmwareList.length} firmware(s):`);
      firmwareList.slice(0, 8).forEach((fw, i) => {
        const mark = i === selectedFirmware ? theme.primary + '❯' + COLOR_RESET : ' ';
        const rec = i === 0 ? COLOR_GREEN + ' *' + COLOR_RESET : '';
        lines.push(` ${mark} ${i + 1}. ${fw.name} (${fw.type}) ${formatSize(fw.size)}${rec}`);
      });
      if (firmwareList.length > 8) {
        lines.push(`   ... and ${firmwareList.length - 8} more`);
      }
      lines.push('');
      lines.push(COLOR_DIM + '[↑/↓] navigate | [1-8] select | [Enter] flash | [R] refresh | [Esc] back' + COLOR_RESET);
    } else {
      lines.push(COLOR_DIM + 'No firmware found' + COLOR_RESET);
      lines.push(COLOR_DIM + '[R] refresh | [Esc] back' + COLOR_RESET);
    }
  } else if (currentView === 'ports') {
    lines.push(COLOR_BOLD + theme.primary + 'Serial Ports' + COLOR_RESET);
    if (portList.length > 0) {
      lines.push(`Found ${portList.length} port(s):`);
      // Calculate max friendlyName display width for alignment (considering Chinese chars)
      const maxNameWidth = Math.max(35, ...portList.slice(0, 8).map(p => displayWidth(p.friendlyName)));
      portList.slice(0, 8).forEach((port, i) => {
        const mark = i === selectedPort ? theme.primary + '❯' + COLOR_RESET : ' ';
        const paddedName = padDisplay(port.friendlyName, maxNameWidth);
        const tags = port.tags.length > 0 ? COLOR_GREEN + '[' + port.tags.join(', ') + ']' + COLOR_RESET : COLOR_DIM + '[未标记]' + COLOR_RESET;
        lines.push(` ${mark} ${i + 1}. ${paddedName} ${tags}`);
      });
      if (portList.length > 8) {
        lines.push(`   ... and ${portList.length - 8} more`);
      }
      lines.push('');
      lines.push(COLOR_DIM + '[↑/↓] navigate | [Enter] edit tag | [R] refresh | [Esc] back' + COLOR_RESET);
    } else {
      lines.push(COLOR_DIM + 'No serial ports found' + COLOR_RESET);
      lines.push(COLOR_DIM + '[R] refresh | [Esc] back' + COLOR_RESET);
    }
  } else if (currentView === 'port-tag') {
    // Port tag edit view
    const port = portList[selectedPort];
    lines.push(COLOR_BOLD + theme.primary + 'Edit Port Tag' + COLOR_RESET);
    lines.push(`Port: ${port?.friendlyName || 'Unknown'}`);
    lines.push(`Tags: ${port?.tags.length > 0 ? port.tags.join(', ') : '(none)'}`);
    portTags.forEach((tag, i) => {
      const mark = i === selectedTag ? theme.primary + '❯' + COLOR_RESET : ' ';
      const hasTag = port?.tags.includes(tag);
      const check = hasTag ? COLOR_GREEN + '✓' + COLOR_RESET : ' ';
      lines.push(` ${mark} ${i + 1}. ${tag} ${check}`);
    });
    lines.push('');
    lines.push(COLOR_DIM + '[↑/↓] select tag | [Enter] add/remove | [D] clear all | [Esc] back' + COLOR_RESET);
  } else if (currentView === 'settings') {
    lines.push(COLOR_BOLD + theme.primary + 'Settings' + COLOR_RESET);
    settingsItems.forEach((item, i) => {
      const mark = i === selectedSetting ? theme.primary + '❯' + COLOR_RESET : ' ';
      let valueStr: string;
      if (item.type === 'ports') {
        valueStr = COLOR_DIM + '(' + portList.length + ' ports)' + COLOR_RESET;
      } else if (item.type === 'array') {
        const value = getConfigValue(config, item.key, item.type);
        valueStr = COLOR_DIM + '(' + value + ' items)' + COLOR_RESET;
      } else if (item.type === 'theme') {
        const currentTheme = config.theme?.color || 'cyan';
        const themeColorCode = themeColorMap[currentTheme]?.primary || themeColorMap.cyan.primary;
        valueStr = themeColorCode + currentTheme + COLOR_RESET;
      } else if (item.type === 'action') {
        valueStr = COLOR_DIM + 'dove.json' + COLOR_RESET;
      } else {
        const value = getConfigValue(config, item.key, item.type);
        valueStr = value ? COLOR_DIM + truncate(value, 30) + COLOR_RESET : COLOR_DIM + '(not set)' + COLOR_RESET;
      }
      lines.push(` ${mark} ${i + 1}. ${item.label}: ${valueStr}`);
    });
    lines.push('');
    lines.push(COLOR_DIM + '[↑/↓] navigate | [1-5] select | [Enter] edit | [Esc] back' + COLOR_RESET);
  } else if (currentView === 'theme-select') {
    lines.push(COLOR_BOLD + theme.primary + 'Select Theme Color' + COLOR_RESET);
    lines.push('');
    const currentTheme = (config as any).theme?.color || 'cyan';
    themeColorNames.forEach((colorName: string, i: number) => {
      const mark = i === selectedThemeColor ? theme.primary + '❯' + COLOR_RESET : ' ';
      const isSelected = colorName === currentTheme;
      const colorCode = themeColorMap[colorName]?.primary || '';
      const check = isSelected ? COLOR_GREEN + ' ✓' + COLOR_RESET : '';
      lines.push(` ${mark} ${i + 1}. ${colorCode}${colorName}${COLOR_RESET}${check}`);
    });
    lines.push('');
    lines.push(COLOR_DIM + '[↑/↓] navigate | [Enter] select | [Esc] back' + COLOR_RESET);
  } else if (currentView === 'settings-detail') {
    lines.push(COLOR_BOLD + theme.primary + 'Setting Detail' + COLOR_RESET);
    if (outputBuffer.length > 0) {
      outputBuffer.slice(-10).forEach(line => {
        lines.push(line);
      });
    }
    lines.push('');
    lines.push(COLOR_DIM + '[Enter/Esc] back' + COLOR_RESET);
  } else if (currentView === 'settings-edit') {
    const item = settingsItems.find(s => s.key === editingSettingKey);
    lines.push(COLOR_BOLD + theme.primary + 'Edit: ' + (item?.label || 'Value') + COLOR_RESET);
    lines.push(COLOR_DIM + 'Current: ' + (config[editingSettingKey] || '(not set)') + COLOR_RESET);
    lines.push('New value: ' + editInputBuffer + '\x1b[5m_' + COLOR_RESET);
    lines.push('');
    lines.push(COLOR_DIM + '[Enter] save | [Esc] cancel' + COLOR_RESET);
  }

  // Status bar with box lines
  lines.push('');
  lines.push(theme.primary + '─'.repeat(termWidth) + COLOR_RESET);
  lines.push(COLOR_DIM + 'Workspace: ' + workspaceName + COLOR_RESET);

  // Output - incrementally update each line
  lines.forEach((line, idx) => {
    process.stdout.write(`\x1b[${idx + 1}H\x1b[2K${line}`);
  });

  // Clear extra lines from previous view (if new view is shorter)
  if (!fullClear && prevViewLines > lines.length) {
    for (let i = lines.length + 1; i <= prevViewLines; i++) {
      process.stdout.write(`\x1b[${i}H\x1b[2K`);
    }
  }

  // Update previous view line count
  prevViewLines = lines.length;
}

export async function startTUI(): Promise<void> {
  renderScreen();

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Listen for terminal resize
    process.stdout.on('resize', () => {
      renderScreen();
    });

    process.stdin.on('data', async (data: Buffer) => {
      const input = data.toString();

      // Global: Exit
      if (input === '\x03' || input === '\x1b' || (input === 'q' && currentView === 'main')) {
        if (input === '\x1b' && currentView !== 'main') {
          // Ports and port-tag views return to settings
          if (currentView === 'ports' || currentView === 'port-tag' || currentView === 'settings-edit' || currentView === 'theme-select') {
            currentView = 'settings';
            editInputBuffer = '';
            editingSettingKey = '';
          } else if (currentView === 'settings-detail') {
            currentView = 'settings';
          } else {
            currentView = 'main';
          }
          outputBuffer = [];
          firmwareList = [];
          renderScreen();
          return;
        }
        if (input === '\x03' || (input === 'q' && currentView === 'main') || (input === '\x1b' && currentView === 'main')) {
          process.stdout.write('\x1b[?25h\x1b[2J\x1b[H');
          process.exit(0);
        }
      }

      // Navigation
      if (currentView === 'main') {
        if (input === '\x1b[A') { // Up
          const oldIndex = selectedMenu;
          selectedMenu = Math.max(0, selectedMenu - 1);
          if (oldIndex !== selectedMenu) updateListSelection('main', oldIndex, selectedMenu);
        } else if (input === '\x1b[B') { // Down
          const oldIndex = selectedMenu;
          selectedMenu = Math.min(menuItems.length - 1, selectedMenu + 1);
          if (oldIndex !== selectedMenu) updateListSelection('main', oldIndex, selectedMenu);
        } else if (input === '\r' || input === '\n') { // Enter
          const item = menuItems[selectedMenu];
          if (item.action === 'quit') {
            process.stdout.write('\x1b[?25h\x1b[2J\x1b[H');
            process.exit(0);
          } else {
            currentView = item.action;
            if (item.action === 'build') {
              loadBuildCommands();
            } else if (item.action === 'flash') {
              await loadFirmwareList();
            } else if (item.action === 'settings') {
              await loadPortList();  // Preload ports for Settings display
            }
            renderScreen();
          }
        } else if (input >= '1' && input <= '4') {
          // Number keys for menu selection
          const idx = parseInt(input) - 1;
          if (idx >= 0 && idx < menuItems.length && idx !== selectedMenu) {
            const oldIndex = selectedMenu;
            selectedMenu = idx;
            updateListSelection('main', oldIndex, selectedMenu);
            const item = menuItems[idx];
            if (item.action === 'quit') {
              process.stdout.write('\x1b[?25h\x1b[2J\x1b[H');
              process.exit(0);
            } else {
              currentView = item.action;
              if (item.action === 'build') {
                loadBuildCommands();
              } else if (item.action === 'flash') {
                await loadFirmwareList();
              } else if (item.action === 'settings') {
                await loadPortList();  // Preload ports for Settings display
              }
              renderScreen();
            }
          }
        }
      } else if (currentView === 'flash') {
        // Flash view - firmware selection
        if (isExecuting) {
          // During execution, handle Ctrl+O to toggle log
          if (input === '\x0f') { // Ctrl+O
            showFlashLog = !showFlashLog;
            renderScreen();
          }
        } else {
          if (input === 'r' || input === 'R') {
            await loadFirmwareList();
            renderScreen();
          } else if (input === '\x1b[A') { // Up
            const oldIndex = selectedFirmware;
            selectedFirmware = Math.max(0, selectedFirmware - 1);
            if (oldIndex !== selectedFirmware) updateListSelection('flash', oldIndex, selectedFirmware);
          } else if (input === '\x1b[B') { // Down
            const oldIndex = selectedFirmware;
            selectedFirmware = Math.min(Math.min(8, firmwareList.length) - 1, selectedFirmware + 1);
            if (oldIndex !== selectedFirmware) updateListSelection('flash', oldIndex, selectedFirmware);
          } else if (input >= '1' && input <= '8') {
            // Number keys to select firmware
            const idx = parseInt(input) - 1;
            if (idx >= 0 && idx < Math.min(8, firmwareList.length) && idx !== selectedFirmware) {
              const oldIndex = selectedFirmware;
              selectedFirmware = idx;
              updateListSelection('flash', oldIndex, selectedFirmware);
            }
          } else if (input === '\r' || input === '\n') {
            // Enter to flash selected firmware
            if (firmwareList.length > 0) {
              const fw = firmwareList[selectedFirmware];
              isExecuting = true;
              flashProgress = 0;
              flashStatus = 'idle';
              flashLogBuffer = [];
              showFlashLog = false;
              renderScreen();
              try {
                await flashFirmwareWithProgress(fw.path);
              } catch (err) {
                // Error already handled
              }
              isExecuting = false;
              renderScreen();
            }
          }
        }
      } else if (currentView === 'build') {
        // Build view - command selection
        if (!isExecuting) {
          const totalItems = Math.min(7, buildCommands.length) + 1; // +1 for Add option
          if (input === '\x1b[A') { // Up
            const oldIndex = selectedBuild;
            selectedBuild = Math.max(0, selectedBuild - 1);
            if (oldIndex !== selectedBuild) updateListSelection('build', oldIndex, selectedBuild);
          } else if (input === '\x1b[B') { // Down
            const oldIndex = selectedBuild;
            selectedBuild = Math.min(totalItems - 1, selectedBuild + 1);
            if (oldIndex !== selectedBuild) updateListSelection('build', oldIndex, selectedBuild);
          } else if (input >= '1' && input <= '8') {
            // Number keys to select command
            const idx = parseInt(input) - 1;
            if (idx >= 0 && idx < totalItems && idx !== selectedBuild) {
              const oldIndex = selectedBuild;
              selectedBuild = idx;
              updateListSelection('build', oldIndex, selectedBuild);
            }
          } else if (input === '\r' || input === '\n') {
            // Check if selecting "Add" option
            const addIndex = Math.min(7, buildCommands.length);
            if (selectedBuild === addIndex) {
              // Enter add command mode
              currentView = 'build-add';
              buildAddStep = 0;
              buildAddName = '';
              buildAddCommand = '';
              buildAddDescription = '';
              renderScreen();
            } else if (buildCommands.length > 0) {
              // Execute selected command
              const cmd = buildCommands[selectedBuild];
              isExecuting = true;
              renderScreen();
              try {
                await compileFirmware(cmd.name);
              } catch (err) {
                // Error already handled in compileFirmware
              }
              isExecuting = false;
              currentView = 'main';
              renderScreen();
            }
          } else if (input === 'd' || input === 'D') {
            // Delete selected command (not the Add option)
            const addIndex = Math.min(7, buildCommands.length);
            if (selectedBuild < addIndex && buildCommands.length > 0) {
              // Delete from config
              const config = loadConfig() as any || {};
              if (config.buildCommands) {
                config.buildCommands.splice(selectedBuild, 1);
                saveConfig(config);
                // Reload and adjust selection
                loadBuildCommands();
                selectedBuild = Math.min(selectedBuild, Math.min(7, buildCommands.length));
                renderScreen();
              }
            }
          }
          }
        } else if (currentView === 'build-add') {
          // Add command input handling
          if (input === '\x1b') { // Esc - cancel
            currentView = 'build';
            loadBuildCommands();
            renderScreen();
          } else if (input === '\x1b[A') { // Up - previous field
            buildAddStep = Math.max(0, buildAddStep - 1);
            renderScreen();
          } else if (input === '\x1b[B') { // Down - next field
            buildAddStep = Math.min(2, buildAddStep + 1);
            renderScreen();
          } else if (input === '\r' || input === '\n') { // Enter - save
            if (buildAddName && buildAddCommand) {
              // Save new command to config
              const config = loadConfig() as any || {};
              if (!config.buildCommands) {
                config.buildCommands = [];
              }
              config.buildCommands.push({
                name: buildAddName,
                command: buildAddCommand,
                description: buildAddDescription || '',
                isActive: false
              });
              saveConfig(config);
              // Return to build view
              currentView = 'build';
              loadBuildCommands();
              renderScreen();
            }
          } else if (input === '\x7f' || input === '\b') { // Backspace
            // Remove last char from current field
            if (buildAddStep === 0) {
              buildAddName = buildAddName.slice(0, -1);
            } else if (buildAddStep === 1) {
              buildAddCommand = buildAddCommand.slice(0, -1);
            } else {
              buildAddDescription = buildAddDescription.slice(0, -1);
            }
          renderScreen();
          } else if (input.length === 1 && input >= ' ') { // Regular char
            // Add to current field
            if (buildAddStep === 0) {
              buildAddName += input;
            } else if (buildAddStep === 1) {
              buildAddCommand += input;
            } else {
              buildAddDescription += input;
            }
            renderScreen();
          }
        } else if (currentView === 'ports') {
        // Ports view
        if (!isExecuting) {
          if (input === 'r' || input === 'R') {
            await loadPortList();
            renderScreen();
          } else if (input === '\x1b[A') { // Up
            const oldIndex = selectedPort;
            selectedPort = Math.max(0, selectedPort - 1);
            if (oldIndex !== selectedPort) updateListSelection('ports', oldIndex, selectedPort);
          } else if (input === '\x1b[B') { // Down
            const oldIndex = selectedPort;
            selectedPort = Math.min(Math.min(8, portList.length) - 1, selectedPort + 1);
            if (oldIndex !== selectedPort) updateListSelection('ports', oldIndex, selectedPort);
          } else if (input >= '1' && input <= '8') {
            const idx = parseInt(input) - 1;
            if (idx >= 0 && idx < Math.min(8, portList.length) && idx !== selectedPort) {
              const oldIndex = selectedPort;
              selectedPort = idx;
              updateListSelection('ports', oldIndex, selectedPort);
            }
          } else if (input === '\r' || input === '\n') {
            // Enter to edit port tags
            if (portList.length > 0) {
              selectedTag = 0;
              currentView = 'port-tag';
              renderScreen();
            }
          }
        }
      } else if (currentView === 'port-tag') {
        // Port tag edit view
        const port = portList[selectedPort];
        if (input === '\x1b[A') { // Up
          const oldIndex = selectedTag;
          selectedTag = Math.max(0, selectedTag - 1);
          if (oldIndex !== selectedTag) updateListSelection('port-tag', oldIndex, selectedTag);
        } else if (input === '\x1b[B') { // Down
          const oldIndex = selectedTag;
          selectedTag = Math.min(portTags.length - 1, selectedTag + 1);
          if (oldIndex !== selectedTag) updateListSelection('port-tag', oldIndex, selectedTag);
        } else if (input >= '1' && input <= '3') {
          const idx = parseInt(input) - 1;
          if (idx >= 0 && idx < portTags.length && idx !== selectedTag) {
            const oldIndex = selectedTag;
            selectedTag = idx;
            updateListSelection('port-tag', oldIndex, selectedTag);
          }
        } else if (input === '\r' || input === '\n') {
          // Add or remove selected tag
          const tag = portTags[selectedTag];
          if (port.tags.includes(tag)) {
            removePortTag(port.path, tag);
          } else {
            savePortTag(port.path, tag);
          }
          // Reload port list to reflect changes
          await loadPortList();
          currentView = 'ports';
          renderScreen();
        } else if (input === 'd' || input === 'D') {
          // Clear all tags for this port
          const config = loadConfig() as any || {};
          if (config.comPorts) {
            config.comPorts = config.comPorts.filter((p: any) => p.port !== port.path);
            saveConfig(config);
          }
          await loadPortList();
          currentView = 'ports';
          renderScreen();
        }
      } else if (currentView === 'settings') {
        // Settings view - navigation
        if (input === '\x1b[A') { // Up
          const oldIndex = selectedSetting;
          selectedSetting = Math.max(0, selectedSetting - 1);
          if (oldIndex !== selectedSetting) updateListSelection('settings', oldIndex, selectedSetting);
        } else if (input === '\x1b[B') { // Down
          const oldIndex = selectedSetting;
          selectedSetting = Math.min(settingsItems.length - 1, selectedSetting + 1);
          if (oldIndex !== selectedSetting) updateListSelection('settings', oldIndex, selectedSetting);
        } else if (input >= '1' && input <= '5') {
          // Number keys to select setting
          const idx = parseInt(input) - 1;
          if (idx >= 0 && idx < settingsItems.length && idx !== selectedSetting) {
            const oldIndex = selectedSetting;
            selectedSetting = idx;
            updateListSelection('settings', oldIndex, selectedSetting);
          }
        } else if (input === '\r' || input === '\n') {
          // Enter to show/edit setting
          const item = settingsItems[selectedSetting];
          if (item.type === 'ports') {
            // Enter Ports configuration view
            await loadPortList();
            currentView = 'ports';
            renderScreen();
          } else if (item.type === 'theme') {
            // Enter theme color selection
            const config = loadConfig() as any || {};
            const currentTheme = config.theme?.color || 'cyan';
            selectedThemeColor = themeColorNames.indexOf(currentTheme);
            if (selectedThemeColor < 0) selectedThemeColor = 0;
            currentView = 'theme-select';
            renderScreen();
          } else if (item.type === 'action') {
            // Open config file with notepad
            const configPath = findConfigPath();
            if (configPath) {
              spawn('notepad', [configPath], { detached: true, stdio: 'ignore' });
            } else {
              // Create default config in current directory
              const defaultPath = process.cwd() + '/dove.json';
              spawn('notepad', [defaultPath], { detached: true, stdio: 'ignore' });
            }
          } else if (item.type === 'path') {
            // Enter edit mode for path settings
            editingSettingKey = item.key;
            const config = loadConfig() as any || {};
            editInputBuffer = config[item.key] || '';
            currentView = 'settings-edit';
            renderScreen();
          } else {
            // Show detail for other settings
            const config = loadConfig() as any || {};
            const value = config[item.key];
            outputBuffer = [];
            if (item.type === 'array') {
              const arr = value || [];
              outputBuffer.push(COLOR_BOLD + item.label + ' (' + arr.length + ' items):' + COLOR_RESET);
              arr.forEach((elem: any, i: number) => {
                const str = typeof elem === 'object' ? JSON.stringify(elem) : String(elem);
                outputBuffer.push(`  ${i + 1}. ${truncate(str, 40)}`);
              });
              if (arr.length === 0) {
                outputBuffer.push('  ' + COLOR_DIM + '(empty)' + COLOR_RESET);
              }
            } else {
              outputBuffer.push(COLOR_BOLD + item.label + ':' + COLOR_RESET);
              outputBuffer.push(`  ${value || COLOR_DIM + '(not set)' + COLOR_RESET}`);
            }
            outputBuffer.push('');
            outputBuffer.push(COLOR_DIM + 'Edit in dove.json file' + COLOR_RESET);
            currentView = 'settings-detail';
            renderScreen();
          }
        }
      } else if (currentView === 'theme-select') {
        // Theme color selection
        if (input === '\x1b[A') { // Up
          const oldIndex = selectedThemeColor;
          selectedThemeColor = Math.max(0, selectedThemeColor - 1);
          if (oldIndex !== selectedThemeColor) updateListSelection('theme', oldIndex, selectedThemeColor);
        } else if (input === '\x1b[B') { // Down
          const oldIndex = selectedThemeColor;
          selectedThemeColor = Math.min(themeColorNames.length - 1, selectedThemeColor + 1);
          if (oldIndex !== selectedThemeColor) updateListSelection('theme', oldIndex, selectedThemeColor);
        } else if (input >= '1' && input <= '7') {
          // Number keys to select theme
          const idx = parseInt(input) - 1;
          if (idx >= 0 && idx < themeColorNames.length && idx !== selectedThemeColor) {
            const oldIndex = selectedThemeColor;
            selectedThemeColor = idx;
            updateListSelection('theme', oldIndex, selectedThemeColor);
          }
        } else if (input === '\r' || input === '\n') {
          // Enter to select theme
          const config = loadConfig() as any || {};
          config.theme = { color: themeColorNames[selectedThemeColor] };
          saveConfig(config);
          currentView = 'settings';
          renderScreen();
        }
      } else if (currentView === 'settings-detail') {
        // Settings detail view - just show info, press any key to go back
        if (input === '\x1b' || input === '\r' || input === '\n') {
          currentView = 'settings';
          outputBuffer = [];
          renderScreen();
        }
      } else if (currentView === 'settings-edit') {
        // Settings edit view - text input
        if (input === '\x1b') {
          // Escape - cancel
          currentView = 'settings';
          editInputBuffer = '';
          editingSettingKey = '';
          renderScreen();
        } else if (input === '\r' || input === '\n') {
          // Enter - save
          const config = loadConfig() as any || {};
          config[editingSettingKey] = editInputBuffer;
          saveConfig(config);
          currentView = 'settings';
          editInputBuffer = '';
          editingSettingKey = '';
          renderScreen();
        } else if (input === '\x7f' || input === '\b') {
          // Backspace
          editInputBuffer = editInputBuffer.slice(0, -1);
          renderScreen();
        } else if (input.length === 1 && input.charCodeAt(0) >= 32) {
          // Regular character input
          editInputBuffer += input;
          renderScreen();
        }
      }
    });
  }

  // Keep running
  await new Promise(() => {});
}