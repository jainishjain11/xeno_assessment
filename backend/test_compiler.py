import asyncio
import json
from app.utils.filter_compiler import build_segment_query
from sqlalchemy.dialects import postgresql

rules_examples = [
    {
        "name": "High Spenders in Mumbai",
        "rules": {
            "operator": "AND",
            "rules": [
                {"field": "total_spent", "op": "gte", "value": 10000},
                {"field": "city", "op": "eq", "value": "Mumbai"}
            ]
        }
    },
    {
        "name": "Lapsed Customers",
        "rules": {
            "operator": "AND",
            "rules": [
                {"field": "last_order_at", "op": "lt", "value": "NOW() - INTERVAL '3 months'"}
            ]
        }
    },
    {
        "name": "VIP OR Frequent Buyers",
        "rules": {
            "operator": "OR",
            "rules": [
                {"field": "tags", "op": "contains", "value": "VIP"},
                {"field": "order_count", "op": "gte", "value": 10}
            ]
        }
    },
    {
        "name": "Recent Signup without Orders",
        "rules": {
            "operator": "AND",
            "rules": [
                {"field": "created_at", "op": "gte", "value": "NOW() - INTERVAL '7 days'"},
                {"field": "order_count", "op": "eq", "value": 0}
            ]
        }
    },
    {
        "name": "Complex Churn Risk",
        "rules": {
            "operator": "AND",
            "rules": [
                {
                    "operator": "OR",
                    "rules": [
                        {"field": "tags", "op": "contains", "value": "Churn Risk"},
                        {"field": "last_order_at", "op": "lt", "value": "NOW() - INTERVAL '6 months'"}
                    ]
                },
                {"field": "total_spent", "op": "gt", "value": 500}
            ]
        }
    }
]

for example in rules_examples:
    query = build_segment_query(example["rules"])
    sql = str(query.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    print(f"### {example['name']}")
    print("**Rule JSON:**")
    print("```json")
    print(json.dumps(example['rules'], indent=2))
    print("```")
    print("**Compiled SQL:**")
    print("```sql")
    print(sql)
    print("```\n")
