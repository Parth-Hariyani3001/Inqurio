from src.worker.celery_app import app
from src.schemas.papers import PaperProcess
import asyncio

from src.worker.process_paper import process_paper_async


@app.task
def process_paper(paper_payload: PaperProcess):
    asyncio.run(process_paper_async(paper_payload))
