import os
from urllib.parse import quote_plus, unquote
from pymongo import MongoClient
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

_client = None
_db = None


def get_db():
    global _client, _db

    if _db is not None:
        return _db

    MONGO_URI = os.getenv("MDB_MCP_CONNECTION_STRING")
    MONGO_DB = os.getenv("MONGO_DB", "smart_grocery")

    #print(f"[DEBUG] Raw MONGO_URI from env: {repr(MONGO_URI)}")

    if not MONGO_URI:
        raise Exception("MDB_MCP_CONNECTION_STRING is not set")

    try:
        prefix = "mongodb+srv://"
        rest = MONGO_URI[len(prefix):]

        at_idx = rest.rfind("@")
        userinfo = rest[:at_idx]
        hostpart = rest[at_idx + 1:]

        colon_idx = userinfo.index(":")
        username = unquote(userinfo[:colon_idx])
        password = unquote(userinfo[colon_idx + 1:])

        encoded_uri = f"{prefix}{quote_plus(username)}:{quote_plus(password)}@{hostpart}"

    except Exception as e:
        print(f"URI parsing failed: {e}, using raw URI")
        encoded_uri = MONGO_URI

    _client = MongoClient(encoded_uri, serverSelectionTimeoutMS=5000)
    _db = _client[MONGO_DB]

    # optional: lightweight ping (safe to keep here)
    try:
        _client.admin.command("ping")
        print("✅ MongoDB connected successfully")
    except Exception as e:
        print("❌ MongoDB connection failed:", str(e))

    return _db