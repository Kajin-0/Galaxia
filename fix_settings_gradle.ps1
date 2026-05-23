# Fix settings.gradle to resolve Capacitor Android build error
$settingsFile = Join-Path $PSScriptRoot "android\settings.gradle"

if (Test-Path $settingsFile) {
    $content = Get-Content $settingsFile -Raw
    
    # Check if apply from is already at the top
    if ($content -match "^apply from: 'capacitor.settings.gradle'") {
        Write-Host "settings.gradle is already correctly configured."
        exit 0
    }
    
    # Create new content with apply from at the top
    $newContent = "apply from: 'capacitor.settings.gradle'`r`n`r`n"
    
    # Remove the apply from line from its current position
    $remainingContent = $content -replace "apply from: 'capacitor.settings.gradle'`r?`n?", ""
    
    # Add the remaining content
    $newContent += $remainingContent.Trim() + "`r`n"
    
    # Write the file
    [System.IO.File]::WriteAllText($settingsFile, $newContent, [System.Text.UTF8Encoding]::new($false))
    
    Write-Host "Successfully updated android\settings.gradle"
    Write-Host "The 'apply from: capacitor.settings.gradle' line has been moved to the top."
} else {
    Write-Host "Error: android\settings.gradle not found at $settingsFile"
    exit 1
}












