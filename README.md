# Dove - Firmware CLI Tool

> Release a dove, deliver your firmware.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

嵌入式固件编译和烧录CLI工具，支持多种芯片平台的固件开发流程。

## Features

- **Multi-Platform Support**: ASR 160X/180X/190X, UNISOC 8310/8910/8850, Eigen 618/718, ESP
- **Auto Detection**: Automatic firmware type detection and port discovery
- **Unified Port Commands**: Consistent `port` subcommand for all port operations
- **Serial Monitoring**: Real-time serial port monitoring with filtering and logging
- **AT Commands**: Interactive AT command execution with auto port detection
- **AI Integration**: Designed for AI assistant integration (Cline, Claude, etc.)
- **Configuration Management**: JSON-based configuration with CLI management

## Quick Start

### Installation

#### Method 1: Use with Node.js (Development)
```bash
npm install
npm run build
```

#### Method 2: Use Standalone Executable (No Node.js Required)
Download `dove.exe` from the `dist/` directory.

### First Flash

1. **Initialize configuration** (optional):
```bash
dove.exe config set firmwarePath "C:/path/to/firmware"
```

2. **Flash firmware** (auto-detect):
```bash
dove.exe flash
```

## Usage

### Running the Tool

```bash
# Using Node.js
node dist/index.js <command> [arguments]

# Using standalone executable
dove.exe <command> [arguments]
```

### Commands

#### Compile Firmware
```bash
# Auto-find build command
dove.exe build

# List available build commands (JSON output)
dove.exe build --list

# Run command by index
dove.exe build --index 1

# Run command by name
dove.exe build --name install
```

#### Build and Flash
```bash
dove.exe build-and-flash
```

#### Flash Firmware
```bash
# Auto-find and flash firmware
dove.exe flash

# Specify firmware path
dove.exe flash "C:/path/firmware.bin"

# Skip auto entering download mode
dove.exe flash --skip-dl-mode

# List available firmware (JSON output)
dove.exe flash --list
```

#### Port Operations (Unified)

The `port` command provides unified interface for all port-related operations. All query commands output JSON by default for AI integration:

##### List Ports (JSON output)
```bash
# List serial ports (JSON output)
dove.exe port list

# List USB devices (JSON output)
dove.exe port list --usb

# List both USB and serial ports (JSON output)
dove.exe port list --all
```

##### Monitor Serial Port
```bash
# Monitor with default settings
dove.exe port monitor -p COM9

# Monitor with timeout and output file
dove.exe port monitor -p COM9 --timeout 30000 -o log.txt

# Select port by tag (uses comPorts config)
dove.exe port monitor --tag Log --timeout 30000

# Filter output (include only ERROR lines)
dove.exe port monitor -p COM9 --include "ERROR" -o errors.log

# JSON output for programmatic use
dove.exe port monitor -p COM9 --json --timeout 5000

# Capture until specific text
dove.exe port monitor -p COM9 --until "Done" -o boot.log

# Capture N lines
dove.exe port monitor -p COM9 --lines 100 -o debug.log
```

##### Send AT Commands (JSON output)
```bash
# Auto-detect AT port and send command (JSON output)
dove.exe port at -c "ATI"

# Specify port (JSON output)
dove.exe port at -p COM107 -c "AT+CGMI"

# Select port by tag (JSON output)
dove.exe port at --tag AT -c "ATI"

# Device reset (requires confirmation in AI skill)
dove.exe port at -c "AT+CFUN=1,1" --timeout 10000
```

**Example JSON Output:**
```json
{
  "success": true,
  "response": "ATI\r\nQuectel\nEC200U\nRevision: EC200UCNLBR03A02M08\nOK",
  "port": "COM107",
  "duration": 245
}
```

#### Configuration Management (JSON output)
```bash
# Show current configuration (JSON output)
dove.exe config

# Set configuration values (JSON output)
dove.exe config set firmwarePath "C:/path/to/firmware"
dove.exe config set buildCommand "build_OPTfile.bat"
dove.exe config set buildGitBashPath "C:/Program Files/Git/bin/bash.exe"
dove.exe config set defaultComPort "COM107"
```

#### Help
```bash
dove.exe help
```

## Configuration Files

### Project Configuration

Create `dove.json` in your project root:

