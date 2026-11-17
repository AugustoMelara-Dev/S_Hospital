"""The Alembic migration must build the same schema as the models, from zero."""

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.config import API_ROOT
from app.db import Base


def test_migrations_from_zero_match_models(tmp_path: Path) -> None:
    url = f"sqlite:///{(tmp_path / 'mig.db').as_posix()}"
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")

    engine = create_engine(url)
    try:
        tables = set(inspect(engine).get_table_names())
        assert set(Base.metadata.tables) <= tables
        with engine.connect() as conn:
            diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
        assert diff == []
    finally:
        engine.dispose()
