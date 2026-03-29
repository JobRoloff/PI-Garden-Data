import argparse
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

def run_sql_file_psycopg2(sql_file_path, db_params):
    """
    Executes a SQL file using psycopg2.

    Args:
        sql_file_path (str): The path to the .sql file.
        db_params (dict): A dictionary containing database connection parameters 
        (e.g., dbname, user, password, host, port).
    """
    conn = None
    cur = None
    try:
        # Connect to the database
        conn = psycopg2.connect(**db_params)
        cur = conn.cursor()

        # Open and read the SQL file
        with open(sql_file_path, "r", encoding="utf-8") as sql_file:
            sql_script = sql_file.read()

        # Execute the script
        cur.execute(sql_script)

        # Print rows for SELECT-style queries.
        if cur.description:
            rows = cur.fetchall()
            col_names = [desc[0] for desc in cur.description]
            print(" | ".join(col_names))
            for row in rows:
                print(" | ".join(str(value) for value in row))

        conn.commit()

        print(f"Successfully executed SQL file: {sql_file_path}")

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Error executing SQL file: {error}")
        if conn:
            conn.rollback()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def parse_args():
    parser = argparse.ArgumentParser(description="Run a SQL file with psycopg2.")
    parser.add_argument(
        "sql_file",
        nargs="?",
        default=str(Path(__file__).with_name("most_humid_hour.sql")),
        help="Path to the SQL file to execute.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Match the rest of the project: load .env from repo root and local dir.
    root = Path(__file__).resolve().parent.parent.parent
    for directory in (root, Path(__file__).resolve().parent):
        env_file = directory / ".env"
        if env_file.is_file():
            load_dotenv(env_file)
    load_dotenv()

    database_url = os.getenv("DATABASE_URL")
    if database_url:
        run_sql_file_psycopg2(args.sql_file, {"dsn": database_url})
    else:
        db_params = {
            "dbname": os.getenv("PGDATABASE", "app"),
            "user": os.getenv("PGUSER", "postgres"),
            "host": os.getenv("PGHOST", "127.0.0.1"),
            "port": int(os.getenv("PGPORT", "5432")),
        }
        password = os.getenv("PGPASSWORD")
        if password:
            db_params["password"] = password
        run_sql_file_psycopg2(args.sql_file, db_params)
