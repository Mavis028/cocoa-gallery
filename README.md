# Cocoa Gallery — website + dashboard

- `index.html` — the shop website (rings showcase, bonbon layers, collection, box builder with order form)
- `admin.html` — the shop dashboard: Overview (orders, sales, visits, top flavours), Orders (change status), Products (names, text, stock, photos, box sizes & prices)
- `config.js` — the only file you edit to connect the database
- `data.js` — shared code that talks to the database
- `supabase-setup.sql` — creates the database tables and security rules

## Demo mode (works right away)
With `config.js` left empty, everything is saved only in your own browser. Open `admin.html` and press **Fill with sample data** to try it.

## Go live with a free Supabase database (about 10 minutes)
1. Create a free account at supabase.com → **New project** (choose a region close to Egypt, e.g. Frankfurt).
2. **SQL Editor → New query** → paste all of `supabase-setup.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up" (so no one else can create an account).
4. **Authentication → Users → Add user**: your email + a strong password.
5. Back in **SQL Editor**, run (with your email):
   `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`
6. **Project Settings → API**: copy **Project URL** and the **anon public** key into `config.js`.
7. Push to GitHub. Open `https://<your-site>/admin.html`, sign in, and press **Add the 11 bonbons from the website** on the Products tab.

The anon key is meant to be public; the security rules in `supabase-setup.sql` make sure visitors can only place orders and record visits — only the admin account can read orders or change products.

## Edit products in code (optional)
Visual details (colours, images) live in `index.html` under `EDIT YOUR PRODUCTS HERE`. Names, descriptions, stock, photos and box prices are best changed from the dashboard.

## Custom domain
GitHub → Settings → Pages → Custom domain. At your domain provider add A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` and a CNAME `www` → `mavis028.github.io`.
