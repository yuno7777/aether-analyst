"""
Auto EDA (Exploratory Data Analysis) tool.
Uses pandas to generate comprehensive dataset statistics.
"""

import os
import pandas as pd
import numpy as np


def run_eda(file_path: str) -> dict:
    """
    Run automated EDA on a dataset.
    Returns shape, types, stats, missing values, correlations, and distributions.
    """
    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}"}

    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(file_path)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(file_path)
        else:
            return {"error": f"EDA only supports CSV and Excel files, got: {ext}"}

        result = {
            "file": os.path.basename(file_path),
            "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
            "columns": list(df.columns),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        }

        # Missing values
        missing = df.isnull().sum()
        missing_pct = (missing / len(df) * 100).round(2)
        result["missing_values"] = {
            col: {"count": int(missing[col]), "percentage": float(missing_pct[col])}
            for col in df.columns if missing[col] > 0
        }

        # Numeric stats
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            stats = df[numeric_cols].describe().round(4)
            result["numeric_stats"] = stats.to_dict()

            # Correlations (top pairs)
            if len(numeric_cols) > 1:
                corr = df[numeric_cols].corr()
                corr_pairs = []
                for i in range(len(numeric_cols)):
                    for j in range(i + 1, len(numeric_cols)):
                        corr_pairs.append({
                            "col1": numeric_cols[i],
                            "col2": numeric_cols[j],
                            "correlation": round(float(corr.iloc[i, j]), 4)
                        })
                corr_pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)
                result["top_correlations"] = corr_pairs[:10]

            # Skewness
            skew = df[numeric_cols].skew().round(4)
            result["skewness"] = {col: float(skew[col]) for col in numeric_cols if not pd.isna(skew[col])}

        # Categorical stats
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        if cat_cols:
            cat_stats = {}
            for col in cat_cols:
                vc = df[col].value_counts()
                cat_stats[col] = {
                    "unique_values": int(df[col].nunique()),
                    "top_values": {str(k): int(v) for k, v in vc.head(10).items()},
                    "sample": list(df[col].dropna().head(5).astype(str))
                }
            result["categorical_stats"] = cat_stats

        # Duplicates
        result["duplicate_rows"] = int(df.duplicated().sum())

        # Summary text
        result["summary"] = (
            f"Dataset has {df.shape[0]} rows and {df.shape[1]} columns. "
            f"{len(numeric_cols)} numeric and {len(cat_cols)} categorical columns. "
            f"{'No missing values.' if missing.sum() == 0 else f'{missing.sum()} total missing values across {(missing > 0).sum()} columns.'} "
            f"{result['duplicate_rows']} duplicate rows found."
        )

        return result

    except Exception as e:
        return {"error": f"EDA failed: {str(e)}"}
