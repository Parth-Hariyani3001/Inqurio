from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from uuid import UUID

splitter = RecursiveCharacterTextSplitter(
    chunk_size=900,
    chunk_overlap=180,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def chunk_sections(paper_id: UUID, sections: list[dict]) -> list[Document]:
    documents = []

    for section in sections:
        chunks = splitter.split_documents(
            [
                Document(
                    page_content=section["content"],
                    metadata={
                        "paper_id": paper_id,
                        "section_order": section["section_order"],
                        "section_title": section["title"],
                    },
                )
            ]
        )

        documents.extend(chunks)

    return documents


def group_chunks_on_section(chunks: list[Document]):
    sections = {}
    for doc in chunks:
        section_title = doc.metadata["section_title"]
        section_order = doc.metadata["section_order"]

        key = (section_title, section_order)
        if key not in sections:
            sections[key] = [doc]
        else:
            sections[key].append(doc)

    return sections


def embed_text_for_chunk(section_title: str, content: str) -> str:
    """Prefix section title so dense/sparse retrieval can use section cues."""
    title = (section_title or "").strip()
    body = content.strip()
    if not title:
        return body
    return f"## {title}\n{body}"
