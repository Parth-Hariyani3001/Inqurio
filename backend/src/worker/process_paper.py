from __future__ import annotations

import hashlib

from src.rag.chunker import (
    chunk_sections,
    embed_text_for_chunk,
    group_chunks_on_section,
)
from src.schemas.papers import PaperProcess
from src.utils.grobid import GROBID
from src.utils.open_alex import OpenAlex
from src.utils.object_store import get_pdf_object, upload_pdf_bytes
from src.services.sections import SectionService
from src.services.chunks import ChunkService
from src.services.papers import PaperService
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio.session import async_sessionmaker

from src.db.main import create_task_engine
from src.db.models import Status
from src.rag.embeddings import embeddings
from src.rag.vector_store import (
    collection_name,
    delete_points_for_paper,
    ensure_collection,
    vector_store,
)
from qdrant_client.models import PointStruct
from celery.utils.log import get_task_logger

section_service = SectionService()
chunk_service = ChunkService()
paper_service = PaperService()

logger = get_task_logger(__name__)


def _load_paper_bytes(urls: list[str], s3_key: str | None) -> bytes:
    if s3_key:
        try:
            obj = get_pdf_object(s3_key)
            body = obj["Body"].read()
            if body:
                return body
        except FileNotFoundError:
            logger.warning("Cached PDF missing in object store; re-downloading")

    return OpenAlex.download_paper_contents(urls)


async def process_paper_async(paper_payload: PaperProcess):
    engine = create_task_engine()
    TaskSession = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    paper = None

    try:
        async with TaskSession() as session:
            try:
                logger.info("Validating input")
                payload = PaperProcess.model_validate(paper_payload)

                logger.info("Validating if paper exist")
                paper = await paper_service.get_paper_by_openalex_id(
                    id=payload.openalex_id,
                    session=session
                )
                if not paper:
                    raise Exception("Paper not found")

                logger.info("Updating the paper status to Processing")
                await paper_service.update_paper(
                    paper=paper,
                    updates={"status": Status.PROCESSING},
                    session=session
                )

                urls = payload.urls
                paper_id = payload.paper_id

                # Clear prior index so reprocess/re-queue does not duplicate chunks.
                logger.info("Clearing previous sections and vectors for paper")
                delete_points_for_paper(paper_id)
                await section_service.delete_sections_for_paper(paper_id, session)

                logger.info("Loading paper contents")
                paper_contents = _load_paper_bytes(urls, paper.s3_key)
                file_hash = hashlib.sha256(paper_contents).hexdigest()
                object_key = paper.s3_key or f"pdfs/{paper_id}.pdf"

                logger.info("Uploading the paper to R2")
                upload_pdf_bytes(paper_contents, object_key)

                logger.info("Updating the file hash of the paper")
                await paper_service.update_paper(
                    paper=paper,
                    updates={"file_hash": file_hash, "s3_key": object_key},
                    session=session
                )

                parsed_result = GROBID.parse_paper(paper_contents)
                paper_sections = GROBID.parse_response(parsed_result)

                logger.info("Creating chunks for the sections")
                chunks = chunk_sections(paper_id, paper_sections)
                grouped_sections = group_chunks_on_section(chunks)

                ensure_collection(recreate_if_dim_mismatch=False)

                logger.info("Creating Chunks for each section")
                for (title, order), documents in grouped_sections.items():
                    logger.info(
                        f"Processing Section {title} with {len(documents)} Chunks")
                    section = await section_service.create_section(
                        paper_id=paper_id,
                        title=title,
                        section_order=order,
                        session=session,
                    )

                    contents = []
                    for document in documents:
                        document.metadata["section_id"] = str(section.uid)
                        contents.append(document.page_content)

                    new_chunks = await chunk_service.bulk_create_chunks(
                        paper_id=paper_id,
                        section_id=section.uid,
                        contents=contents,
                        session=session,
                    )

                    vectors = embeddings.embed_documents(
                        [
                            embed_text_for_chunk(title, chunk.content)
                            for chunk in new_chunks
                        ]
                    )

                    points = [
                        PointStruct(
                            id=str(chunk.uid),
                            vector=vector,
                            payload={
                                "paper_id": str(chunk.paper_id),
                                "section_id": str(chunk.section_id),
                                "chunk_index": chunk.chunk_index,
                                "section_title": title,
                            },
                        )
                        for chunk, vector in zip(new_chunks, vectors)
                    ]

                    vector_store.client.upsert(
                        collection_name=collection_name,
                        points=points,
                    )

                await paper_service.update_paper(
                    paper=paper,
                    updates={"status": Status.READY},
                    session=session
                )
            except Exception as e:
                logger.exception(
                    f"An error occured while processing the paper {str(e)}")

                if paper:
                    await paper_service.update_paper(
                        paper=paper,
                        updates={"status": Status.FAILED},
                        session=session
                    )

                raise
    finally:
        logger.info("Process completed")
        await engine.dispose()
