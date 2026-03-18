"""
Research Agent — focuses on web search and ArXiv paper retrieval.
Tools: web_search, arxiv, file_reader
"""

from agent.core import build_system_prompt, run_agent_loop, get_tools_description
from memory import read_memory, recall_memories, store_memory_vector

RESEARCH_TOOLS = ["web_search", "arxiv", "file_reader", "finish"]

RESEARCH_PROMPT_EXTRA = """
## Research Agent Mode
Your job is to research a topic thoroughly before any analysis begins.
- Search the web for recent developments, techniques, and best practices
- Fetch relevant academic papers from ArXiv
- Read any provided documents for context
- Synthesize findings into a structured research report
- Always cite your sources
- Focus on methodology extraction and key takeaways
- When done, use the finish action with a comprehensive summary
"""


async def run_research_agent(messages: list[dict], dataset_path: str = None):
    """Run the research agent and yield step events."""
    memory_content = read_memory()

    # Get relevant past memories
    query = messages[-1]["content"] if messages else ""
    relevant = recall_memories(query, n_results=3)

    system_prompt = build_system_prompt(
        agent_type="Research Agent",
        tool_names=RESEARCH_TOOLS,
        memory_content=memory_content,
        relevant_memories=relevant

    )
    system_prompt += RESEARCH_PROMPT_EXTRA

    if dataset_path:
        system_prompt += f"\n\nDataset file available at: {dataset_path}"

    async def on_step(step_text):
        store_memory_vector(step_text, {"agent_mode": "research"})

    async for event in run_agent_loop(
        messages=messages,
        system_prompt=system_prompt,
        tool_names=RESEARCH_TOOLS,
        step_callback=on_step,
    ):
        yield event
