---
name: dove
version: 1.0
summary: 合并查询与执行类 intents，提供明确触发短语与 intent 元数据，方便 Agent 精准匹配。
---

说明：此 Skill 提供查询（list、monitor、AT 查询）与执行（build、flash、复位）功能。每个 intent 在 skill/dove/capabilities/** 下有对应的 -meta.json 元数据（包含 errorHandling、riskLevel、logging）。

如何被 Agent 命中（建议）：
- 优先使用 intent id（例如 "flash"、"build"）作为调用信号。
- 若使用自然语言，匹配器应查找下面的触发短语（triggers）和示例调用。
- 调用示例使用命令行形式有助于精确匹配：例如 "dove.exe flash C:\\path\\firmware.bin"。

关键 intents 与触发短语（示例）：
- flash: "烧录固件", "flash 固件", "烧录到设备", 示例: "dove.exe flash C:\\firmware.bin"
- build: "编译工程", "build 固件", 示例: "dove.exe build"
- build-and-flash: "一键编译并烧录", 示例: "dove.exe build-and-flash"
- flash-list: "列出固件", "flash --list", 示例: "dove.exe flash --list"
- build-list: "列出编译命令", 示例: "dove.exe build --list"
- port-list: "列出串口", 示例: "dove.exe port list"
- port-at: "发送 AT", "查询设备信息", 示例: "dove.exe port at -c \"ATI\""
- port-monitor: "监控串口", 示例: "dove.exe port monitor --timeout 30000 -o log.txt"
- config: "查看配置", 示例: "dove.exe config"

匹配优先级建议：
1) 精确命令/intent id 匹配
2) 包含触发短语的短语匹配
3) 基于语义的模糊匹配（次优）

附注：riskLevel 用于提示与日志，不再作为自动阻断条件。若同意，我可以把这些触发短语写入各 intent 的 -meta.json 中的 examples 字段以进一步提高匹配率。
