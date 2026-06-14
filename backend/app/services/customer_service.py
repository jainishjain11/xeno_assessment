from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate
import uuid

class CustomerService:
    @staticmethod
    async def get_customer(db: AsyncSession, customer_id: uuid.UUID) -> Customer | None:
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Customer)
            .options(selectinload(Customer.orders))
            .where(Customer.id == customer_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def get_customers_query(search: str | None = None):
        from sqlalchemy import or_
        query = select(Customer)
        if search:
            query = query.where(or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%")
            ))
        return query.order_by(Customer.created_at.desc())

    @staticmethod
    async def create_customer(db: AsyncSession, data: CustomerCreate) -> Customer:
        customer = Customer(**data.model_dump())
        db.add(customer)
        await db.commit()
        await db.refresh(customer)
        return customer

    @staticmethod
    async def update_customer(db: AsyncSession, customer_id: uuid.UUID, data: CustomerUpdate) -> Customer | None:
        customer = await CustomerService.get_customer(db, customer_id)
        if not customer:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(customer, key, value)
            
        await db.commit()
        await db.refresh(customer)
        return customer

    @staticmethod
    async def delete_customer(db: AsyncSession, customer_id: uuid.UUID) -> bool:
        customer = await CustomerService.get_customer(db, customer_id)
        if not customer:
            return False
        await db.delete(customer)
        await db.commit()
        return True

    @staticmethod
    async def recalculate_stats(db: AsyncSession, customer_id: uuid.UUID):
        await db.execute(text("""
            UPDATE customers
            SET total_spent = COALESCE(o.total, 0),
                order_count = COALESCE(o.count, 0),
                last_order_at = o.last_order
            FROM (
                SELECT customer_id, SUM(amount) as total, COUNT(id) as count, MAX(ordered_at) as last_order
                FROM orders
                WHERE status = 'completed' AND customer_id = :cust_id
                GROUP BY customer_id
            ) o
            WHERE customers.id = o.customer_id AND customers.id = :cust_id
        """), {"cust_id": customer_id})
        
        await db.execute(text("""
            UPDATE customers
            SET total_spent = 0, order_count = 0, last_order_at = NULL
            WHERE id = :cust_id AND NOT EXISTS (
                SELECT 1 FROM orders WHERE customer_id = :cust_id AND status = 'completed'
            )
        """), {"cust_id": customer_id})
        await db.commit()

    @staticmethod
    async def bulk_upsert(db: AsyncSession, customers_data: list[CustomerCreate]) -> int:
        count = 0
        for cust_data in customers_data:
            result = await db.execute(select(Customer).where(Customer.email == cust_data.email))
            customer = result.scalar_one_or_none()
            if customer:
                update_data = cust_data.model_dump(exclude_unset=True)
                for key, value in update_data.items():
                    setattr(customer, key, value)
            else:
                customer = Customer(**cust_data.model_dump())
                db.add(customer)
            count += 1
        await db.commit()
        
        for cust_data in customers_data:
            result = await db.execute(select(Customer).where(Customer.email == cust_data.email))
            c = result.scalar_one()
            await CustomerService.recalculate_stats(db, c.id)
            
        return count
