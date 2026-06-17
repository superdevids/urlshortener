# URL Shortener

A professional-grade URL Shortener application built with Next.js (App Router), TypeScript, and Tailwind CSS. This application supports both local JSON file storage and MySQL database storage, configurable via environment variables.

## Features

- **URL Shortening**: Create short URLs with custom aliases and optional expiration.
- **Redirection**: Redirects short URLs to their original long URLs, tracking click counts.
- **Dashboard**: Manage all created short URLs, view statistics, and delete links.
- **Analytics**: View click counts and last clicked timestamps for each short URL.
- **Configurable Storage**: Choose between JSON file storage (local, default) or MySQL database.
- **Security**: Input validation, URL sanitization, rate limiting, and protection against SQL injection.

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Zod for schema validation
- dotenv for configuration
- `mysql2` for MySQL interaction (or Prisma)
- `proper-lockfile` for JSON file concurrency safety

## Project Structure

The project follows a structured layout:

- `/app`: Contains Next.js App Router routes and pages.
  - `/api`: API routes for backend logic.
    - `/links`: For managing links (list, delete).
    - `/[id]`: For specific link operations.
    - `/[id]/stats`: For retrieving link statistics.
    - `/shorten`: Endpoint for creating new short links.
  - `/[shortCode]`: Dynamic route for redirecting short links.
  - `404.tsx`: Custom 404 error page.
- `/lib`: Core application logic.
  - `/storage`: Storage adapter implementations (JSON, MySQL).
    - `index.ts`: Repository factory.
    - `types.ts`: Repository interface and types.
    - `json-repository.ts`: JSON file storage implementation.
    - `mysql-repository.ts`: MySQL database storage implementation.
  - `validators.ts`: Zod schemas for input validation.
  - `rate-limit.ts`: Rate limiting implementation.
  - `short-code.ts`: Short code generation logic.
- `/types`: Shared TypeScript types.
- `/public`: Static assets.
- `/tests`: Unit tests.
- `/data`: Directory for storing the JSON database file (created automatically).
- `/migrations`: SQL migration scripts for MySQL.

## Environment Variables

Create a `.env.local` file in the root of the project based on the `.env.local.example` provided. Key variables include:

- `STORAGE_DRIVER`: `'json'` or `'mysql'` (defaults to `'json'`).
- `JSON_DB_PATH`: Path to the JSON database file (used when `STORAGE_DRIVER` is `'json'`).
- MySQL configuration variables (`MYSQL_HOST`, `MYSQL_PORT`, etc.) for when `STORAGE_DRIVER` is `'mysql'`.
- `NEXT_PUBLIC_BASE_URL`: The base URL for generated short links.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`: For API rate limiting.

## Setup and Running

### 1. Install Dependencies

```bash
npm install
```

### 2. JSON File Storage (Default)

1.  Ensure `STORAGE_DRIVER=json` in your `.env.local` file.
2.  Run the development server:

    ```bash
    npm run dev
    ```
3.  The application will automatically create the `./data/links.json` file if it doesn't exist.

### 3. MySQL Storage

1.  Ensure `STORAGE_DRIVER=mysql` in your `.env.local` file.
2.  Configure your MySQL connection details in `.env.local`.
3.  **Migrate the database**:

    ```bash
    npm run db:migrate
    ```
    *(This command assumes you have a script in `package.json` to run the SQL migration)*
4.  Run the development server:

    ```bash
    npm run dev
    ```

## Storage Driver Comparison

### JSON File Storage

*   **Pros**: Simple setup, no external database required, good for local development and small-scale deployments.
*   **Cons**:
    *   **Concurrency Issues**: Can lead to race conditions if not properly managed with file locking, especially under heavy load. The implementation uses `proper-lockfile` to mitigate this.
    *   **Scalability**: Not suitable for high-traffic or high-concurrency production environments.
    *   **Serverless Deployment**: **Not recommended for serverless platforms like Vercel** due to the ephemeral nature of the filesystem. Data can be lost on deploy or scale-up events.

### MySQL Storage

*   **Pros**: Robust, scalable, reliable for production environments, handles concurrency well with proper connection pooling. Recommended for serverless deployments.
*   **Cons**: Requires a separate database instance, slightly more complex setup.

### Recommendation

-   **Development & Small Scale**: JSON file storage is convenient.
-   **Production & Serverless (Vercel)**: MySQL storage is strongly recommended for reliability and scalability.

## Additional Notes

-   The `NEXT_PUBLIC_BASE_URL` environment variable must be set correctly for short links to function properly.
-   Rate limiting is implemented in-memory; for multi-instance deployments, consider a centralized solution like Redis.
