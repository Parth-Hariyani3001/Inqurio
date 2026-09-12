from src.config.main import Config

from xml.etree.ElementTree import Element
import xml.etree.ElementTree as ET
import requests
import httpx
import re


class GROBID:
    BASE_URL = Config.grobid_url
    TEI_NS = "http://www.tei-c.org/ns/1.0"

    _client = httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=120,
    )

    @classmethod
    def parse_paper(cls, pdf_contents: bytes) -> bytes:
        params = {
            "consolidateHeader": 0,
            "consolidateCitations": 0,
        }

        response = requests.post(
            f"{cls.BASE_URL}/api/processFulltextDocument",
            params=params,
            files={
                "input": ("paper.pdf", pdf_contents, "application/pdf")
            }
        )

        response.raise_for_status()
        return response.content

    @classmethod
    def _get_namespace(cls, root: Element):
        match = re.match(r"\{(.*)\}", root.tag)
        namespace = match.group(1) if match else ""

        return {'ns': namespace}

    @classmethod
    def _tag(cls, local: str, ns: str) -> str:
        return f"{{{ns}}}{local}"

    @classmethod
    def _element_text(cls, el: Element) -> str:
        return "".join(el.itertext()).strip()

    @classmethod
    def _section_content(cls, div: Element, ns: str) -> str:
        parts: list[str] = []
        for child in div:
            if child.tag == cls._tag("head", ns):
                continue

            text = cls._element_text(child)
            if text:
                parts.append(text)

        return "\n\n".join(parts)

    @classmethod
    def parse_response(cls, response: bytes):
        root = ET.fromstring(response)
        ns = cls._get_namespace(root)

        body = root.find(".//ns:body", ns)
        if body is None:
            return []

        sections: list[dict] = []
        order = 0

        # Getting the abstract
        abstract = root.find(".//ns:profileDesc/ns:abstract/ns:div", ns)
        if abstract is not None:
            order += 1
            sections.append({
                "section_order": order,
                "title": "Abstract",
                "content": cls._section_content(abstract, ns['ns'])
            })

        # Getting sections
        for div in body.findall('.//ns:div', ns):
            head = div.find(".//ns:head", ns)
            if head is None:
                continue

            title = cls._element_text(head)
            if title is None:
                continue

            # n = head.get("n")
            # title = f"{n} {head_text}".strip() if n else head_text

            section_content = cls._section_content(div, ns['ns'])
            if not section_content.strip():
                continue

            order += 1
            sections.append(
                {
                    "section_order": order,
                    "title": title,
                    "content": section_content
                }
            )

        return sections
