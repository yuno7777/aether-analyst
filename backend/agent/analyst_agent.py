"""
Analyst Agent — focuses on data analysis, modeling, and reporting.
Tools: file_reader, eda, code_executor, report
"""

from agent.core import build_system_prompt, run_agent_loop
from memory import read_memory, recall_memories, store_memory_vector

ANALYST_TOOLS = ["file_reader", "eda", "code_executor", "report", "finish"]

ANALYST_PROMPT_EXTRA = """
## Analyst Agent Mode
Your job is to analyze data, build models, and generate reports.
- Always start by reading the dataset with file_reader
- Run EDA to understand the data structure and quality
- Write and execute Python code for data processing and modeling
- Use pandas, scikit-learn, xgboost, matplotlib for analysis
- Compare multiple models when applicable
- Generate visualizations with matplotlib (call plt.show() to save)
- When analysis is complete, use the report tool to create a structured report
- Then use finish action with a summary of findings
- Be systematic: EDA → Feature Engineering → Modeling → Evaluation → Report

## Code Execution Tips
- Import libraries inside your code blocks
- Use matplotlib for plotting, always call plt.show()
- Plots are automatically saved as PNG files
- Keep code concise and well-commented
- Handle potential errors in code (try/except)
"""


async def run_analyst_agent(messages: list[dict], dataset_path: str = None):
    """Run the analyst agent and yield step events."""
    memory_content = read_memory()

    query = messages[-1]["content"] if messages else ""
    relevant = recall_memories(query, n_results=3)

    system_prompt = build_system_prompt(
        agent_type="Analyst Agent",
        tool_names=ANALYST_TOOLS,
        memory_content=memory_content,
        relevant_memories=relevant
    )
    system_prompt += ANALYST_PROMPT_EXTRA

    if dataset_path:
        system_prompt += f"\n\nDataset file available at: {dataset_path}\nStart by reading and understanding this dataset."

    async def on_step(step_text):
        store_memory_vector(step_text, {"agent_mode": "analyst"})

    async for event in run_agent_loop(
        messages=messages,
        system_prompt=system_prompt,
        tool_names=ANALYST_TOOLS,
        step_callback=on_step,
    ):
        yield event
