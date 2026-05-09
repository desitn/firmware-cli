---
name: dove-query
description: 固件开发辅助工具，查询设备信息、列出固件、监控串口日志、发送查询类 AT 命令。只读操作，可直接执行无需确认。
---

# Dove Query（低风险操作）

用于查询和监控的操作，不修改设备状态，**可直接执行无需确认**。

## 环境说明

- **可执行文件**: `dove.exe`
- **运行环境**: Windows OS
- **前置条件**: 插件已预安装，无需手动初始化环境

---

## 可直接执行的命令

| 命令 | 说明 | 输出格式 |
|------|------|----------|
| `flash --list` | 列出可用固件 | JSON |
| `build --list` | 列出编译命令 | JSON |
| `port list` | 列出串口及标签 | JSON |
| `config` | 查看当前配置 | JSON |
| `port at -c "查询命令"` | 发送 AT 查询命令（自动使用 AT 端口） | JSON |
| `port monitor` | 监控串口日志（自动使用 DBG 端口） | 原始日志 |

---

## 命令参考

### 信息查询（JSON 输出）

```bash
# 列出可用固件（JSON）
dove.exe flash --list

# 列出编译命令（JSON）
dove.exe build --list

# 列出串口及标签配置（JSON）
dove.exe port list

# 查看配置（JSON）
dove.exe config
```

### AT 查询命令（JSON 输出）

```bash
# 查询设备信息（自动使用 AT 标签端口）
dove.exe port at -c "ATI"

# 查询厂商
dove.exe port at -c "AT+CGMI"

# 查询型号
dove.exe port at -c "AT+CGMM"

# 查询 IMEI
dove.exe port at -c "AT+CGSN"

# 查询信号强度
dove.exe port at -c "AT+CSQ"
```

> **说明**: AT 命令自动使用配置中 `tag: "AT"` 的端口，无需手动指定。

### 串口监控（建议输出到文件）

```bash
# 监控串口 - 自动使用 DBG 标签端口，必须指定 timeout
dove.exe port monitor --timeout 30000 -o log.txt

# 监控指定标签端口
dove.exe port monitor --tag AT --timeout 10000 -o at_log.txt

# JSON 摘要输出
dove.exe port monitor --timeout 5000 --json
```

> **约束**: monitor 命令必须指定 `--timeout`（最小 5000ms），建议使用 `-o` 输出到文件。
> **默认端口**: 自动使用 `tag: "DBG"` 的端口。

---

## JSON 输出示例

### port list
```json
{
  "ports": [
    { "path": "COM3", "friendlyName": "Quectel AT Port", "tag": "AT" },
    { "path": "COM4", "friendlyName": "Quectel Debug Port", "tag": "DBG" },
    { "path": "COM5", "friendlyName": "Other Port", "tag": "invalid" }
  ],
  "count": 3
}
```

### port at
```json
{
  "success": true,
  "response": "Quectel\nOK",
  "port": "COM3",
  "duration": 52
}
```

---

## 端口标签配置

端口标签用于 AI 自动识别端口用途，在 `dove.json` 中配置：

| 标签 | 用途 | AI 行为 |
|------|------|----------|
| **AT** | AT 命令端口 | `port at` 自动使用此端口 |
| **DBG** | 调试日志端口 | `port monitor` 自动使用此端口 |
| **invalid** | 无效/不可用端口 | AI 不使用此端口 |

### 配置示例（dove.json）

```json
{
  "comPorts": [
    { "port": "COM3", "tag": "AT" },
    { "port": "COM4", "tag": "DBG" },
    { "port": "COM5", "tag": "invalid" }
  ]
}
```

> **重要**: 必须配置 `AT` 和 `DBG` 标签端口，否则 AI 无法自动执行命令。

---

## 约束规则

1. **只读操作**：以上命令不修改设备状态，可直接执行
2. **monitor 必须带 timeout**：最小 5000ms，防止无限等待
3. **建议输出到文件**：monitor 日志量大，使用 `-o` 参数保存到文件
4. **错误只展示**：工具返回错误时，只展示给用户，不自动修复

### 错误处理

| 错误信息 | 处理方式 |
|----------|----------|
| "Timeout is required" | 提示用户添加 `--timeout` 参数 |
| "Timeout must be at least 5000ms" | 提示用户增大 timeout 值 |
| "AT port not found" | 提示用户配置 `tag: "AT"` 端口 |
| "marked as invalid" | 提示用户此端口不可用，更换其他端口 |

---

## 注意事项

- **高风险操作在 dove-action skill**：`flash`、`build`、`build-and-flash`、设备复位等需要确认
- `invalid` 标签端口 AI 不使用，保留给用户手动操作
- 如果用户请求烧录/编译，提示用户这是高风险操作需要确认