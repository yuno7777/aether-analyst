<div align="center">

<h1>Aether Analyst</h1>

<img src="https://img.shields.io/badge/AETHER-ANALYST-c4b5fd?style=for-the-badge&labelColor=050505&logoColor=black" height="40" />
<br>
<samp>Universal Intelligence. Deep Research. Flawless Analysis.</samp>
<br><br>

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python_3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-886FBF?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-0f172a?style=flat-square&logo=tailwindcss&logoColor=38bdf8)](https://tailwindcss.com/)
[![Chroma DB](https://img.shields.io/badge/Chroma_DB-FF9E0F?style=flat-square&logo=chroma&logoColor=black)](https://trychroma.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white)](https://www.framer.com/motion/)

<br>

---

</div>

## About

**Aether Analyst** is an advanced, autonomous AI research and data analysis platform. Designed with a sleek, distraction-free "pitch-black" UI infused with soft lavender accents, it provides a premium workspace where artificial intelligence operates as an intelligent, independent agent. 

Unlike traditional chat interfaces, Aether Analyst doesn't just talk to you—it acts. Powered by Google Gemini under a robust ReAct (Reasoning + Acting) loop, the platform can browse the web, scrape academic papers from ArXiv, autonomously write and execute Python code against your CSV/Excel files, generate beautiful data visualizations in real-time, and instantly compile styled PDF reports with embedded charts. 

Everything you accomplish is securely persisted, fully transparent, and instantly accessible.

---

## Why Aether Analyst

<table>
<tr>
<td width="50%">

### The Problem

Data analysis and academic research are notoriously fragmented. You search the web in one window, read PDFs in another, write Python data scripts in Jupyter, and compile reports in Word. Context is lost between tools, execution is deeply manual, and synthesizing the final insight takes far too much overhead.

</td>
<td width="50%">

### The Solution

Aether Analyst centralizes cognitive labor. You upload a dataset and provide a prompt. The AI transparently streams its reasoning, fetches the necessary tools, executes sandboxed Python code to gather insights, generates stunning visualizations, and outputs a formatted PDF report—all without you leaving the chat dashboard.

</td>
</tr>
</table>

**Key Capabilities:**

| Capability | Description |
|:---|:---|
| **Autonomous ReAct Engine** | The core AI operates on a Thought → Action → Observation loop, allowing it to correct its own mistakes and chain complex tools together. |
| **Sandboxed Code Execution** | Safely writes and executes Python code (pandas, scikit-learn, matplotlib, seaborn, etc.) to analyze your spreadsheets and CSVs live in the background. |
| **Real-Time Chart Generation** | Generates premium dark-themed data visualizations (bar charts, scatter plots, line charts, etc.) rendered directly in the chat interface. |
| **PDF Reports with Embedded Charts** | Transforms raw analytical insights into beautifully styled PDF reports with auto-embedded visualizations, instantly downloadable from the UI. |
| **Dual-Layer Memory System** | Uses localized Markdown documents for core identity and a Semantic ChromaDB Vector Store to perfectly recall past conversations. |
| **Real-Time Tracing** | Through Server-Sent Events (SSE), you watch the agent's exact "thoughts," "tool calls," and "observations" stream to the UI in real-time. |
| **Universal File Uploads** | Directly supports dropping `.csv`, `.xlsx`, `.pdf`, and `.txt` files into the chat context. |
| **Persistent Agent Mode** | Selected agent mode is remembered across sessions and page reloads via local storage. |
| **Live Backend Health** | A real-time status indicator shows backend connectivity (Offline, Online, Running) with visual color states. |

---

## Architecture

```text
                              +---------------------+
                              |   Next.js 16 UI     |
                              |  (Route: /dashboard)|
                              +----------+----------+
                                         |  SSE & REST API
                          +--------------+--------------+
                          |                             |
                +---------v---------+        +----------v----------+
                |    API Layer      |        |     Database        |
                |   (FastAPI App)   |        |  (SQLite / Chroma)  |
                +---------+---------+        +----------+----------+
                          |                             |
              +-----------+-----------+       +---------+---------+
              |           |           |       |         |         |
          Core Loop    Agents       Tools  Sessions  Messages  Reports
              |           |                   |
    +---------+---------+ |          +--------+--------+
    |  ReAct Engine     | |          | Session Logs    |
    |  Memory Manager   | |          | Agent Traces    |
    |  Tool Router      | |          | PDF Blobs       |
    +-------------------+ |          +-----------------+
                          |
     +--------------------+--------------------+
     | web_search.py  | arXiv_fetcher.py       |
     |                |                        |
     | auto_eda.py    | code_executor.py       |
     |                |                        |
     | file_reader.py | report_generator.py    |
     +--------------------+--------------------+
```

### Database Schema

The platform relies on a lightweight **SQLite** database for high-velocity local persistence, and **ChromaDB** for vector embeddings.

<details>
<summary><b>Persistence Schema</b> — <code>backend/database.py</code></summary>
<br>

| Model | Key Fields | Purpose |
|:---|:---|:---|
| `Session` | id, title, agent_mode, created_at | High-level conversation workspace. |
| `Run` | id, session_id, status, error, finish_time | Tracks background execution state for the agent. |
| `Message` | id, session_id, role, content | Chronological chat history logs (user vs agent). |
| `Report` | id, title, agent_mode, findings_count | Permanent record of generated analysis documents. |

</details>

---

## Modules

Aether Analyst splits its cognitive load across three distinct agent modes, allowing you to tailor the AI's execution path to your specific task.

<details>
<summary><b>View Agent Modes</b></summary>
<br>

| Mode | Component | Description |
|:---|:---|:---|
| **Research Agent** | `research_agent.py` | Highly curious mode. References `web_search.py` (DuckDuckGo scraping) and `arxiv.py` (academic paper fetching) to answer deep contextual questions. Now includes `code_executor` for generating charts and visualizations. |
| **Analyst Agent** | `analyst_agent.py` | Pure data cruncher. Upload a `.csv` and this agent invokes `code_executor.py` and `eda.py` to calculate moving averages, run scikit-learn models, generate visualizations, and find absolute statistical truth. |
| **Combined Agent** | `combined_agent.py` | The apex orchestrator. When tasked with a massive prompt, it will first act as a researcher to understand the domain, and then shift into analyst mode to execute code against the data with enhanced domain context. |

</details>

---

## Tech Stack

<table>
<tr>
<td><b>Category</b></td>
<td><b>Technology</b></td>
<td><b>Purpose</b></td>
</tr>
<tr><td>Frontend Framework</td><td>Next.js 16 (App Router + Turbopack)</td><td>Client dashboard, routing, and dynamic data fetching</td></tr>
<tr><td>UI Library</td><td>React 19</td><td>Component architecture</td></tr>
<tr><td>Backend API</td><td>FastAPI (Python)</td><td>Asynchronous AI orchestration and REST/SSE endpoints</td></tr>
<tr><td>AI Engine</td><td>Google Gemini API (google-genai SDK)</td><td>Core intelligence (gemini-2.0-flash)</td></tr>
<tr><td>Vector Memory</td><td>ChromaDB</td><td>Semantic search and conversational recall</td></tr>
<tr><td>Relational DB</td><td>SQLite & SQLAlchemy</td><td>Local, zero-config persistence of sessions and output</td></tr>
<tr><td>Styling</td><td>Tailwind CSS 4</td><td>Utility-first CSS styling on a dark theme foundation</td></tr>
<tr><td>Animation</td><td>Framer Motion 12</td><td>Micro-interactions and accordion trace reveals</td></tr>
<tr><td>Reporting</td><td>ReportLab, PIL</td><td>Professional PDF generation with embedded chart images</td></tr>
<tr><td>Data Visualization</td><td>Matplotlib, Seaborn</td><td>Automated premium dark-themed chart generation</td></tr>
<tr><td>Data Processing</td><td>Pandas, NumPy, Scikit-Learn</td><td>Agent sandbox statistical capabilities</td></tr>
</table>

---

## Getting Started

### Prerequisites

- **Node.js** 20 or higher
- **Python** 3.10 to 3.13

### Installation

```bash
# Clone the repository
git clone https://github.com/yuno7777/aether-analyst.git
cd aether-analyst
```

#### 1. Start the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# On Windows
venv\Scripts\activate
# On Mac/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
echo "GEMINI_API_KEY=your_google_api_key_here" > .env

# Run the FastAPI server
uvicorn main:app --port 8000
```

#### 2. Start the Frontend

Open a new terminal window in the root of the project:

```bash
# Install Next.js dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at `http://localhost:3000/dashboard`.

---

## Design Philosophy

Aether Analyst adheres to a strict visual and functional philosophy:

- **Pitch Black Foundation** — Background `#050505` to eliminate visual noise and maximize analytical focus.
- **Lavender Accent System** — Primary accent `#c4b5fd` (violet-300) to signify AI actions, thoughts, and primary interactions.
- **Total Transparency** — We believe AI should not be a "black box". The UI uniquely exposes the agent's internal trace (thoughts, tool usage, failures) directly to the user in clean accordion logs.
- **Zero-Friction Analysis** — If a task requires code, the AI writes the code, runs the code, generates the charts, and gives you the answer. You do not touch a terminal.
- **Premium Visualizations** — Every chart is automatically styled with a dark premium theme, vibrant accent colors, and clean typography via a forced `rcParams` injection layer.

---

<div align="center">

<br>

<samp>Built with clarity and precision</samp>

<br>

<sub>Autonomous Intelligence &middot; Code Execution &middot; Real-Time Charts &middot; Advanced Reporting</sub>

<br><br>

<img src="https://img.shields.io/badge/%C2%A9_2026-Aether_Analyst-c4b5fd?style=flat-square&labelColor=050505&logoColor=black" />

</div>
