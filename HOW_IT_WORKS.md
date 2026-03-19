# Aether Analyst: Exhaustive End-To-End Architecture Deep Dive

This document provides a highly technical, granular breakdown of the **Aether Analyst** platform. It explains the exact flow of bytes from a user's browser, through the React component tree, across the HTTP network, deep into the Python FastAPI asynchronous event loop, and finally into the Google Gemini LLM API and the subsequent dynamic code execution sandbox.

---

## 1. System Topology & Data Flow Paradigms

Aether Analyst relies on a bifurcated interaction model to handle differing architectural constraints:

1. **Synchronous CRUD (REST)**: Standard HTTP `GET` / `POST` / `DELETE` requests are used for immutable state actions (e.g., retrieving previous chat sessions, downloading PDF blobs, uploading raw CSV files). 
2. **Asynchronous Streaming (SSE)**: Standard HTTP requests time out if an AI takes 2 minutes to write and execute python code. We solve this using **Server-Sent Events (SSE)**. The frontend establishes a persistent one-way socket connection to the backend, catching JSON packets (Events) emitted by the background AI loop the exact millisecond they occur.
3. **Static File Serving**: Generated chart images are served from the `./reports` directory mounted at `/api/plots` via FastAPI's `StaticFiles`, enabling the frontend to display AI-generated visualizations directly in the chat interface.

---

## 2. The Next.js 16 Frontend (`app/dashboard/page.tsx`)

The entire client application is rendered server-side and hydrated as a highly interactive React 19 Client Component. Next.js 16 uses **Turbopack** as its default bundler for significantly faster HMR and compilation.

### State Management
The frontend relies heavily on localized React state to represent the database:
- `sessions`: An array tracking every prior conversation fetched from `/api/sessions`. Maps to the sidebar "Recent Chats".
- `chatMessages`: An array tracking the active conversation. Each object contains `role` (user/agent/system) and an array of `parts` (e.g., pure text, a thought block, a tool execution trace). Messages can also carry a `plots` array of image paths for inline chart rendering.
- `reports`: An array fetched from SQLite mapping physical `.pdf` files on the backend server to the "Reports" tab UI.
- `agentMode`: Persisted to `localStorage` so the selected agent mode (Research / Analyst / Combined) survives page refreshes and browser restarts.

### The Chat Execution Lifecycle (UI Perspective)
1. User types "Analyze generic.csv" and hits Send.
2. The UI pushes a temporary `role: 'user'` message to `chatMessages` and triggers `POST /api/chat`.
3. The response contains a `run_id`.
4. The UI immediately opens `new EventSource('/api/chat/stream?session_id=X&run_id=Y')`.
5. As the `EventSource` catches events (`thought`, `tool_call`, `observation`, `plots`), the UI state is mutated *in real-time*. Complex components like Framer Motion accordions expand dynamically to render the agent's internal tool usage while waiting for the final `message` event.
6. When `plots` events arrive, the UI renders an interactive image grid directly in the chat bubble. Each chart is clickable to open in a new tab at full resolution.

### Backend Health Indicator
A persistent health polling mechanism (`/api/health`) updates a visual status indicator in the chat header:
- **Green text** — Backend is connected and idle ("Online")
- **Purple text with pulse** — Backend is actively running an agent task ("Running")
- **Red text** — Backend is unreachable ("Offline")

---

## 3. The FastAPI Backend Orchestration (`main.py`)

`main.py` is the routing nervous system. It mounts the SQLite database connection middleware and defines the APIs.

### Critical Endpoints
*   `POST /api/upload`: Receives multi-part form data (CSVs, PDFs) mapping directly to the host OS `/data` folder, returning the absolute server paths needed for the AI sandbox tools to ingest them.
*   `POST /api/chat`: The entry point for logic. It intercepts the user prompt, logs it to SQLite as a `Message` entity, creates a `Run` state, and uses FastAPI's `BackgroundTasks.add_task(_execute_agent_run)` to boot the ReAct engine off the main thread so the server does not freeze.
*   `GET /api/chat/stream`: The persistent socket. It uses Python's asynchronous generator functionality `yield` inside an HTTP `StreamingResponse` object formatted explicitly to `text/event-stream` MIME standards. Emits event types: `message`, `action`, `observation`, `plots`, `report`, `error`, `done`.
*   `GET /api/plots/{filename}`: Serves generated chart images as static files from the `./reports` directory, mounted via `StaticFiles`.

