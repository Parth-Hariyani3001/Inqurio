import requests
import httpx
import asyncio
import re


class OpenAlex:
    BASE_URL = "https://api.openalex.org"
    API_KEY = "kjieBZXzwM5utlRzh16ykH"
    BASE_ARXIV_URL = "https://arxiv.org/pdf/"

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
    def download_paper_contents(cls, pdf_url: str) -> bytes:
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

        response = requests.get(pdf_url, headers=headers,
                                stream=True, timeout=(10, 60))
        response.raise_for_status()

        pdf_contents = bytearray()

        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                pdf_contents.extend(chunk)

        return bytes(pdf_contents)

    @classmethod
    def get_pdf_urls(cls, payload: dict) -> list:
        urls = set()

        if 'primary_location' in payload and 'pdf_url' in payload.get('primary_location', {}):
            urls.add(payload['primary_location']['pdf_url'])

        if 'locations' in payload and len(payload.get('locations', [])) > 0:
            for location in payload['locations']:
                if 'pdf_url' in location and location.get('pdf_url', None) is not None:
                    urls.add(location['pdf_url'])

        if 'best_oa_location' in payload and 'pdf_url' in payload.get('best_oa_location', {}):
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
    def get_top_100_papers(cls) -> list:
        params = {
            "filter": "is_oa:true",
            "sort": "cited_by_count:desc",
            "per-page": 100,
            "search": "Large Language Model",
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
        top_papers = open_alex.get_top_100_papers()
        for paper_content in top_papers:
            urls = OpenAlex.get_pdf_urls(paper_content)
            authors = OpenAlex.get_authors(paper_content)

            print(f"PAPERS: {paper_content['title']}")
            print(urls)
            print(authors)

        print("Done")

        # Get paper metadata
        # ids = ["W7201845208", "W2626778328"]
        # for alex_id in ids:
        #     paper = await open_alex.get_data_by_openalex_id(alex_id)

        #     urls = OpenAlex.get_pdf_urls(paper)
        #     authors = OpenAlex.get_authors(paper)

        #     print(f"Details for paper: {paper['title']}")
        #     print(urls)

    asyncio.run(test_function())
