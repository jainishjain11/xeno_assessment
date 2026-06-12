import asyncio
import random
from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import text

# Import database and models
from app.database import AsyncSessionLocal, engine
from app.models import User, Customer, Order, Segment, Campaign, CommunicationLog

fake = Faker('en_IN')
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("Creating demo user...")
        # Check if user already exists
        existing_user = await db.execute(text("SELECT id FROM users WHERE email = 'demo@aurabeauty.com'"))
        if not existing_user.first():
            user = User(
                email="demo@aurabeauty.com",
                hashed_password=get_password_hash("demo1234"),
                full_name="Demo User",
                role="admin"
            )
            db.add(user)

        print("Generating 500 customers...")
        customers = []
        tags_options = ['VIP', 'Churn Risk', 'New', 'Frequent Buyer', 'Discount Seeker']
        
        for _ in range(500):
            cust = Customer(
                name=fake.name(),
                email=fake.unique.email(),
                phone=fake.phone_number(),
                city=fake.city(),
                tags=random.sample(tags_options, k=random.randint(0, 3)),
            )
            db.add(cust)
            customers.append(cust)
        await db.commit()

        print("Generating 2,000 orders...")
        for _ in range(2000):
            cust = random.choice(customers)
            amount = round(random.uniform(500, 15000), 2)
            order = Order(
                customer_id=cust.id,
                amount=amount,
                status=random.choices(['completed', 'refunded', 'cancelled'], weights=[85, 10, 5])[0],
                channel=random.choice(['web', 'app', 'store']),
                ordered_at=fake.date_time_between(start_date='-1y', end_date='now')
            )
            db.add(order)
        await db.commit()

        print("Recomputing customer stats...")
        await db.execute(text("""
            UPDATE customers
            SET total_spent = COALESCE(o.total, 0),
                order_count = COALESCE(o.count, 0),
                last_order_at = o.last_order
            FROM (
                SELECT customer_id, SUM(amount) as total, COUNT(id) as count, MAX(ordered_at) as last_order
                FROM orders
                WHERE status = 'completed'
                GROUP BY customer_id
            ) o
            WHERE customers.id = o.customer_id
        """))
        await db.commit()

        print("Creating segments...")
        s1 = Segment(
            name="VIP Customers", 
            description="Spent over 10000", 
            filter_rules={"field": "total_spent", "operator": ">=", "value": 10000},
            audience_size=150
        )
        s2 = Segment(
            name="Mumbai Customers", 
            description="From Mumbai", 
            filter_rules={"field": "city", "operator": "==", "value": "Mumbai"},
            audience_size=80
        )
        s3 = Segment(
            name="Churn Risk", 
            description="Has Churn Risk tag", 
            filter_rules={"field": "tags", "operator": "contains", "value": "Churn Risk"},
            audience_size=40
        )
        db.add_all([s1, s2, s3])
        await db.commit()

        print("Creating campaigns and logs...")
        c1 = Campaign(
            name="VIP Promo", 
            segment_id=s1.id, 
            channel="email", 
            message_template="Hi {{name}}, here is your VIP discount!", 
            status="completed"
        )
        c2 = Campaign(
            name="Mumbai Store Launch", 
            segment_id=s2.id, 
            channel="sms", 
            message_template="Visit our new Mumbai store, {{name}}!", 
            status="completed"
        )
        db.add_all([c1, c2])
        await db.commit()

        print("Creating communication logs...")
        statuses = ['sent', 'delivered', 'opened', 'clicked', 'converted', 'failed']
        weights = [10, 40, 20, 10, 5, 5]
        
        # VIP promo (email logs)
        for i, c in enumerate(random.sample(customers, min(150, len(customers)))):
            status = random.choices(statuses, weights=weights)[0]
            log = CommunicationLog(
                campaign_id=c1.id,
                customer_id=c.id,
                channel="email",
                message_body=f"Hi {c.name}, here is your VIP discount!",
                status=status,
                idempotency_key=f"vip_promo_{c.id}_{i}",
                sent_at=fake.date_time_between(start_date='-10d', end_date='now'),
            )
            if status in ['delivered', 'opened', 'clicked', 'converted']:
                log.delivered_at = fake.date_time_between(start_date='-10d', end_date='now')
            if status in ['opened', 'clicked', 'converted']:
                log.opened_at = fake.date_time_between(start_date='-10d', end_date='now')
            if status in ['clicked', 'converted']:
                log.clicked_at = fake.date_time_between(start_date='-10d', end_date='now')
            if status == 'converted':
                log.converted_at = fake.date_time_between(start_date='-10d', end_date='now')
            db.add(log)

        # Mumbai Store (sms logs)
        for i, c in enumerate(random.sample(customers, min(80, len(customers)))):
            status = random.choices(statuses, weights=weights)[0]
            log = CommunicationLog(
                campaign_id=c2.id,
                customer_id=c.id,
                channel="sms",
                message_body=f"Visit our new Mumbai store, {c.name}!",
                status=status,
                idempotency_key=f"mumbai_store_{c.id}_{i}",
                sent_at=fake.date_time_between(start_date='-5d', end_date='now'),
            )
            if status in ['delivered', 'opened', 'clicked', 'converted']:
                log.delivered_at = fake.date_time_between(start_date='-5d', end_date='now')
            db.add(log)

        await db.commit()
        print("Database seeded successfully!")

async def main():
    await seed_data()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
