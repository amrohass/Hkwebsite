# HK Technologies — Website + CMS (Supabase + Namecheap cPanel)

Your website as plain **HTML + CSS + JavaScript**, with a small **content manager
(CMS)** and a cloud **database (Supabase)** so you can edit, add and remove
everything without touching code — and deploy it on **Namecheap cPanel**.

```
hk-cms/
├── server.js              ← the small web server (Node.js)
├── db.js                  ← talks to Supabase + seeds first-run content
├── supabase-setup.sql     ← run this once in Supabase to create the tables
├── .env.example           ← template for your secret keys
├── package.json
└── public/
    ├── index.html         ← the WEBSITE
    ├── styles.css         ← the WEBSITE styling
    ├── script.js          ← the WEBSITE logic
    ├── admin.html / .css / .js   ← the CONTENT MANAGER
    └── assets/            ← all images
```

---

## ⚡ FIRST: fix the `npm` error you saw

The error *“npm.ps1 cannot be loaded because running scripts is disabled”* is a
Windows PowerShell security setting — not a problem with your project. Fix it once:

1. Open **PowerShell** (no need for admin).
2. Paste this and press Enter:

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

3. When asked, type **Y** and press Enter.

Now `npm install` and `npm start` will work normally. (This is safe and only
affects your own user account.)

---

# PART A — Set up Supabase (your database)

You do this once.

1. Go to **https://supabase.com** → **Start your project** → sign in (GitHub or email).
2. Click **New project**.
   - **Name:** `hk-technologies`
   - **Database password:** click *Generate*, then **save it somewhere** (you may
     need it later).
   - **Region:** pick the one closest to your visitors.
   - Click **Create new project** and wait ~1 minute while it sets up.
3. **Create the tables:** in the left menu open **SQL Editor** → **New query**.
   Open the file `supabase-setup.sql` from this project, copy **all** of it, paste
   it into the editor, and click **Run**. You should see “Success”.
4. **Get your two keys:** left menu → **Project Settings** (gear icon).
   - **Project URL:** under **Data API** → copy **Project URL**
     (looks like `https://abcdefgh.supabase.co`).
   - **Service role key:** under **API Keys** → reveal and copy the **`service_role`**
     key (a long string). **Keep this secret** — it has full database access.

You now have the two values you’ll plug in everywhere: `SUPABASE_URL` and
`SUPABASE_SERVICE_KEY`.

---

# PART B — Run it on your computer (test before deploying)

### 1. Install Node.js (one time)
If `node --version` doesn’t work in PowerShell, install the **LTS** version from
**https://nodejs.org**, then restart PowerShell.

### 2. Open the project folder
```powershell
cd "c:\Users\palin\OneDrive\Desktop\amro\HK TECH\HK_Technologies-main\hk-cms"
```

### 3. Create your `.env` file
Make a copy of `.env.example` named exactly **`.env`**:
```powershell
Copy-Item .env.example .env
```
Open `.env` in Notepad and fill in the two values from Part A:
```
SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
SUPABASE_SERVICE_KEY=your-long-service-role-key
PORT=3000
```
Save and close.

### 4. Install and start
```powershell
npm install
npm start
```
The first start automatically fills Supabase with your current website content.
You’ll see:
```
  HK Technologies CMS is running!
  ▸ Website:  http://localhost:3000/
  ▸ Admin:    http://localhost:3000/admin.html
```
Leave that window open while testing.

### 5. Open it
- **Website:** http://localhost:3000/
- **Content manager:** http://localhost:3000/admin.html
- **Default password:** `admin123` — change it right away via **Change password**.

To stop the server: click the PowerShell window and press **Ctrl + C**.

---

# PART C — Deploy to Namecheap cPanel

> **Requirement:** your Namecheap plan must support Node.js. In cPanel, look for an
> icon called **“Setup Node.js App”** (under *Software*). Stellar / Stellar Plus /
> Stellar Business shared plans have it. If you don’t see it, contact Namecheap
> support to confirm Node.js is enabled on your plan.

Because the database is Supabase (in the cloud), your hosting only needs to run the
small Node server — there’s nothing to compile.

