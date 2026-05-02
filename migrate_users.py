# migrate_users.py
import urllib.request
import urllib.parse
import json

URL = 'https://cdiwriptqmqnexxukqaf.supabase.co'
KEY = 'sb_publishable_vX6RQCfPpA14Pg9ZVgDrFg_l3jY7KVw'

ALL_PERMS = ["comparator","history","paletteValidator","development","assignment","reports","dashboard","backup","admin","linearization"]

USERS_TO_CONVERT = ['ARYANIE','BAEZ','EVALDIM','KEVIN','MARVINC','NICOLE.NUÑEZ09']

body = json.dumps({"is_master": False, "permisos": ALL_PERMS}).encode('utf-8')

for username in USERS_TO_CONVERT:
    encoded = urllib.parse.quote(username)
    uri = f"{URL}/rest/v1/usuarios?username=eq.{encoded}"
    req = urllib.request.Request(
        uri,
        data=body,
        method='PATCH',
        headers={
            'apikey': KEY,
            'Authorization': f'Bearer {KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"OK: {username} -> HTTP {resp.status}")
    except Exception as e:
        print(f"ERROR: {username} -> {e}")

print("\nMigracion completada.")
