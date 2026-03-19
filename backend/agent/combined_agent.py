"""
Combined Agent — runs Research Agent first, then Analyst Agent.
Passes research findings to the analyst for data-backed analysis.
"""

from agent.core import build_system_prompt, run_agent_loop
from memory import read_memory, recall_memories, store_memory_vector

COMBINED_TOOLS = ["web_search", "arxiv", "file_reader", "eda", "code_executor", "report", "finish"]

COMBINED_PROMPT_EXTRA = """
## Combined Agent Mode
You operate in two phases:

### Phase 1: Research
- Search the web and ArXiv for relevant techniques, papers, and best practices
- Understand the latest approaches to the problem at hand
- Gather 3-5 key insights before moving to analysis

### Phase 2: Analysis  
- Read and analyze the dataset using file_reader and eda tools
- Apply the best techniques discovered during research
- Write and execute Python code for modeling
- Generate highly aesthetic, modern visualization charts (via seaborn/matplotlib, using dark themes) using `code_executor`.
- Create a comprehensive report covering both research and analysis, passing all `[PLOT_SAVED]` image paths to the `report` tool for embedding into the final PDF.

## Workflow
1. First, search the web and ArXiv for context (2-3 searches)
2. Then read and run EDA on the dataset
3. Apply research-backed techniques via code execution
4. Generate a unified report with both research findings and analysis results
5. Finish with a comprehensive summary

Always cite your sources and explain why you chose specific approaches.
"""


async def run_combined_agent(messages: list[dict], dataset_path: str = None):
    """Run the combined agent (research + analyst) and yield step events."""
    memory_content = read_memory()

    query = messages[-1]["content"] if messages else ""
    relevant = recall_memories(query, n_results=3)

    system_prompt = build_system_prompt(
        agent_type="Combined (Research + Analyst)",
        tool_names=COMBINED_TOOLS,
        memory_content=memory_content,
        relevant_memories=relevant
    )
    system_prompt += COMBINED_PROMPT_EXTRA

    if dataset_path:
        system_prompt += f"\n\nDataset file available at: {dataset_path}\nAfter researching, analyze this dataset using the techniques you found."

    async def on_step(step_text):
        store_memory_vector(step_text, {"agent_mode": "combined"})

    async for event in run_agent_loop(
        messages=messages,
        system_prompt=system_prompt,
        tool_names=COMBINED_TOOLS,
        step_callback=on_step,
    ):
        yield event
