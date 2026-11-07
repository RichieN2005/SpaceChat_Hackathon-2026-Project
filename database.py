import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set.")
    
    try:
        conn = psycopg.connect(database_url)
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        raise