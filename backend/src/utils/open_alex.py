from src.config.main import Config
from src.errors.exceptions import OpenAlexUpstreamError, PaperNotFoundInOpenAlexError
from src.schemas.openalex import (
    OpenAlexWork,
    OpenAlexWorkDetail,
    OpenAlexWorksMeta,
    OpenAlexWorksResponse,
)

import requests
import httpx
import asyncio
import re


class OpenAlex:
    BASE_URL = "https://api.openalex.org"
    BASE_ARXIV_URL = "https://arxiv.org/pdf/"
    API_KEY = Config.open_alex_key

    _client = httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=120,
    )

    @classmethod
    def get_arxiv_pdf_url(cls, doi: str | None) -> str | None:
        if not doi:
            return None

        match = re.search(
            r"arxiv\.(\d{4}\.\d{4,5})",
            doi,
            re.IGNORECASE,
        )

        if not match:
            return None

        arxiv_id = match.group(1)
        return f"{cls.BASE_ARXIV_URL}{arxiv_id}"

    @classmethod
    def _short_work_id(cls, work_id: str | None) -> str:
        if not work_id:
            return ""
            
        return work_id.rsplit("/", 1)[-1]

    @classmethod
    def _map_work(cls, payload: dict) -> OpenAlexWork:
        open_access = payload.get("open_access") or {}
        primary_location = payload.get("primary_location") or {}
        source = primary_location.get("source") or {}

        display_name = payload.get("display_name") or payload.get("title") or ""

        return OpenAlexWork(
            id=cls._short_work_id(payload.get("id")),
            doi=payload.get("doi"),
            display_name=display_name,
            publication_year=payload.get("publication_year"),
            cited_by_count=payload.get("cited_by_count") or 0,
            is_oa=bool(open_access.get("is_oa")),
            authors=cls.get_authors(payload),
            tags=cls.get_tags(payload),
            venue=source.get("display_name"),
        )

    @classmethod
    def _reconstruct_abstract(cls, inverted_index: dict | None) -> str | None:
        if not inverted_index:
            return None

        positioned: list[tuple[int, str]] = []
        for word, positions in inverted_index.items():
            if not word or not positions:
                continue
            for position in positions:
                positioned.append((position, word))

        if not positioned:
            return None

        positioned.sort(key=lambda item: item[0])
        return " ".join(word for _, word in positioned)

    @classmethod
    def _get_oa_url(cls, payload: dict) -> str | None:
        best_oa_location = payload.get("best_oa_location") or {}
        open_access = payload.get("open_access") or {}
        primary_location = payload.get("primary_location") or {}

        return (
            best_oa_location.get("pdf_url")
            or open_access.get("oa_url")
            or best_oa_location.get("landing_page_url")
            or primary_location.get("pdf_url")
            or primary_location.get("landing_page_url")
        )

    @classmethod
    def get_institutions(cls, payload: dict) -> list[str]:
        institutions: list[str] = []
        seen: set[str] = set()

        for authorship in payload.get("authorships") or []:
            for institution in (authorship or {}).get("institutions") or []:
                display_name = (institution or {}).get("display_name")
                if not display_name:
                    continue

                normalized = display_name.casefold()
                if normalized in seen:
                    continue

                seen.add(normalized)
                institutions.append(display_name)

        return institutions

    @classmethod
    def get_topics(cls, payload: dict) -> list[str]:
        topics: list[str] = []
        seen: set[str] = set()

        for topic in payload.get("topics") or []:
            display_name = (topic or {}).get("display_name")
            if not display_name:
                continue

            normalized = display_name.casefold()
            if normalized in seen:
                continue

            seen.add(normalized)
            topics.append(display_name)

        return topics

    @classmethod
    def _map_work_detail(cls, payload: dict) -> OpenAlexWorkDetail:
        work = cls._map_work(payload)

        return OpenAlexWorkDetail(
            **work.model_dump(),
            abstract=cls._reconstruct_abstract(
                payload.get("abstract_inverted_index")
            ),
            publication_date=payload.get("publication_date"),
            type=payload.get("type"),
            language=payload.get("language"),
            is_retracted=bool(payload.get("is_retracted")),
            oa_url=cls._get_oa_url(payload),
            institutions=cls.get_institutions(payload),
            topics=cls.get_topics(payload),
            in_database=False,
            paper_id=None,
            ingest_status=None,
        )

    @classmethod
    async def search_works(
        cls,
        *,
        search: str | None = None,
        open_access: str = "any",
        from_year: int | None = None,
        to_year: int | None = None,
        sort: str = "relevance_score:desc",
        per_page: int = 25,
        cursor: str = "*",
    ) -> OpenAlexWorksResponse:
        filters: list[str] = []

        if open_access == "open":
            filters.append("is_oa:true")
        elif open_access == "closed":
            filters.append("is_oa:false")

        if from_year is not None:
            filters.append(f"from_publication_date:{from_year}-01-01")

        if to_year is not None:
            filters.append(f"to_publication_date:{to_year}-12-31")

        query = (search or "").strip()
        effective_sort = sort
        if effective_sort == "relevance_score:desc" and not query:
            effective_sort = "cited_by_count:desc"

        params: dict[str, str | int] = {
            "sort": effective_sort,
            "per-page": per_page,
            "cursor": cursor,
            "select": (
                "id,doi,display_name,title,publication_year,"
                "cited_by_count,open_access,authorships,primary_location,"
                "keywords"
            ),
        }

        if query:
            params["search"] = query

        if filters:
            params["filter"] = ",".join(filters)

        if cls.API_KEY:
            params["api_key"] = cls.API_KEY

        try:
            response = await cls._client.get("/works", params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OpenAlexUpstreamError() from exc

        payload = response.json()
        meta = payload.get("meta") or {}
        results = payload.get("results") or []

        return OpenAlexWorksResponse(
            meta=OpenAlexWorksMeta(
                count=meta.get("count") or 0,
                per_page=meta.get("per_page") or per_page,
                next_cursor=meta.get("next_cursor"),
            ),
            results=[cls._map_work(work) for work in results],
        )

    @classmethod
    async def get_data_by_openalex_id(cls, work_id: str):
        params = {
            "select": (
                "id,doi,title,display_name,"
                "authorships,primary_location,"
                "locations,best_oa_location"
            )
        }

        if cls.API_KEY:
            params["api_key"] = cls.API_KEY

        response = await cls._client.get(f"/works/{work_id}", params=params)
        response.raise_for_status()
        return response.json()

    @classmethod
    async def get_work_details(cls, work_id: str) -> OpenAlexWorkDetail:
        short_id = cls._short_work_id(work_id)
        params: dict[str, str] = {
            "select": (
                "id,doi,title,display_name,publication_year,publication_date,"
                "type,language,cited_by_count,is_retracted,open_access,"
                "authorships,primary_location,best_oa_location,keywords,"
                "topics,abstract_inverted_index"
            ),
        }

        if cls.API_KEY:
            params["api_key"] = cls.API_KEY

        try:
            response = await cls._client.get(f"/works/{short_id}", params=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise PaperNotFoundInOpenAlexError() from exc
            raise OpenAlexUpstreamError() from exc
        except httpx.HTTPError as exc:
            raise OpenAlexUpstreamError() from exc

        return cls._map_work_detail(response.json())

    @classmethod
    def download_paper_contents(cls, pdf_urls: list[str]) -> bytes:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 "
                "(Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/120 Safari/537.36"
            ),
            "Accept": "application/pdf,*/*",
        }

        for pdf_url in pdf_urls:
            try:
                response = requests.get(
                    pdf_url,
                    headers=headers,
                    stream=True,
                    timeout=(10, 60),
                )
                response.raise_for_status()

                pdf_contents = bytearray()

                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        pdf_contents.extend(chunk)

                return bytes(pdf_contents)

            except requests.RequestException:
                continue

        raise RuntimeError("Failed to download paper from all provided URLs.")

    @classmethod
    def get_pdf_urls(cls, payload: dict) -> list:
        urls = set()

        if 'primary_location' in payload and 'pdf_url' in payload.get('primary_location', {}):
            urls.add(payload['primary_location']['pdf_url'])

        if 'locations' in payload and len(payload.get('locations', [])) > 0:
            for location in payload['locations']:
                if 'pdf_url' in location and location.get('pdf_url', None) is not None:
                    urls.add(location['pdf_url'])

        if 'pdf_url' in (payload.get('best_oa_location') or {}):
            urls.add(payload['best_oa_location']['pdf_url'])

        url_list = list(filter(lambda url: url is not None, urls))
        if len(url_list) == 0:
            constructed_url = cls.get_arxiv_pdf_url(payload['doi'])
            if constructed_url:
                url_list.append(constructed_url)

        return url_list

    @classmethod
    def get_authors(cls, payload: dict) -> list:
        authors = set()

        if 'authorships' in payload and len(payload.get('authorships', [])) > 0:
            for author_data in payload['authorships']:
                if 'author' in author_data and 'display_name' in author_data.get('author', {}):
                    authors.add(author_data['author']['display_name'])

        return list(authors)

    @classmethod
    def get_tags(cls, payload: dict) -> list[str]:
        tags: list[str] = []
        seen: set[str] = set()

        for keyword in payload.get("keywords") or []:
            display_name = (keyword or {}).get("display_name")
            if not display_name:
                continue

            normalized = display_name.casefold()
            if normalized in seen:
                continue

            seen.add(normalized)
            tags.append(display_name)

        return tags

    @classmethod
    def get_top_100_papers(cls) -> list:
        params = {
            "filter": "is_oa:true",
            "sort": "cited_by_count:desc",
            "per-page": 100,
            "search": "artificial intelligence machine learning",
            "select": (
                "id,doi,title,display_name,"
                "authorships,primary_location,"
                "locations,best_oa_location"
            )
        }

        if cls.API_KEY:
            params["api_key"] = cls.API_KEY

        response = requests.get(f"{cls.BASE_URL}/works", params=params)
        response.raise_for_status()

        return response.json().get('results', [])


if __name__ == "__main__":
    open_alex = OpenAlex()

    async def test_function():
        # Get paper metadata
        ids = ["W7201845208", "W2626778328"]
        for alex_id in ids:
            paper = await open_alex.get_data_by_openalex_id(alex_id)

            urls = OpenAlex.get_pdf_urls(paper)
            authors = OpenAlex.get_authors(paper)

            print(f"Details for paper: {paper['title']}")
            print(urls)

    asyncio.run(test_function())
