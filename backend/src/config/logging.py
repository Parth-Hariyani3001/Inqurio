from __future__ import annotations

import logging


def configure_logging() -> None:
    """Send src.* INFO logs to the console (uvicorn ignores app loggers by default)."""
    logger = logging.getLogger("src")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    fmt = logging.Formatter("%(levelname)s [%(name)s] %(message)s")
    for handler in logger.handlers:
        if isinstance(handler, logging.StreamHandler) and not isinstance(
            handler, logging.FileHandler
        ):
            handler.setFormatter(fmt)
            handler.setLevel(logging.INFO)
            return

    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)
    handler.setFormatter(fmt)
    logger.addHandler(handler)
