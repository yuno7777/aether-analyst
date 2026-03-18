"""
File reader tool.
Supports CSV, Excel (.xlsx), and PDF files.
"""

import os
import pandas as pd


def read_file(file_path: str) -> dict:
    """
    Read a file and return its contents.
    Supports CSV, Excel, and PDF formats.
    """
    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}"}

    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".csv":
            return _read_csv(file_path)
        elif ext in (".xlsx", ".xls"):
            return _read_excel(file_path)
        elif ext == ".pdf":
            return _read_pdf(file_path)
        else:
            return {"error": f"Unsupported file format: {ext}. Supported: .csv, .xlsx, .xls, .pdf"}
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}


def _read_csv(file_path: str) -> dict:
    """Read a CSV file and return summary + head."""
    df = pd.read_csv(file_path)
    return {
        "type": "csv",
        "file": os.path.basename(file_path),
        "shape": list(df.shape),
        "columns": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "head": df.head(10).to_dict(orient="records"),
        "missing_values": df.isnull().sum().to_dict(),
        "preview": df.head(5).to_string()
    }


def _read_excel(file_path: str) -> dict:
    """Read an Excel file and return summary + head."""
    df = pd.read_excel(file_path)
    return {
        "type": "excel",
        "file": os.path.basename(file_path),
        "shape": list(df.shape),
        "columns": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "head": df.head(10).to_dict(orient="records"),
        "missing_values": df.isnull().sum().to_dict(),
        "preview": df.head(5).to_string()
    }


def _read_pdf(file_path: str) -> dict:
    """Read a PDF file and extract text."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return {"error": "PyMuPDF is not installed. Run: pip install PyMuPDF"}

    doc = fitz.open(file_path)
    pages = []
    full_text = ""

    for page_num in range(min(len(doc), 20)):  # limit to first 20 pages
        page = doc[page_num]
        text = page.get_text()
        pages.append({
            "page": page_num + 1,
            "text": text[:2000]  # limit per page
        })
        full_text += text + "\n"

    doc.close()

    return {
        "type": "pdf",
        "file": os.path.basename(file_path),
        "num_pages": len(doc) if hasattr(doc, '__len__') else page_num + 1,
        "pages": pages,
        "text_preview": full_text[:5000]
    }