---

## 4. Dual-Layer Persistence (`database.py` & `memory.py`)

A persistent LLM agent requires two distinct forms of memory to function securely and intelligently.

### 1. Hard State (SQLite & SQLAlchemy)
*   **Location**: `backend/database.py` generates `aether_analyst.db`.
*   **Purpose**: Immutable transaction logs. 
*   **Models**: 
    - `Session` (Tracks high-level workspaces)
    - `Run` (Tracks whether a background task crashed, succeeded, or is active)
    - `Message` (The exact chronological transcript)
    - `Report` (Links generated documents to valid Sessions)

### 2. Semantic Memory (ChromaDB)
*   **Location**: `backend/memory.py` leveraging the `chromadb` library.
*   **Purpose**: Overcoming LLM context window limits via RAG (Retrieval-Augmented Generation).
*   **Mechanics**: When a conversation spans thousands of messages, feeding them all to Gemini is mathematically impossible. Aether Analyst chunks older messages and passes them through an Embedding Model to convert paragraphs into numerical vectors. When a user asks a new question, ChromaDB executes a Mathematical Cosine Similarity search, finding the top 5 most highly correlated historical messages and silently injecting them into the Gemini system prompt to "remind" the AI of past context.

---

## 5. The ReAct Core Engine (`agent/core.py`)

This is the cognitive heartbeat of the platform. The `AgentCore` class implements the **ReAct (Reasoning and Acting)** loop. LLMs by default only predict text. The ReAct wrapper forces the LLM to behave like software.

### The Execution Loop (`AgentCore.run()`)
1.  **System Prompt Tuning**: The agent is initialized with strict behavioral overrides including a comprehensive **chart style guide** that mandates premium dark-themed visualizations with specific color palettes, typography, and layout rules. It also includes a mandatory `code_executor` → `report` tool workflow for chart-inclusive PDFs.
2.  **The Generation Call**: The loop calls `client.models.generate_content(model, contents, config)` via the `google-genai` SDK (migrated from the deprecated `google-generativeai` package).
3.  **Intercepting the Function Call**:
    *   If Gemini outputs a `FunctionCall` payload instead of text, `core.py` pauses.
    *   It extracts the targeted `function_name` and the JSON `args`.
    *   It looks up the physical python function in its internal routing dictionary.
    *   It dynamically invokes the actual Python function: `result = func(**args)`.
4.  **Observation Injection**: The raw output of that function (which could be a string, a pandas dataframe dump, chart file paths, or a fatal Python traceback error) is wrapped in an `Observation` object and appended sequentially to the `history` array.
5.  **Plot Event Emission**: When `code_executor` returns paths to generated chart images, the core engine emits a dedicated `plots` SSE event containing those paths so the frontend can render them inline.
6.  **Recurrence**: The loop calls `generate_content()` *again*, passing the newly updated history. The AI reads the `Observation`, realizes what its python code or web search yielded, and decides what to do next.

---

## 6. Persona Routing (The 3 Agents)

Aether Analyst handles specific domain tasks natively by restricting the tools loaded into the `AgentCore`.

*   **`research_agent.py`**: Injected with Web Scraper, ArXiv API, and `code_executor` tools. It searches the internet, reads webpages, fetches Academic XML data, synthesizes answers, and can generate data visualizations for research findings.
*   **`analyst_agent.py`**: Strictly banned from internet access to prevent hallucinations. Injected with `code_executor` and `eda` tools. It expects local files and purely functions as an autonomous data scientist with full charting capabilities.
*   **`combined_agent.py`**: Both tool arrays are merged including `code_executor`. To prevent Gemini from getting "confused" by too many options, the system prompt is rewritten to explicitly instruct it to execute Research Tools *first*, build an intelligence profile, and *then* run localized Python analytics with visualizations.

---

## 7. Deep Tool Mechanics (How it interacts with the OS)

The files inside `backend/agent/tools/` perform the physical, deterministic actions that the probabilistic LLM cannot safely do on its own.

