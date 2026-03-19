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

    # Generate and save PDF with ReportLab
    pdf_path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, PageBreak

        # Define canvas drawers for branding
        def draw_cover_branding(canvas, doc):
            canvas.saveState()
            # Deep purple/black premium header
            canvas.setFillColor(colors.HexColor("#0a0a0c"))
            canvas.rect(0, A4[1] - 120, A4[0], 120, stroke=0, fill=1)
            
            canvas.setFillColor(colors.white)
            canvas.setFont("Helvetica-Bold", 32)
            canvas.drawString(40, A4[1] - 70, "AETHER")
            canvas.setFillColor(colors.HexColor("#c4b5fd"))
            canvas.drawString(185, A4[1] - 70, "ANALYST")
            
            # Subtitle
            canvas.setFillColor(colors.HexColor("#999999"))
            canvas.setFont("Helvetica", 12)
            canvas.drawString(40, A4[1] - 95, "AUTONOMOUS INTELLIGENCE REPORT")

            # Accent banner
            canvas.setFillColor(colors.HexColor("#7c3aed"))
            canvas.rect(0, A4[1] - 125, A4[0], 5, stroke=0, fill=1)
            
            # Simple footer
            canvas.setFillColor(colors.HexColor("#999999"))
            canvas.setFont("Helvetica", 9)
            canvas.drawString(40, 30, f"Generated dynamically | {datetime.utcnow().strftime('%Y-%m-%d')}")
            canvas.restoreState()

        def draw_later_pages(canvas, doc):
            canvas.saveState()
            canvas.setFillColor(colors.HexColor("#7c3aed"))
            canvas.rect(40, A4[1] - 40, A4[0] - 80, 2, stroke=0, fill=1)
            canvas.setFillColor(colors.HexColor("#999999"))
            canvas.setFont("Helvetica", 9)
            canvas.drawString(40, 30, f"Aether Analyst | Page {doc.page}")
            canvas.restoreState()

        doc = SimpleDocTemplate(
            pdf_path, pagesize=A4, 
            rightMargin=40, leftMargin=40, 
            topMargin=40, bottomMargin=40
        )
        styles = getSampleStyleSheet()

        # Custom Styles
        title_style = ParagraphStyle(
            "CustomTitle", parent=styles["Heading1"], fontSize=26, spaceAfter=20,
            textColor=colors.HexColor("#1a1a1a"), fontName="Helvetica-Bold",
        )
        heading_style = ParagraphStyle(
            "CustomHeading", parent=styles["Heading2"], fontSize=18, spaceBefore=20, spaceAfter=12,
            textColor=colors.HexColor("#4c1d95"), fontName="Helvetica-Bold",
        )
        body_style = ParagraphStyle(
            "CustomBody", parent=styles["Normal"], fontSize=11, spaceAfter=10,
            textColor=colors.HexColor("#333333"), fontName="Helvetica", leading=16,
        )
        bullet_style = ParagraphStyle(
            "CustomBullet", parent=styles["Normal"], fontSize=11, spaceAfter=8,
            textColor=colors.HexColor("#333333"), leftIndent=20, firstLineIndent=-20, leading=16,
            bulletIndent=0
        )

        story = []
        
        # Space below the huge absolute header
        story.append(Spacer(1, 1.2 * inch))
        
        # Title
        story.append(Paragraph(title, title_style))
        story.append(Paragraph(f"<b>Agent Mode:</b> {agent_mode} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Report ID:</b> {report_id[:8]}", body_style))
        story.append(Spacer(1, 0.2 * inch))

        if methodology:
            story.append(Paragraph("Methodology", heading_style))
            story.append(Paragraph(methodology.replace('\\n', '<br/>'), body_style))

        if findings:
            story.append(Paragraph("Key Findings", heading_style))
            for f in findings:
                story.append(Paragraph(f"<bullet>&bull;</bullet> {f}", bullet_style))

        if plots:
            story.append(PageBreak())
            story.append(Spacer(1, 0.5 * inch))
            story.append(Paragraph("Dashboards & Visualizations", heading_style))
            for plot_path_ in plots:
                if os.path.exists(plot_path_):
                    try:
                        from PIL import Image as PILImage
                        pil_img = PILImage.open(plot_path_)
                        orig_w, orig_h = pil_img.size
                        pil_img.close()
                        img = RLImage(plot_path_)
                        img.drawWidth = 6.2 * inch
                        img.drawHeight = img.drawWidth * (orig_h / orig_w)
                        story.append(img)
                        story.append(Spacer(1, 0.4 * inch))
                    except Exception as e:
                        print(f"Failed to load image for PDF: {e}")

        if recommendations:
            if not plots:
                story.append(Spacer(1, 0.3 * inch))
            story.append(Paragraph("Strategic Recommendations", heading_style))
            for r in recommendations:
                story.append(Paragraph(f"<bullet>&bull;</bullet> {r}", bullet_style))

        if sources:
            story.append(Spacer(1, 0.3 * inch))
            story.append(Paragraph("Sources & Citations", heading_style))
            for s in sources:
                cleaned_url = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                story.append(Paragraph(f"<bullet>&#8250;</bullet> <a href='{cleaned_url}' color='blue'>{cleaned_url}</a>", bullet_style))

        doc.build(story, onFirstPage=draw_cover_branding, onLaterPages=draw_later_pages)
        report["pdf_path"] = pdf_path
    except Exception as e:
        print(f"Failed to generate aesthetic PDF via ReportLab: {e}")

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
