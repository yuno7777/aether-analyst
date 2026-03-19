"""
Agent core — ReAct loop engine.
Handles: Thought→Action→Observation cycle, tool routing,
JSON parsing with retry, and step streaming.
"""

import os
import re
import json
import uuid
import asyncio
from datetime import datetime
from typing import AsyncGenerator
from dotenv import load_dotenv

load_dotenv()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
MAX_AGENT_STEPS = int(os.getenv("MAX_AGENT_STEPS", "20"))

# ─── Tool Imports ───
from agent.tools.web_search import web_search
from agent.tools.arxiv import search_arxiv
from agent.tools.code_executor import execute_code
from agent.tools.file_reader import read_file
from agent.tools.eda import run_eda
from agent.tools.report import generate_report

# ─── Tool Registry ───
TOOL_REGISTRY = {
    "web_search": {
        "fn": web_search,
        "async": True,
        "description": "Search the web using DuckDuckGo. Input: {\"query\": \"search terms\", \"max_results\": 5}"
    },
    "arxiv": {
        "fn": search_arxiv,
        "async": True,
        "description": "Search ArXiv for academic papers. Input: {\"query\": \"topic\", \"max_results\": 5}"
    },
    "code_executor": {
        "fn": execute_code,
        "async": False,
        "description": "Execute Python code in a sandbox. Input: {\"code\": \"python code string\"}"
    },
    "file_reader": {
        "fn": read_file,
        "async": False,
        "description": "Read CSV, Excel, or PDF files. Input: {\"file_path\": \"/path/to/file\"}"
    },
    "eda": {
        "fn": run_eda,
        "async": False,
        "description": "Run auto EDA on a dataset. Input: {\"file_path\": \"/path/to/data.csv\"}"
    },
    "report": {
        "fn": generate_report,
        "async": False,
        "description": "Generate a structured report. Input: {\"title\": \"...\", \"agent_mode\": \"...\", \"methodology\": \"...\", \"findings\": [...], \"recommendations\": [...], \"sources\": [...]}"
    },
    "finish": {
        "fn": None,
        "async": False,
        "description": "Finish the run. Input: {\"summary\": \"final summary text\", \"report_id\": \"optional report id\"}"
    },
}


def get_tools_description(tool_names: list[str]) -> str:
    """Get formatted tool descriptions for the system prompt."""
    lines = ["Available tools:"]
    for name in tool_names:
        if name in TOOL_REGISTRY:
            lines.append(f"  - {name}: {TOOL_REGISTRY[name]['description']}")
    return "\n".join(lines)


