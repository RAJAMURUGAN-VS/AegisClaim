$login_body = @{email="provider@example.com"; password="password"} | ConvertTo-Json
try {
    $login_resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/auth/login" -Method Post -Body $login_body -ContentType "application/json"
    $token = $login_resp.access_token
    Write-Host "Login successful."

    $pa_id = "d74c2a56-d934-4984-b515-0e41cf320771"
    $status_url = "http://127.0.0.1:8000/api/v1/pa/$pa_id/status"
    $full_url = "http://127.0.0.1:8000/api/v1/pa/$pa_id"
    $headers = @{Authorization = "Bearer $token"}
    $active_statuses = @("PROCESSING", "AGENT_PROCESSING", "SCORING", "SUBMITTED", "IN_REVIEW")

    for ($i = 1; $i -le 36; $i++) {
        $status_resp = Invoke-RestMethod -Uri $status_url -Method Get -Headers $headers
        $current_status = $status_resp.status
        Write-Host "Attempt ${i}: Status is ${current_status}"

        if ($current_status -notin $active_statuses) {
            Write-Host "Terminal status reached: ${current_status}"
            break
        }
        if ($i -lt 36) { Start-Sleep -Seconds 5 }
    }

    $final_full = Invoke-RestMethod -Uri $full_url -Method Get -Headers $headers
    $final_full | ConvertTo-Json -Depth 12 | Out-Host

    $clean_lines_exists = $null -ne $final_full.clean_lines
    $clean_lines_count = if ($clean_lines_exists) { ($final_full.clean_lines | Measure-Object).Count } else { 0 }

    Write-Host "`nSummary:"
    Write-Host "status: $($final_full.status)"
    Write-Host "decision: $($final_full.decision)"
    Write-Host "final_score: $($final_full.final_score)"
    Write-Host "clean_lines_exists: $clean_lines_exists"
    Write-Host "clean_lines_count: $clean_lines_count"

} catch {
    Write-Host "Request failed."
    if ($_.Exception -and $_.Exception.InnerException -and $_.Exception.InnerException.Response) {
        $resp = $_.Exception.InnerException.Response
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Status Code: $($resp.StatusCode)"
        Write-Host "Body: $body"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
    }
}
