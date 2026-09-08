#!/bin/sh
# Wait for PostgreSQL to be ready
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "Waiting for database at $DB_HOST:$DB_PORT..."
  sleep 2
done
echo "Database is ready!"