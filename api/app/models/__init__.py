"""All ORM models. Importing this package registers every table on ``Base.metadata``."""

from app.models.billing import Invoice, InvoiceItem, Payment
from app.models.cash import CashMovement, CashRegister, CashSession
from app.models.catalog import ERYTHROPOIETIN_RULE, Area, Category, Service, ServicePriceHistory
from app.models.receipts import (
    InstitutionalReceipt,
    PrintProfile,
    ReceiptPrintEvent,
    ReceiptSeries,
)
from app.models.settings import SETTINGS_ID, FiscalSequence, Setting, TaxRate
from app.models.system import AuditLog, Backup, IdempotencyKey
from app.models.users import LoginAttempt, Role, RolePermission, User, UserSession

__all__ = [
    "ERYTHROPOIETIN_RULE",
    "SETTINGS_ID",
    "Area",
    "AuditLog",
    "Backup",
    "CashMovement",
    "CashRegister",
    "CashSession",
    "Category",
    "FiscalSequence",
    "IdempotencyKey",
    "InstitutionalReceipt",
    "Invoice",
    "InvoiceItem",
    "LoginAttempt",
    "Payment",
    "PrintProfile",
    "ReceiptPrintEvent",
    "ReceiptSeries",
    "Role",
    "RolePermission",
    "Service",
    "ServicePriceHistory",
    "Setting",
    "TaxRate",
    "User",
    "UserSession",
]
