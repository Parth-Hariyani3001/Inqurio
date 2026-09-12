"""Parse GROBID TEI XML into section dicts for DB insertion."""

from __future__ import annotations

import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

TEI_NS = "http://www.tei-c.org/ns/1.0"
NS = {"tei": TEI_NS}


def _tag(local: str) -> str:
    return f"{{{TEI_NS}}}{local}"


def _element_text(el: ET.Element) -> str:
    return "".join(el.itertext()).strip()


def _section_content(div: ET.Element) -> str:
    """Collect text under a body div, excluding the head."""
    parts: list[str] = []
    for child in div:
        if child.tag == _tag("head"):
            continue
        text = _element_text(child)
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def parse_sections(xml_path: str, paper_id: uuid.UUID) -> list[dict]:
    """
    Parse body sections from a GROBID TEI XML file.

    Returns dicts matching the Section model fields, plus ``content``
    for later chunking (drop ``content`` when inserting into ``sections``).
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()

    body = root.find(".//tei:text/tei:body", NS)
    if body is None:
        return []

    sections: list[dict] = []
    order = 0

    for div in body.findall("tei:div", NS):
        head = div.find("tei:head", NS)
        if head is None:
            continue

        head_text = _element_text(head)
        if not head_text:
            continue

        n = head.get("n")
        title = f"{n} {head_text}".strip() if n else head_text

        section_content = _section_content(div)
        if not section_content.strip():
            continue
        
        order += 1
        sections.append(
            {
                "uid": uuid.uuid4(),
                "paper_id": paper_id,
                "title": title,
                "section_order": order,
                "content": _section_content(div),
            }
        )

    return sections


if __name__ == "__main__":
    import json
    import sys

    sys.stdout.reconfigure(encoding="utf-8")

    xml_file = Path(__file__).with_name("totpdf.tei.xml")
    out_file = Path(__file__).with_name("sections.json")
    paper_id = uuid.uuid4()
    sections = parse_sections(str(xml_file), paper_id)

    serializable = [
        {
            **s,
            "uid": str(s["uid"]),
            "paper_id": str(s["paper_id"]),
        }
        for s in sections
    ]
    out_file.write_text(
        json.dumps(serializable, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"paper_id={paper_id}")
    print(f"sections={len(sections)}")
    print(f"wrote {out_file}")
    for s in sections:
        print(
            f"{s['section_order']:2d}. {s['title']!r} "
            f"(content_chars={len(s['content'])})"
        )
