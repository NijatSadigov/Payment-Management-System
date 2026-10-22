# Deploying to cPanel

The app is a Node.js server with a PostgreSQL database. On cPanel it runs through
**Setup Node.js App**; the database is created in **PostgreSQL Databases**.

The examples below use `pay.hedefliseyi.az` — use the subdomain you actually have
(cPanel → **Domains**).

## 1. Build the upload package (on your computer)

```bash
cd backend
npm run package
```

This creates `hadaf-payments-deploy.zip` in the project root: the compiled app,
the web pages and the database migrations. It does **not** contain `node_modules`
or your `.env`.

## 2. Create the database

cPanel → **PostgreSQL Databases**:

1. **Create New Database**, e.g. `payments`. cPanel adds your account prefix, so
   the real name is something like `targetium_payments`.
2. **Add New User**, e.g. `payuser` → `targetium_payuser`. Use a long password made
   of **letters and digits only** (symbols would need escaping in the URL below).
3. **Add User to Database**: pick that user and database, grant **ALL privileges**.

Your connection string is then:

```
postgresql://targetium_payuser:PASSWORD@localhost:5432/targetium_payments?schema=public
```

## 3. Turn on HTTPS for the subdomain

cPanel → **SSL/TLS Status** → tick the subdomain → **Run AutoSSL**. Wait until it
shows a valid certificate.

## 4. Create the Node.js application

cPanel → **Setup Node.js App** → **Create Application**:

| Field               | Value                                   |
| ------------------- | --------------------------------------- |
| Node.js version     | the highest offered (18 or newer)       |
| Application mode    | **Production**                          |
| Application root    | `hadaf-payments`                        |
| Application URL     | `pay.hedefliseyi.az`                    |
| Startup file        | `dist/index.js`                         |

Under **Environment variables** add:

| Name           | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| `DATABASE_URL` | the connection string from step 2                              |
| `JWT_SECRET`   | a random string, at least 32 characters (see below)            |
| `APP_BASE_URL` | `https://pay.hedefliseyi.az`                                   |
| `EPOINT_MODE`  | `sandbox` (online payments stay off until you have Epoint keys) |

Make a `JWT_SECRET` on your computer with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Click **Create**, then **Stop App** for now.

## 5. Upload the files

cPanel → **File Manager** → open the `hadaf-payments` folder (the application
root) → **Upload** `hadaf-payments-deploy.zip` → right-click it → **Extract**.

`package.json`, `dist/`, `public/` and `prisma/` must sit directly inside
`hadaf-payments/` (not in a sub-folder). Delete the zip afterwards.

## 6. Install, set up the database, create your admin

Back in **Setup Node.js App** → edit the application:

1. **Run NPM Install** and wait for it to finish.
2. **Run JS script** → `migrate`. This creates the tables.
3. Add two temporary environment variables, `ADMIN_EMAIL` and `ADMIN_PASSWORD`
   (at least 10 characters), **Save**, then **Run JS script** → `create-admin`.
4. **Delete** `ADMIN_EMAIL` and `ADMIN_PASSWORD` again and **Save**.
5. **Start App** (or **Restart**).

Open `https://pay.hedefliseyi.az` and sign in with that email and password. Then
add campaigns and managers from the admin screens.

If your cPanel has **Terminal**, steps 2–3 can be done there instead. Copy the
"Enter to the virtual environment" command shown at the top of the app's page,
run it, then:

```bash
npm run migrate
npm run create-admin -- --email you@example.com --password 'YourLongPassword'
```

`create-admin` can be run again later to reset that account's password.

**Never run `npm run seed` on the server.** It deletes all data and creates demo
accounts; it refuses to run in production mode anyway.

## Updating to a new version

1. `npm run package` on your computer.
2. **Stop App**, upload the new zip into `hadaf-payments/`, **Extract** and
   overwrite, delete the zip.
3. **Run NPM Install** (only needed if dependencies changed), then **Run JS
   script** → `migrate`.
4. **Start App**.

## Turning on real online payments (Epoint)

Once Epoint gives you merchant keys:

1. Set `EPOINT_MODE=live`, `EPOINT_PUBLIC_KEY` and `EPOINT_PRIVATE_KEY`, then
   **Restart**.
2. In the Epoint merchant panel, set the result/callback URL to
   `https://pay.hedefliseyi.az/api/epay/epoint-callback`.
3. Make a small real payment to check that it shows up as completed.

The live Epoint path has not been tested yet. Until it is turned on, customers can
still see their balance and history, and managers record cash payments as usual.

## When something goes wrong

- The app writes its errors to `stderr.log` in the application root (File Manager).
- `Invalid production configuration: ...` means an environment variable from step 4
  is missing or wrong. The message names it.
- `permission denied for schema public` during `migrate`: ask the host's support to
  grant your database user `CREATE` on schema `public` of your database.
