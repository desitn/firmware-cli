# Firmware CLI 工具 - 详细参考文档

## 工具概述

**工具名称**: firmware-cli.exe  
**版本**: v1.0.0  
**描述**: 嵌入式固件编译和烧录命令行工具，支持多种芯片平台的固件开发流程。  
**工具位置**: `scripts/firmware-cli.exe` (skill 目录内)  
**运行环境**: Windows CMD

## 初始化配置

首次使用时，运行初始化脚本将 firmware-cli 添加到系统 PATH：

```batch
scripts/init.bat
```

运行后，可以在任何目录直接使用 `firmware-cli` 命令。

## 核心能力

1. **固件烧录** - 将编译好的固件下载到目标设备
2. **固件列表** - 查找和列出可用的固件文件
3. **设备管理** - 列出连接的 USB 设备
4. **固件编译** - 执行固件构建流程
5. **配置管理** - 管理工具配置项
6. **串口监控** - 实时监控设备串口输出

## 快速示例

| 用户需求 | 命令 |
|----------|------|
| "帮我烧录最新的固件" | `firmware-cli.exe flash` |
| "列出所有可用的固件文件" | `firmware-cli.exe list` |
| "编译并烧录固件" | `firmware-cli.exe build-and-flash` |
| "烧录这个固件：C:/firmwares/test.bin" | `firmware-cli.exe flash "C:/firmwares/test.bin"` |
| "检查 USB 设备连接" | `firmware-cli.exe devices` |
| "显示当前配置" | `firmware-cli.exe config` |
| "监控串口输出" | `firmware-cli.exe monitor` |
| "监控指定串口" | `firmware-cli.exe monitor -p COM3` |

## 可用命令详解

### 1. flash - 烧录固件

**语法**: `firmware-cli.exe flash [固件路径]`

**参数**: 固件路径（可选），不提供则自动查找最新固件

**智能查找策略**:
1. 检查配置文件 `firmware-cli.json` 中的 `firmwarePath`
2. 查找工作空间目录下的 `quectel_build/release` 子目录
3. 自动选择最新编译的固件

**支持的固件类型**:
- ASR 160X: `*.zip` 文件
- ASR 180X/190X: `*_fbf.bin` 文件
- UNISOC 8310/8910/8850: `*.pac` 文件
- Eigen 618/718: `*_download_usb.ini` 文件

---

### 2. list - 列出可用固件

**语法**: `firmware-cli.exe list`

**输出信息**: 固件文件名、完整路径、固件类型、文件大小、修改时间、推荐烧录命令

---

### 3. devices - 列出 USB 设备

**语法**: `firmware-cli.exe devices`

**用途**: 确认目标设备已正确连接、检查设备驱动是否安装、排查连接问题

---

### 4. build - 编译固件

**语法**: `firmware-cli.exe build [构建命令]`

**智能查找策略**:
1. 检查配置文件 `firmware-cli.json` 中的 `buildCommand`
2. 查找当前目录下的 `build*OPTfile.bat` 或 `build*OPTfile.sh` 文件

**前置条件**: 必须在项目根目录下执行（包含 `quectel_build` 目录）

---

### 5. build-and-flash - 编译并烧录

**语法**: `firmware-cli.exe build-and-flash`

**执行流程**: 执行固件编译 → 自动查找最新固件 → 执行固件烧录

---

### 6. config - 配置管理

**语法**: 
```bash
firmware-cli.exe config
firmware-cli.exe config set <配置项名称> <配置值>
```

**支持的配置项**:

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `firmwarePath` | 固件文件所在目录 | `C:/firmwares` |
| `buildCommand` | 构建命令或脚本名 | `build_OPTfile.bat` |
| `buildGitBashPath` | Git Bash 可执行文件路径 | `C:/Program Files/Git/bin/bash.exe` |
| `defaultComPort` | 默认串口端口 | `COM107` |

---

### 7. monitor - 串口监控

**语法**: `firmware-cli.exe monitor [选项]`

