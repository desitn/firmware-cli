---
name: firmware-tool
description: 固件开发辅助工具，查询设备、列出固件、监控串口、发送查询类 AT 命令。只读操作，可直接执行无需确认。
---

# Firmware Tool（低风险操作）

用于查询和监控的操作，不修改设备状态，**可直接执行无需确认**。

## 环境说明

- **可执行文件**: `scripts/dove.exe`
- **运行环境**: Windows OS
- **前置条件**: 插件已预安装，无需手动初始化环境

---

## 可直接执行的命令

以下命令只读取信息，不修改设备或系统状态：

| 命令 | 说明 |
|------|------|
| `list` | 列出可用固件 |
| `devices` | 列出 USB 设备 |
| `serial` | 列出串口设备 |
| `config` | 查看当前配置 |
| `config set` | 设置配置项（低风险，可直接执行） |
| `monitor` | 监控串口（需指定 timeout） |
| `at` 查询类 | ATI, AT+CGMI, AT+CGSN 等查询命令 |

---

## 触发条件

当用户**明确要求查询/查看**时触发：

**明确触发：**
- "查看设备" / "列出设备" / "USB 设备"
- "列出固件" / "有哪些固件" / "查看固件列表"
- "监控串口" / "查看串口日志" / "串口输出"
- "查询版本" / "发送 ATI" / "设备信息"
- "查看配置" / "设置配置"

**不应触发：**
- 用户仅讨论固件/设备相关概念，无执行意图

---

## 命令参考

### 信息查询
```bash
# 列出可用固件
dove.exe list

# 列出 USB 设备
dove.exe devices

# 列出串口
dove.exe serial

# 查看配置
dove.exe config

# 设置配置项
dove.exe config set firmwarePath "C:/firmwares"
dove.exe config set defaultComPort "COM107"
```

### 串口监控
```bash
# 监控串口（必须指定 timeout）
dove.exe monitor -p COM3 --timeout 30000

# 保存日志
dove.exe monitor -p COM3 --timeout 60000 -o output.log

# JSON 输出
dove.exe monitor -p COM3 --json --timeout 5000

# 过滤输出
dove.exe monitor -p COM3 --include "ERROR" --timeout 30000
```

> **约束**: monitor 命令必须指定 `--timeout`，防止无限等待

### AT 命令（查询类）
```bash
# 查询设备信息
dove.exe at -c "ATI"

# 查询厂商
dove.exe at -c "AT+CGMI"

# 查询型号
dove.exe at -c "AT+CGMM"

# 查询 IMEI
dove.exe at -c "AT+CGSN"

# JSON 输出
dove.exe at -c "ATI" --json
```

---

## 约束规则

1. **只读操作**：以上命令不修改设备状态，可直接执行
2. **monitor 必须带 timeout**：防止无限等待卡住
3. **错误只展示**：工具返回错误时，只展示给用户，不自动修复

### 错误处理

| 错误信息 | 处理方式 |
|----------|----------|
| "未找到固件文件" | 提示用户检查配置或指定路径 |
| "请指定串口路径" | 提示用户使用 `-p` 或配置 defaultComPort |

---

## 注意事项

- **高风险操作不在此 skill**：flash、build、build-and-flash、设备复位等高风险操作在 `firmware-action` skill 中，需要用户确认
- 如果用户请求烧录/编译，**不要执行**，提示用户这是高风险操作需要确认