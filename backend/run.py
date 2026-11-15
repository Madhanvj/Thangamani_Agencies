"""Start the API using the shared project .env port configuration."""
from pathlib import Path

import uvicorn

from app.core.config import settings


if __name__ == '__main__':
    uvicorn.run(
        'app.main:app',
        host='0.0.0.0',
        port=settings.BACKEND_PORT,
        reload=True,
        reload_dirs=[str(Path(__file__).resolve().parent / 'app')],
    )