**选项**:
| 选项 | 说明 | 示例 |
|------|------|------|
| `-p, --port <端口>` | 指定串口端口 | `-p COM3` |
| `-b, --baud <波特率>` | 设置波特率（默认 115200） | `-b 9600` |
| `-t, --timeout <毫秒>` | 设置超时时间 | `--timeout 5000` |
| `-o, --output <文件>` | 保存输出到文件 | `-o logs/boot.log` |
| `--append` | 追加到文件（不覆盖） | `--append` |
| `--timestamp` | 添加时间戳 | `--timestamp` |
| `--include <模式>` | 只显示包含指定内容的行 | `--include "ERROR"` |
| `--exclude <模式>` | 排除包含指定内容的行 | `--exclude "DEBUG"` |
| `--lines <数量>` | 捕获指定行数后退出 | `--lines 100` |
| `--until <文本>` | 匹配到指定内容后退出 | `--until "Boot complete"` |
| `--until-regex <正则>` | 使用正则匹配退出 | `--until-regex "Error:.*Code"` |
| `--json` | JSON 格式输出 | `--json` |

**推荐使用方式**:

⚠️ **重要**: 所有监控命令都应设置超时和退出条件，防止 AI 代理卡住！

1. **使用超时 + 退出条件**（推荐）
   ```bash
   # 监控直到匹配到特定文本，超时 60 秒
   firmware-cli.exe monitor -p COM107 --until "System ready" --timeout 60000 -o logs/boot.log
   ```

2. **使用正则匹配退出**（适合复杂场景）
   ```bash
   # 使用正则匹配多个关键词，超时 60 秒
   firmware-cli.exe monitor -p COM107 --until-regex "Ready|Done|Complete" --timeout 60000 -o logs/status.log
   ```

3. **捕获指定行数**（适合快速检查）
   ```bash
   # 捕获 100 行后退出，超时 30 秒
   firmware-cli.exe monitor -p COM107 --lines 100 --timeout 30000 -o logs/check.log
   ```

4. **只监控错误信息**（适合调试）
   ```bash
   # 只捕获包含 ERROR 的行，超时 60 秒
   firmware-cli.exe monitor -p COM107 --include "ERROR" --timeout 60000 -o logs/errors.log
   ```

**日志存储建议**:

✅ **推荐**: 将日志保存到临时文件夹，便于 AI 调试和人工查看

```bash
# 创建临时日志文件夹
mkdir logs

# 监控并保存日志到 logs 文件夹
firmware-cli.exe monitor -p COM107 --until "System ready" --timeout 60000 -o logs/boot_20250318.log

# 添加时间戳的日志
firmware-cli.exe monitor -p COM107 --timestamp --until "Ready" --timeout 60000 -o logs/timestamp.log

# 错误日志单独存储
firmware-cli.exe monitor -p COM107 --include "ERROR|FAIL" --timeout 60000 -o logs/errors.log
```

**超时时间建议**:
- 快速检查：10-30 秒
- 等待特定事件：60 秒
- 完整启动过程：120 秒

**其他使用示例**:
```bash
# 使用默认串口（需在配置中设置 defaultComPort），超时 60 秒
firmware-cli.exe monitor --timeout 60000 -o logs/default.log

# JSON 格式输出，超时 3 秒（适合快速状态检查）
firmware-cli.exe monitor -p COM3 --timeout 3000 --json

# 追加模式（不覆盖已有日志）
firmware-cli.exe monitor -p COM107 --append -o logs/continuous.log --timeout 60000
```

**默认串口配置**:
在 `firmware-cli.json` 中配置 `defaultComPort` 字段后，执行 `monitor` 命令可不指定端口：
```json
{
  "defaultComPort": "COM107"
}
```

**最佳实践总结**:
1. ✅ 始终设置 `--timeout` 防止卡住
2. ✅ 使用 `--until` 或 `--until-regex` 设置明确的退出条件
3. ✅ 日志保存到 `logs/` 文件夹，便于管理和查看
4. ✅ 添加 `--timestamp` 方便追踪时间线
5. ✅ 不同场景使用不同的日志文件名（如 `boot.log`, `errors.log`, `status.log`）

