# Firmware CLI Tool

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

嵌入式固件编译和烧录 CLI 工具，支持多种芯片平台的固件开发流程。

## Features

- **Multi-Platform Support**: ASR 160X/180X/190X, UNISOC 8310/8910/8850, Eigen 618/718
- **Auto Detection**: Automatic firmware type detection and port discovery
- **Serial Monitoring**: Real-time serial port monitoring with filtering and logging
- **AT Commands**: Interactive AT command execution with auto port detection
- **AI Integration**: Designed for AI assistant integration (Cline, etc.)
- **Configuration Management**: JSON-based configuration with CLI management

## Quick Start

### Installation

#### Method 1: Use with Node.js (Development)
```bash
npm install
npm run build
```

#### Method 2: Use Standalone Executable (No Node.js Required)
Download `firmware-cli.exe` from the `dist/` directory.

### First Flash

1. **Initialize configuration** (optional):
```bash
firmware-cli.exe config set firmwarePath "C:/path/to/firmware"
```

2. **Flash firmware** (auto-detect):
```bash
firmware-cli.exe flash
```

## Usage

### Running the Tool

```bash
# Using Node.js
node dist/index.js <command> [arguments]

# Using standalone executable
firmware-cli.exe <command> [arguments]
```

### Commands

#### Flash Firmware
```bash
# Auto-find and flash firmware
firmware-cli.exe flash

# Specify firmware path
firmware-cli.exe flash "C:/path/firmware.bin"

# Skip auto entering download mode
firmware-cli.exe flash --skip-dl-mode
```

#### List Available Firmware
```bash
firmware-cli.exe list
```

**Example Output:**
```
Firmware List
==================================================
Found 3 firmware(s):

1. firmware_v1.2.3.zip
   Type: ASR ABOOT
   Size: 15.6 MB
   Time: 2024/01/15 14:30:25
   Path: C:/workspace/release/v1.2.3/firmware_v1.2.3.zip

2. firmware_v1.2.2.zip
   Type: ASR ABOOT
   Size: 15.4 MB
   Time: 2024/01/14 09:15:10
   Path: C:/workspace/release/v1.2.2/firmware_v1.2.2.zip
```

#### List USB Devices
```bash
firmware-cli.exe devices
```

#### List Serial Ports
```bash
firmware-cli.exe serial
```

#### Compile Firmware
```bash
# Auto-find build command
firmware-cli.exe build

# Specify build command
firmware-cli.exe build "build_OPTfile.bat"
```

#### Build and Flash
```bash
firmware-cli.exe build-and-flash
```

#### Serial Port Monitoring
```bash
# Monitor with default settings
firmware-cli.exe monitor -p COM107

# Monitor with timeout and output file
firmware-cli.exe monitor -p COM107 --timeout 30000 -o log.txt

# Filter output (include only ERROR lines)
firmware-cli.exe monitor -p COM107 --include "ERROR" -o errors.log

# JSON output for programmatic use
firmware-cli.exe monitor -p COM107 --json --timeout 5000
```

#### Send AT Commands
```bash
# Auto-detect AT port and send command
firmware-cli.exe at -c "ATI"

# Specify port
firmware-cli.exe at -p COM107 -c "AT+CGMI"

# JSON output
firmware-cli.exe at -c "ATI" --json
```

**Example Output:**
```
AT Command Result
==================================================
Port: COM107
Command: ATI
Duration: 245ms

Response:
Quectel
EC200U
Revision: EC200UCNLBR03A02M08

Status: OK
```

#### Configuration Management
```bash
# Show current configuration
firmware-cli.exe config

# Set configuration values
firmware-cli.exe config set firmwarePath "C:/path/to/firmware"
firmware-cli.exe config set buildCommand "build_OPTfile.bat"
firmware-cli.exe config set buildGitBashPath "C:/Program Files/Git/bin/bash.exe"
firmware-cli.exe config set defaultComPort "COM107"
```

#### Help
```bash
firmware-cli.exe help
```

## Configuration Files

### Project Configuration

Create `firmware-cli.json` in your project root:

