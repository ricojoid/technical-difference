# Implementation Plan: Direct Database Schema Compare via SQL Server Connection Strings

This plan modifies the database comparison feature to accept Microsoft SQL Server (and SQLite/MySQL/PostgreSQL) connection strings directly, connect dynamically to retrieve table metadata, and perform gap analysis.

## Proposed Changes

### Backend

---

#### [MODIFY] [reviewer.py](file:///c:/Users/ricoji/OneDrive%20-%20FUJITSU/Documents/OCIR/Vibe%20Coding/Code%20Reviewer/backend/reviewer.py)
* Add SQL Server connection and metadata retrieval logic:
  - `get_mssql_schema(conn_str: str) -> Dict[str, Any]`: Parses `mssql://username:password@host:port/database` connection strings, connects using `pymssql`, queries metadata tables (`INFORMATION_SCHEMA` and `sys.indexes` for primary keys), and outputs table definitions.
  - Expose support for MySQL, PostgreSQL, and SQLite connection strings as fallback database types.
* Update `compare_database_schemas` method to use this live connection logic.

---

#### [MODIFY] [main.py](file:///c:/Users/ricoji/OneDrive%20-%20FUJITSU/Documents/OCIR/Vibe%20Coding/Code%20Reviewer/backend/main.py)
* Expose updated endpoints accepting connection strings.

---

### Frontend

---

#### [MODIFY] [App.tsx](file:///c:/Users/ricoji/OneDrive%20-%20FUJITSU/Documents/OCIR/Vibe%20Coding/Code%20Reviewer/frontend/src/App.tsx)
* Update database compare view inputs to request connection strings.
* Update sample loader to load SQL Server sample connection string configurations.

---

## Design and Technical Notes

> [!IMPORTANT]
> **MS SQL Server Driver**:
> We will install `pymssql` in the Python virtual environment. It is a lightweight, pure Python-compatible database adapter that includes its own FreeTDS compilation, meaning it does NOT require system-level Microsoft ODBC drivers to be pre-installed on the machine.

---

## Verification Plan

### Automated Tests
- Run `pip install pymssql`.
- Run FastAPI backend and test the SQL Server connection string parsing.