---

### 8. at - AT 命令交互

**语法**: `firmware-cli.exe at [选项]`

**用途**: 发送 AT 命令到设备并获取响应，用于调试和控制设备。与 `monitor` 命令不同，`at` 命令采用请求-响应模式，数据量小，反馈及时。

**选项**:
| 选项 | 说明 | 示例 |
|------|------|------|
| `-c, --command <cmd>` | AT 命令（必填） | `-c "ATI"` |
| `-p, --port <port>` | 指定串口端口（可选，自动检测） | `-p COM107` |
| `-t, --timeout <ms>` | 设置超时时间（默认 5000ms） | `--timeout 10000` |
| `--platform <type>` | 指定平台用于自动检测（默认 asr160x） | `--platform asr160x` |
| `--json` | JSON 格式输出 | `--json` |

**使用示例**:

```bash
# 1. 自动查找 AT 端口并发送命令（推荐）
firmware-cli.exe at -c "ATI"

# 2. 指定端口发送命令
firmware-cli.exe at -p COM107 -c "AT+CGMI"

# 3. 查询版本信息（多个命令组合）
firmware-cli.exe at -c "ATI"
firmware-cli.exe at -c "AT+GMI"
firmware-cli.exe at -c "AT+GMM"

# 4. 模块复位（可能需要更长时间，设置 10 秒超时）
firmware-cli.exe at -p COM107 -c "AT+CFUN=1,1" --timeout 10000

# 5. JSON 格式输出（适合 agent 解析）
firmware-cli.exe at -c "ATI" --json

# 6. 指定平台自动检测
firmware-cli.exe at --platform asr160x -c "ATI"

# 7. 查询 IMEI
firmware-cli.exe at -c "AT+CGSN"

# 8. 查询 SIM 卡状态
firmware-cli.exe at -c "AT+CPIN?"
```

**普通输出格式**:
```
AT Command Result
Port: COM107
Command: ATI
Duration: 123ms

Response:
Quectel
EC200N
Revision: EC200NCNAAR05A03M16

Status: OK
```

**JSON 输出格式**:
```json
{
  "success": true,
  "response": "Quectel\nEC200N\nRevision: EC200NCNAAR05A03M16",
  "port": "COM107",
  "duration": 123
}
```

**与 monitor 命令的区别**:

| 特性 | at | monitor |
|------|----|----|
| 用途 | AT 命令交互 | 持续监控日志 |
| 数据量 | 小（请求-响应） | 大（可能持续输出） |
| 退出方式 | 收到 OK/ERROR 后自动退出 | 超时/匹配条件/Ctrl+C |
| 适用场景 | 查询信息、控制操作 | 调试日志、启动过程 |
| Agent 友好度 | 高（直接解析响应） | 中（需要处理流数据） |
| 默认超时 | 5000ms | 无（需手动设置） |

**常见 AT 命令**:

| 命令 | 说明 | 示例 |
|------|------|------|
| `ATI` | 查询设备信息 | `firmware-cli.exe at -c "ATI"` |
| `AT+GMI` | 查询制造商 | `firmware-cli.exe at -c "AT+GMI"` |
| `AT+GMM` | 查询型号 | `firmware-cli.exe at -c "AT+GMM"` |
| `AT+GMR` | 查询固件版本 | `firmware-cli.exe at -c "AT+GMR"` |
| `AT+CGSN` | 查询 IMEI | `firmware-cli.exe at -c "AT+CGSN"` |
| `AT+CPIN?` | 查询 SIM 卡状态 | `firmware-cli.exe at -c "AT+CPIN?"` |
| `AT+CREG?` | 查询网络注册状态 | `firmware-cli.exe at -c "AT+CREG?"` |
| `AT+CFUN=1,1` | 模块复位 | `firmware-cli.exe at -c "AT+CFUN=1,1" --timeout 10000` |

