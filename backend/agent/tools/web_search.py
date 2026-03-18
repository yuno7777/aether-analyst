"""
Web search tool using DuckDuckGo HTML scraping.
No API key required.
"""

import httpx
import re
from urllib.parse import quote_plus


async def web_search(query: str, max_results: int = 5) -> dict:
    """
    Search the web using DuckDuckGo HTML.
    Returns a list of results with title, url, and snippet.
    """
    try:
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html = response.text

        results = []

        # Parse result blocks from DuckDuckGo HTML
        result_blocks = re.findall(
            r'<a rel="nofollow" class="result__a" href="(.*?)".*?>(.*?)</a>.*?'
            r'<a class="result__snippet".*?>(.*?)</a>',
            html,
            re.DOTALL
        )

        for href, title, snippet in result_blocks[:max_results]:
            # Clean HTML tags from title and snippet
            clean_title = re.sub(r'<.*?>', '', title).strip()
            clean_snippet = re.sub(r'<.*?>', '', snippet).strip()

            # Extract actual URL from DuckDuckGo redirect
            actual_url = href
            uddg_match = re.search(r'uddg=(.*?)(&|$)', href)
            if uddg_match:
                from urllib.parse import unquote
                actual_url = unquote(uddg_match.group(1))

            if clean_title:
                results.append({
                    "title": clean_title,
                    "url": actual_url,
                    "snippet": clean_snippet
                })

        if not results:
            # Fallback: try a simpler regex
            links = re.findall(r'<a rel="nofollow"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', html, re.DOTALL)
            for href, title in links[:max_results]:
                clean_title = re.sub(r'<.*?>', '', title).strip()
                if clean_title and len(clean_title) > 5:
                    results.append({
                        "title": clean_title,
                        "url": href,
                        "snippet": ""
                    })

        return {
            "query": query,
            "num_results": len(results),
            "results": results
        }

    except Exception as e:
        return {
            "query": query,
            "num_results": 0,
            "results": [],
            "error": str(e)
        }
