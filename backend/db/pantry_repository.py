from datetime import datetime
from backend.db.mongo_client import get_db

db = get_db()
pantry_collection = db["pantry"]

if pantry_collection is None:
    raise RuntimeError("MongoDB not configured")


# -----------------------------------
# CREATE / REPLACE PANTRY
# -----------------------------------

def save_pantry(user_id: str, items: list) -> dict:
    db = get_db()
    result = db.pantry.update_one(
        {"user_id": user_id},
        {"$set": {"items": items}},
        upsert=True
    )
    print(f"Updated pantry: {result.modified_count}")
    return {"user_id": user_id, "items": items, "updated": result.modified_count}


# -----------------------------------
# GET PANTRY
# -----------------------------------

def get_pantry(user_id: str) -> list[str]:
    """
    Returns pantry items for user
    """

    doc = pantry_collection.find_one(
        {"user_id": user_id}
    )

    if not doc:
        return []

    return doc.get("items", [])


# -----------------------------------
# ADD ITEMS
# -----------------------------------

def add_items(user_id: str, new_items: list[str]):
    """
    Add new pantry items
    """

    current = get_pantry(user_id)

    merged = list(
        set(
            [x.lower() for x in current]
            +
            [x.lower() for x in new_items]
        )
    )

    save_pantry(user_id, merged)

    return merged


# -----------------------------------
# REMOVE ITEMS
# -----------------------------------

def remove_items(user_id: str, items_to_remove: list[str]):
    """
    Remove specific items from pantry
    """

    current = get_pantry(user_id)

    updated = [
        item
        for item in current
        if item.lower() not in [x.lower() for x in items_to_remove]
    ]

    save_pantry(user_id, updated)

    return {
        "updated": updated,
        "removed": items_to_remove
    }


# -----------------------------------
# CLEAR PANTRY
# -----------------------------------

def clear_pantry(user_id: str):

    pantry_collection.delete_one(
        {"user_id": user_id}
    )


# -----------------------------------
# DEBUG
# -----------------------------------

if __name__ == "__main__":

    USER = "demo_user"

    save_pantry(
        USER,
        ["rice", "salt", "olive oil"]
    )

    print("Pantry:")
    print(get_pantry(USER))

    add_items(
        USER,
        ["garlic", "onion"]
    )

    print("After Add:")
    print(get_pantry(USER))

    remove_items(
        USER,
        ["salt"]
    )

    print("After Remove:")
    print(get_pantry(USER))