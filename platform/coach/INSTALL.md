# ME.Coach — install on Hostinger

## Install
1. hPanel → File Manager → `public_html`. Upload `me-coach.zip` and **Extract**. You get `public_html/coach/`.
2. PHP 8 or later (hPanel → Advanced → PHP Configuration).
3. Open **https://miladebrahimi.me/coach/**. The first account created is the **owner** (you). Everyone after you gets a 7-day free trial.
4. Check that `https://miladebrahimi.me/coach/data/users.json` answers 403 or 404 (private).

## Your account (owner)
- Start free → your name → **Skip — I will import my own data** → email and password.
- Settings → Import JSON: first your old MILAD 2031 backup, then `me-coach-milad-plan-2026-11-16.json` (it replaces areas, goals, milestones, courses, habits and cycles; the old ones go to Trash).
- Settings → **Members**: see every account; **+30 d / +1 y** activates a subscriber after they pay you, **Stop** ends access.

## Updating later
- Extract the new zip over the `coach` folder. **Never delete the folder**: `coach/data/` holds every user's data.

## Home-screen widget (7.0)
- Today → **Edit widgets** → **Set up home-screen widget**. iPhone/iPad: free app *Scriptable* + the copied script. Mac/Windows: open the desktop widget link (Safari → File → Add to Dock).

## Reminders (optional)
- Each user turns them on in Settings → Notifications (installed app, iOS 16.4+).
- One cron job for everyone: hPanel → Advanced → Cron Jobs → every 15 minutes, with the command shown in Settings → Notifications.

---

## نصب (فارسی)
۱. فایل `me-coach.zip` را در `public_html` آپلود و Extract کنید تا پوشه `public_html/coach/` ساخته شود.
۲. آدرس **miladebrahimi.me/coach** را باز کنید. اولین حساب، حساب مالک (شما) است و بقیه ۷ روز رایگان دارند.
۳. در صفحه اول Start free → نام → «Skip — I will import my own data» → ایمیل و رمز.
۴. Settings → Import JSON: اول بک‌آپ قدیمی MILAD 2031، بعد فایل برنامه جدید.
۵. برای به‌روزرسانی، zip جدید را روی همان پوشه `coach` Extract کنید (Overwrite) و هرگز پوشه را پاک نکنید. هر دو فایل `api.php` و `assets` باید با هم آپدیت شوند.
