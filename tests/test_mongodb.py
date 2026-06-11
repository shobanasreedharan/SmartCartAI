from backend.db.mongo_client import get_db

if __name__ == "__main__":
    db = get_db()
    print(db.list_collection_names())