# 用来排查插件之外的问题：账号余额、key 是否有效、API 网关是否活着、各模型能否返回。
# 运行方式：pwsh -ExecutionPolicy Bypass -File .\test-api.ps1
$key = (Read-Host "请输入 DeepSeek API Key（只在本机使用）").Trim()
$headers = @{ Authorization = "Bearer $key" }
$url = "https://api.deepseek.com/chat/completions"

function Show-Error {
  "HTTP " + [int]$_.Exception.Response.StatusCode
  $_.Exception.Message
  $_.ErrorDetails.Message
}

"=== 1. 账户余额 ==="
try {
  Invoke-RestMethod -Uri "https://api.deepseek.com/user/balance" -Headers $headers -TimeoutSec 20 | ConvertTo-Json -Depth 5
} catch { Show-Error }

""
"=== 2. API 网关是否活着（故意用不存在的模型名，正常应秒回 400）==="
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
  Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Headers $headers -Body '{"model":"this-model-does-not-exist","messages":[{"role":"user","content":"hi"}]}' -TimeoutSec 30
  "意外成功？耗时 $([int]$sw.Elapsed.TotalSeconds) 秒"
} catch {
  "耗时 $([int]$sw.Elapsed.TotalSeconds) 秒 ->"
  Show-Error
}

foreach ($model in @("deepseek-flash", "deepseek-v4-pro")) {
  ""
  "=== 3. 模型 $model 非流式（最多等 60 秒）==="
  $body = '{"model":"' + $model + '","messages":[{"role":"user","content":"用一句话介绍你自己"}]}'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Headers $headers -Body $body -TimeoutSec 60
    "成功，耗时 $([int]$sw.Elapsed.TotalSeconds) 秒"
    "回复：" + $r.choices[0].message.content
  } catch {
    "失败，耗时 $([int]$sw.Elapsed.TotalSeconds) 秒"
    Show-Error
  }

  ""
  "=== 4. 模型 $model 流式（最多等 60 秒，有字节回来就会立刻打印）==="
  $tmp = New-TemporaryFile
  ('{"model":"' + $model + '","stream":true,"messages":[{"role":"user","content":"用一句话介绍你自己"}]}') | Set-Content -Path $tmp -Encoding utf8 -NoNewline
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & curl.exe -sS -N --max-time 60 -w "`n[curl 状态: http=%{http_code} 耗时=%{time_total}s]`n" $url -H "Content-Type: application/json" -H "Authorization: Bearer $key" -d "@$tmp" 2>&1 | Select-Object -First 12
  Remove-Item $tmp -ErrorAction SilentlyContinue
}
