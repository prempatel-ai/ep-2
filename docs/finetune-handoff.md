# Fine-Tuning & Model Serving Handoff Guide

> **Audience:** The builder / ML engineer fine-tuning the base model (e.g. Sarvam-1 2B or Gemma 3 4B) for Sahayak.
> **Date:** 2026-10-04 (Phase 3)

---

## 1. Executive Summary

Sahayak serves the fine-tuned model via an **OpenAI-compatible HTTP endpoint** (`llama-server`, `vLLM`, or `Ollama`). Swapping the placeholder model for the real fine-tuned weights requires only changing the configuration (`SAHAYAK_LLM__BASE_URL` and `SAHAYAK_LLM__MODEL`), with zero backend code changes.

To prevent formatting degradation and hallucinations, the fine-tuning training data **must exactly match** the prompt structure produced by `PromptBuilder` (`src/sahayak/services/prompting.py`).

---

## 2. Exact Prompt Layout (from `dump_prompt.py`)

The backend sends a list of `ChatMessage` objects (`role: "system"`, `role: "user"`, `role: "assistant"`).

### System Prompt Template

```text
You are a calm, friendly assistant that explains breast cancer information in plain language.
You only share general, verified information. You never diagnose, never interpret a person's
own results, and never recommend treatments or medicine doses. For anything about a person's
own health, tell them to speak to their doctor.
Keep answers short and natural, as if speaking aloud: a few sentences, no lists, no markdown.

Reply in {Language.english_name}.
```

---

### [Case A] Without Reference Block (Context Mode Disabled / Score < threshold)

Used when no verified FAQ matches above the context threshold (or when Decision D3 is set to "train without reference").

#### Gujarati:
```json
[
  {
    "role": "system",
    "content": "You are a calm, friendly assistant that explains breast cancer information in plain language.\nYou only share general, verified information. You never diagnose, never interpret a person's\nown results, and never recommend treatments or medicine doses. For anything about a person's\nown health, tell them to speak to their doctor.\nKeep answers short and natural, as if speaking aloud: a few sentences, no lists, no markdown.\n\nReply in Gujarati."
  },
  {
    "role": "user",
    "content": "મેમોગ્રાફી શું છે?"
  }
]
```

#### Hindi:
```json
[
  {
    "role": "system",
    "content": "You are a calm, friendly assistant that explains breast cancer information in plain language.\nYou only share general, verified information. You never diagnose, never interpret a person's\nown results, and never recommend treatments or medicine doses. For anything about a person's\nown health, tell them to speak to their doctor.\nKeep answers short and natural, as if speaking aloud: a few sentences, no lists, no markdown.\n\nReply in Hindi."
  },
  {
    "role": "user",
    "content": "मैमोग्राफी क्या है?"
  }
]
```

#### English:
```json
[
  {
    "role": "system",
    "content": "You are a calm, friendly assistant that explains breast cancer information in plain language.\nYou only share general, verified information. You never diagnose, never interpret a person's\nown results, and never recommend treatments or medicine doses. For anything about a person's\nown health, tell them to speak to their doctor.\nKeep answers short and natural, as if speaking aloud: a few sentences, no lists, no markdown.\n\nReply in English."
  },
  {
    "role": "user",
    "content": "What is a mammogram?"
  }
]
```

---

### [Case B] With Reference Block (Context Mode Enabled)

When a relevant verified FAQ is retrieved (similarity in `[context_threshold, direct_threshold)`), the reference block is appended to the system prompt:

```text
Verified reference information. Base factual statements only on this:
[1] Q: <question>
    A: <answer>
```

#### Example with Context (English):
```json
[
  {
    "role": "system",
    "content": "You are a calm, friendly assistant that explains breast cancer information in plain language.\nYou only share general, verified information. You never diagnose, never interpret a person's\nown results, and never recommend treatments or medicine doses. For anything about a person's\nown health, tell them to speak to their doctor.\nKeep answers short and natural, as if speaking aloud: a few sentences, no lists, no markdown.\n\nReply in English.\n\nVerified reference information. Base factual statements only on this:\n[1] Q: What is a mammogram?\n    A: A mammogram is a low-dose X-ray picture of the breast used to detect early signs of cancer."
  },
  {
    "role": "user",
    "content": "What is a mammogram?"
  }
]
```

---

## 3. Critical Chat-Template Caveat

> [!WARNING]
> The chat template baked into the GGUF file or model server **must match the chat format used during fine-tuning**.
> If the model is fine-tuned with ChatML (`<|im_start|>system...`), but `llama-server` or Ollama formats inputs as Llama-3 (`<|start_header_id|>...`), the model will output gibberish, repeat tokens, or ignore instructions.

Ensure the training framework writes the tokenizer's `chat_template` in `tokenizer_config.json` before converting to GGUF.

---

## 4. Decision D3: Train With or Without Reference Block?

- **Default recommendation:** Without reference block (`RETRIEVAL__CONTEXT_THRESHOLD=1.0`).
  - **Why:** Keeps the model focused strictly on answering naturally from its fine-tuned domain knowledge. High-confidence FAQ matches (score ≥ 0.90) are returned directly and verbatim by the FAQ retrieval engine without invoking the model at all.
- **Alternative:** If the model is expected to synthesize answers from multiple FAQs, training data must include diverse examples matching the `[1] Q: ... A: ...` reference block structure shown in Case B above.

---

## 5. Sampling Parameters Used at Runtime

The backend uses the following default configuration in `src/sahayak/config.py`:
- `temperature`: `0.3` (restrained, minimizes hallucination)
- `max_tokens`: `300` (keeps responses concise for spoken delivery)
- `timeout_s`: `60.0`
- `max_sentence_chars`: `200` (segments streaming tokens into speakable sentences for immediate TTS streaming)

---

## 6. GGUF Conversion and Serving Instructions

> [!NOTE]
> The commands below are **UNVERIFIED** on this machine until the real fine-tuned weights are provided.

### 6.1 Conversion Steps (llama.cpp)

1. Clone and compile `llama.cpp`:
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   cmake -B build
   cmake --build build --config Release
   ```

2. Convert Hugging Face PyTorch/Safetensors checkpoint to FP16 GGUF:
   ```bash
   python convert_hf_to_gguf.py /path/to/fine-tuned-model/ --outfile models/sahayak-model-f16.gguf
   ```

3. Quantise to 4-bit (recommended for CPU laptops):
   ```bash
   ./build/bin/llama-quantize models/sahayak-model-f16.gguf models/sahayak-model-q4_k_m.gguf Q4_K_M
   ```

### 6.2 Running `llama-server`

Run via the provided helper scripts:
- **Linux/macOS:**
  ```bash
  ./backend/scripts/run_llm_server.sh --model models/sahayak-model-q4_k_m.gguf --port 8080 --threads 6
  ```
- **Windows PowerShell:**
  ```powershell
  .\backend\scripts\run_llm_server.ps1 -Model "models\sahayak-model-q4_k_m.gguf" -Port 8080 -Threads 6
  ```

### 6.3 Connecting Sahayak Backend

Set environment variables:
```bash
SAHAYAK_LLM__BACKEND=openai_compatible
SAHAYAK_LLM__BASE_URL=http://127.0.0.1:8080/v1
SAHAYAK_LLM__MODEL=local
```
Or for Ollama:
```bash
SAHAYAK_LLM__BACKEND=openai_compatible
SAHAYAK_LLM__BASE_URL=http://127.0.0.1:11434/v1
SAHAYAK_LLM__MODEL=gaganyatri/sarvam-2b-v0.5:latest
```
