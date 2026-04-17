import psycopg2

conn = psycopg2.connect(
    "postgresql://neondb_owner:npg_jSTDn08loPFx@ep-flat-dew-ancpuyq8-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

cur = conn.cursor()
cur.execute("SELECT * FROM plans;")

print(cur.fetchall())

conn.close()