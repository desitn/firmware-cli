---
name: dove-query
description: 固件开发辅助工具，查询设备、列出固件、监控串口、发送查询类 AT 命令。只读操作，可直接执行无需确认。**所有查询命令默认输出 JSON 格式**。
---

# Dove Query（低风险操作）

用于查询和监控的操作，不修改设备状态，**可直接执行无需确认**。所有查询类命令默认输出 JSON 格式，便于 AI 解析。

## 环境说明

- **可执行文件**: `dove.exe`
- **运行环境**: Windows OS
- **前置条件**: 插件已预安装，无需手动初始化环境
- **输出格式**: 默认 JSON，便于程序化处理

---

## 可直接执行的命令

以下命令只读取信息，不修改设备或系统状态，**默认输出 JSON**：

| 命令 | 说明 | 输出格式 |
|------|------|----------|
| `flash --list` | 列出可用固件 | JSON |
| `build --list` | 列出编译命令 | JSON |
| `port list` | 列出串口 | JSON |
| `port list --usb` | 列出 USB 设备 | JSON |
| `port list --all` | 列出所有端口 | JSON |
| `config` | 查看当前配置 | JSON |
| `config set <key> <value>` | 设置配置项 | JSON |
| `port at -c "查询命令"` | ATI, AT+CGMI 等查询 | JSON |
| `port monitor` | 监控串口 | 原始输出（可选 --json） |

---

## 触发条件

当用户**明确要求查询/查看**时触发：

**明确触发：**
- "查看设备" / "列出设备" / "USB 设备"
- "列出固件" / "有哪些固件" / "查看固件列表"
- "列出编译命令" / "查看 build 命令"
- "监控串口" / "查看串口日志" / "串口输出"
- "查询版本" / "发送 ATI" / "设备信息"
- "查看配置" / "设置配置"
- "列出端口" / "串口列表"

**不应触发：**
- 用户仅讨论固件/设备相关概念，无执行意图

---

## 命令参考

### 信息查询（JSON 输出）
```bash
# 列出可用固件（JSON）
dove.exe flash --list

# 列出编译命令（JSON）
dove.exe build --list

# 列出串口（JSON）
dove.exe port list

# 列出 USB 设备（JSON）
dove.exe port list --usb

# 列出所有端口（JSON）
dove.exe port list --all

# 查看配置（JSON）
dove.exe config

# 设置配置项（JSON）
dove.exe config set firmwarePath "C:/firmwares"
dove.exe config set defaultComPort "COM107"
```

### 串口监控（原始输出，可选 JSON）
```bash
# 监控串口（必须指定 timeout）
dove.exe port monitor -p COM3 --timeout 30000

# 按标签选择端口（推荐，便于 AI 自动化）
dove.exe port monitor --tag Log --timeout 30000
dove.exe port monitor --tag Debug --timeout 30000

# 保存日志
dove.exe port monitor -p COM3 --timeout 60000 -o output.log

# JSON 输出
dove.exe port monitor -p COM3 --json --timeout 5000

# 过滤输出
dove.exe port monitor -p COM3 --include "ERROR" --timeout 30000
```

> **约束**: monitor 命令必须指定 `--timeout`，防止无限等待
> **推荐**: 使用 `--tag` 参数，AI 可自动选择合适端口

### AT 命令（JSON 输出）
```bash
# 查询设备信息（JSON）
dove.exe port at -c "ATI"

# 按标签选择端口（推荐）
dove.exe port at --tag AT -c "ATI"
dove.exe port at --tag AT -c "AT+CGMI"

# 查询厂商（JSON）
dove.exe port at -c "AT+CGMI"

# 查询型号（JSON）
dove.exe port at -c "AT+CGMM"

# 查询 IMEI（JSON）
dove.exe port at -c "AT+CGSN"
```

> **推荐**: 使用 `--tag AT` 参数，AI 可自动选择 AT 命令端口

---

## JSON 输出示例

### port list
```json
[
  {
    "path": "COM3",
    "manufacturer": "Quectel",
    "vendorId": "0x1782",
    "productId": "0x4D00",
    "fullDescription": "..."
  }
]
```

### flash --list
```json
{
  "firmwares": [
    { "name": "firmware.zip", "path": "...", "type": "ASR ABOOT", "size": 15755284 }
  ],
  "count": 1,
  "recommended": { "name": "firmware.zip", "path": "...", "type": "ASR ABOOT" }
}
```

### build --list
```json
{
  "commands": [
    { "name": "build", "command": "build.bat", "description": "...", "isActive": true }
  ],
  "activeIndex": 0,
  "count": 1
}
```

### config
```json
{
  "firmwarePath": "C:/firmwares",
  "buildCommands": [...],
  "activeCommand": "build",
  "comPorts": [...]
}
```

### port at
```json
{
  "success": true,
  "response": "ATI\r\nQuectel\n...",
  "port": "COM7",
  "duration": 52
}
```

---

## 约束规则

1. **只读操作**：以上命令不修改设备状态，可直接执行
2. **默认 JSON 输出**：查询类命令默认输出 JSON，无需指定参数
3. **monitor 必须带 timeout**：防止无限等待卡住
4. **错误只展示**：工具返回错误时，只展示给用户，不自动修复
5. **优先使用 --tag**：便于 AI 自动选择合适端口

### 错误处理

| 错误信息 | 处理方式 |
|----------|----------|
| "未找到固件文件" | 提示用户检查配置或指定路径 |
| "请指定串口路径" | 提示用户使用 `-p` 或 `--tag` 参数 |
| "No port found with tag" | 提示用户在 settings 中配置端口标签 |

### 端口标签配置

用户需在 VS Code 插件 settings 页面配置端口标签：
- **AT**: AT 命令端口
- **Download**: 固件下载端口
- **Log**: 日志监控端口
- **Debug**: 调试输出端口
- **UART**: 通用串口通信

---

## 注意事项

- **高风险操作不在此 skill**：`flash`、`build`（执行编译）、`build-and-flash`、设备复位等高风险操作在 `dove-action` skill 中，需要用户确认
- `build --list` 是低风险查询命令，可在此 skill 执行；实际编译 `build` 需在 `dove-action` 中确认
- 如果用户请求烧录/编译，**不要执行**，提示用户这是高风险操作需要确认