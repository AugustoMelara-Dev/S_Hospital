"""initial schema

Revision ID: dc388ab743ce
Revises:
Create Date: 2026-11-17 00:28:42.265824
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = 'dc388ab743ce'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('areas',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('slug', sa.String(length=140), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_areas')),
    sa.UniqueConstraint('slug', name=op.f('uq_areas_slug'))
    )
    op.create_table('cash_registers',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_cash_registers')),
    sa.UniqueConstraint('code', name=op.f('uq_cash_registers_code'))
    )
    op.create_table('categories',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('slug', sa.String(length=140), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_categories')),
    sa.UniqueConstraint('slug', name=op.f('uq_categories_slug'))
    )
    op.create_table('fiscal_sequences',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('prefix', sa.String(length=32), nullable=False),
    sa.Column('cai', sa.String(length=128), nullable=False),
    sa.Column('min_number', sa.BigInteger(), nullable=False),
    sa.Column('max_number', sa.BigInteger(), nullable=False),
    sa.Column('current_number', sa.BigInteger(), nullable=False),
    sa.Column('valid_until', sa.Date(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('active_marker', sa.SmallInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fiscal_sequences')),
    sa.UniqueConstraint('active_marker', name=op.f('uq_fiscal_sequences_active_marker'))
    )
    op.create_table('login_attempts',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('login', sa.String(length=160), nullable=False),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('success', sa.Boolean(), nullable=False),
    sa.Column('attempted_at', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_login_attempts'))
    )
    with op.batch_alter_table('login_attempts', schema=None) as batch_op:
        batch_op.create_index('ix_login_attempts_ip_time', ['ip', 'attempted_at'], unique=False)
        batch_op.create_index('ix_login_attempts_login_time', ['login', 'attempted_at'], unique=False)

    op.create_table('print_profiles',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('paper', sa.String(length=20), nullable=False),
    sa.Column('width_mm', sa.Numeric(precision=6, scale=1, asdecimal=False), nullable=False),
    sa.Column('height_mm', sa.Numeric(precision=6, scale=1, asdecimal=False), nullable=False),
    sa.Column('margins_mm', sa.Numeric(precision=5, scale=1, asdecimal=False), nullable=False),
    sa.Column('copies_mode', sa.String(length=30), nullable=False),
    sa.Column('show_seal_space', sa.Boolean(), nullable=False),
    sa.Column('use_logo', sa.Boolean(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('default_marker', sa.SmallInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_print_profiles')),
    sa.UniqueConstraint('code', name=op.f('uq_print_profiles_code')),
    sa.UniqueConstraint('default_marker', name=op.f('uq_print_profiles_default_marker'))
    )
    op.create_table('receipt_series',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('series', sa.String(length=32), nullable=False),
    sa.Column('prefix', sa.String(length=32), nullable=False),
    sa.Column('min_number', sa.BigInteger(), nullable=False),
    sa.Column('max_number', sa.BigInteger(), nullable=False),
    sa.Column('current_number', sa.BigInteger(), nullable=False),
    sa.Column('range_authorization', sa.String(length=128), nullable=False),
    sa.Column('legal_text', sa.Text(), nullable=False),
    sa.Column('number_color', sa.String(length=9), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('active_marker', sa.SmallInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_receipt_series')),
    sa.UniqueConstraint('active_marker', name=op.f('uq_receipt_series_active_marker'))
    )
    op.create_table('roles',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('is_system', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_roles')),
    sa.UniqueConstraint('code', name=op.f('uq_roles_code'))
    )
    op.create_table('settings',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('hospital_name', sa.String(length=160), nullable=False),
    sa.Column('rtn', sa.String(length=20), nullable=False),
    sa.Column('address', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=60), nullable=False),
    sa.Column('slogan', sa.String(length=160), nullable=False),
    sa.Column('government_line', sa.String(length=160), nullable=False),
    sa.Column('secretariat_line', sa.String(length=160), nullable=False),
    sa.Column('receipt_location', sa.String(length=160), nullable=False),
    sa.Column('receipt_footer_text', sa.Text(), nullable=False),
    sa.Column('default_tax_rate_bp', sa.Integer(), nullable=False),
    sa.Column('partial_payments_enabled', sa.Boolean(), nullable=False),
    sa.Column('logo', sa.LargeBinary().with_variant(mysql.LONGBLOB(), 'mariadb').with_variant(mysql.LONGBLOB(), 'mysql'), nullable=True),
    sa.Column('logo_mime', sa.String(length=60), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_settings'))
    )
    op.create_table('tax_rates',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.Column('rate_bp', sa.Integer(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tax_rates'))
    )
    op.create_table('role_permissions',
    sa.Column('role_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('permission', sa.String(length=60), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_role_permissions_role_id_roles'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('role_id', 'permission', name=op.f('pk_role_permissions'))
    )
    op.create_table('services',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('category_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('area_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('name', sa.String(length=160), nullable=False),
    sa.Column('slug', sa.String(length=180), nullable=False),
    sa.Column('source_key', sa.String(length=191), nullable=True),
    sa.Column('aliases', sa.Text(), nullable=False),
    sa.Column('description', sa.String(length=255), nullable=False),
    sa.Column('price_cents', sa.BigInteger(), nullable=False),
    sa.Column('tax_rate_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('visible_in_billing', sa.Boolean(), nullable=False),
    sa.Column('is_billable', sa.Boolean(), nullable=False),
    sa.Column('special_rule_code', sa.String(length=80), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint('price_cents >= 0', name=op.f('ck_services_price_non_negative')),
    sa.ForeignKeyConstraint(['area_id'], ['areas.id'], name=op.f('fk_services_area_id_areas')),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name=op.f('fk_services_category_id_categories')),
    sa.ForeignKeyConstraint(['tax_rate_id'], ['tax_rates.id'], name=op.f('fk_services_tax_rate_id_tax_rates')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_services')),
    sa.UniqueConstraint('category_id', 'slug', name='uq_services_category_slug'),
    sa.UniqueConstraint('source_key', name=op.f('uq_services_source_key'))
    )
    with op.batch_alter_table('services', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_services_area_id'), ['area_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_services_category_id'), ['category_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_services_name'), ['name'], unique=False)
        batch_op.create_index(batch_op.f('ix_services_tax_rate_id'), ['tax_rate_id'], unique=False)

    op.create_table('users',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('username', sa.String(length=60), nullable=False),
    sa.Column('email', sa.String(length=160), nullable=True),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('must_change_password', sa.Boolean(), nullable=False),
    sa.Column('last_login_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_users_role_id_roles')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email')),
    sa.UniqueConstraint('username', name=op.f('uq_users_username'))
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_role_id'), ['role_id'], unique=False)

    op.create_table('audit_logs',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('action', sa.String(length=80), nullable=False),
    sa.Column('entity_type', sa.String(length=60), nullable=True),
    sa.Column('entity_id', sa.BigInteger(), nullable=True),
    sa.Column('result', sa.String(length=10), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=True),
    sa.Column('old_values', sa.JSON(), nullable=True),
    sa.Column('new_values', sa.JSON(), nullable=True),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_audit_logs_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_logs'))
    )
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.create_index('ix_audit_logs_action_created', ['action', 'created_at'], unique=False)
        batch_op.create_index('ix_audit_logs_created', ['created_at'], unique=False)
        batch_op.create_index('ix_audit_logs_entity', ['entity_type', 'entity_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_user_id'), ['user_id'], unique=False)

    op.create_table('backups',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('size_bytes', sa.BigInteger(), nullable=True),
    sa.Column('sha256', sa.String(length=64), nullable=True),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('created_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_backups_created_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_backups'))
    )
    op.create_table('cash_sessions',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('cash_register_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('open_register_marker', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('open_user_marker', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('opening_cents', sa.BigInteger(), nullable=False),
    sa.Column('opening_notes', sa.Text(), nullable=False),
    sa.Column('opened_at', sa.DateTime(), nullable=False),
    sa.Column('closed_at', sa.DateTime(), nullable=True),
    sa.Column('closed_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('counted_cents', sa.BigInteger(), nullable=True),
    sa.Column('expected_cash_cents', sa.BigInteger(), nullable=True),
    sa.Column('difference_cents', sa.BigInteger(), nullable=True),
    sa.Column('closing_notes', sa.Text(), nullable=False),
    sa.Column('closing_breakdown', sa.JSON(), nullable=True),
    sa.Column('method_totals', sa.JSON(), nullable=True),
    sa.Column('payments_count', sa.Integer(), nullable=False),
    sa.Column('payments_total_cents', sa.BigInteger(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['cash_register_id'], ['cash_registers.id'], name=op.f('fk_cash_sessions_cash_register_id_cash_registers')),
    sa.ForeignKeyConstraint(['closed_by'], ['users.id'], name=op.f('fk_cash_sessions_closed_by_users')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_cash_sessions_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_cash_sessions')),
    sa.UniqueConstraint('open_register_marker', name=op.f('uq_cash_sessions_open_register_marker')),
    sa.UniqueConstraint('open_user_marker', name=op.f('uq_cash_sessions_open_user_marker'))
    )
    with op.batch_alter_table('cash_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_cash_sessions_cash_register_id'), ['cash_register_id'], unique=False)
        batch_op.create_index('ix_cash_sessions_status_opened', ['status', 'opened_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_cash_sessions_user_id'), ['user_id'], unique=False)

    op.create_table('idempotency_keys',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('route', sa.String(length=255), nullable=False),
    sa.Column('key', sa.String(length=100), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('status_code', sa.Integer(), nullable=False),
    sa.Column('content_type', sa.String(length=100), nullable=True),
    sa.Column('headers', sa.JSON(), nullable=True),
    sa.Column('body', sa.LargeBinary().with_variant(mysql.LONGBLOB(), 'mariadb').with_variant(mysql.LONGBLOB(), 'mysql'), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_idempotency_keys_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_idempotency_keys')),
    sa.UniqueConstraint('user_id', 'route', 'key', name='uq_idempotency_keys')
    )
    op.create_table('service_price_history',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('service_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('old_price_cents', sa.BigInteger(), nullable=False),
    sa.Column('new_price_cents', sa.BigInteger(), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=False),
    sa.Column('changed_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('changed_at', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['changed_by'], ['users.id'], name=op.f('fk_service_price_history_changed_by_users')),
    sa.ForeignKeyConstraint(['service_id'], ['services.id'], name=op.f('fk_service_price_history_service_id_services')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_service_price_history'))
    )
    with op.batch_alter_table('service_price_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_service_price_history_service_id'), ['service_id'], unique=False)

    op.create_table('user_sessions',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('user_agent', sa.String(length=255), nullable=True),
    sa.Column('last_seen_at', sa.DateTime(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_sessions_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_user_sessions')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_user_sessions_token_hash'))
    )
    with op.batch_alter_table('user_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_sessions_expires_at'), ['expires_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_user_sessions_user_id'), ['user_id'], unique=False)

    op.create_table('invoices',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('number', sa.String(length=40), nullable=False),
    sa.Column('fiscal_sequence_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('fiscal_cai', sa.String(length=128), nullable=False),
    sa.Column('fiscal_range_from', sa.String(length=40), nullable=False),
    sa.Column('fiscal_range_to', sa.String(length=40), nullable=False),
    sa.Column('fiscal_valid_until', sa.Date(), nullable=True),
    sa.Column('hospital_name', sa.String(length=160), nullable=False),
    sa.Column('hospital_rtn', sa.String(length=20), nullable=False),
    sa.Column('hospital_address', sa.String(length=255), nullable=False),
    sa.Column('hospital_phone', sa.String(length=60), nullable=False),
    sa.Column('government_line', sa.String(length=160), nullable=False),
    sa.Column('secretariat_line', sa.String(length=160), nullable=False),
    sa.Column('receipt_location', sa.String(length=160), nullable=False),
    sa.Column('receipt_footer_text', sa.Text(), nullable=False),
    sa.Column('patient_name', sa.String(length=180), nullable=False),
    sa.Column('subtotal_cents', sa.BigInteger(), nullable=False),
    sa.Column('exempt_cents', sa.BigInteger(), nullable=False),
    sa.Column('taxable_cents', sa.BigInteger(), nullable=False),
    sa.Column('tax_cents', sa.BigInteger(), nullable=False),
    sa.Column('total_cents', sa.BigInteger(), nullable=False),
    sa.Column('paid_cents', sa.BigInteger(), nullable=False),
    sa.Column('balance_cents', sa.BigInteger(), nullable=False),
    sa.Column('tax_breakdown', sa.JSON(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('settlement', sa.String(length=20), nullable=False),
    sa.Column('dialysis_prescription', sa.Boolean(), nullable=False),
    sa.Column('cash_session_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('issued_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('issued_at', sa.DateTime(), nullable=False),
    sa.Column('voided_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('voided_at', sa.DateTime(), nullable=True),
    sa.Column('void_reason', sa.String(length=500), nullable=True),
    sa.Column('reversed', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['cash_session_id'], ['cash_sessions.id'], name=op.f('fk_invoices_cash_session_id_cash_sessions')),
    sa.ForeignKeyConstraint(['fiscal_sequence_id'], ['fiscal_sequences.id'], name=op.f('fk_invoices_fiscal_sequence_id_fiscal_sequences')),
    sa.ForeignKeyConstraint(['issued_by'], ['users.id'], name=op.f('fk_invoices_issued_by_users')),
    sa.ForeignKeyConstraint(['voided_by'], ['users.id'], name=op.f('fk_invoices_voided_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_invoices')),
    sa.UniqueConstraint('number', name=op.f('uq_invoices_number'))
    )
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_invoices_cash_session_id'), ['cash_session_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_invoices_fiscal_sequence_id'), ['fiscal_sequence_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_invoices_issued_at'), ['issued_at'], unique=False)
        batch_op.create_index('ix_invoices_issued_by_issued', ['issued_by', 'issued_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_invoices_patient_name'), ['patient_name'], unique=False)
        batch_op.create_index('ix_invoices_status_issued', ['status', 'issued_at'], unique=False)

    op.create_table('institutional_receipts',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('invoice_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('issued_invoice_marker', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('series_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('number', sa.BigInteger(), nullable=False),
    sa.Column('number_full', sa.String(length=60), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('amount_cents', sa.BigInteger(), nullable=False),
    sa.Column('amount_words', sa.String(length=255), nullable=False),
    sa.Column('payer_name', sa.String(length=180), nullable=False),
    sa.Column('cash_session_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('issued_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('issued_at', sa.DateTime(), nullable=False),
    sa.Column('snapshot', sa.JSON(), nullable=False),
    sa.Column('reprint_count', sa.Integer(), nullable=False),
    sa.Column('voided_at', sa.DateTime(), nullable=True),
    sa.Column('void_reason', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['cash_session_id'], ['cash_sessions.id'], name=op.f('fk_institutional_receipts_cash_session_id_cash_sessions')),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name=op.f('fk_institutional_receipts_invoice_id_invoices')),
    sa.ForeignKeyConstraint(['issued_by'], ['users.id'], name=op.f('fk_institutional_receipts_issued_by_users')),
    sa.ForeignKeyConstraint(['series_id'], ['receipt_series.id'], name=op.f('fk_institutional_receipts_series_id_receipt_series')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_institutional_receipts')),
    sa.UniqueConstraint('issued_invoice_marker', name=op.f('uq_institutional_receipts_issued_invoice_marker')),
    sa.UniqueConstraint('number_full', name=op.f('uq_institutional_receipts_number_full'))
    )
    with op.batch_alter_table('institutional_receipts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_institutional_receipts_cash_session_id'), ['cash_session_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_institutional_receipts_invoice_id'), ['invoice_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_institutional_receipts_issued_at'), ['issued_at'], unique=False)

    op.create_table('invoice_items',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('invoice_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('service_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('service_name', sa.String(length=160), nullable=False),
    sa.Column('category_name', sa.String(length=120), nullable=False),
    sa.Column('area_name', sa.String(length=120), nullable=False),
    sa.Column('quantity_hundredths', sa.Integer(), nullable=False),
    sa.Column('unit_price_registered_cents', sa.BigInteger(), nullable=False),
    sa.Column('unit_price_cents', sa.BigInteger(), nullable=False),
    sa.Column('rule_adjustment_cents', sa.BigInteger(), nullable=False),
    sa.Column('rate_bp', sa.Integer(), nullable=False),
    sa.Column('line_subtotal_cents', sa.BigInteger(), nullable=False),
    sa.Column('tax_cents', sa.BigInteger(), nullable=False),
    sa.Column('line_total_cents', sa.BigInteger(), nullable=False),
    sa.Column('special_rule_applied', sa.Boolean(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name=op.f('fk_invoice_items_invoice_id_invoices')),
    sa.ForeignKeyConstraint(['service_id'], ['services.id'], name=op.f('fk_invoice_items_service_id_services'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_invoice_items'))
    )
    with op.batch_alter_table('invoice_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_invoice_items_invoice_id'), ['invoice_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_invoice_items_service_id'), ['service_id'], unique=False)

    op.create_table('payments',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('invoice_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('cash_session_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('method', sa.String(length=20), nullable=False),
    sa.Column('amount_cents', sa.BigInteger(), nullable=False),
    sa.Column('received_cents', sa.BigInteger(), nullable=True),
    sa.Column('change_cents', sa.BigInteger(), nullable=True),
    sa.Column('reference', sa.String(length=120), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('void_reason', sa.String(length=500), nullable=True),
    sa.Column('voided_by', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('voided_at', sa.DateTime(), nullable=True),
    sa.Column('paid_at', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['cash_session_id'], ['cash_sessions.id'], name=op.f('fk_payments_cash_session_id_cash_sessions')),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name=op.f('fk_payments_invoice_id_invoices')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_payments_user_id_users')),
    sa.ForeignKeyConstraint(['voided_by'], ['users.id'], name=op.f('fk_payments_voided_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_payments'))
    )
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_payments_invoice_id'), ['invoice_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_payments_paid_at'), ['paid_at'], unique=False)
        batch_op.create_index('ix_payments_session_status', ['cash_session_id', 'status'], unique=False)
        batch_op.create_index(batch_op.f('ix_payments_user_id'), ['user_id'], unique=False)

    op.create_table('cash_movements',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('cash_session_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('payment_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('method', sa.String(length=20), nullable=True),
    sa.Column('amount_cents', sa.BigInteger(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=False),
    sa.Column('occurred_at', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['cash_session_id'], ['cash_sessions.id'], name=op.f('fk_cash_movements_cash_session_id_cash_sessions')),
    sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], name=op.f('fk_cash_movements_payment_id_payments')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_cash_movements_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_cash_movements'))
    )
    with op.batch_alter_table('cash_movements', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_cash_movements_cash_session_id'), ['cash_session_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_cash_movements_payment_id'), ['payment_id'], unique=False)

    op.create_table('receipt_print_events',
    sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), autoincrement=True, nullable=False),
    sa.Column('receipt_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=True),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=False),
    sa.Column('profile_code', sa.String(length=40), nullable=True),
    sa.Column('user_id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['receipt_id'], ['institutional_receipts.id'], name=op.f('fk_receipt_print_events_receipt_id_institutional_receipts')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_receipt_print_events_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_receipt_print_events'))
    )
    with op.batch_alter_table('receipt_print_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_receipt_print_events_receipt_id'), ['receipt_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('receipt_print_events', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_receipt_print_events_receipt_id'))

    op.drop_table('receipt_print_events')
    with op.batch_alter_table('cash_movements', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_cash_movements_payment_id'))
        batch_op.drop_index(batch_op.f('ix_cash_movements_cash_session_id'))

    op.drop_table('cash_movements')
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_payments_user_id'))
        batch_op.drop_index('ix_payments_session_status')
        batch_op.drop_index(batch_op.f('ix_payments_paid_at'))
        batch_op.drop_index(batch_op.f('ix_payments_invoice_id'))

    op.drop_table('payments')
    with op.batch_alter_table('invoice_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_invoice_items_service_id'))
        batch_op.drop_index(batch_op.f('ix_invoice_items_invoice_id'))

    op.drop_table('invoice_items')
    with op.batch_alter_table('institutional_receipts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_institutional_receipts_issued_at'))
        batch_op.drop_index(batch_op.f('ix_institutional_receipts_invoice_id'))
        batch_op.drop_index(batch_op.f('ix_institutional_receipts_cash_session_id'))

    op.drop_table('institutional_receipts')
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.drop_index('ix_invoices_status_issued')
        batch_op.drop_index(batch_op.f('ix_invoices_patient_name'))
        batch_op.drop_index('ix_invoices_issued_by_issued')
        batch_op.drop_index(batch_op.f('ix_invoices_issued_at'))
        batch_op.drop_index(batch_op.f('ix_invoices_fiscal_sequence_id'))
        batch_op.drop_index(batch_op.f('ix_invoices_cash_session_id'))

    op.drop_table('invoices')
    with op.batch_alter_table('user_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_sessions_user_id'))
        batch_op.drop_index(batch_op.f('ix_user_sessions_expires_at'))

    op.drop_table('user_sessions')
    with op.batch_alter_table('service_price_history', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_service_price_history_service_id'))

    op.drop_table('service_price_history')
    op.drop_table('idempotency_keys')
    with op.batch_alter_table('cash_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_cash_sessions_user_id'))
        batch_op.drop_index('ix_cash_sessions_status_opened')
        batch_op.drop_index(batch_op.f('ix_cash_sessions_cash_register_id'))

    op.drop_table('cash_sessions')
    op.drop_table('backups')
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_logs_user_id'))
        batch_op.drop_index('ix_audit_logs_entity')
        batch_op.drop_index('ix_audit_logs_created')
        batch_op.drop_index('ix_audit_logs_action_created')

    op.drop_table('audit_logs')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_role_id'))

    op.drop_table('users')
    with op.batch_alter_table('services', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_services_tax_rate_id'))
        batch_op.drop_index(batch_op.f('ix_services_name'))
        batch_op.drop_index(batch_op.f('ix_services_category_id'))
        batch_op.drop_index(batch_op.f('ix_services_area_id'))

    op.drop_table('services')
    op.drop_table('role_permissions')
    op.drop_table('tax_rates')
    op.drop_table('settings')
    op.drop_table('roles')
    op.drop_table('receipt_series')
    op.drop_table('print_profiles')
    with op.batch_alter_table('login_attempts', schema=None) as batch_op:
        batch_op.drop_index('ix_login_attempts_login_time')
        batch_op.drop_index('ix_login_attempts_ip_time')

    op.drop_table('login_attempts')
    op.drop_table('fiscal_sequences')
    op.drop_table('categories')
    op.drop_table('cash_registers')
    op.drop_table('areas')
