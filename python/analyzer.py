#!/usr/bin/env python3
"""Compatibility entry point for V1 build(payload); use packaged persistent worker for VS Code."""
from __future__ import annotations
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'src'))
from xp_canvas_analysis.session import build
from xp_canvas_analysis.syntax.signatures import signature, visibility

def main():
    try:
        response=build(json.load(sys.stdin))
        json.dump(response,sys.stdout,ensure_ascii=False)
    except Exception as exc:
        json.dump({'schema':1,'error':str(exc)},sys.stdout)
        sys.exit(1)
if __name__=='__main__':
    main()
