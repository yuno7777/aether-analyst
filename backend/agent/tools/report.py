"""
Report generator tool.
Creates JSON and Markdown reports, saves to reports/ folder.
"""

import os
import json
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

REPORTS_DIR = os.getenv("REPORTS_DIR", "./reports")


def generate_report(
    title: str,
    agent_mode: str,
    methodology: str = "",
    findings: list = None,
    recommendations: list = None,
    sources: list = None,
    plots: list = None,
) -> dict:
    """
    Generate a JSON + Markdown report and save to disk.
    Returns the report data with id and paths.
    """
    os.makedirs(REPORTS_DIR, exist_ok=True)

    report_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()

    report = {
        "id": report_id,
        "title": title,
        "agent_mode": agent_mode,
        "created_at": created_at,
        "methodology": methodology,
        "findings": findings or [],
        "recommendations": recommendations or [],
        "sources": sources or [],
        "plots": plots or [],
    }

    # Save JSON
    json_path = os.path.join(REPORTS_DIR, f"{report_id}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # Generate and save Markdown
    md_content = _generate_markdown(report)
    md_path = os.path.join(REPORTS_DIR, f"{report_id}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    # Generate and save PDF
    pdf_path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")
    try:
        import markdown
        from xhtml2pdf import pisa
        
        # Convert markdown to HTML
        # Add basic styling to make the PDF look professional
        html_content = markdown.markdown(md_content, extensions=['extra', 'codehilite'])
        styled_html = f"""
        <html>
        <head>
        <style>
            @page {{ size: a4; margin: 2cm; }}
            body {{ font-family: "Helvetica", "Arial", sans-serif; font-size: 11pt; line-height: 1.5; color: #333333; }}
            h1 {{ color: #1a202c; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-size: 24pt; margin-bottom: 16px; }}
            h2 {{ color: #2d3748; margin-top: 24px; font-size: 18pt; }}
            h3 {{ color: #4a5568; margin-top: 16px; font-size: 14pt; }}
            p {{ margin-bottom: 12px; }}
            ul, ol {{ margin-bottom: 16px; padding-left: 20px; }}
            li {{ margin-bottom: 6px; }}
            code {{ font-family: "Courier New", monospace; background-color: #f7fafc; padding: 2px 4px; border-radius: 4px; font-size: 10pt; }}
            pre {{ background-color: #f7fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 16px; }}
            img {{ max-width: 100%; height: auto; margin-top: 16px; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 4px; }}
            hr {{ border: 0; border-top: 1px solid #cbd5e0; margin: 24px 0; }}
            .footer {{ font-size: 9pt; color: #718096; text-align: center; margin-top: 32px; font-style: italic; }}
        </style>
        </head>
        <body>
        {html_content}
        <div class="footer">Report generated dynamically by Aether Analyst</div>
        </body>
        </html>
        """
        with open(pdf_path, "w+b") as result_file:
            pisa.CreatePDF(styled_html, dest=result_file)
        report["pdf_path"] = pdf_path
    except Exception as e:
        print(f"Failed to generate PDF: {e}")

    report["json_path"] = json_path
    report["md_path"] = md_path

    return report


def _generate_markdown(report: dict) -> str:
    """Generate a Markdown report from structured data."""
    lines = [
        f"# {report['title']}",
        "",
        f"**Agent Mode:** {report['agent_mode']}  ",
        f"**Generated:** {report['created_at']}  ",
        f"**Report ID:** `{report['id']}`",
        "",
        "---",
        "",
    ]

    if report.get("methodology"):
        lines.extend([
            "## Methodology",
            "",
            report["methodology"],
            "",
        ])

    if report.get("findings"):
        lines.extend(["## Key Findings", ""])
        for i, finding in enumerate(report["findings"], 1):
            lines.append(f"{i}. {finding}")
        lines.append("")

    if report.get("recommendations"):
        lines.extend(["## Recommendations", ""])
        for i, rec in enumerate(report["recommendations"], 1):
            lines.append(f"{i}. {rec}")
        lines.append("")

    if report.get("sources"):
        lines.extend(["## Sources", ""])
        for source in report["sources"]:
            lines.append(f"- {source}")
        lines.append("")

    if report.get("plots"):
        lines.extend(["## Visualizations", ""])
        for plot in report["plots"]:
            filename = os.path.basename(plot)
            lines.append(f"![{filename}]({plot})")
            lines.append("")

    lines.extend([
        "---",
        "",
        "*Report generated by Aether Analyst*",
    ])

    return "\n".join(lines)


def load_report(report_id: str) -> dict | None:
    """Load a report by ID from disk."""
    json_path = os.path.join(REPORTS_DIR, f"{report_id}.json")
    if not os.path.exists(json_path):
        return None
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_reports() -> list[dict]:
    """List all reports on disk."""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    reports = []
    for filename in os.listdir(REPORTS_DIR):
        if filename.endswith(".json"):
            path = os.path.join(REPORTS_DIR, filename)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    report = json.load(f)
                    reports.append({
                        "id": report.get("id", filename.replace(".json", "")),
                        "title": report.get("title", "Untitled"),
                        "agent_mode": report.get("agent_mode", "unknown"),
                        "created_at": report.get("created_at", ""),
                        "findings_count": len(report.get("findings", [])),
                    })
            except Exception:
                continue
    reports.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return reports
