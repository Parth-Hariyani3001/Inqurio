import hashlib

from src.rag.chunker import chunk_sections, group_chunks_on_section
from src.worker.celery_app import app
from src.schemas.papers import PaperProcess
from src.utils.grobid import GROBID
from src.utils.open_alex import OpenAlex
from src.utils.object_store import upload_pdf_bytes
from src.services.sections import SectionService
from src.services.chunks import ChunkService
from src.services.papers import PaperService
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio.session import async_sessionmaker

from src.db.main import create_task_engine
from src.db.models import Status
from src.rag.embeddings import embeddings
from src.rag.vector_store import vector_store
from qdrant_client.models import PointStruct
from celery.utils.log import get_task_logger

section_service = SectionService()
chunk_service = ChunkService()
paper_service = PaperService()

logger = get_task_logger(__name__)


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

                logger.info("Downloading paper contents")
                paper_contents = OpenAlex.download_paper_contents(urls)
                file_hash = hashlib.sha256(paper_contents).hexdigest()
                object_key = f"pdfs/{paper_id}.pdf"

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

                    for _, document in enumerate(documents):
                        document.metadata["section_id"] = str(section.uid)
                        document.page_content = document.page_content.replace("\n", "")
                        contents.append(document.page_content)

                    new_chunks = await chunk_service.bulk_create_chunks(
                        paper_id=paper_id,
                        section_id=section.uid,
                        contents=contents,
                        session=session,
                    )

                    vectors = embeddings.embed_documents(
                        [chunk.content for chunk in new_chunks]
                    )

                    points = [
                        PointStruct(
                            id=str(chunk.uid),
                            vector=vector,
                            payload={
                                "paper_id": str(chunk.paper_id),
                                "section_id": str(chunk.section_id),
                                "chunk_index": chunk.chunk_index,
                            },
                        )
                        for chunk, vector in zip(new_chunks, vectors)
                    ]

                    vector_store.client.upsert(
                        collection_name="papers",
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
