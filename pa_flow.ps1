function Check-Port($port) {
    try {
        $res = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -InformationAction SilentlyContinue -ErrorAction SilentlyContinue
        if ($res.TcpTestSucceeded -eq $true) {
            Write-Host "Port $port is up."
            return $true
        }
    } catch {}
    Write-Host "Port $port is not reachable."
    return $false
}

if (-not (Check-Port 5001)) { exit 1 }
if (-not (Check-Port 8000)) { exit 1 }

Write-Host "Attempting Login..."
$loginBody = @{email="provider@example.com"; password="password"} | ConvertTo-Json
try {
    $loginRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginRes.token.access_token
    if (-not $token) { $token = $loginRes.access_token }
    if (-not $token) { throw "No token found in response." }
    Write-Host "Login successful."
} catch {
    Write-Host "Login failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
    exit 1
}

$pdf = Get-ChildItem -Path "pa-workflow/backend/uploads" -Filter "*.pdf" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $pdf) { Write-Host "No PDF found in pa-workflow/backend/uploads."; exit 1 }
Write-Host "Using PDF: $($pdf.FullName)"

$headers = @{ Authorization = "Bearer $token" }
$boundary = "----MultipartBoundary$([System.Guid]::NewGuid().ToString('N'))"
$LF = "`r`n"

$fields = @{
    patient_member_id = "TEST12345"
    payer_id = "11111111-1111-1111-1111-111111111111"
    plan_id = "plan-001"
    provider_npi = "1234567890"
    date_of_service = "2026-04-20"
    icd_codes = '["E11.9"]'
    cpt_codes = '["99213"]'
    prior_treatment_history = "Test history"
}

$bodyParts = @()
foreach($name in $fields.Keys) {
    $bodyParts += "--$boundary"
    $bodyParts += "Content-Disposition: form-data; name=`"$name`""
    $bodyParts += ""
    $bodyParts += $fields[$name]
}

$fileBytes = [System.IO.File]::ReadAllBytes($pdf.FullName)
$bodyParts += "--$boundary"
$bodyParts += "Content-Disposition: form-data; name=`"documents`"; filename=`"$($pdf.Name)`""
$bodyParts += "Content-Type: application/pdf"
$bodyParts += ""

$encoding = [System.Text.Encoding]::GetEncoding("iso-8859-1")
$headerStr = ($bodyParts -join $LF) + $LF
$headerBytes = $encoding.GetBytes($headerStr)
$footerBytes = $encoding.GetBytes("$LF--$boundary--$LF")

$finalBody = New-Object byte[] ($headerBytes.Length + $fileBytes.Length + $footerBytes.Length)
[System.Buffer]::BlockCopy($headerBytes, 0, $finalBody, 0, $headerBytes.Length)
[System.Buffer]::BlockCopy($fileBytes, 0, $finalBody, $headerBytes.Length, $fileBytes.Length)
[System.Buffer]::BlockCopy($footerBytes, 0, $finalBody, ($headerBytes.Length + $fileBytes.Length), $footerBytes.Length)

Write-Host "Submitting PA..."
try {
    $submitRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/pa/submit" -Method Post -Headers $headers -Body $finalBody -ContentType "multipart/form-data; boundary=$boundary"
    $pa_id = $submitRes.pa_id
    if (-not $pa_id) { $pa_id = $submitRes.id }
    Write-Host "Submit Response: $($submitRes | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Submit failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
    exit 1
}

$ongoing = "PROCESSING", "AGENT_PROCESSING", "SCORING", "SUBMITTED", "IN_REVIEW"
$start = Get-Date
$timeoutSec = 180

while (((Get-Date) - $start).TotalSeconds -lt $timeoutSec) {
    Start-Sleep -Seconds 5
    try {
        $statusRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/pa/$pa_id/status" -Method Get -Headers $headers
        Write-Host "Current Status: $($statusRes.status)"
        if ($ongoing -notcontains $statusRes.status) { break }
    } catch {
        Write-Host "Polling error: $($_.Exception.Message)"
    }
}

Write-Host "`nFinal Status Payload:"
Write-Host ($statusRes | ConvertTo-Json -Depth 12)

Write-Host "`nSummary:"
Write-Host "Final Status: $($statusRes.status)"
Write-Host "Decision: $($statusRes.decision)"
Write-Host "Score: $($statusRes.final_score)"
$cl = $statusRes.agent_a_output.ocr_results.clean_lines
$hasCl = $null -ne $cl
Write-Host "Has clean_lines: $hasCl"
if ($hasCl) { Write-Host "Clean lines count: $($cl.Count)" }
