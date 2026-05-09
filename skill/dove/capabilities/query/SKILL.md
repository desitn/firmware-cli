# Dove Query（低风险 / 查询）

说明：包含所有只读与查询类 intents（flash --list, build --list, port list, port at (查询) , port monitor）。这些 intent 默认可直接执行，但每个 intent 都包含 errorHandling 元数据：在遇到短暂失败时可进行有限重试并返回结构化错误，避免无人值守时无限等待。

建议默认 errorHandling： retries=1, backoffMs=500, timeoutMs=30000

主要要点：
- monitor 命令仍需 --timeout 参数以避免无限等待（建议最小 5000ms）。
- 对超时或暂时性串口繁忙，按 intent.errorHandling 执行有限重试。
- 返回的错误应包含 code, message, suggestion 字段，日志应包含 command, args, port, timestamp。

示例命令：
- dove.exe flash --list
- dove.exe build --list
- dove.exe port list
- dove.exe port at -c "ATI"
- dove.exe port monitor --timeout 30000 -o log.txt