### Step 1 — Prepare the files to upload
On your computer, make a ZIP of the project **without** `node_modules` and `.env`
(cPanel rebuilds those):
```powershell
cd "c:\Users\palin\OneDrive\Desktop\amro\HK TECH\HK_Technologies-main"
Compress-Archive -Path "hk-cms\*" -DestinationPath "hk-cms.zip" -Force
```
> Tip: if `hk-cms.zip` ends up huge, delete the local `hk-cms\node_modules` folder
> first, then run the command again. You don’t need it for the upload.

### Step 2 — Upload and extract
1. Log into **cPanel** (e.g. `https://yourdomain.com/cpanel`).
2. Open **File Manager** → go to your home folder (the one *above* `public_html`).
3. Create a folder named **`hk-cms`** and open it.
4. Click **Upload**, choose `hk-cms.zip`, wait for it to finish.
5. Back in File Manager, right-click `hk-cms.zip` → **Extract** into `hk-cms`.
   You should now see `server.js`, `db.js`, `public/`, etc. Delete the ZIP.

### Step 3 — Create the Node.js application
1. In cPanel open **Setup Node.js App** → **Create Application**.
2. Fill in:
   - **Node.js version:** the highest available (e.g. 20.x).
   - **Application mode:** `Production`
   - **Application root:** `hk-cms`
   - **Application URL:** choose your domain (or a subdomain like `hk.yourdomain.com`).
   - **Application startup file:** `server.js`
3. Click **Create**.

### Step 4 — Add your Supabase keys (Environment Variables)
On the same application screen, find **Environment variables** → **Add Variable**,
and add these two (do **not** add PORT — cPanel manages it):

| Name | Value |
|------|-------|
| `SUPABASE_URL` | your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | your Supabase service_role key |

Click **Save**.

### Step 5 — Install dependencies and start
1. On the application screen click **Run NPM Install** (wait for it to finish).
2. Click **Restart** (or **Start**).

### Step 6 — Visit your site
- **Website:** your Application URL (e.g. `https://yourdomain.com/`)
- **Content manager:** add `/admin.html` (e.g. `https://yourdomain.com/admin.html`)
- Sign in with `admin123` and **change the password immediately**.

That’s it — your site is live, backed by Supabase. 🎉

---

## Editing content (local or live, same steps)
1. Open `…/admin.html` and sign in.
2. Pick a section in the left menu.
3. **Text sections:** edit fields → **Save changes**.
4. **Products / Services / Testimonials:** **+ Add new**, **Edit**, or **Delete**;
   change the **Sort order** number to reorder (lower shows first).
5. **Images:** **⬆ Upload image** to upload from your computer, or paste a path.
6. Refresh the website to see changes — they’re saved in Supabase instantly.

**Highlighting in headings:** wrap a phrase like
`Products shaping <span class="text-gradient">real industries</span>`; use `<br />`
for a line break.

---

## Good to know

- **Where is my data?** In your Supabase project (Table Editor → `settings`,
  `products`, `services`, `testimonials`). Editing content never requires
  re-deploying — only code changes do.
- **Uploaded images** are stored on the server in `public/assets/uploads/`.
- **Reset to original content:** delete the rows from the four tables in Supabase
  (or drop & re-run `supabase-setup.sql`), then restart the app — it re-seeds.
- **Security:** the `service_role` key lives only on the server (env variables) and
  is never sent to the browser. Keep it secret; never paste it into the website
  files.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| `npm.ps1 cannot be loaded` | Run the `Set-ExecutionPolicy` command at the top of this file. |
| App exits: *Missing SUPABASE_URL…* | Your `.env` (local) or Environment Variables (cPanel) are missing/empty. |
| *Could not reach Supabase. Did you run supabase-setup.sql?* | Run `supabase-setup.sql` in the Supabase SQL Editor (Part A, step 3). |
| Site loads but is blank | Open the browser console (F12). Usually the keys are wrong, or the tables weren’t created. |
| No **Setup Node.js App** in cPanel | Your plan doesn’t have Node.js — ask Namecheap support to enable it, or upgrade. |
| Changed code, site unchanged | In cPanel **Setup Node.js App**, click **Restart**. |
