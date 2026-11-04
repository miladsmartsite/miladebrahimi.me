# MILAD 2031 OS — install on Hostinger

## English
1. In hPanel open **File Manager → public_html**. Upload `milad2031.zip` and **Extract** it. You get the folder `public_html/milad2031/`.
   - Upload by hand. Do not put this folder in the GitHub repository's deploy branch, so a website deploy can never overwrite your data.
2. Check that PHP is version 8.0 or newer (**hPanel → Advanced → PHP Configuration**).
3. Open **https://miladebrahimi.me/milad2031/** in Safari. The first screen asks you to **create the owner password** (10+ characters). This sets up the platform.
4. Go to **Settings → Import JSON** and choose the file `milad2031-import-2026-11-04.json` (your data from Notion). Do this once.
5. On iPhone and iPad, in Safari: **Share → Add to Home Screen**. Sign in once on each device.
6. **Settings → Show my calendar link → Subscribe now**. Events and scheduled tasks then appear in Apple Calendar with reminders.
7. Security check: open `https://miladebrahimi.me/milad2031/data/store.json`. It must show **403 or 404**, never your data.

### Where your data lives
- Data is stored in `milad2031/data/` as JSON files.
- The server keeps a daily backup for 30 days in `data/backups/`.
- Use **Settings → Export JSON** now and then to keep a copy.
- Optional, safer: create `config.local.php` next to `api.php` containing `<?php define('DATA_DIR', '/home/USER/milad2031-data');` (a folder outside public_html).

### Updating the app later
- Replace these files: `index.html`, `assets/`, `icons/`, `sw.js`, `api.php`, `manifest.webmanifest`.
- Never replace or delete `data/`.

## فارسی
۱. در hPanel به **File Manager → public_html** بروید. فایل `milad2031.zip` را آپلود و **Extract** کنید تا پوشه `public_html/milad2031/` ساخته شود. این پوشه را دستی آپلود کنید، نه از طریق ریپازیتوری گیت‌هاب، تا دیپلوی سایت هیچ‌وقت داده‌ها را پاک نکند.

۲. نسخه PHP باید ۸ یا بالاتر باشد (hPanel → Advanced → PHP Configuration).

۳. آدرس **https://miladebrahimi.me/milad2031/** را در Safari باز کنید. صفحه اول از شما می‌خواهد **رمز مالک** را بسازید (حداقل ۱۰ کاراکتر).

۴. به **Settings → Import JSON** بروید و فایل `milad2031-import-2026-11-04.json` را انتخاب کنید. همه داده‌های نوشن وارد می‌شود. این کار فقط یک بار لازم است.

۵. در آیفون و آیپد: Safari → دکمه Share → **Add to Home Screen**. روی هر دستگاه یک بار وارد شوید.

۶. **Settings → Show my calendar link → Subscribe now** را بزنید. رویدادها و کارهای زمان‌بندی‌شده با یادآور در Calendar آیفون نشان داده می‌شوند.

۷. برای امنیت، آدرس `https://miladebrahimi.me/milad2031/data/store.json` را باز کنید. باید خطای 403 یا 404 بدهد، نه داده‌های شما.

**به‌روزرسانی بعدی:** فقط فایل‌های برنامه را جایگزین کنید. پوشه `data/` را هرگز پاک یا جایگزین نکنید.
