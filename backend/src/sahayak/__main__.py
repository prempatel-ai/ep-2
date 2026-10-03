"""``python -m sahayak`` starts the server using the configured host and port."""

import uvicorn

from sahayak.config import Settings


def main() -> None:
    settings = Settings()
    uvicorn.run(
        "sahayak.main:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
