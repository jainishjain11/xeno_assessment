from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerBulkImport
from app.services.customer_service import CustomerService
from app.utils.jwt import get_current_user
from app.utils.pagination import paginate, PaginatedResponse
from app.models import User
import uuid
import math

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("", response_model=PaginatedResponse[CustomerResponse])
async def list_customers(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = CustomerService.get_customers_query()
    items, total = await paginate(db, query, page, size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 0
    }

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    customer = await CustomerService.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.post("", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await CustomerService.create_customer(db, data)

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    customer = await CustomerService.update_customer(db, customer_id, data)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = await CustomerService.delete_customer(db, customer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Customer not found")

@router.post("/bulk", status_code=200)
async def bulk_import_customers(
    data: CustomerBulkImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = await CustomerService.bulk_upsert(db, data.customers)
    return {"message": f"Successfully imported {count} customers"}