def build_system_prompt(agent_type: str, tool_names: list[str], memory_content: str, relevant_memories: list = None) -> str:
    """Build the full system prompt for the agent."""
    tools_desc = get_tools_description(tool_names)

    memories_section = ""
    if relevant_memories:
        memories_section = "\n\n## Relevant Past Memories\n"
        for m in relevant_memories:
            memories_section += f"- {m['content']}\n"

    return f"""You are Aether Analyst, an autonomous AI data science agent operating in {agent_type} mode.

You work in a ReAct loop: Think step by step, use tools, observe results, repeat until done.

{tools_desc}

## CRITICAL: Response Format
You MUST respond with ONLY valid JSON, no markdown fences, no extra text.
Every response must be exactly one of these formats:

Action response (when you need to use a tool):
{{"thought": "your reasoning", "action": "tool_name", "action_input": {{...params}}}}

Finish response (when you are done):
{{"thought": "final reasoning", "action": "finish", "action_input": {{"summary": "what you accomplished"}}}}

## Rules
- Always think before acting
- Use tools one at a time
- If a tool returns an error, try a different approach
- Maximum {MAX_AGENT_STEPS} steps per run
- Be concise in thoughts
- When working with data, always run EDA first before modeling
- CRITICAL: You ARE integrated with a physical React frontend that renders and downloads ACTUAL PDF files! When a user asks for a report or PDF, you MUST use the `report` tool. NEVER apologize or claim you cannot generate PDFs or physical files, because the `report` tool natively handles all PDF generation and serves it to the user.
- CRITICAL: When a user asks for charts, graphs, or visualizations, you MUST use the `code_executor` tool to run real Python code that generates them. ALWAYS call `plt.show()` to save the chart.
- MANDATORY CHART STYLE GUIDE — Every chart you create MUST follow this premium design system:
  ```
  import matplotlib.pyplot as plt
  import matplotlib.ticker as mticker
  import numpy as np

  # ── PREMIUM DARK THEME SETUP ──
  BG_COLOR = '#0d0d0d'
  CARD_BG = '#151520'
  TEXT_COLOR = '#e0e0e0'
  SUBTITLE_COLOR = '#8888aa'
  GRID_COLOR = '#2a2a3a'
  ACCENT_COLORS = ['#c084fc', '#818cf8', '#38bdf8', '#34d399', '#fb923c', '#f87171', '#fbbf24']
  
  fig, ax = plt.subplots(figsize=(12, 7))
  fig.patch.set_facecolor(BG_COLOR)
  ax.set_facecolor(CARD_BG)
  
  # ── YOUR CHART LOGIC HERE (use ACCENT_COLORS for bars/lines) ──
  # For bar charts: use ax.bar() with color=ACCENT_COLORS, edgecolor='none', width=0.6
  # For line charts: use ax.plot() with linewidth=2.5, marker='o', markersize=8
  # For scatter: use ax.scatter() with alpha=0.8, edgecolors='white', linewidth=0.5
  # For pie: use explode, shadow=False, startangle=140, wedgeprops=dict(edgecolor=BG_COLOR, linewidth=2)
  
  # ── PREMIUM STYLING ──
  ax.set_title('Your Title', fontsize=20, fontweight='bold', color=TEXT_COLOR, pad=20, fontfamily='sans-serif')
  ax.set_xlabel('X Label', fontsize=12, color=SUBTITLE_COLOR, labelpad=10)
  ax.set_ylabel('Y Label', fontsize=12, color=SUBTITLE_COLOR, labelpad=10)
  ax.tick_params(colors=SUBTITLE_COLOR, labelsize=10)
  ax.grid(True, axis='y', color=GRID_COLOR, linewidth=0.5, alpha=0.5)
  ax.spines['top'].set_visible(False)
  ax.spines['right'].set_visible(False)
  ax.spines['left'].set_color(GRID_COLOR)
  ax.spines['bottom'].set_color(GRID_COLOR)
  
  # Add value labels on bars/points for clarity
  # Add a subtle watermark: fig.text(0.98, 0.02, 'Aether Analyst', fontsize=8, color='#333355', ha='right', va='bottom', style='italic')
  
  plt.tight_layout()
  plt.show()
  ```
  KEY RULES: (1) NEVER use default matplotlib styles or colors. (2) ALWAYS use the dark background (#0d0d0d). (3) ALWAYS add value labels on data points. (4) Use the ACCENT_COLORS palette. (5) Remove top/right spines. (6) Use large, readable fonts.
- WORKFLOW: When creating reports with charts: (1) First use `code_executor` to generate all charts, (2) Then use `report` tool to compile everything into a PDF. The backend will automatically inject ALL chart images into the PDF.
- All `[PLOT_SAVED]` paths generated by your code MUST be passed directly into the `plots` array of the `report` tool to be assembled into the final beautiful PDF dashboard.

## Agent Memory (from previous sessions)
{memory_content}
{memories_section}"""


def parse_llm_response(text: str) -> dict | None:
    """Parse JSON from LLM response, handling markdown fences."""
    # Strip markdown code fences
    cleaned = text.strip()
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                return None
    return None


