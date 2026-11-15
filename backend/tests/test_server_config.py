import runpy
from pathlib import Path
from unittest.mock import patch

import pytest

from app.core.config import Settings


def test_ports_load_from_env_file(tmp_path, monkeypatch):
    monkeypatch.delenv('FRONTEND_PORT', raising=False)
    monkeypatch.delenv('BACKEND_PORT', raising=False)
    env_file = tmp_path / '.env'
    env_file.write_text('FRONTEND_PORT=6100\nBACKEND_PORT=8100\n')
    settings = Settings(_env_file=env_file)
    assert (settings.FRONTEND_PORT, settings.BACKEND_PORT) == (6100, 8100)


@pytest.mark.parametrize('port', ['0', '65536', 'not-a-port'])
def test_invalid_backend_port_is_rejected(port, monkeypatch):
    monkeypatch.setenv('BACKEND_PORT', port)
    with pytest.raises(ValueError):
        Settings(_env_file=None)


def test_launcher_uses_configured_backend_port(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'BACKEND_PORT', 8100)
    with patch('uvicorn.run') as run:
        runpy.run_path(str(Path(__file__).resolve().parents[1] / 'run.py'), run_name='__main__')
    assert run.call_args.args == ('app.main:app',)
    assert run.call_args.kwargs['port'] == 8100