```json
{
  "firmwarePath": "",
  "buildCommand": "",
  "buildGitBashPath": "",
  "defaultComPort": ""
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `firmwarePath` | Path to firmware files or directory | Auto-detect |
| `buildCommand` | Build script/command | Auto-detect |
| `buildGitBashPath` | Path to Git Bash executable | System PATH |
| `defaultComPort` | Default serial port for monitoring | None |

### Tool Configuration

Tool configurations are stored in `tools/config/` directory with the following structure:

```
tools/config/
├── global.json           # Global settings and serial configuration
├── asr160x.json         # ASR 160X platform configuration
├── asr1x03.json         # ASR 180X/190X platform configuration
├── unisoc.json          # UNISOC platform configuration
├── eigen.json           # Eigen platform configuration
└── esp.json             # ESP platform configuration
```

Each platform configuration file contains:
- **platform**: Platform-specific settings (extensions, serial config, progress patterns)
- **tool**: Download tool configuration (name, path, arguments)

Example (`tools/config/asr160x.json`):
```json
{
  "platform": {
    "type": "ad",
    "extensions": [".zip"],
    "description": "ASR 160X Series",
    "serial": {
      "atPortPatterns": ["at port", "modem"],
      "atCommand": "AT+QDOWNLOAD=1",
      "baudrate": 115200,
      "autoEnterDlMode": true,
      "downloadPortPatterns": ["download"],
      "downloadPortVidPid": [
        { "vid": "2ECC", "pid": "3004", "desc": "BOOT" }
      ]
    },
    "progressPatterns": {
      "started": ["CONNECTING"],
      "downloading": ["RUNNING"],
      "completed": ["SUCCEEDED"],
      "error": ["error", "timeout"]
    }
  },
  "tool": {
    "name": "adownload",
    "path": "adownload.exe",
    "description": "ASR 160X Download Tool",
    "args": {
      "flash": ["-r", "-q", "-a", "-u", "-s", "115200", "{firmwarePath}"],
      "default": []
    }
  }
}
```

### Adding New Platform Support

To add support for a new chip platform:

1. Create a new JSON file in `tools/config/` (e.g., `newplatform.json`)
2. Define the platform configuration with:
   - `platform.type`: Tool type identifier
   - `platform.extensions`: Supported file extensions
   - `platform.serial`: Serial port configuration
   - `tool`: Download tool configuration (if applicable)
3. Place the download tool executable in `tools/` directory

## Supported Firmware Types

| Platform | Chip Models | File Extension | Description |
|----------|-------------|----------------|-------------|
| **ASR** | 160X | `*.zip` | ASR 160X ABOOT format |
| **ASR** | 180X/190X | `*_fbf.bin` | ASR FBF format |
| **UNISOC** | 8310/8910/8850 | `*.pac` | UNISOC PAC format |
| **Eigen** | 618/718 | `*_download_usb.ini` | Eigen ECF format |

## Progress Display Options

The firmware flash tool supports two progress display modes:

### Single-line Mode (Default)
- Uses `\r` to update the same line
- Suitable for terminal user interaction
- Display: `[====================] 50% Downloading...`

### Multi-line Mode
- Outputs new line for each update
- Suitable for UI program parsing
- Display:
  ```
  [2024-01-15 14:30:25] Progress: 50%
  [2024-01-15 14:30:26] Progress: 51%
  ```

### Configuration

Set progress mode in `tools/config/global.json`:

```json
{
  "outputConfig": {
    "progressMode": "single-line", // "single-line" or "multi-line"
    "verbose": false,
    "timestamp": false
  }
}
```

### Command Line Options

```bash
# Single-line mode (default)
firmware-cli.exe flash --progress single-line

# Multi-line mode
firmware-cli.exe flash --progress multi-line
```

## Serial Monitoring Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port` | Serial port (e.g., COM107) | Required or from config |
| `-b, --baud` | Baud rate | 115200 |
| `-t, --timeout` | Timeout in milliseconds | 0 (no timeout) |
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
- Try using absolute path: `firmware-cli.exe flash "C:/full/path/firmware.bin"`

### "Workspace not found"
- Ensure you're running from a project directory containing `quectel_build` folder
- Or configure `firmwarePath` to point to your firmware directory

### "Download tool not found"
- Verify `tools/` directory exists and contains required executables
- Check `tools/config/` directory for platform configuration files
- Verify tool path in platform configuration (e.g., `tools/config/asr160x.json`)

### "Build command not found"
- Configure build command: `firmware-cli.exe config set buildCommand "build_OPTfile.bat"`
- Ensure build script exists in your workspace

### "AT port not found"
- Check USB connection and drivers
- Try specifying port manually: `firmware-cli.exe at -p COM107 -c "ATI"`
- List available ports: `firmware-cli.exe serial`

### "Serial port access denied"
- Close other applications using the serial port
- Run as Administrator (if needed)
- Check port is not in use by another process

## Project Structure

```
firmware-cli/
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
│   │   ├── global.json    # Global settings
│   │   ├── asr160x.json   # ASR 160X platform
│   │   ├── asr1x03.json   # ASR 180X/190X platform
│   │   ├── unisoc.json    # UNISOC platform
│   │   ├── eigen.json     # Eigen platform
│   │   └── esp.json       # ESP platform
│   ├── adownload.exe      # ASR 160X tool
│   ├── FBFDownloader.exe  # ASR 180X/190X tool
│   └── pacdownload/       # UNISOC tools
├── dist/                  # Compiled JavaScript
├── skill/                 # AI skill integration
│   └── firmware-cli/
│       ├── SKILL.md       # AI assistant documentation
│       └── scripts/       # Distribution scripts
├── tests/                 # Test scripts
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Adding New Platform Support

To add support for a new chip platform:

1. **Add tool configuration** in `tools/tools-config.json`:
```json
"newplatform": {
  "type": "newtype",
  "extensions": [".ext"],
  "description": "New Platform",
  "serial": {
    "atPortPatterns": ["at port"],
    "atCommand": "AT+DOWNLOAD=1",
    "baudrate": 115200,
    "autoEnterDlMode": true,
    "downloadPortPatterns": ["download"],
    "downloadPortVidPid": [{ "vid": "1234", "pid": "5678" }]
  }
}
```

2. **Add download tool** to `tools/` directory

3. **Update type definitions** in `src/types/index.ts`

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

This CLI tool is designed for seamless AI assistant integration. AI tools can:

- Execute commands via natural language
- Parse JSON output for structured data
- Monitor serial ports for automated testing
- Send AT commands for device control

Example AI interactions:
- "Flash the latest firmware"
- "Monitor COM107 for errors and save to log"
- "Send ATI command and show the response"
- "Build and flash the project"

See `skill/firmware-cli/SKILL.md` for detailed AI integration documentation.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Changelog

### v1.0.0 (2024-01)
- Initial release
- Support for ASR 160X/180X/190X, UNISOC, Eigen platforms
- Serial monitoring with filtering
- AT command interface
- Configuration management
- AI assistant integration

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Maintained by**: destin.zhang@quectel.com