```json
{
  "firmwarePath": "",
  "buildCommands": [],
  "buildGitBashPath": "",
  "defaultComPort": "",
  "comPorts": [
    { "port": "COM9", "tags": ["AT"], "isActive": true },
    { "port": "COM10", "tags": ["Log", "Debug"] }
  ]
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `firmwarePath` | Path to firmware files or directory | Auto-detect |
| `buildCommands` | Build scripts/commands | Auto-detect |
| `buildGitBashPath` | Path to Git Bash executable | System PATH |
| `defaultComPort` | Default serial port for monitoring | None |
| `comPorts` | Port configurations with tags | None |

### Using Port Tags

Port tags allow AI assistants to automatically select appropriate ports:

```json
{
  "comPorts": [
    { "port": "COM107", "tags": ["AT"], "isActive": true },
    { "port": "COM108", "tags": ["Log", "Debug"] },
    { "port": "COM109", "tags": ["Download"] }
  ]
}
```

Available tags:
- **AT**: AT command port
- **Log**: Log monitoring port
- **Debug**: Debug output port
- **Download**: Firmware download port
- **UART**: General serial communication

Usage:
```bash
dove.exe port monitor --tag Log --timeout 30000
dove.exe port at --tag AT -c "ATI"
```

### Tool Configuration

Tool configurations are stored in `tools/config/` directory:

```
tools/config/
├── global.json           # Global settings and serial configuration
├── asr160x.json         # ASR 160X platform configuration
├── asr1x03.json         # ASR 180X/190X platform configuration
├── unisoc.json          # UNISOC platform configuration
├── eigen.json           # Eigen platform configuration
└── esp.json             # ESP platform configuration
```

## Supported Firmware Types

| Platform | Chip Models | File Extension | Description |
|----------|-------------|----------------|-------------|
| **ASR** | 160X | `*.zip` | ASR 160X ABOOT format |
| **ASR** | 180X/190X | `*_fbf.bin` | ASR FBF format |
| **UNISOC** | 8310/8910/8850 | `*.pac` | UNISOC PAC format |
| **Eigen** | 618/718 | `*_download_usb.ini` | Eigen ECF format |
| **ESP** | - | `*.bin` | ESP binary format |

## Serial Monitoring Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port` | Serial port (e.g., COM9) | Required or from config |
| `--tag` | Select port by tag | None |
| `-b, --baud` | Baud rate | 115200 |
| `--timeout` | Timeout in milliseconds | 0 (no timeout) |
| `-o, --output` | Output file path | None |
| `-a, --append` | Append to file (default: overwrite) | false |
| `--include` | Include lines containing keywords (comma-separated) | None |
| `--exclude` | Exclude lines containing keywords (comma-separated) | None |
| `--until` | Exit after receiving this text | None |
| `--until-regex` | Exit after regex match | None |
| `--lines` | Capture N lines then exit | 0 (unlimited) |
| `--json` | Output results in JSON format | false |
| `--timestamp` | Add timestamp to each line | false |

## Troubleshooting

### "Firmware file not found"
- Check if `firmwarePath` in config is correct
- Verify firmware files exist in the specified path
- Try using absolute path: `dove.exe flash "C:/full/path/firmware.bin"`

### "Workspace not found"
- Ensure you're running from a project directory containing `quectel_build` folder
- Or configure `firmwarePath` to point to your firmware directory

### "Download tool not found"
- Verify `tools/` directory exists and contains required executables
- Check `tools/config/` directory for platform configuration files

### "Build command not found"
- Use `dove.exe build --list` to see available commands
- Configure build command: `dove.exe config set buildCommands ["build.bat"]`

### "AT port not found"
- Check USB connection and drivers
- Try specifying port manually: `dove.exe port at -p COM107 -c "ATI"`
- List available ports: `dove.exe port list`

### "Serial port access denied"
- Close other applications using the serial port
- Run as Administrator (if needed)
- Check port is not in use by another process

## Project Structure

```
dove/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main entry point
│   ├── flash.ts           # Firmware flashing logic
│   ├── compile.ts         # Build/compile logic
│   ├── serial.ts          # Serial port operations
│   ├── list.ts            # Firmware listing
│   ├── utils.ts           # Utility functions
│   └── types/             # TypeScript type definitions
├── tools/                 # Download tools and config
│   ├── config/            # Platform configurations
│   ├── adownload.exe      # ASR 160X tool
│   ├── FBFDownloader.exe  # ASR 180X/190X tool
│   └── pacdownload/       # UNISOC tools
├── dist/                  # Compiled JavaScript
├── skill/                 # AI skill integration
│   ├── dove-action/       # High-risk operations (flash, build)
│   └── dove-query/        # Low-risk queries (list, devices, config)
├── tests/                 # Test scripts
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Building from Source

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build executable
npm run build:exe

# Development mode
npm run dev

# Watch mode
npm run build:watch
```

## Dependencies

- **iconv-lite**: Encoding conversion for Chinese output
- **adm-zip**: ZIP file handling
- **serialport**: Serial port communication
- **@serialport/parser-readline**: Line-based serial parsing

## AI Assistant Integration

This CLI tool is designed for seamless AI assistant integration. Key features:

- **Default JSON Output**: All query commands output JSON by default for easy parsing
- **Structured Responses**: AT commands, port lists, config, firmware lists all return JSON
- **Natural Language Execution**: AI tools can execute commands via natural language
- **Serial Monitoring**: Real-time serial port monitoring for automated testing
- **AT Commands**: Query device info without confirmation, destructive commands require confirmation

### JSON Output Commands

| Command | Output | Description |
|---------|--------|-------------|
| `port list` | JSON | Serial/USB port information |
| `port at -c "..."` | JSON | AT command response |
| `flash --list` | JSON | Available firmware files |
| `build --list` | JSON | Build commands list |
| `config` | JSON | Current configuration |
| `config set` | JSON | Configuration update result |

See `skill/dove-action/SKILL.md` and `skill/dove-query/SKILL.md` for detailed AI integration documentation.

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Maintained by**: destin.zhang@quectel.com