### The Web Scraping Engine (`web_search.py` & `arxiv.py`)
*   Gemini is cut off from the live web. `web_search.py` fakes a browser session. It sends HTTP GET requests to DuckDuckGo HTML endpoints using spoofed `User-Agent` headers to bypass bot protection.
*   It utilizes `BeautifulSoup4` to parse the returning DOM tree. It identifies the top 3 `<a class="result__url">` organically ranked links, navigates strictly to those specific sub-URLs individually, and scrapes purely textual tags (`<p>`, `<h1>`, `<li>`) stripped of javascript, returning raw synthesized text blobs to Gemini.
*   `arxiv.py` specifically hits `export.arxiv.org/api/query`, parsing standard XML to retrieve Title, Authors, Published Dates, and PDF links for academic precision.

### The Code Sandbox (`code_executor.py`)
This is the most critical and complex tool on the platform. 
*   Gemini drafts pure Python text (e.g., `import pandas as pd; df = pd.read_csv('data.csv'); print(df.corr())`).
*   `code_executor.py` catches this string. It strips markdown blocks and executes it dynamically within the active OS process using Python's native primitive `exec()`.
*   **Forced Chart Theme Injection**: Before executing any user code, the sandbox injects a comprehensive `matplotlib.rcParams` override at the module level. This forces **every** generated chart to automatically use a premium dark theme with:
    - Dark background (`#0f0f14` figure, `#1a1a24` axes)
    - High-contrast white text (`#ffffff`) and bright labels (`#d0d0e0`)
    - Vibrant futuristic color cycle (purples, indigos, cyans, emeralds, ambers)
    - Clean spines (no top/right borders), subtle grid lines
    - 200 DPI output at 12×7 figure size
    - This theme is enforced regardless of what styling code the AI writes, guaranteeing visual consistency.
*   **Automatic Plot Capture**: The sandbox monkey-patches `plt.show()` with a custom `_patched_show()` function. When the AI calls `plt.show()`, the plot is silently saved as a high-resolution PNG to the `./reports` directory with a UUID-prefixed filename, and the path is printed as `[PLOT_SAVED] /path/to/file.png`. The core engine parses these markers to emit `plots` SSE events.
*   **Output Capture Mechanism**: Standard `exec()` writes to the console terminal, which the LLM cannot physically see. The tool wraps the execution in `contextlib.redirect_stdout(io.StringIO())`. This intercepts all `print()` outputs, storing them in memory as a string variable, which is then explicitly returned as the `Observation` payload back to the LLM.
*   **Error Healing**: If the LLM writes broken syntax (e.g., calling a column that doesn't exist), `try/except Exception as e` catches the Python stack trace error. We return the *literal error string* to Gemini. Because of the ReAct loop, Gemini sees the error, thinks ("Ah, the column name is 'Date', not 'date'"), and writes a fixed payload on the next loop.

### Auto-EDA (`eda.py`)
To prevent the LLM from wasting API tokens drafting the same boilerplate Pandas code constantly, the `eda.py` tool serves as an abstraction. It natively loads a target `.csv` or `.xlsx` using its own Pandas import, runs `.describe()`, `.info()`, and checks `.isna().sum()`, throwing the structured summary back to Gemini effortlessly.

### The PDF Report Engine (`report.py`)
When analysis is complete, Gemini drafts a Markdown string as its final payload. Instead of dumping raw markdown into the chat UI permanently, Gemini invokes `generate_report(markdown_str)`.
1.  **HTML Compilation**: The `markdown` python compiler converts the pure strings into nested HTML elements (`<p>`, `<table>`, `<h1>`).
2.  **CSS Injection**: The tool injects a hardcoded CSS stylesheet string mirroring the "Aether" design aesthetic (dark tables, lavender accents, standard margins) into the `<head>`.
3.  **Chart Embedding**: If the report references chart images (generated by the `code_executor` tool), the engine uses **Pillow** (`PIL.Image.open()`) to read actual image dimensions and **ReportLab** to calculate proper scaling ratios. Charts are embedded inline within the PDF flow, maintaining aspect ratios and fitting within page margins.
4.  **PDF Rasterization**: **ReportLab** consumes the HTML/CSS payload, rasterizes it into physical A4-sized PDF pages, and writes `report_{uuid}.pdf` to the mapped server drive. Finally, it logs the document metadata to the SQLite `Report` database row, allowing the Next.js frontend to instantly download it across the REST API.
