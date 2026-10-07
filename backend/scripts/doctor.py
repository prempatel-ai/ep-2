#!/usr/bin/env python3
"""Wrapper forwarding to root scripts/doctor.py."""

import sys
from pathlib import Path

ROOT_DOCTOR = Path(__file__).resolve().parent.parent.parent / "scripts" / "doctor.py"
if ROOT_DOCTOR.is_file():
    import runpy
    runpy.run_path(str(ROOT_DOCTOR), run_name="__main__")
else:
    print(f"Error: doctor script not found at {ROOT_DOCTOR}", file=sys.stderr)
    sys.exit(1)
