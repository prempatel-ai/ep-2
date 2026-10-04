<#
.SYNOPSIS
    Starts a local OpenAI-compatible LLM server for Sahayak on Windows.

.DESCRIPTION
    Supports both llama-server (llama.cpp) and Ollama serving.
    Defaults to Ollama when installed and running locally, or llama-server if available.

.PARAMETER Engine
    Server engine: 'ollama' or 'llama-server'. Default: 'ollama' (or 'llama-server' if binary found).

.PARAMETER Model
    Model name or GGUF path.
    Default for Ollama: 'gaganyatri/sarvam-2b-v0.5:latest'
    Default for llama-server: 'models/placeholder.gguf'

.PARAMETER Host
    Host interface to bind. Default: '127.0.0.1'

.PARAMETER Port
    Port number. Default: 11434 for Ollama, 8080 for llama-server.

.PARAMETER Threads
    CPU inference threads for llama-server. Default: 6.

.PARAMETER CtxSize
    Context window size. Default: 2048.

.PARAMETER Ngl
    GPU layers to offload. Default: 0 (CPU-only).
#>

[CmdletBinding()]
param (
    [string]$Engine = "",
    [string]$Model = "",
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 0,
    [int]$Threads = 6,
    [int]$CtxSize = 2048,
    [int]$Ngl = 0
)

# Auto-detect engine if not provided
if (-not $Engine) {
    if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
        $Engine = "ollama"
    } elseif (Get-Command "llama-server" -ErrorAction SilentlyContinue) {
        $Engine = "llama-server"
    } else {
        Write-Error "Neither 'ollama' nor 'llama-server' was found on PATH."
        exit 1
    }
}

if ($Engine -eq "llama-server") {
    if ($Port -eq 0) { $Port = 8080 }
    if (-not $Model) { $Model = "models/placeholder.gguf" }

    Write-Host "Starting llama-server on http://${HostAddress}:${Port} ..." -ForegroundColor Cyan
    Write-Host "Model: $Model (ctx: $CtxSize, threads: $Threads, ngl: $Ngl)"

    & llama-server `
        -m $Model `
        --host $HostAddress `
        --port $Port `
        -c $CtxSize `
        --threads $Threads `
        -ngl $Ngl `
        --embeddings false
} else {
    if ($Port -eq 0) { $Port = 11434 }
    if (-not $Model) { $Model = "gaganyatri/sarvam-2b-v0.5:latest" }

    Write-Host "Using Ollama server on http://${HostAddress}:${Port} ..." -ForegroundColor Cyan
    Write-Host "Model: $Model"

    # Check if Ollama service is already responding
    $serviceRunning = $false
    try {
        $resp = Invoke-RestMethod -Uri "http://${HostAddress}:${Port}/api/tags" -TimeoutSec 2 -ErrorAction Stop
        $serviceRunning = $true
    } catch {
        $serviceRunning = $false
    }

    if (-not $serviceRunning) {
        Write-Host "Starting Ollama server process..." -ForegroundColor Yellow
        Start-Process -FilePath "ollama" -ArgumentList "serve" -NoNewWindow
        Start-Sleep -Seconds 2
    }

    Write-Host "Warming up model $Model..." -ForegroundColor Green
    & ollama run $Model "/bye"
    Write-Host "Ollama OpenAI-compatible endpoint ready at http://${HostAddress}:${Port}/v1" -ForegroundColor Green
}
