# Deploying to cPanel

The app is a Node.js server with a PostgreSQL database. On cPanel it runs through
**Setup Node.js App**; the database is created in **PostgreSQL Databases**.

The app is served at `pay.hedefliseyi.edu.az` (cPanel → **Domains**).

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
| Node.js version     | the highest offered — **must be 18+** (the form defaults to 10, which won't work) |
| Application mode    | **Production**                          |
| Application root    | `hadaf-payments`                        |
| Application URL     | `pay.hedefliseyi.edu.az`                    |
| Startup file        | `dist/index.js`                         |

Under **Environment variables** add:

| Name           | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| `DATABASE_URL` | the connection string from step 2                              |
| `JWT_SECRET`   | a random string, at least 32 characters (see below)            |
| `APP_BASE_URL` | `https://pay.hedefliseyi.edu.az`                                   |
| `EPOINT_MODE`  | `sandbox` (online payments stay off until you have Epoint keys) |
| `NODE_OPTIONS` | `--disable-wasm-trap-handler` (see "When something goes wrong") |
| `TOKIO_WORKER_THREADS` | `2` (the host caps threads; more makes database calls hang) |
| `MALLOC_ARENA_MAX` | `2` |

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

Open `https://pay.hedefliseyi.edu.az` and sign in with that email and password. Then
add campaigns and managers from the admin screens.

If your cPanel has **Terminal**, steps 2–3 can be done there instead. Copy the
"Enter to the virtual environment" command shown at the top of the app's page,
run it, then:

```bash
export NODE_OPTIONS=--disable-wasm-trap-handler
npm run migrate
npm run create-admin -- --email you@example.com --password 'YourLongPassword'
```

`create-admin` can be run again later to reset that account's password.

**Never run `npm run seed` on the server.** It deletes all data and creates demo
accounts; it refuses to run in production mode anyway.

## Updating to a new version (git — recommended)

After a one-time switch, an update is: `git push` on your computer, then one
command on the server.

### One-time switch

1. In cPanel **Terminal**, clone the repository into your home folder:
   ```bash
   cd ~ && git clone https://github.com/NijatSadigov/Payment-Management-System.git
   ```
2. **Setup Node.js App** → pencil icon → change **Application root** to
   `Payment-Management-System/backend` → **SAVE**. The environment variables and
   the database stay as they are.
   If the field can't be edited: copy down all environment variables, **Destroy**
   the app, and create it again with that root, the same settings as in step 4,
   and the same variables.
3. Run the update script once (it installs, builds, migrates and restarts):
   ```bash
   bash ~/Payment-Management-System/backend/deploy.sh
   ```
4. Check the site works, then delete the old `hadaf-payments` folder in File
   Manager.

### Every update after that

1. On your computer: commit and `git push`.
2. On the server, in **Terminal**:
   ```bash
   bash ~/Payment-Management-System/backend/deploy.sh
   ```
   It ends with `Deployed <commit>`. If a step fails, it stops there and the
   running site keeps the previous version until the restart step.

## Updating with a zip (if git isn't set up)

1. `npm run package` on your computer.
2. **Stop App**, upload the new zip into the application root, **Extract** and
   overwrite, delete the zip.
3. In Terminal: `npm run migrate` (with the app's environment entered).
4. **Start App**.

## Turning on real online payments (Epoint)

Once Epoint gives you merchant keys:

1. Set `EPOINT_MODE=live`, `EPOINT_PUBLIC_KEY` and `EPOINT_PRIVATE_KEY`, then
   **Restart**.
2. In the Epoint merchant panel, set the result/callback URL to
   `https://pay.hedefliseyi.edu.az/api/epay/epoint-callback`.
3. Make a small real payment to check that it shows up as completed.

The live Epoint path has not been tested yet. Until it is turned on, customers can
still see their balance and history, and managers record cash payments as usual.

## When something goes wrong

- A Prisma command (e.g. `migrate`) sits forever with no output: the host's
  thread cap. `npm run migrate` sets `TOKIO_WORKER_THREADS=2` itself; for other
  commands set it (and `MALLOC_ARENA_MAX=2`) in the environment first.
- `P1001: Can't reach database server at localhost:5432`: PostgreSQL only listens
  on a local socket here. End `DATABASE_URL` with `&host=/var/run/postgresql`.
- `P1010 ... denied access`: in PostgreSQL Databases, add the user to the database
  and click **Synchronize Grants**. The username needs the `targetium_` prefix.

- `WebAssembly.Instance(): Out of memory` from Prisma: the host caps virtual
  memory, and Node reserves ~10 GB of it for WebAssembly by default. Node's
  `--disable-wasm-trap-handler` turns that off. The `migrate` and `postinstall`
  scripts pass it already; for anything else run
  `export NODE_OPTIONS=--disable-wasm-trap-handler` first. If the app itself
  complains that Prisma Client is not generated, run `npx prisma generate` with
  that set.

- The app writes its errors to `stderr.log` in the application root (File Manager).
- `Invalid production configuration: ...` means an environment variable from step 4
  is missing or wrong. The message names it.
- `permission denied for schema public` during `migrate`: ask the host's support to
  grant your database user `CREATE` on schema `public` of your database.
