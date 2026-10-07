#!/usr/bin/env python3
"""Diagnostic script for Sahayak development and production environments.

Checks:
  1. Python version (>= 3.11 required)
  2. Core and optional dependencies for configured backends
  3. Offline model cache (E5, Faster-Whisper, MMS-TTS)
  4. LLM endpoint reachability (llama-server) or echo mode
  5. FAQ ChromaDB index population
  6. Frontend static export build (frontend/out)
  7. Offline environment variable flags

Usage:
  python scripts/doctor.py [--strict]
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Locate repository root and ensure backend/src is importable
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent if (SCRIPT_DIR.parent / "backend").is_dir() else SCRIPT_DIR
BACKEND_SRC = REPO_ROOT / "backend" / "src"

if str(BACKEND_SRC) not in sys.path and BACKEND_SRC.is_dir():
    sys.path.insert(0, str(BACKEND_SRC))


class DiagnosticCheck:
    def __init__(self, name: str) -> None:
        self.name = name
        self.status: str = "PASS"  # PASS, WARN, FAIL, INFO
        self.message: str = ""
        self.action: str | None = None

    def pass_(self, message: str) -> DiagnosticCheck:
        self.status = "PASS"
        self.message = message
        return self

    def warn(self, message: str, action: str | None = None) -> DiagnosticCheck:
        self.status = "WARN"
        self.message = message
        self.action = action
        return self

    def fail(self, message: str, action: str | None = None) -> DiagnosticCheck:
        self.status = "FAIL"
        self.message = message
        self.action = action
        return self

    def info(self, message: str) -> DiagnosticCheck:
        self.status = "INFO"
        self.message = message
        return self


def check_python_version() -> DiagnosticCheck:
    check = DiagnosticCheck("Python Version")
    v = sys.version_info
    ver_str = f"{v.major}.{v.minor}.{v.micro}"
    if v < (3, 11):
        return check.fail(
            f"Found Python {ver_str}. Sahayak requires Python >= 3.11 (uses StrEnum, modern asyncio).",
            action="Upgrade Python to version 3.11 or newer.",
        )
    return check.pass_(f"Python {ver_str} (>= 3.11 required)")


def load_settings():
    try:
        from sahayak.config import Settings
        return Settings()
    except Exception as exc:
        return exc


def check_dependencies(settings) -> list[DiagnosticCheck]:
    checks = []

    # 1. Core dependencies
    core_pkgs = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("pydantic", "pydantic"),
        ("pydantic_settings", "pydantic-settings"),
        ("httpx", "httpx"),
        ("numpy", "numpy"),
        ("yaml", "pyyaml"),
    ]
    missing_core = []
    for mod, pkg in core_pkgs:
        try:
            __import__(mod)
        except ImportError:
            missing_core.append(pkg)

    c_core = DiagnosticCheck("Core Python Packages")
    if missing_core:
        c_core.fail(
            f"Missing required core packages: {', '.join(missing_core)}",
            action=f"pip install -e \"backend[dev]\"",
        )
    else:
        c_core.pass_("All core backend packages installed")
    checks.append(c_core)

    if isinstance(settings, Exception):
        c_cfg = DiagnosticCheck("Configuration Loader")
        c_cfg.fail(f"Could not load sahayak.config: {settings}")
        checks.append(c_cfg)
        return checks

    # 2. RAG dependencies
    if settings.retrieval.backend == "chroma":
        c_rag = DiagnosticCheck("Retrieval (RAG) Packages")
        missing_rag = []
        for mod, pkg in [("chromadb", "chromadb"), ("sentence_transformers", "sentence-transformers")]:
            try:
                __import__(mod)
            except ImportError:
                missing_rag.append(pkg)
        if missing_rag:
            c_rag.fail(
                f"Missing packages for Chroma retrieval: {', '.join(missing_rag)}",
                action="pip install -e \"backend[rag]\"",
            )
        else:
            c_rag.pass_("chromadb and sentence-transformers installed")
        checks.append(c_rag)

    # 3. STT dependencies
    if settings.stt.backend == "faster_whisper":
        c_stt = DiagnosticCheck("STT (Whisper) Packages")
        try:
            __import__("faster_whisper")
            c_stt.pass_("faster-whisper installed")
        except ImportError:
            c_stt.fail(
                "faster-whisper package is not installed",
                action="pip install -e \"backend[stt-whisper]\"",
            )
        checks.append(c_stt)
    elif settings.stt.backend == "indic_conformer":
        c_stt = DiagnosticCheck("STT (IndicConformer) Packages")
        missing = []
        for mod, pkg in [("transformers", "transformers"), ("torch", "torch"), ("onnxruntime", "onnxruntime")]:
            try:
                __import__(mod)
            except ImportError:
                missing.append(pkg)
        if missing:
            c_stt.fail(f"Missing packages: {', '.join(missing)}", action="pip install -e \"backend[stt-indic]\"")
        else:
            c_stt.pass_("transformers, torch, onnxruntime installed")
        checks.append(c_stt)

    # 4. TTS dependencies
    if settings.tts.backend == "mms":
        c_tts = DiagnosticCheck("TTS (Meta MMS) Packages")
        missing = []
        for mod, pkg in [("transformers", "transformers"), ("torch", "torch")]:
            try:
                __import__(mod)
            except ImportError:
                missing.append(pkg)
        if missing:
            c_tts.fail(f"Missing packages: {', '.join(missing)}", action="pip install -e \"backend[tts-mms]\"")
        else:
            c_tts.pass_("transformers and torch installed")
        checks.append(c_tts)
    elif settings.tts.backend == "indic_parler":
        c_tts = DiagnosticCheck("TTS (Indic Parler) Packages")
        try:
            __import__("parler_tts")
            c_tts.pass_("parler-tts installed")
        except ImportError:
            c_tts.fail("parler-tts not installed", action="pip install -e \"backend[tts-parler]\"")
        checks.append(c_tts)

    return checks


def get_hf_cache_dir() -> Path:
    hf_home = os.environ.get("HF_HOME")
    if hf_home:
        return Path(hf_home) / "hub"
    return Path.home() / ".cache" / "huggingface" / "hub"


def is_hf_model_cached(repo_id: str) -> bool:
    # Directory in hub is models--owner--repo
    parts = repo_id.replace("/", "--")
    folder_name = f"models--{parts}"
    cache_dir = get_hf_cache_dir()
    model_dir = cache_dir / folder_name
    if not model_dir.is_dir():
        return False
    # Check if snapshots has at least one item
    snapshots = model_dir / "snapshots"
    if snapshots.is_dir() and any(snapshots.iterdir()):
        return True
    return False


def check_model_cache(settings) -> list[DiagnosticCheck]:
    checks = []
    if isinstance(settings, Exception):
        return checks

    # 1. Embedding model
    if settings.retrieval.backend == "chroma":
        c_emb = DiagnosticCheck(f"Embedding Cache ({settings.retrieval.embed_model})")
        if is_hf_model_cached(settings.retrieval.embed_model):
            c_emb.pass_("Cached locally in HuggingFace cache")
        else:
            c_emb.warn(
                f"Model '{settings.retrieval.embed_model}' not found in local cache.",
                action="Run 'python scripts/download_models.py' while online.",
            )
        checks.append(c_emb)

    # 2. Whisper model
    if settings.stt.backend == "faster_whisper":
        whisper_id = f"Systran/faster-whisper-{settings.stt.whisper_model}"
        c_w = DiagnosticCheck(f"STT Cache ({whisper_id})")
        if is_hf_model_cached(whisper_id):
            c_w.pass_("Cached locally in HuggingFace cache")
        else:
            c_w.warn(
                f"Model '{whisper_id}' not found in local cache.",
                action="Run 'python scripts/download_models.py' while online.",
            )
        checks.append(c_w)

    # 3. MMS TTS models
    if settings.tts.backend == "mms":
        c_mms = DiagnosticCheck("TTS Cache (MMS gu/hi/en)")
        mms_models = ["facebook/mms-tts-guj", "facebook/mms-tts-hin", "facebook/mms-tts-eng"]
        missing = [m for m in mms_models if not is_hf_model_cached(m)]
        if not missing:
            c_mms.pass_("All 3 MMS language models cached locally")
        else:
            c_mms.warn(
                f"Missing MMS models in local cache: {', '.join(missing)}",
                action="Run 'python scripts/download_models.py' while online.",
            )
        checks.append(c_mms)

    return checks


def check_llm_server(settings) -> DiagnosticCheck:
    check = DiagnosticCheck("Language Model (LLM)")
    if isinstance(settings, Exception):
        return check.fail("Cannot check LLM: settings failed to load")

    if settings.llm.backend == "echo":
        return check.pass_("Echo backend enabled (UI dev/testing mode; no llama-server needed)")

    base_url = settings.llm.base_url.rstrip("/")
    probe_url = f"{base_url}/models"
    try:
        req = urllib.request.Request(probe_url, headers={"User-Agent": "SahayakDoctor/0.1"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status == 200:
                return check.pass_(f"llama-server is running and reachable at {base_url}")
            return check.warn(
                f"llama-server returned HTTP {resp.status} at {probe_url}",
                action="Check llama-server logs.",
            )
    except urllib.error.URLError:
        return check.warn(
            f"llama-server is not reachable at {base_url}.",
            action=(
                "Start llama-server with your GGUF model (see backend/scripts/run_llm_server.sh or .ps1), "
                "or set SAHAYAK_LLM__BACKEND=echo for local development."
            ),
        )
    except Exception as exc:
        return check.warn(f"Probe to {probe_url} failed: {exc}")


def check_faq_index(settings) -> DiagnosticCheck:
    check = DiagnosticCheck("FAQ ChromaDB Index")
    if isinstance(settings, Exception):
        return check.fail("Cannot check FAQ index: settings failed to load")

    if settings.retrieval.backend == "disabled":
        return check.info("Retrieval backend is disabled")

    persist_dirs = [
        REPO_ROOT / "backend" / settings.retrieval.persist_dir,
        REPO_ROOT / settings.retrieval.persist_dir,
        Path(settings.retrieval.persist_dir),
    ]

    checked_dirs: list[Path] = []
    found_col_info: tuple[Path, int] | None = None

    for p in persist_dirs:
        p_resolved = p.resolve()
        if p_resolved in checked_dirs:
            continue
        checked_dirs.append(p_resolved)
        if not (p_resolved / "chroma.sqlite3").is_file():
            continue

        try:
            import chromadb
            client = chromadb.PersistentClient(path=str(p_resolved))
            collections = client.list_collections()
            faq_col = next((c for c in collections if c.name == "faqs"), None)
            if faq_col:
                count = faq_col.count()
                if count > 0:
                    found_col_info = (p_resolved, count)
                    break
        except Exception:
            continue

    if found_col_info:
        p_res, count = found_col_info
        return check.pass_(f"Found index at '{p_res}' with {count} FAQ entries")

    return check.warn(
        f"No populated 'faqs' collection found in {settings.retrieval.persist_dir}.",
        action="Run 'sahayak-index' or 'python -m sahayak.cli.build_index' to build the FAQ index.",
    )


def check_frontend_build(settings) -> DiagnosticCheck:
    check = DiagnosticCheck("Frontend Static Build")
    candidates = []
    if not isinstance(settings, Exception) and settings.static_dir:
        candidates.append(Path(settings.static_dir))
    candidates.extend([
        REPO_ROOT / "frontend" / "out",
        REPO_ROOT / "backend" / ".." / "frontend" / "out",
    ])

    for out_dir in candidates:
        index_html = out_dir / "index.html"
        if index_html.is_file():
            size_kb = index_html.stat().st_size / 1024
            return check.pass_(f"Static export ready at '{out_dir}' (index.html: {size_kb:.1f} KB)")

    return check.warn(
        "Frontend static export not found (frontend/out/index.html).",
        action="Run 'npm --prefix frontend run build' before running in production mode.",
    )


def check_offline_flags() -> DiagnosticCheck:
    check = DiagnosticCheck("Offline Runtime Flags")
    hf_off = os.environ.get("HF_HUB_OFFLINE") == "1"
    tf_off = os.environ.get("TRANSFORMERS_OFFLINE") == "1"

    if hf_off and tf_off:
        return check.pass_("HF_HUB_OFFLINE=1 and TRANSFORMERS_OFFLINE=1 (strictly air-gapped)")
    if hf_off or tf_off:
        return check.info(f"Partial offline flags set: HF_HUB_OFFLINE={hf_off}, TRANSFORMERS_OFFLINE={tf_off}")
    return check.info("Offline flags not set (set HF_HUB_OFFLINE=1 when testing air-gapped deployment)")


def format_status(status: str) -> str:
    # Use standard ASCII brackets
    if status == "PASS":
        return "[PASS]"
    if status == "WARN":
        return "[WARN]"
    if status == "FAIL":
        return "[FAIL]"
    return "[INFO]"


def main() -> int:
    parser = argparse.ArgumentParser(description="Sahayak System Diagnostic (Doctor)")
    parser.add_argument("--strict", action="store_true", help="Treat WARN as FAIL (exit code 1)")
    args = parser.parse_args()

    print("=" * 70)
    print(" Sahayak System Diagnostic (scripts/doctor.py)")
    print("=" * 70)

    settings = load_settings()
    checks: list[DiagnosticCheck] = []

    # 1. Python version
    checks.append(check_python_version())

    # 2. Dependencies
    checks.extend(check_dependencies(settings))

    # 3. Model cache
    checks.extend(check_model_cache(settings))

    # 4. LLM server
    checks.append(check_llm_server(settings))

    # 5. FAQ index
    checks.append(check_faq_index(settings))

    # 6. Frontend build
    checks.append(check_frontend_build(settings))

    # 7. Offline flags
    checks.append(check_offline_flags())

    # Print results
    num_pass = 0
    num_warn = 0
    num_fail = 0
    num_info = 0

    for c in checks:
        badge = format_status(c.status)
        print(f"{badge} {c.name}: {c.message}")
        if c.action:
            print(f"       -> ACTION: {c.action}")

        if c.status == "PASS":
            num_pass += 1
        elif c.status == "WARN":
            num_warn += 1
        elif c.status == "FAIL":
            num_fail += 1
        elif c.status == "INFO":
            num_info += 1

    print("-" * 70)
    print(f"Summary: {num_pass} passed, {num_warn} warnings, {num_fail} failures, {num_info} info")
    print("=" * 70)

    if num_fail > 0:
        return 1
    if args.strict and num_warn > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
