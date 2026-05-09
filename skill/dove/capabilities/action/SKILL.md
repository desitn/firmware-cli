# Dove Action（执行类）

说明：包含修改设备状态的 intents（flash, build, build-and-flash, port at (复位) 等）。系统不再强制要求交互确认；相应 intent 在元数据中标注 riskLevel，执行时遵循 intent.errorHandling。对于 high-risk intent 建议在 UI/调用方做额外审查或提示。

主要要点：
- 每个 intent 必须包含 errorHandling 与 logging 元数据。
- 对于非幂等操作（如 flash），默认 retries=0，以避免重复破坏性操作；若确认为可重试，需在 metadata 标注 idempotent=true 并谨慎设置 retries 与 backoff。
- 错误返回结构化信息并提供建议的补救步骤（例如：检查固件路径、检查 tools 目录、检查端口标签）。

示例命令：
- dove.exe flash C:\\path\\to\\firmware.bin
- dove.exe build
- dove.exe build-and-flash
- dove.exe port at -c "AT+CFUN=1,1" --timeout 10000