async def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a tool and return the result as a string."""
    if tool_name not in TOOL_REGISTRY or tool_name == "finish":
        return json.dumps({"error": f"Unknown tool: {tool_name}"})

    tool = TOOL_REGISTRY[tool_name]
    fn = tool["fn"]

    try:
        if tool["async"]:
            result = await fn(**tool_input)
        else:
            result = fn(**tool_input)

        if isinstance(result, dict):
            return json.dumps(result, indent=2, default=str)[:8000]
        return str(result)[:8000]
    except Exception as e:
        return json.dumps({"error": f"Tool '{tool_name}' failed: {str(e)}"})


async def run_agent_loop(
    messages: list[dict],
    system_prompt: str,
    tool_names: list[str],
    step_callback=None,
) -> AsyncGenerator[dict, None]:
    """
    Run the ReAct agent loop.
    Yields step events for SSE streaming.
    """
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your-gemini-api-key-here":
        yield {"type": "error", "content": "GEMINI_API_KEY not configured. Please set it in backend/.env"}
        yield {"type": "done"}
        return

    client = genai.Client(api_key=api_key)
    
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
    )

    # Build conversation history for Gemini
    chat_history = []
    for msg in messages:
        if not msg.get("content") or not str(msg["content"]).strip():
            continue
        role = "user" if msg["role"] == "user" else "model"
        chat_history.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )

    chat = client.chats.create(
        model=GEMINI_MODEL,
        config=config,
        history=chat_history[:-1] if len(chat_history) > 1 else []
    )

    # Send the latest message
    current_message = messages[-1]["content"] if messages else ""

    all_plots = []
    final_summary = ""
    report_id = None

    for step in range(MAX_AGENT_STEPS):
        # Retry loop for API errors
        max_retries = 3
        raw = ""
        for attempt in range(max_retries):
            try:
                response = chat.send_message(current_message)
                # Check for empty response or finish reason
                if not response.text:
                    if hasattr(response, 'candidates') and response.candidates:
                        cand = response.candidates[0]
                        if cand.finish_reason not in [1, "STOP", "FINISH_REASON_STOP"]:
                            raise Exception(f"Gemini API returned finish_reason {cand.finish_reason} with no content.")
                    raise Exception("Gemini API returned an empty response.")
                
                raw = response.text.strip()
                break # Success, break retry loop
            except Exception as e:
                error_msg = str(e)
                if attempt == max_retries - 1:
                    yield {"type": "error", "content": f"Gemini API error after {max_retries} attempts: {error_msg}"}
                    
                    # Yield a done event to gracefully close the stream instead of just breaking
                    yield {"type": "done", "plots": all_plots, "report_id": report_id}
                    return
                
                # Small delay before retry
                await asyncio.sleep(1)
        
        # If we failed all retries and loop didn't return, break the main step loop
        if not raw:
            break

        # Parse LLM response
        parsed = parse_llm_response(raw)

        if parsed is None:
            # Retry with error correction prompt
            try:
                correction = f"Your previous response was not valid JSON. Please respond with ONLY valid JSON in this format: {{\"thought\": \"...\", \"action\": \"tool_name\", \"action_input\": {{...}}}}. Your raw response was: {raw[:500]}"
                response = chat.send_message(correction)
                raw = response.text.strip()
                parsed = parse_llm_response(raw)
            except Exception:
                pass

            if parsed is None:
                yield {"type": "error", "content": f"Failed to parse agent response as JSON: {raw[:300]}"}
                break

        thought = parsed.get("thought", "")
        action = parsed.get("action", "")
        action_input = parsed.get("action_input", {})

        # Yield thought
        yield {"type": "thought", "content": thought, "step": step + 1}

        # Check for finish
        if action == "finish":
            final_summary = action_input.get("summary", thought)
            report_id = action_input.get("report_id")
            yield {"type": "message", "content": final_summary}
            if report_id:
                yield {"type": "report", "report_id": report_id}
            break

        # Validate tool
        if action not in tool_names and action not in TOOL_REGISTRY:
            observation = f"Error: Tool '{action}' is not available. Available tools: {', '.join(tool_names)}"
        else:
            # Yield action
            yield {"type": "action", "tool": action, "input": action_input, "step": step + 1}

            # Intercept report tool to auto-inject all session plots to guarantee aesthetic PDF output
            if action == "report":
                existing_plots = action_input.get("plots") or []
                if not isinstance(existing_plots, list):
                    existing_plots = []
                # Merge unique plots
                merged = list(dict.fromkeys(existing_plots + all_plots))
                action_input["plots"] = merged

            # Execute tool
            observation = await execute_tool(action, action_input)

            # Track plots from code execution
            if action == "code_executor":
                try:
                    obs_data = json.loads(observation)
                    if obs_data.get("plots"):
                        all_plots.extend(obs_data["plots"])
                        yield {"type": "plots", "paths": obs_data["plots"]}
                except Exception:
                    pass

        # Yield observation
        yield {"type": "observation", "tool": action, "content": observation[:3000], "step": step + 1}

        # Store step in vector memory
        if step_callback:
            await step_callback(f"Step {step+1} - Thought: {thought} | Action: {action} | Observation: {observation[:200]}")

        # Set up next message with the observation
        current_message = f"Observation from {action}:\n{observation[:4000]}\n\nContinue with your next thought and action."

    else:
        # Max steps reached
        yield {"type": "message", "content": f"Agent reached maximum steps ({MAX_AGENT_STEPS}). Here's what I've done so far: {final_summary or 'Processing was incomplete.'}"}

    yield {"type": "done", "plots": all_plots, "report_id": report_id}
