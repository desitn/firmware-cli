import fs from 'fs';
import path from 'path';
import { findWorkspacePath, loadConfig, saveConfig, isWindows, executeCommand, getGlobalPaths } from './utils';

/**
 * Build command interface
 */
interface BuildCommand {
  name: string;
  command: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Compile firmware
 * @param commandIdentifier - Build command name or index (optional)
 */
export async function compileFirmware(commandIdentifier: string | null = null): Promise<void> {
  try {
    console.log('Firmware Compilation Tool');
    console.log('='.repeat(50));
    
    const workspacePath = findWorkspacePath();
    if (!workspacePath) {
      throw new Error('Workspace not found, please run from project root');
    }
    
    console.log(`Workspace: ${workspacePath}`);
    
    const config = loadConfig();
    
    // Get build command to execute
    let buildCmd: BuildCommand | null = null;

    if (commandIdentifier) {
      // Try to find by name first
      buildCmd = findCommandByName(config.buildCommands, commandIdentifier);

        // If not found by name, try to parse as index
        if (!buildCmd) {
          const index = parseInt(commandIdentifier, 10);
          if (!isNaN(index) && index > 0 && config.buildCommands && index <= config.buildCommands.length) {
            buildCmd = config.buildCommands[index - 1];
          }
        }

      if (!buildCmd) {
        throw new Error(`Build command "${commandIdentifier}" not found`);
      }
    } else {
      // No identifier provided, use active command
      if (config.buildCommands) {
        // Find the active command
        buildCmd = config.buildCommands.find(cmd => cmd.isActive) || null;

        // If no active command found, use first command
        if (!buildCmd && config.buildCommands.length > 0) {
          buildCmd = config.buildCommands[0];
        }
      }

      if (!buildCmd) {
        throw new Error('No build commands configured, please add commands to dove.json');
      }
    }

    console.log(`Build command: [${buildCmd.name}] ${buildCmd.command}`);
    if (buildCmd.description) {
      console.log(`Description: ${buildCmd.description}`);
    }
    console.log('='.repeat(50));

    // Update active command
    if (!buildCmd.isActive && config.buildCommands) {
      config.buildCommands.forEach(cmd => {
        cmd.isActive = cmd.name === buildCmd!.name;
      });
      saveConfig(config);
    }
    
    await executeBuild(workspacePath, buildCmd.command, config.buildGitBashPath);
    
    console.log('='.repeat(50));
    console.log('Compilation finished');
    console.log('> 1. Identify command line output');
    console.log('> 2. Check for compilation errors');
    console.log('> 3. Check if new firmware is generated');
    
  } catch (error) {
    const err = error as Error;
    console.error('Compilation failed:', err.message);
    process.exit(1);
  }
}

/**
 * Find command by name in buildCommands array
 */
function findCommandByName(commands: BuildCommand[] | undefined, name: string): BuildCommand | null {
  if (!commands || commands.length === 0) {
    return null;
  }
  
  const found = commands.find(cmd => cmd.name === name);
  return found || null;
}

/**
 * List all available build commands
 */
export async function listBuildCommands(): Promise<void> {
  const config = loadConfig();

  console.log('Available Build Commands');
  console.log('='.repeat(50));

  if (!config.buildCommands || config.buildCommands.length === 0) {
    console.log('No build commands configured.');
    console.log('\nAdd commands to dove.json:');
    console.log('  "buildCommands": [');
    console.log('    { "name": "build", "command": "build.bat", "description": "Production build", "isActive": true },');
    console.log('    { "name": "clean", "command": "clean.bat", "description": "Clean build artifacts" }');
    console.log('  ]');
    return;
  }

  config.buildCommands.forEach((cmd, index) => {
    const marker = cmd.isActive ? ' (active)' : '';
    const desc = cmd.description ? ` - ${cmd.description}` : '';
    console.log(`  ${index + 1}. [${cmd.name}] ${cmd.command}${desc}${marker}`);
  });

  console.log('\nUsage:');
  console.log('  dove build              # Run active command');
  console.log('  dove build -i  1        # Run by index');
  console.log('  dove build -n  "clean"  # Run by name');
}

/**
 * Execute build with PATH injection
 */
async function executeBuild(workspacePath: string, buildCommand: string, bashPath: string | undefined): Promise<void> {
  // Load global config for Git Bash path
  const globalPaths = getGlobalPaths();
  const gitBashPath = globalPaths?.gitBash || bashPath;

  // Get bin directory for PATH injection
  const gitBashBinDir = gitBashPath ? path.dirname(gitBashPath) : null;

  // Build environment with PATH injection
  const env = gitBashBinDir ? {
    ...process.env,
    PATH: isWindows()
      ? `${gitBashBinDir};${process.env.PATH}`
      : `${gitBashBinDir}:${process.env.PATH}`
  } : process.env;

  let taskCmd: string;
  let args: string[];

  // Check if the command is a bash script (.sh file)
  // Match .sh followed by space or end of string to handle cases like "build.sh -app"
  const isBash = /\.sh(\s|$)/i.test(buildCommand);

  if (isWindows()) {
    if (isBash) {
      if (!gitBashPath || !fs.existsSync(gitBashPath)) {
        throw new Error('Shell script requires Git Bash, please set paths.gitBash in global.json or buildGitBashPath in dove.json');
      }
      taskCmd = gitBashPath;
      args = ['-c', `./${buildCommand}`];
      console.log(`Using Git Bash: ${gitBashPath}`);
      console.log(`PATH injected: ${gitBashBinDir}`);
    } else {
      taskCmd = 'cmd';
      args = ['/c', `${buildCommand}`];
    }
  } else {
    taskCmd = '/bin/bash';
    args = ['-c', `${buildCommand}`];
  }

  console.log(`\nExecuting command: ${taskCmd} ${args.join(' ')}`);
  console.log('='.repeat(50));

  try {
    await executeCommand(taskCmd, args, {
      cwd: workspacePath,
      shell: true,
      env: env
    });
  } catch (error) {
    const err = error as Error;
    throw new Error(`Build command execution failed: ${err.message}`);
  }
}

/**
 * Add build command
 */
export async function addBuildCommand(name: string, command: string, description: string = ''): Promise<void> {
  const config = loadConfig();

  if (!config.buildCommands) {
    config.buildCommands = [];
  }

  // Check if name already exists
  const existingIndex = config.buildCommands.findIndex(cmd => cmd.name === name);
  if (existingIndex >= 0) {
    // Update existing command
    config.buildCommands[existingIndex].command = command;
    config.buildCommands[existingIndex].description = description;
    console.log(`Updated build command: [${name}] ${command}`);
    if (description) {
      console.log(`Description: ${description}`);
    }
  } else {
    // Add new command
    const isActive = config.buildCommands.length === 0; // First command is active by default
    config.buildCommands.push({ name, command, description, isActive });
    console.log(`Added build command: [${name}] ${command}`);
    if (description) {
      console.log(`Description: ${description}`);
    }
  }

  // If this is the first command, set it as active
  if (config.buildCommands.length === 1) {
    console.log(`Set "${name}" as active command`);
  }

  saveConfig(config);
  console.log('Config saved to dove.json');
}

/**
 * Remove build command
 */
export async function removeBuildCommand(name: string): Promise<void> {
  const config = loadConfig();

  if (!config.buildCommands || config.buildCommands.length === 0) {
    console.log('No build commands to remove');
    return;
  }

  const index = config.buildCommands.findIndex(cmd => cmd.name === name);
  if (index < 0) {
    console.log(`Build command "${name}" not found`);
    return;
  }

  const wasActive = config.buildCommands[index].isActive;
  config.buildCommands.splice(index, 1);

  // If removed command was active, set first command as active
  if (wasActive && config.buildCommands.length > 0) {
    config.buildCommands[0].isActive = true;
    console.log(`Active command changed to: ${config.buildCommands[0].name}`);
  }

  saveConfig(config);
  console.log(`Removed build command: ${name}`);
}

/**
 * Set active build command
 */
export async function setActiveCommand(name: string): Promise<void> {
  const config = loadConfig();

  if (!config.buildCommands || config.buildCommands.length === 0) {
    throw new Error('No build commands configured');
  }

  const found = config.buildCommands.find(cmd => cmd.name === name);
  if (!found) {
    throw new Error(`Build command "${name}" not found`);
  }

  // Set all commands inactive, then set the specified one active
  config.buildCommands.forEach(cmd => {
    cmd.isActive = cmd.name === name;
  });

  saveConfig(config);
  console.log(`Set "${name}" as active build command`);
}

/**
 * Set config
 */
export async function setConfig(key: string, value: string): Promise<void> {
  const config = loadConfig();
  
  if (key === 'firmwarePath') {
    config.firmwarePath = value;
    console.log(`Set firmware path: ${value}`);
  } else if (key === 'buildGitBashPath') {
    config.buildGitBashPath = value;
    console.log(`Set Git Bash path: ${value}`);
  } else if (key === 'defaultComPort') {
    config.defaultComPort = value;
    console.log(`Set default COM port: ${value}`);
  } else {
    throw new Error(`Unknown config item: ${key}`);
  }
  
  saveConfig(config);
  console.log('Config saved to dove.json');
}

/**
 * Show config
 */
export async function showConfig(): Promise<void> {
  const config = loadConfig();

  console.log('Current Config');
  console.log('='.repeat(50));
  console.log(`Firmware path: ${config.firmwarePath || 'Not set'}`);
  console.log(`Git Bash: ${config.buildGitBashPath || 'Not set'}`);
  console.log(`Default COM port: ${config.defaultComPort || 'Not set'}`);

  if (config.buildCommands && config.buildCommands.length > 0) {
    const activeCmd = config.buildCommands.find(cmd => cmd.isActive);
    console.log(`\nActive command: ${activeCmd?.name || 'None'}`);

    console.log('\nBuild commands:');
    config.buildCommands.forEach((cmd, index) => {
      const marker = cmd.isActive ? ' *' : '';
      const desc = cmd.description ? ` (${cmd.description})` : '';
      console.log(`  ${index + 1}. [${cmd.name}] ${cmd.command}${desc}${marker}`);
    });
  }

  console.log('='.repeat(50));
}
