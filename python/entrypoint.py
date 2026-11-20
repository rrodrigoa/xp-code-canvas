"""Pinned Python worker, isolated -I/-S execution. Only extension-shipped code is importable."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent / 'src'))
from xp_canvas_analysis.protocol import main
if __name__ == '__main__':
    main()
