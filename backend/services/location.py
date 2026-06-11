import requests


# =====================================================
# USER LOCATION VIA IP
# =====================================================

def get_user_location(user_lat: float = None, user_lng: float = None) -> dict:
    """
    Returns user location. Prefers browser-supplied coordinates (accurate)
    over IP-based detection (inaccurate on Cloud Run — resolves to server IP).
    Falls back to Saint Louis, MO if all methods fail.
    """

    # ── Browser GPS (most accurate — use when frontend sends it) ──
    if user_lat is not None and user_lng is not None:
        try:
            response = requests.get(
                f"https://nominatim.openstreetmap.org/reverse"
                f"?lat={user_lat}&lon={user_lng}&format=json",
                headers={"User-Agent": "SmartCartAI/1.0"},
                timeout=5
            )
            response.raise_for_status()
            data = response.json()
            addr = data.get("address", {})
            return {
                "lat":     user_lat,
                "lng":     user_lng,
                "city":    addr.get("city") or addr.get("town") or addr.get("village") or "Unknown",
                "region":  addr.get("state", "Unknown"),
                "country": addr.get("country_code", "US").upper(),
            }
        except Exception as e:
            print(f"[location] Reverse geocode failed: {e}. Falling through to IP lookup.")

    # ── IP-based fallback (unreliable on Cloud Run) ──
    try:
        response = requests.get("https://ipinfo.io/json", timeout=5)
        response.raise_for_status()
        data = response.json()
        loc = data.get("loc", "")
        if not loc or "," not in loc:
            raise ValueError(f"Missing or malformed 'loc' field: {loc!r}")
        lat, lng = loc.split(",")
        return {
            "lat":     float(lat),
            "lng":     float(lng),
            "city":    data.get("city",    "Unknown"),
            "region":  data.get("region",  "Unknown"),
            "country": data.get("country", "Unknown"),
        }
    except Exception as e:
        print(f"[location] Could not detect location: {e}. Using default.")

    # ── Hard fallback ──
    return {
        "lat": 38.6270, "lng": -90.1994,
        "city": "Saint Louis", "region": "Missouri", "country": "US",
    }


# =====================================================
# TEST
# =====================================================

if __name__ == "__main__":
    import json
    print(json.dumps(get_user_location(), indent=2))