**最佳实践**:
1. ✅ 使用 JSON 输出方便 agent 解析
2. ✅ 自动检测 AT 端口，无需手动指定
3. ✅ 复位操作设置更长超时（如 10 秒）
4. ✅ 查询信息使用默认 5 秒超时即可
5. ✅ 组合多个命令获取完整设备信息

---

### 9. help - 帮助信息

**语法**: `firmware-cli.exe help`

## 配置文件

工具使用 `firmware-cli.json` 配置文件（应位于项目根目录）。
如果不存在可主动创建一个参数为空的 `firmware-cli.json` 。

**配置文件示例**:
```json
{
  "firmwarePath": "",
  "buildCommand": "",
  "buildGitBashPath": "",
  "defaultComPort": "COM107"
}
```

## 典型使用场景

### 场景 1: 快速烧录最新固件
```bash
firmware-cli.exe flash
```

### 场景 2: 完整开发流程
```bash
firmware-cli.exe build
firmware-cli.exe devices
firmware-cli.exe flash
```

### 场景 3: 一键编译并烧录
```bash
firmware-cli.exe build-and-flash
```

### 场景 4: 使用特定固件
```bash
firmware-cli.exe flash "C:/specific/path/custom_firmware.bin"
```

### 场景 5: 监控设备启动日志
```bash
# 使用配置的默认串口，监控直到系统就绪，超时 60 秒
firmware-cli.exe monitor --until "System ready" --timeout 60000 -o logs/boot.log

# 指定串口并保存带时间戳的日志，监控直到启动完成
firmware-cli.exe monitor -p COM107 --timestamp --until "Boot complete" --timeout 60000 -o logs/boot_timestamp.log

# 只捕获错误信息，超时 60 秒
firmware-cli.exe monitor -p COM107 --include "ERROR|FAIL" --timeout 60000 -o logs/errors.log

# 快速状态检查，捕获 50 行，超时 30 秒
firmware-cli.exe monitor -p COM107 --lines 50 --timeout 30000 -o logs/quick_check.log
```

## 错误处理

> **重要**: 当工具返回错误时，AI 助手只需将错误信息提示给开发者，不要尝试额外的操作。
> **important**：When the execution tool returns an error, the AI assistant simply prompts the developer with the error information, without attempting additional actions!

| 错误信息 | 原因 | AI 处理方式 |
|----------|------|-------------|
| "未找到固件文件" | 固件路径不存在或未配置 | 提示开发者检查配置文件或使用完整路径 |
| "未找到工作空间" | 不在项目根目录下 | 提示开发者工程无 `quectel_build` 目录 |
| "下载工具不存在" | tools 目录缺少下载工具 | 提示开发者检查 tools 目录是否完整 |
| "未找到构建命令" | 未配置且未找到构建脚本 | 提示开发者配置 buildCommand 或指定脚本路径 |
| "请指定串口路径" | 未指定串口且未配置默认串口 | 提示开发者使用 `-p` 指定串口或配置 defaultComPort |

## 最佳实践

1. **优先使用自动查找** - 默认执行 `flash` 不带参数
2. **错误直接反馈** - 工具报错后直接反馈给用户，不要重复尝试
3. **检查设备连接** - 烧录前可先执行 `devices` 确认设备连接
4. **配置优先** - 建议用户配置 `firmware-cli.json` 简化操作
5. **串口监控安全** - 始终设置 `--timeout` 和退出条件，防止卡住
6. **日志管理** - 将日志保存到 `logs/` 文件夹，便于管理和调试
7. **时间戳记录** - 使用 `--timestamp` 方便追踪事件时间线
8. **分类存储** - 不同场景使用不同日志文件名（`boot.log`, `errors.log`, `status.log`）


**重要**: 当执行工具返回错误时，AI 助手只需将错误信息提示给开发者，不要再尝试额外的操作！。
**important**:When the execution tool returns an error, the AI assistant simply prompts the developer with the error information, without attempting additional actions!