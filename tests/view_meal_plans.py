from backend.db.mongo_client import get_db
db = get_db()
for doc in db["meal_plans"].find():
    print(doc)