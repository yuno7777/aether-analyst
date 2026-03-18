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
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your-gemini-api-key-here":
        yield {"type": "error", "content": "GEMINI_API_KEY not configured. Please set it in backend/.env"}
        yield {"type": "done"}
        return

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=system_prompt
    )

    # Build conversation history for Gemini
    chat_history = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        chat_history.append({"role": role, "parts": [msg["content"]]})

    chat = model.start_chat(history=chat_history[:-1] if len(chat_history) > 1 else [])

    # Send the latest message
    current_message = messages[-1]["content"] if messages else ""

    all_plots = []
    final_summary = ""
    report_id = None

    for step in range(MAX_AGENT_STEPS):
        try:
            response = chat.send_message(current_message)
            raw = response.text.strip()
        except Exception as e:
            yield {"type": "error", "content": f"Gemini API error: {str(e)}"}
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
