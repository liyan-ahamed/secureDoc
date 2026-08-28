# SecureDoc

A robust document management system built with React, Node.js, and PostgreSQL.

## Running with Docker

SecureDoc is fully containerized. You can run the entire stack (PostgreSQL, Redis, Backend, Frontend) with a single command:

```bash
docker compose up --build
```

**Note:** The backend container will automatically run database migrations on startup before the server begins listening.

- The Frontend will be available at `http://localhost:5173`
- The Backend API will be available at `http://localhost:5000`
