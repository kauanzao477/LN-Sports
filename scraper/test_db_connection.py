import psycopg
import sys

sys.stdout.reconfigure(encoding='utf-8')

dsn = 'postgresql://postgres:kauan@localhost:5432/lnsports'
print(f"Connecting to: {dsn}")
try:
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(), current_user;")
            db, user = cur.fetchone()
            print(f"PostgreSQL acessível!")
            print(f"Banco atual: {db}")
            print(f"Usuário atual: {user}")

            cur.execute("SELECT COUNT(*) FROM products;")
            total = cur.fetchone()[0]
            print(f"Total de produtos no banco: {total}")

            cur.execute("SELECT COUNT(*) FROM products WHERE category = 'Tênis Esportivos';")
            total_tenis = cur.fetchone()[0]
            print(f"Total de produtos 'Tênis Esportivos': {total_tenis}")
except Exception as e:
    print(f"ERRO DE CONEXÃO: {e}")



