
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from database import Base, DATABASE_URL
import models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured")

# Use the existing PostgreSQL connection string.
config.set_main_option(
    "sqlalchemy.url",
    DATABASE_URL.replace("%", "%%")
)

# Alembic reads our SQLAlchemy models to detect changes.
target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
