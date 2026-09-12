from src.config.main import Config
from celery import Celery

app = Celery(
    "inquiro",
    backend=Config.redis_url,
    broker=Config.redis_url
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
)

app.conf.imports = (
    "src.worker.tasks",
)

app.conf.update(
    worker_log_format=(
        "[%(asctime)s] "
        "[%(levelname)s] "
        "[%(processName)s] "
        "[%(name)s] "
        "%(message)s"
    ),
    worker_task_log_format=(
        "[%(asctime)s] "
        "[%(levelname)s] "
        "[%(task_name)s:%(task_id)s] "
        "%(message)s"
    ),
    worker_redirect_stdouts=True,
    worker_redirect_stdouts_level="INFO",
)
