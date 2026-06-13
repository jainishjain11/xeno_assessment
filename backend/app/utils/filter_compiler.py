from typing import Any
from sqlalchemy import and_, or_, ColumnElement, text
from app.models import Customer

ALLOWED_FIELDS = {
    "total_spent": getattr(Customer, "total_spent"),
    "order_count": getattr(Customer, "order_count"),
    "last_order_at": getattr(Customer, "last_order_at"),
    "created_at": getattr(Customer, "created_at"),
    "city": getattr(Customer, "city"),
    "tags": getattr(Customer, "tags")
}

ALLOWED_OPERATORS = {
    "eq", "neq", "gt", "gte", "lt", "lte", "contains", "not_contains", 
    "in", "not_in", "is_null", "is_not_null"
}

def parse_value(val: Any) -> Any:
    if isinstance(val, str) and val.upper().startswith("NOW()"):
        return text(val)
    return val

def validate_rules(rules: dict) -> list[str]:
    errors = []
    
    op = rules.get("operator")
    if op in ("AND", "OR", "and", "or"):
        if "rules" not in rules or not isinstance(rules["rules"], list):
            errors.append(f"Operator {op} requires a list of 'rules'.")
        else:
            for r in rules["rules"]:
                errors.extend(validate_rules(r))
        return errors
        
    field = rules.get("field")
    rule_op = rules.get("op") or rules.get("operator")
    
    if not field or field not in ALLOWED_FIELDS:
        errors.append(f"Invalid field: {field}")
    if not rule_op or rule_op not in ALLOWED_OPERATORS:
        errors.append(f"Invalid operator: {rule_op}")
        
    return errors

def compile_rules(rules: dict) -> list[ColumnElement]:
    op = rules.get("operator")
    
    if op in ("AND", "and"):
        conditions = []
        for r in rules.get("rules", []):
            conditions.extend(compile_rules(r))
        return [and_(*conditions)] if conditions else []
        
    if op in ("OR", "or"):
        conditions = []
        for r in rules.get("rules", []):
            compiled = compile_rules(r)
            if compiled:
                # 'compiled' is a list of ColumnElements, we need to AND them together if there's multiple,
                # because inner rules of an OR are treated as individual composite conditions.
                conditions.append(and_(*compiled) if len(compiled) > 1 else compiled[0])
        return [or_(*conditions)] if conditions else []
        
    field_name = rules.get("field")
    rule_op = rules.get("op") or rules.get("operator")
    value = parse_value(rules.get("value"))
    
    if not field_name or field_name not in ALLOWED_FIELDS:
        return []
        
    column = ALLOWED_FIELDS[field_name]
    
    if field_name == "tags":
        if rule_op == "contains":
            val_list = value if isinstance(value, list) else [value]
            return [column.contains(val_list)]
        elif rule_op == "not_contains":
            val_list = value if isinstance(value, list) else [value]
            return [~column.contains(val_list)]

    if rule_op == "eq":
        return [column == value]
    elif rule_op == "neq":
        return [column != value]
    elif rule_op == "gt":
        return [column > value]
    elif rule_op == "gte":
        return [column >= value]
    elif rule_op == "lt":
        return [column < value]
    elif rule_op == "lte":
        return [column <= value]
    elif rule_op == "contains":
        return [column.ilike(f"%{value}%")]
    elif rule_op == "not_contains":
        return [~column.ilike(f"%{value}%")]
    elif rule_op == "in":
        val_list = value if isinstance(value, list) else [value]
        return [column.in_(val_list)]
    elif rule_op == "not_in":
        val_list = value if isinstance(value, list) else [value]
        return [column.not_in(val_list)]
    elif rule_op == "is_null":
        return [column.is_(None)]
    elif rule_op == "is_not_null":
        return [column.is_not(None)]
        
    return []

def build_segment_query(rules: dict):
    from sqlalchemy import select
    query = select(Customer)
    
    if not rules:
        return query
        
    conditions = compile_rules(rules)
    if conditions:
        query = query.where(and_(*conditions))
    return query
