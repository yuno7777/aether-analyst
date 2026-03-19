"""
Aether Analyst — FastAPI Backend
Main application with all API routes, CORS, and startup logic.
"""

import os
import sys
import uuid
import json
import asyncio
import aiofiles
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
from dotenv import load_dotenv

load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_db, Session, Message, Run, Report
from memory import read_memory, write_memory, clear_memory, store_memory_vector
from agent.research_agent import run_research_agent
from agent.analyst_agent import run_analyst_agent
from agent.combined_agent import run_combined_agent

# ─── Config ───
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
REPORTS_DIR = os.getenv("REPORTS_DIR", "./reports")

# ─── App ───
app = FastAPI(
    title="Aether Analyst API",
    description="AI Data Science Agent Backend",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Static files for parsing plots directly from the chat
app.mount("/api/plots", StaticFiles(directory=REPORTS_DIR), name="plots")

# ─── Startup ───
@app.on_event("startup")
async def startup():
    """Initialize database, directories, and memory on startup."""
    init_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(os.getenv("CHROMA_PATH", "./chroma_data"), exist_ok=True)
    # Ensure memory.md exists
    read_memory()
    print("✓ Aether Analyst backend ready")


# ─── Request/Response Models ───
class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    agent_mode: str = "combined"  # research, analyst, combined
    dataset_path: Optional[str] = None


class MemoryUpdateRequest(BaseModel):
    content: str


# ─── In-memory run store for SSE ───
_run_events: dict[str, asyncio.Queue] = {}


# ─── Routes ───

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ─── Chat ───

@app.post("/api/chat")
async def chat(req: ChatRequest, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db)):
    """Start an agent run. Returns run_id and session_id."""
    # Get or create session
    session_id = req.session_id or str(uuid.uuid4())
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        session = Session(
            id=session_id,
            title=req.message[:50] + ("..." if len(req.message) > 50 else ""),
            agent_mode=req.agent_mode,
        )
        db.add(session)
        db.commit()

    # Save user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    db.commit()

    # Create run
    run_id = str(uuid.uuid4())
    run = Run(
        id=run_id,
        session_id=session_id,
        agent_mode=req.agent_mode,
        status="running",
    )
    db.add(run)
    db.commit()

    # Create event queue for SSE
    _run_events[run_id] = asyncio.Queue()

    # Start agent in background
    background_tasks.add_task(
        _execute_agent_run,
        run_id=run_id,
        session_id=session_id,
        message=req.message,
        agent_mode=req.agent_mode,
        dataset_path=req.dataset_path,
    )

    return {
        "run_id": run_id,
        "session_id": session_id,
        "agent_mode": req.agent_mode,
        "status": "running"
    }


async def _execute_agent_run(run_id: str, session_id: str, message: str, agent_mode: str, dataset_path: str = None):
    """Execute the agent run in the background and push events to the queue."""
    queue = _run_events.get(run_id)
    if not queue:
        return

    try:
        # Build message list from session history
        db = next(get_db())
        history = db.query(Message).filter(Message.session_id == session_id).order_by(Message.created_at).all()
        messages = [{"role": m.role, "content": m.content} for m in history]
        db.close()

        if not messages:
            messages = [{"role": "user", "content": message}]

        # Select agent
        if agent_mode == "research":
            agent_fn = run_research_agent
        elif agent_mode == "analyst":
            agent_fn = run_analyst_agent
        else:
            agent_fn = run_combined_agent

        final_content = ""
        report_id = None

        async for event in agent_fn(messages, dataset_path):
            await queue.put(event)

            if event.get("type") == "message":
                final_content = event.get("content", "")
            if event.get("type") == "report":
                report_id = event.get("report_id")
            if event.get("type") == "done":
                report_id = report_id or event.get("report_id")

        # Save agent response to DB
        if final_content:
            db = next(get_db())
            agent_msg = Message(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role="agent",
                content=final_content,
            )
            db.add(agent_msg)

            # Update run status
            run = db.query(Run).filter(Run.id == run_id).first()
            if run:
                run.status = "completed"
                run.finished_at = datetime.utcnow()
                run.report_id = report_id

            db.commit()
            db.close()

        # Update memory.md with session summary
        try:
            _update_memory_after_run(message, final_content, agent_mode)
        except Exception:
            pass

    except Exception as e:
        await queue.put({"type": "error", "content": str(e)})
    finally:
        await queue.put(None)  # Signal end


