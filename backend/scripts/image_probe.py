"""Developer-eyes-only probe for testing local MedGemma 4B image inference.

Sends synthetic or non-medical images to the local Ollama server, measures
latency, throughput, and system memory, and prints output.
Saves nothing to disk. Developer-eyes-only.
"""

import argparse
import base64
import ctypes
import json
import os
import struct
import sys
import time
import zlib
import httpx

# Predefined JSON schema for structured category output verification
IMAGE_CHECK_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {
            "type": "string",
            "enum": ["ok", "unclear_image", "not_a_breast_photo"],
        },
        "findings": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": [
                    "finding_redness",
                    "finding_skin_thickening",
                    "finding_dimpling",
                    "finding_scaling",
                    "finding_nipple_change",
                    "finding_visible_lump_or_shape_difference",
                    "finding_open_sore",
                    "none_visible",
                    "unclear_image",
                    "not_a_breast_photo",
                ],
            },
        },
    },
    "required": ["status", "findings"],
}


class MemoryStatus(ctypes.Structure):
    """Windows MEMORYSTATUSEX structure for memory measurements."""

    _fields_ = [
        ("dwLength", ctypes.c_ulong),
        ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def get_system_memory() -> dict:
    """Return current system RAM usage in MB and percentage."""
    if sys.platform == "win32":
        stat = MemoryStatus()
        stat.dwLength = ctypes.sizeof(MemoryStatus)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
        used_mb = (stat.ullTotalPhys - stat.ullAvailPhys) / (1024 * 1024)
        total_mb = stat.ullTotalPhys / (1024 * 1024)
        avail_mb = stat.ullAvailPhys / (1024 * 1024)
        return {
            "used_mb": round(used_mb, 1),
            "total_mb": round(total_mb, 1),
            "avail_mb": round(avail_mb, 1),
            "load_percent": stat.dwMemoryLoad,
        }
    return {"used_mb": 0.0, "total_mb": 0.0, "avail_mb": 0.0, "load_percent": 0}


def create_synthetic_png(width: int, height: int, r: int, g: int, b: int) -> bytes:
    """Generate a valid in-memory PNG without external imaging dependencies."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw_data = bytearray()
    for _ in range(height):
        raw_data.append(0)  # Filter type 0 (none)
        for _ in range(width):
            raw_data.extend([r, g, b])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw_data))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


def load_images_from_folder(folder_path: str) -> list[tuple[str, bytes]]:
    """Load test images from a directory in memory. Never persists."""
    loaded = []
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp"}
    for root, _, files in os.walk(folder_path):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in allowed_exts:
                p = os.path.join(root, f)
                with open(p, "rb") as fp:
                    loaded.append((f, fp.read()))
    return loaded


def run_probe(server_url: str, model_name: str, images: list[tuple[str, bytes]]) -> None:
    """Send images to model server and measure latency, memory, and schema conformance."""
    print("=" * 70)
    print("SAHAYAK IMAGE PROBE (Developer-Eyes-Only)")
    print("=" * 70)
    print(f"Server URL:    {server_url}")
    print(f"Model:         {model_name}")
    print(f"Test Images:   {len(images)}")

    mem_init = get_system_memory()
    print(f"Initial RAM:   {mem_init['used_mb']} MB / {mem_init['total_mb']} MB ({mem_init['load_percent']}%)")
    print("-" * 70)

    client = httpx.Client(base_url=server_url, timeout=120.0)

    # Check health and model presence
    try:
        tags_resp = client.get("/api/tags")
        if tags_resp.status_code != 200:
            print(f"ERROR: Server responded with HTTP {tags_resp.status_code}")
            return
        available = [m["name"] for m in tags_resp.json().get("models", [])]
        if not any(model_name in m for m in available):
            print(f"ERROR: Model '{model_name}' not found in server models: {available}")
            return
    except Exception as exc:
        print(f"ERROR: Cannot connect to {server_url}: {exc}")
        return

    total_images = len(images)
    latencies = []

    for idx, (img_name, img_bytes) in enumerate(images, 1):
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        size_kb = len(img_bytes) / 1024

        print(f"\n[{idx}/{total_images}] Image: {img_name} ({size_kb:.1f} KB)")

        # Run 1: Descriptive query
        payload_desc = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": "Describe this image concisely in JSON with key description.",
                    "images": [b64],
                }
            ],
            "stream": False,
            "format": "json",
        }

        t0 = time.perf_counter()
        resp_desc = client.post("/api/chat", json=payload_desc)
        t_desc = time.perf_counter() - t0

        if resp_desc.status_code == 200:
            data = resp_desc.json()
            content = data.get("message", {}).get("content", "").strip()
            total_dur_ms = data.get("total_duration", 0) / 1_000_000
            prompt_ms = data.get("prompt_eval_duration", 0) / 1_000_000
            eval_ms = data.get("eval_duration", 0) / 1_000_000
            print(f"  Descriptive response: {content}")
            print(f"  Latency: {t_desc:.2f}s (server: total={total_dur_ms:.0f}ms, prompt={prompt_ms:.0f}ms, eval={eval_ms:.0f}ms)")
        else:
            print(f"  Descriptive query failed: HTTP {resp_desc.status_code}")

        # Run 2: Schema-constrained category classification
        payload_schema = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "Analyze this image. If it is not a photo of human breast skin, "
                        "set status to not_a_breast_photo. Otherwise identify visible skin findings."
                    ),
                    "images": [b64],
                }
            ],
            "stream": False,
            "format": IMAGE_CHECK_SCHEMA,
        }

        t1 = time.perf_counter()
        resp_schema = client.post("/api/chat", json=payload_schema)
        t_schema = time.perf_counter() - t1
        latencies.append(t_schema)

        if resp_schema.status_code == 200:
            data_schema = resp_schema.json()
            raw_text = data_schema.get("message", {}).get("content", "").strip()
            print(f"  Schema-constrained output: {raw_text}")
            try:
                parsed = json.loads(raw_text)
                print(f"  Status enum:   {parsed.get('status')}")
                print(f"  Findings list: {parsed.get('findings')}")
            except json.JSONDecodeError:
                print("  WARNING: Output was not valid JSON!")
        else:
            print(f"  Schema-constrained query failed: HTTP {resp_schema.status_code}")

        mem_now = get_system_memory()
        print(f"  RAM during run: {mem_now['used_mb']} MB / {mem_now['total_mb']} MB ({mem_now['load_percent']}%)")

    client.close()

    print("\n" + "=" * 70)
    print("PROBE SUMMARY")
    print("=" * 70)
    if latencies:
        avg_lat = sum(latencies) / len(latencies)
        min_lat = min(latencies)
        max_lat = max(latencies)
        print(f"Schema run latency: min={min_lat:.2f}s, avg={avg_lat:.2f}s, max={max_lat:.2f}s")
    mem_final = get_system_memory()
    print(f"Final System RAM:   {mem_final['used_mb']} MB / {mem_final['total_mb']} MB ({mem_final['load_percent']}%)")
    print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(description="MedGemma 4B local image probe (developer-eyes-only)")
    parser.add_argument("--url", default="http://127.0.0.1:11434", help="Ollama server URL")
    parser.add_argument("--model", default="medgemma:4b", help="Model name in Ollama")
    parser.add_argument("--folder", default=None, help="Optional folder of test images")
    args = parser.parse_args()

    if args.folder and os.path.isdir(args.folder):
        images = load_images_from_folder(args.folder)
        if not images:
            print(f"No images found in {args.folder}, using synthetic in-memory images.")
            images = []
    else:
        images = []

    if not images:
        images = [
            ("synthetic_red_square_64x64.png", create_synthetic_png(64, 64, 255, 0, 0)),
            ("synthetic_green_rect_128x64.png", create_synthetic_png(128, 64, 0, 255, 0)),
            ("synthetic_blue_square_96x96.png", create_synthetic_png(96, 96, 0, 0, 255)),
            ("synthetic_neutral_grey_64x64.png", create_synthetic_png(64, 64, 128, 128, 128)),
        ]

    run_probe(args.url, args.model, images)


if __name__ == "__main__":
    main()
