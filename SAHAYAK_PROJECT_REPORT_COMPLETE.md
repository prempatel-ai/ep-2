   # SAHAYAK (સહાયક / सहायक)
   ## Comprehensive Academic Project Report & Technical Documentation
   ### Subject: Engineering Project – II (2ET1000701P) | Bachelor of Technology

   ---

   ## 1. Title Page & Preliminary Information

   - **Project Title:** Sahayak (સહાયક / सहायक) – Offline Multilingual Voice & Multimodal Assistant for Verified Breast Cancer Information
   - **Domain:** Artificial Intelligence, Natural Language Processing, Multimodal Vision, Healthcare Informatics, Embedded Offline Systems
   - **Target Degree:** Bachelor of Technology in Computer Engineering / Information Technology
   - **Institution:** Department of Computer Engineering / Information Technology, Sankalchand Patel College of Engineering, Sankalchand Patel University, Visnagar - 384315, Gujarat, India
   - **Academic Year:** 2026–2027

   ---

   ## 2. Certificate & Acknowledgement Templates

   ### 2.1 Certificate Template
   > **CERTIFICATE**  
   > This is to certify that the project report entitled **"Sahayak: Offline Multilingual Voice & Multimodal Assistant for Verified Breast Cancer Information"** has been carried out by **[Student 1 Name (Enrollment No)]**, **[Student 2 Name (Enrollment No)]**, **[Student 3 Name (Enrollment No)]**, and **[Student 4 Name (Enrollment No)]** in partial fulfillment of the requirements for the degree of **Bachelor of Technology in Computer Engineering / Information Technology** of Sankalchand Patel University, Visnagar during the academic year 2026–27.  
   >  
   > **Internal Guide:** [Faculty Name, Designation]  
   > **Head of Department:** Dr. Sanjeev Kumar Punia  
   > Department of Computer Engineering / Information Technology  
   > Sankalchand Patel College of Engineering, Visnagar  

   ### 2.2 Acknowledgement Template
   > **ACKNOWLEDGEMENT**  
   > We express our sincere and heartfelt gratitude to our respected guide **[Faculty Name]** for continuous encouragement, valuable suggestions, and intellectual guidance throughout the design and implementation of project **Sahayak**.  
   > We would also like to express our deep gratitude to **Dr. Sanjeev Kumar Punia**, Head of Department, for providing laboratory infrastructure, hardware resources, and departmental facilities.  
   > Finally, we thank our peers, clinical literature resources (NIH, NCI, MedlinePlus), and open-source AI communities whose verified models and documentation enabled the realization of this offline healthcare assistant.

   ---

   ## 3. Abstract

   In developing regions, individuals seeking reliable clinical information regarding breast cancer encounter critical barriers: verified medical guidance is seldom accessible in native vernacular languages (specifically Gujarati and Hindi), spoken conversational formats are scarce, and commercial cloud-based Large Language Models (LLMs) frequently hallucinate clinical facts while requiring persistent internet connectivity and compromising user data privacy.

   **Sahayak** is an offline, multilingual, multimodal clinical voice and text information assistant engineered to run completely locally on standard edge hardware without external runtime APIs or internet connectivity. The architecture implements:
   1. A **rule-based clinical safety guard** that intercepts emergency symptoms, self-harm signals, and requests for individual diagnosis before invoking AI models, directing users to national Indian helplines (112 and Tele-MANAS 14416).
   2. A **retrieval-augmented generation (RAG) and verbatim retrieval pipeline** built upon ChromaDB and multilingual Sentence Transformers (`multilingual-e5-small`), containing 3,198 clinically verified FAQs from the National Cancer Institute (NCI), MedlinePlus, and HealthCareMagic.
   3. A **fine-tuned local language model** (GGUF quantized via `llama-server`) that streams token completions through an incremental sentence segmenter.
   4. An **interruptible duplex voice pipeline** running client-side Silero Voice Activity Detection (VAD v5 via WebAssembly/ONNX), offline speech-to-text via CTranslate2 Faster-Whisper, and regional speech synthesis via Meta MMS-TTS.
   5. An optional, privacy-preserving **superficial skin observation module** powered by locally hosted MedGemma 4B via Ollama, processing images strictly in volatile memory with zero disk footprint and mandatory clinical consultation referrals.

   The system features 195 automated unit and integration tests (114 backend `pytest`, 81 frontend `vitest`) with full WCAG AA accessibility compliance.

   ---

   ## 4. Table of Contents

   1. **Introduction**
      - 1.1 Overview of Project
      - 1.2 Motivation & Clinical Problem Statement
      - 1.3 Objectives of the Project
      - 1.4 Scope & Limitations
   2. **System Environment & Requirements**
      - 2.1 Hardware Environment & Edge Feasibility
      - 2.2 Software & Framework Environment
      - 2.3 Machine Learning & Deep Learning Model Stack
      - 2.4 Safety, Privacy & Ethical Compliance Standards
   3. **Feasibility Study**
      - 3.1 Technical Feasibility (CPU Edge Inference, Latency Budgets)
      - 3.2 Clinical & Behavioral Feasibility (Trust, Linguistic Nuances)
      - 3.3 Economic Feasibility (Open-Source vs Cloud API Costs)
   4. **Data Dictionary & Data Structures**
      - 4.1 In-Memory Session Store Schema
      - 4.2 Verified Clinical FAQ Database Schema (JSONL & ChromaDB)
      - 4.3 Multilingual Safety Rules Definition Schema (YAML)
      - 4.4 Image Check Clinical Observation Category Schema
      - 4.5 Wire Event Protocols (SSE & WebSocket)
   5. **System Design & UML Diagrams**
      - 5.1 Architecture Overview (Hexagonal / Ports & Adapters)
      - 5.2 Use Case Diagram
      - 5.3 Activity Diagram (Three-Tier Answering Hierarchy)
      - 5.4 Class & Interface Diagram (Domain Ports & Concrete Adapters)
      - 5.5 Data Flow Diagrams (DFD Level 0, Level 1, Level 2)
      - 5.6 Sequence Diagram (Duplex Voice Turn & Barge-In Lifecycle)
   6. **Implementation Details**
      - 6.1 Clean Architecture / Hexagonal Organization
      - 6.2 Precedence-Driven Answering Hierarchy
      - 6.3 Semantic Retrieval & Dual-Threshold Policy
      - 6.4 Incremental Sentence Segmentation & Audio Streaming
      - 6.5 Full Duplex Barge-In Interruption Mechanism
      - 6.6 Zero-Disk In-Memory Image Check Pipeline
      - 6.7 Frontend Next.js Single Page Architecture & State Reducers
   7. **Empirical Benchmarks, Verification & Failure Analysis**
      - 7.1 Automated Test Suite Analysis (195 Tests)
      - 7.2 CPU-Only Hardware Latency Measurements (Intel Core i5-11400H)
      - 7.3 Memory Utilization & Out-of-Memory (OOM) Protection
      - 7.4 Implementation Challenges, Failures & Architectural Resolutions
   8. **Conclusion & Future Work**
      - 8.1 Summary of Deliverables
      - 8.2 Future Scope & Research Extensions
   9. **References**

   ---

   ## 5. Chapter 1: Introduction

   ### 5.1 Overview of Project
   Sahayak (meaning "Helper" in Gujarati and Hindi) is an offline-first assistive system designed to empower non-English speaking and low-literacy communities in India with accurate, clinically validated breast cancer awareness. Operating without external cloud dependencies, Sahayak translates verified medical knowledge into natural, spoken Gujarati, Hindi, and English.

   ### 5.2 Motivation & Clinical Problem Statement
   1. **Linguistic Exclusion:** The majority of peer-reviewed clinical knowledge exists in English. Patients in regional districts (such as Gujarat) struggle to access trustworthy advice in their native tongue.
   2. **Literacy Barriers:** Traditional healthcare websites rely heavily on dense text, alienating individuals who communicate primarily via spoken vernacular.
   3. **LLM Hallucination Risks:** Generic public AI chatbots tend to invent medical guidance, misstate treatment dosages, or offer speculative diagnoses without clinical provenance.
   4. **Privacy Concerns:** Uploading sensitive physical symptoms or breast imagery to public cloud endpoints introduces privacy, ethical, and regulatory complications.
   5. **Connectivity Constraints:** Rural clinics and remote communities often lack reliable internet, rendering cloud-dependent solutions inoperable.

   ### 5.3 Objectives of the Project
   - **Zero-Internet Operability:** Run all inference components (STT, LLM, Embeddings, TTS, Vision) on edge hardware.
   - **Strict Clinical Boundaries:** Guarantee that the system never diagnoses, never interprets personal lab reports, and never prescribes medicine dosages.
   - **Three-Tier Precedence Routing:** Implement an answering pipeline where safety rules override retrieval, and verified FAQs override LLM generation.
   - **Sentence-Level Streaming Audio:** Minimize Time-to-First-Audio (TTFA) by pipelining sentence chunking with speech synthesis.
   - **Instant Speech Interruption (Barge-In):** Allow the user to cut off assistant speech at any time, instantly halting playback and truncating history.
   - **Privacy by Architecture:** Maintain zero disk storage of patient voice clips, transcribed text, or submitted images.

   ### 5.4 Scope & Limitations
   - **In Scope:** General breast cancer education, anatomical explanations, screening guidelines, symptom awareness, myth debiasing, and referral to medical professionals.
   - **Out of Scope / Limitations:** Automated medical diagnosis, ultrasound/mammogram DICOM radiological analysis, prescription generation, personalized prognosis.

   ---

   ## 6. Chapter 2: System Environment & Requirements

   ### 6.1 Hardware Environment & Edge Feasibility
   - **Target Edge Hardware:** Standard personal computers / laptops (e.g., Intel Core i5 11th Gen, 16 GB DDR4 RAM, 512 GB SSD).
   - **Execution Target:** Primarily CPU-only (utilizing AVX2/AVX-512 instructions), with optional GPU acceleration (NVIDIA CUDA / DirectML) when available.
   - **Audio Interface:** 16 kHz mono microphone input and stereo headphone/speaker output.

   ### 6.2 Software & Framework Environment
   - **Operating System:** Cross-platform (Windows 11 / Linux Ubuntu 22.04 LTS / macOS).
   - **Backend Language & Framework:** Python 3.11+, FastAPI $\ge$ 0.115, Uvicorn $\ge$ 0.30, Pydantic v2.
   - **Frontend Framework:** Next.js 16.3.8 (Static Export SPA), React 19.2.8, TypeScript 5.x.
   - **Client Audio & VAD:** Web Audio API, Web Workers, `@ricky0123/vad-web` (Silero VAD v5 ONNX).
   - **Styling & Icons:** Tailwind CSS v4, Lucide React 1.51.0, Radix UI Primitives.

   ### 6.3 Machine Learning & Deep Learning Model Stack

   | Component | Model / Technology | Model Weight / Quantization | Purpose |
   |---|---|---|---|
   | **Vector Embeddings** | `intfloat/multilingual-e5-small` | 384-dimensional float32 (199 weights) | Semantic search over clinical FAQ entries |
   | **Vector DB** | ChromaDB PersistentClient | Local SQLite + HNSW cosine index | Storage and retrieval of 3,198 FAQ vectors |
   | **Speech-to-Text (STT)** | OpenAI Whisper (`small`) | CTranslate2 int8 quantized | Multilingual speech transcription |
   | **Text-to-Speech (TTS)** | Meta MMS-TTS (VITS) | `facebook/mms-tts-guj`, `-hin`, `-eng` | Native speech synthesis with pitch adaptation |
   | **Large Language Model** | Local GGUF Model via `llama-server` | Quantized Q4_K_M (OpenAI-compatible SSE) | Contextual clinical answer synthesis |
   | **Vision Language Model** | MedGemma 4B (Gemma 3 4B) | Quantized Q4_K_M via Ollama | In-memory superficial visual skin observation |

   ### 6.4 Safety, Privacy & Ethical Compliance Standards
   - **Indian National Helplines:** Integrated hotlines for National Emergency (**112**) and Mental Health (**Tele-MANAS 14416**).
   - **IEC 62304 / ISO 14971 Medical Device Software Principles:** Risk mitigation through deterministic regex guards overriding probabilistic models.
   - **Zero-Persistence Privacy:** In-memory image processing with PIL; session histories maintained solely in RAM with 30-minute idle TTL.
   - **Accessibility:** Compliance with WCAG 2.1 AA standards; keyboard navigable, screen-reader optimized, high contrast ratios.

   ---

   ## 7. Chapter 3: Feasibility Study

   ### 7.1 Technical Feasibility
   - **Feasibility on Commodity CPUs:** Through CTranslate2 int8 quantization (Whisper), VITS linear graph execution (MMS), and GGUF k-quantization, complex multimodal pipelines run simultaneously within 16 GB of system RAM.
   - **Model Decoupling via Hexagonal Ports:** Services depend purely on Python `Protocol` interfaces. If a local model fails to load, fallback or null adapters prevent service crashes.

   ### 7.2 Clinical & Behavioral Feasibility
   - **Patient Comfort with Vernacular:** Speaking in one's mother tongue (Gujarati/Hindi) reduces anxiety surrounding cancer discussions.
   - **Trust Through Attribution:** Users are shown source badges (`[Source: faq]`, `[Source: safety]`, `[Source: model]`) and verified clinical reference links, preventing misinformation.

   ### 7.3 Economic Feasibility
   - **Zero Ongoing API Costs:** By eliminating reliance on paid cloud APIs (OpenAI, AWS Polly, Google Speech), operational expenditure for health centers remains zero after initial deployment.

   ---

   ## 8. Chapter 4: Data Dictionary & Data Structures

   ### 8.1 In-Memory Session Store Schema
   ```
   Session Object:
   ├── id: String (UUID v4)
   ├── messages: List[ChatMessage]
   │     ├── role: Enum ('system', 'user', 'assistant')
   │     └── content: String
   ├── lock: asyncio.Lock (Per-session mutex for turn isolation)
   ├── created_at: Float (Unix epoch timestamp)
   └── last_active: Float (Unix epoch timestamp for 30-minute TTL expiry)
   ```

   ### 8.2 Verified Clinical FAQ Database Schema (`data/faqs.jsonl`)

   | Field Name | Type | Description | Example Value |
   |---|---|---|---|
   | `id` | String (SHA-1) | Deterministic 16-character hash of normalized question | `"a8f2031c9b4e10d2"` |
   | `question` | String | Clinically verified question text | `"What is a screening mammogram?"` |
   | `answer` | String | Medically approved informative answer | `"A screening mammogram is a low-dose X-ray..."` |
   | `source` | String | Originating clinical authority | `"NIH / National Cancer Institute & MedlinePlus"` |
   | `language` | String (Optional) | ISO language code (`gu`, `hi`, `en`) | `"en"` |

   ### 8.3 Multilingual Safety Rules Schema (`resources/safety_rules.yaml`)
   ```yaml
   categories:
   emergency:
      patterns: { en: [...], hi: [...], gu: [...] }
      replies: { en: "Call 112...", hi: "112 पर कॉल करें...", gu: "112 પર કૉલ કરો..." }
   self_harm:
      patterns: { en: [...], hi: [...], gu: [...] }
      replies: { en: "Call Tele-MANAS 14416...", hi: "14416 पर कॉल करें...", gu: "14416 પર કૉલ કરો..." }
   personal_medical:
      patterns: { en: [...], hi: [...], gu: [...] }
      replies: { en: "Speak to your doctor...", hi: "डॉक्टर से बात करें...", gu: "ડૉક્ટર સાથે વાત કરો..." }
   ```

   ### 8.4 Image Check Clinical Observation Category Schema
   Controlled vocabulary of 10 observation categories:
   1. `finding_redness` (Skin erythema)
   2. `finding_skin_thickening` (Peau d'orange texture)
   3. `finding_dimpling` (Focal retraction/tethering)
   4. `finding_scaling` (Eczematoid changes of nipple-areolar complex)
   5. `finding_nipple_change` (Inversion, retraction, discharge)
   6. `finding_visible_lump_or_shape_difference` (Contour asymmetry)
   7. `finding_open_sore` (Ulceration)
   8. `none_visible` (No superficial skin abnormalities detected)
   9. `unclear_image` (Poor illumination, blur, out of focus)
   10. `not_a_breast_photo` (Non-relevant anatomical or inanimate image)

   ### 8.5 Wire Event Protocols

   #### A. Chat Server-Sent Events (`POST /v1/chat`)
   - `event: session` $\rightarrow$ `data: {"type": "session", "session_id": "..."}`
   - `event: sentence` $\rightarrow$ `data: {"type": "sentence", "index": 0, "text": "...", "source": "faq"}`
   - `event: done` $\rightarrow$ `data: {"type": "done", "source": "model", "metrics": {...}}`
   - `event: error` $\rightarrow$ `data: {"type": "error", "code": "...", "message": "..."}`

   #### B. Duplex Voice Protocol (`WS /v1/voice`)
   - **Client to Server:**
   - `JSON {"type": "start", "language": "gu"}`
   - `Binary Frame`: 16 kHz mono 16-bit signed PCM audio bytes
   - `JSON {"type": "text", "text": "..."}`
   - `JSON {"type": "interrupt"}`
   - **Server to Client:**
   - `JSON {"type": "ready"}`
   - `JSON {"type": "transcript", "text": "...", "language": "gu"}`
   - `JSON {"type": "sentence", "index": 0, "text": "...", "source": "model"}`
   - `Binary Frame`: Big-endian 4-byte sentence index + complete WAV audio file
   - `JSON {"type": "done", "metrics": {...}}`
   - `JSON {"type": "interrupted"}`

   ---

   ## 9. Chapter 5: System Design & UML Diagrams

   ### 5.1 System Architecture Diagram
   ```
                        ┌────────────────────────────────────────┐
                        │          Next.js Frontend (SPA)        │
                        │  (ChatView, VoiceView, ImageCheckView) │
                        └───────────────────┬────────────────────┘
                                          │ HTTP SSE / WebSocket
                                          ▼
                        ┌────────────────────────────────────────┐
                        │            FastAPI Web Layer           │
                        │  (routes_chat, routes_voice, image)    │
                        └───────────────────┬────────────────────┘
                                          │ Dependency Injection
                                          ▼
                        ┌────────────────────────────────────────┐
                        │          Application Services          │
                        │ (SafetyGuard, Retrieval, Conversation) │
                        └───────────────────┬────────────────────┘
                                          │ Implements Protocols
                                          ▼
                        ┌────────────────────────────────────────┐
                        │           Concrete Adapters            │
                        ├──────────────┬──────────────┬──────────┤
                        │ FasterWhisper│    MMSTTS    │ ChromaDB │
                        │   (STT)      │    (TTS)     │  (RAG)   │
                        ├──────────────┴──────────────┴──────────┤
                        │ llama-server (LLM) / Ollama (MedGemma) │
                        └────────────────────────────────────────┘
   ```

   ### 5.2 Use Case Diagram
   - **Primary Actor:** User / Patient
   - **Secondary Actor:** Clinical Knowledge Base / Local AI Engines
   - **Key Use Cases:**
   - *UC-1: Voice Conversation in Regional Language*
   - *UC-2: Ask Breast Cancer Question via Text*
   - *UC-3: Interrupt Spoken Playback (Barge-In)*
   - *UC-4: Upload Image for Superficial Skin Observation*
   - *UC-5: Review Sourced Clinical Citations*
   - *UC-6: Trigger Emergency / Suicide Safety Intervention*
   - *UC-7: Forget Active Session Data*

   ### 5.3 Activity Diagram: Three-Tier Answering Pipeline
   ```
   [User Input] ──> [SafetyGuard Check]
                        │
                        ├── [Match Found] ──────────> [Return Pre-Authored Safety Reply]
                        │                             (Source: safety)
                        └── [No Match]
                              │
                              ▼
                        [ChromaDB Embedding & Search]
                              │
                              ├── [Score >= 0.90] ──> [Return FAQ Verbatim] (Source: faq)
                              │
                              ├── [Score >= 0.55] ──> [Augment System Prompt with Top Hits]
                              │                       └──> [Stream LLM Output] (Source: model)
                              │
                              └── [Score < 0.55] ───> [Prompt LLM without Context]
                                                      └──> [Stream LLM Output] (Source: model)
   ```

   ### 5.4 Data Flow Diagrams (DFD)

   #### Level 0 DFD (Context Level)
   ```
   [User] ──(Voice / Text / Image)──> [ SAHAYAK SYSTEM ] ──(Spoken Voice / Text / Citations)──> [User]
   ```

   #### Level 1 DFD
   ```
   [User Input] ──> [1.0 Input Processing & Safety] ──(Safe Query)──> [2.0 Semantic FAQ Retrieval]
                           │                                                   │
                  (Safety Trigger)                                    (FAQ Context / Direct)
                           │                                                   │
                           ▼                                                   ▼
                  [Safety Templates]                                [3.0 LLM Sentence Generation]
                           │                                                   │
                           └──────────────┐                     ┌──────────────┘
                                          ▼                     ▼
                                       [4.0 TTS Synthesis & Formatting] ──> [User Output]
   ```

   ---

   ## 10. Chapter 6: Implementation Details

   ### 10.1 Clean Hexagonal Architecture
   In accordance with Ports and Adapters architecture:
   - `backend/src/sahayak/domain/ports.py` defines abstract interfaces (`LanguageModel`, `SpeechToText`, `TextToSpeech`, `FAQRetriever`, `ImageAnalyzer`).
   - Core services (`conversation.py`, `turns.py`) **never import concrete model libraries** (PyTorch, Whisper, Transformers, ChromaDB).
   - `container.py` builds and binds concrete adapters at startup, isolating ML dependencies from application logic.

   ### 10.2 Incremental Sentence Segmentation (`segmenter.py`)
   To achieve low conversational latency, the system cannot wait for an LLM to generate an entire paragraph before starting speech synthesis.
   - `SentenceSegmenter` buffers streaming token deltas.
   - Scans for clause boundaries (`,;:`) for an accelerated first-sentence cut ($\ge 20$ chars).
   - Detects sentence terminators (`.!?` in English, and `। ॥ …` in Hindi and Gujarati).
   - Distinguishes decimal numbers (`3.5`) and common abbreviations (`Dr.`, `Mrs.`, `vs.`) from sentence ends.

   ### 10.3 Real-Time Barge-In Interruption
   - When the user speaks while the assistant is speaking, client-side Silero VAD fires `onSpeechStart`.
   - The client cancels audio playback immediately (`audioQueuePlayer.flush()`), issues `{"type": "interrupt"}` over the WebSocket, and increments its local turn counter.
   - The backend `TurnService` cancels the active generation task and truncates conversation memory to only the sentences the user actually heard.

   ### 10.4 Zero-Disk In-Memory Image Check Pipeline
   - `image_prep.py` validates file headers, decodes the image via Pillow, strips all EXIF metadata, resizes dimensions to a maximum of 1024 px via Lanczos filtering, and recompresses to PNG bytes entirely in RAM.
   - Structured findings are extracted using Ollama with MedGemma 4B.
   - The UI maps findings to clinical guidance and appends emergency and doctor referral notices.

   ---

   ## 11. Chapter 7: Empirical Benchmarks, Verification & Failure Analysis

   ### 11.1 Test Suite Verification
   The complete test suite runs offline without internet access:
   - **Backend (`pytest`):** 114 passed tests across 10 test modules.
   - **Frontend (`vitest`):** 81 passed tests across 13 test files.
   - **Total:** **195 passed tests**.

   ### 11.2 Hardware Latency Benchmarks (Intel Core i5-11400H CPU-Only)
   Testing on an 11th Gen Intel Core i5-11400H (6 cores, 12 threads, 16 GB RAM) yielded the following benchmarks:
   - **Whisper `small` model load time:** 2.0 seconds.
   - **Meta MMS-TTS load time (3 languages):** 29.6 seconds (~9.8 s per language).
   - **Time-to-First-Audio (TTFA):** ~5.5 seconds on CPU.
   - **Analysis:** Demonstrates that running Whisper `small` on a laptop CPU takes ~4.1 s for transcription. Reaching sub-3-second latency on edge hardware requires a GPU, a smaller model (Whisper `base`/`tiny`), or streaming partial transcription.

   ### 11.3 Memory Optimization & OOM Protection
   - When loading multimodal vision models (MedGemma 4B) alongside voice models (Whisper + MMS-TTS), system memory peaked at 14.8 GB (92% of 16 GB capacity).
   - **Resolution:** Implemented an on-demand loading strategy with a 5-minute keep-alive (`keep_alive: "5m"` in Ollama), unloading vision weights from memory when inactive.

   ### 11.4 Architectural Failures Encountered & Mitigations

   | Failure Encountered | Root Cause | Engineering Mitigation |
   |---|---|---|
   | **Python Regex `\b` Failure in Devanagari/Gujarati** | Python's standard `\b` regex considers Indic vowel signs as non-word characters, causing word boundary failures. | Removed `\b` from Indic regex patterns in `safety_rules.yaml` and switched to explicit phrase boundaries. |
   | **Response Text Squashing in UI** | `conversationReducer.ts` concatenated incoming sentences with `.join(" ")`, flattening markdown headings, bullet lists, and source citations. | Implemented `joinSentences` utility that preserves block newlines for headings, bullets, and citations. |
   | **Model Generation Abrupt Cutoffs** | Default `max_tokens` was configured to 300 tokens, truncating multi-point myth/fact lists. | Increased `max_tokens` default to 800 and updated system prompts to enforce clean formatting without dangling stubs. |
   | **Concurrent Turn Corruption** | A rapid user speech turn overlapping with an existing request could corrupt session message history. | Added an `asyncio.Lock` per session in `SessionStore` to serialize turns. |

   ---

   ## 12. Chapter 8: Conclusion & Future Scope

   ### 12.1 Conclusion
   Sahayak demonstrates that an offline, multilingual, multimodal healthcare assistant can operate effectively on consumer-grade hardware. By enforcing a strict answering hierarchy, provenance tracking, and zero-disk in-memory processing, Sahayak delivers verified clinical information to regional-language speakers while prioritizing user safety and data privacy.

   ### 12.2 Future Work
   - Integration of lightweight quantized vision backends (e.g., Moondream 2) for lower RAM footprint.
   - Partial streaming STT to lower Time-to-First-Audio below 2.0 seconds on CPU.
   - Expansion to additional regional languages (Marathi, Tamil, Telugu).
   - Pilot testing in community healthcare kiosks and rural diagnostic centers.

   ---

   ## 13. References

   1. **Medical Knowledge Bases & Guidelines:**
      - National Cancer Institute (NCI). *Breast Cancer Screening and Diagnosis Guidelines*. Bethesda, MD: National Institutes of Health, 2024.
      - MedlinePlus. *Breast Cancer Information and Clinical Summaries*. National Library of Medicine (US), 2024.
      - World Health Organization (WHO). *Global Breast Cancer Initiative Implementation Framework*. Geneva: WHO, 2023.
   2. **Speech & Multilingual AI Foundations:**
      - Radford, A., et al. (2023). *Robust Speech Recognition via Large-Scale Weak Supervision (Whisper)*. Proceedings of ICML.
      - Pratap, V., et al. (2023). *Scaling Speech Technology to 1,000+ Languages (Meta MMS)*. arXiv:2305.13516.
      - Wang, L., et al. (2024). *Multilingual E5 Text Embeddings: Technical Report*. Microsoft Research.
   3. **Software Architecture & Healthcare Safety Standards:**
      - Martin, Robert C. *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall, 2017.
      - International Electrotechnical Commission (IEC). *IEC 62304: Medical device software – Software life cycle processes*. Geneva: IEC, 2015.
      - Ministry of Health and Family Welfare, Government of India. *Tele-MANAS National Tele-Mental Health Programme Guidelines*, 2022.
