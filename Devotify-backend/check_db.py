import sqlite3

conn = sqlite3.connect("devotify.db")
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", cursor.fetchall())

for table in ["voter_registrations", "votes", "results_revealed"]:
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    print(f"{table}: {len(rows)} rows")

conn.close()