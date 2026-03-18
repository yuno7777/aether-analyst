"""
Sandboxed Python code executor.
Runs code in a subprocess with timeout.
Intercepts matplotlib plt.show() to save plots as PNGs.
"""

import os
import subprocess
import tempfile
import uuid
from dotenv import load_dotenv

load_dotenv()

REPORTS_DIR = os.getenv("REPORTS_DIR", "./reports")


def execute_code(code: str, timeout: int = 60) -> dict:
    """
    Execute Python code in a sandboxed subprocess.
    Intercepts plt.show() to save plots.
    Returns stdout, stderr, return_code, and any saved plot paths.
    """
    os.makedirs(REPORTS_DIR, exist_ok=True)

    # Generate unique plot filename prefix
    plot_prefix = str(uuid.uuid4())[:8]

    # Inject matplotlib interception code
    injection = f"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as _plt

_original_show = _plt.show
_plot_counter = [0]
_saved_plots = []

def _patched_show(*args, **kwargs):
    _plot_counter[0] += 1
    plot_path = r"{os.path.abspath(REPORTS_DIR)}/{plot_prefix}_plot_{{0}}.png".format(_plot_counter[0])
    _plt.savefig(plot_path, dpi=150, bbox_inches='tight', facecolor='#111111', edgecolor='none')
    _saved_plots.append(plot_path)
    print(f"[PLOT_SAVED] {{plot_path}}")
    _plt.close('all')

_plt.show = _patched_show

import warnings
warnings.filterwarnings('ignore')
"""

    full_code = injection + "\n" + code + "\n\n# Print saved plots\nfor _p in _saved_plots:\n    pass\n"

    # Write to temp file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(full_code)
        temp_path = f.name

    try:
        result = subprocess.run(
            ["python", temp_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.path.abspath("."),
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}
        )

        stdout = result.stdout
        stderr = result.stderr

        # Extract saved plot paths
        plots = []
        output_lines = []
        for line in stdout.split("\n"):
            if line.startswith("[PLOT_SAVED]"):
                plot_path = line.replace("[PLOT_SAVED] ", "").strip()
                plots.append(plot_path)
            else:
                output_lines.append(line)

        clean_stdout = "\n".join(output_lines).strip()

        return {
            "success": result.returncode == 0,
            "stdout": clean_stdout[:5000],  # limit output size
            "stderr": stderr[:2000] if stderr else "",
            "return_code": result.returncode,
            "plots": plots
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Code execution timed out after {timeout} seconds.",
            "return_code": -1,
            "plots": []
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "return_code": -1,
            "plots": []
        }
    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass
