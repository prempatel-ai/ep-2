#!/usr/bin/env bash
# run_llm_server.sh - Start local OpenAI-compatible LLM server for Sahayak
#
# Supported server engines:
#   1. llama-server (llama.cpp binary)
#   2. ollama (local Ollama daemon)
#
# Usage:
#   ./backend/scripts/run_llm_server.sh [options]
#
# Options:
#   --engine <llama-server|ollama>  Server engine (default: llama-server, fallback: ollama)
#   --model <path_or_name>          Model path for llama-server or name for ollama
#                                   (default for llama: models/placeholder.gguf, for ollama: gaganyatri/sarvam-2b-v0.5:latest)
#   --host <host>                   Host interface to bind (default: 127.0.0.1)
#   --port <port>                   Port to bind (default: 8080 for llama-server, 11434 for ollama)
#   --ctx-size <tokens>             Context window size (default: 2048)
#   --threads <num>                 CPU inference threads (default: 6)
#   --ngl <num>                     Number of GPU layers to offload (default: 0)

set -euo pipefail

ENGINE="llama-server"
MODEL=""
HOST="127.0.0.1"
PORT=""
CTX_SIZE=2048
THREADS=6
NGL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine)
      ENGINE="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --ctx-size)
      CTX_SIZE="$2"
      shift 2
      ;;
    --threads)
      THREADS="$2"
      shift 2
      ;;
    --ngl)
      NGL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$ENGINE" == "llama-server" ]]; then
  PORT="${PORT:-8080}"
  MODEL="${MODEL:-models/placeholder.gguf}"
  if ! command -v llama-server &> /dev/null; then
    echo "Warning: llama-server binary not found on PATH." >&2
    if command -v ollama &> /dev/null; then
      echo "Falling back to Ollama..." >&2
      ENGINE="ollama"
    else
      echo "Error: Neither llama-server nor ollama found. Please install one to serve local LLMs." >&2
      exit 1
    fi
  fi
fi

if [[ "$ENGINE" == "llama-server" ]]; then
  echo "Starting llama-server on http://${HOST}:${PORT} ..."
  echo "Model: ${MODEL} (ctx: ${CTX_SIZE}, threads: ${THREADS}, gpu-layers: ${NGL})"
  exec llama-server \
    -m "${MODEL}" \
    --host "${HOST}" \
    --port "${PORT}" \
    -c "${CTX_SIZE}" \
    --threads "${THREADS}" \
    -ngl "${NGL}" \
    --embeddings false
else
  PORT="${PORT:-11434}"
  MODEL="${MODEL:-gaganyatri/sarvam-2b-v0.5:latest}"
  echo "Using Ollama server on http://${HOST}:${PORT} ..."
  echo "Model: ${MODEL}"
  if ! curl -s "http://${HOST}:${PORT}/api/tags" &> /dev/null; then
    echo "Starting ollama serve in background..."
    ollama serve &
    sleep 2
  fi
  echo "Ensuring model ${MODEL} is loaded..."
  exec ollama run "${MODEL}" ""
fi