def _update_memory_after_run(user_message: str, agent_response: str, agent_mode: str):
    """Update memory.md after a run."""
    current_memory = read_memory()
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    # Simple append to Last Session Summary
    new_entry = f"\n- [{timestamp}] [{agent_mode}] User asked: \"{user_message[:100]}\". Agent: {agent_response[:200]}"

    if "## Last Session Summary" in current_memory:
        current_memory = current_memory.replace(
            "## Last Session Summary",
            f"## Last Session Summary{new_entry}"
        )
    else:
        current_memory += f"\n\n## Last Session Summary{new_entry}"

    write_memory(current_memory)


@app.get("/api/chat/stream/{run_id}")
async def stream_run(run_id: str):
    """SSE endpoint to stream agent run events."""
    queue = _run_events.get(run_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Run not found or already completed")

    async def event_generator():
        try:
            while True:
                event = await asyncio.wait_for(queue.get(), timeout=300)
                if event is None:
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    break
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except asyncio.TimeoutError:
            yield f"data: {json.dumps({'type': 'error', 'content': 'Stream timeout'})}\n\n"
        finally:
            _run_events.pop(run_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/chat/history/{session_id}")
async def get_chat_history(session_id: str, db: DBSession = Depends(get_db)):
    """Get all messages in a session."""
    messages = db.query(Message).filter(
        Message.session_id == session_id
    ).order_by(Message.created_at).all()

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


# ─── File Upload ───

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file (CSV, Excel, PDF)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".csv", ".xlsx", ".xls", ".pdf"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Supported: .csv, .xlsx, .xls, .pdf")

    file_id = str(uuid.uuid4())[:8]
    safe_name = f"{file_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "path": os.path.abspath(file_path),
        "size_bytes": len(content),
    }


# ─── Reports ───

@app.get("/api/reports")
async def list_reports():
    """List all generated reports."""
    from agent.tools.report import list_reports as _list_reports
    return _list_reports()


@app.get("/api/reports/{report_id}")
async def get_report(report_id: str):
    """Get a single report by ID."""
    from agent.tools.report import load_report
    report = load_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.get("/api/reports/{report_id}/download")
async def download_report(report_id: str):
    """Download report as markdown file."""
    md_path = os.path.join(REPORTS_DIR, f"{report_id}.md")
    if not os.path.exists(md_path):
        raise HTTPException(status_code=404, detail="Report file not found")
    return FileResponse(
        md_path,
        media_type="text/markdown",
        filename=f"report_{report_id}.md"
    )

@app.get("/api/reports/{report_id}/pdf")
async def download_pdf_report(report_id: str):
    """Download report as PDF file."""
    pdf_path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"report_{report_id}.pdf"
    )

# ─── Memory ───

@app.get("/api/memory")
async def get_memory():
    """Get current memory.md contents."""
    content = read_memory()
    return {"content": content}


@app.put("/api/memory")
async def update_memory(req: MemoryUpdateRequest):
    """Update memory.md contents."""
    write_memory(req.content)
    return {"status": "updated", "length": len(req.content)}


@app.delete("/api/memory")
async def delete_memory():
    """Clear memory.md and wipe ChromaDB."""
    clear_memory()
    return {"status": "cleared"}


# ─── Sessions ───

@app.get("/api/sessions")
async def list_sessions(db: DBSession = Depends(get_db)):
    """List all past sessions."""
    sessions = db.query(Session).order_by(Session.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "agent_mode": s.agent_mode,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]


# ─── Run with uvicorn ───
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
