"""
ArXiv API paper fetcher.
Searches for papers and returns titles, abstracts, authors, and links.
"""

import httpx
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus

ARXIV_API_URL = "http://export.arxiv.org/api/query"
NAMESPACE = {"atom": "http://www.w3.org/2005/Atom"}


async def search_arxiv(query: str, max_results: int = 5) -> dict:
    """
    Search ArXiv for papers matching the query.
    Returns structured paper data.
    """
    try:
        params = {
            "search_query": f"all:{quote_plus(query)}",
            "start": 0,
            "max_results": max_results,
            "sortBy": "relevance",
            "sortOrder": "descending"
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(ARXIV_API_URL, params=params)
            response.raise_for_status()

        root = ET.fromstring(response.text)
        papers = []

        for entry in root.findall("atom:entry", NAMESPACE):
            title = entry.find("atom:title", NAMESPACE)
            summary = entry.find("atom:summary", NAMESPACE)
            published = entry.find("atom:published", NAMESPACE)

            authors = []
            for author in entry.findall("atom:author", NAMESPACE):
                name = author.find("atom:name", NAMESPACE)
                if name is not None:
                    authors.append(name.text.strip())

            # Get the PDF link
            pdf_link = ""
            for link in entry.findall("atom:link", NAMESPACE):
                if link.get("title") == "pdf":
                    pdf_link = link.get("href", "")
                    break

            # Get the abstract page link
            abs_link = ""
            for link in entry.findall("atom:link", NAMESPACE):
                if link.get("type") == "text/html":
                    abs_link = link.get("href", "")
                    break

            papers.append({
                "title": title.text.strip().replace("\n", " ") if title is not None else "No title",
                "authors": authors[:5],  # limit to first 5 authors
                "abstract": summary.text.strip().replace("\n", " ")[:500] if summary is not None else "No abstract",
                "published": published.text[:10] if published is not None else "Unknown",
                "pdf_url": pdf_link,
                "url": abs_link or pdf_link,
            })

        return {
            "query": query,
            "num_results": len(papers),
            "papers": papers
        }

    except Exception as e:
        return {
            "query": query,
            "num_results": 0,
            "papers": [],
            "error": str(e)
        }
