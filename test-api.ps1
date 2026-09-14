# 用来排查插件之外的问题：账号余额、key 是否有效、各模型是否能正常返回。
# 运行方式：pwsh -ExecutionPolicy Bypass -File .\test-api.ps1
$key = Read-Host "请输入 DeepSeek API Key（输入时不会显示到聊天里，只在本机使用）"
$key = $key.Trim()
$headers = @{ Authorization = "Bearer $key" }

"=== 1. 账户余额 ==="
try {
  $b = Invoke-RestMethod -Uri "https://api.deepseek.com/user/balance" -Headers $headers -TimeoutSec 20
  $b | ConvertTo-Json -Depth 5
} catch {
  "HTTP " + [int]$_.Exception.Response.StatusCode
  $_.ErrorDetails.Message
}

foreach ($model in @("deepseek-flash", "deepseek-v4-pro")) {
  ""
  "=== 2. 模型 $model（最多等 90 秒）==="
  $body = '{"model":"' + $model + '","messages":[{"role":"user","content":"用一句话介绍你自己"}]}'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method Post -ContentType "application/json" -Headers $headers -Body $body -TimeoutSec 90
    "成功，耗时 $([int]$sw.Elapsed.TotalSeconds) 秒"
    "回复：" + $r.choices[0].message.content
  } catch {
    "失败，耗时 $([int]$sw.Elapsed.TotalSeconds) 秒"
    "HTTP " + [int]$_.Exception.Response.StatusCode
    $_.Exception.Message
    $_.ErrorDetails.Message
  }
}
