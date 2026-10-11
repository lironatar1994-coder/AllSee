# AllSee

עמוד אחד עם כל האתרים והפרויקטים: כתובת חיה, קישורי ניהול, קישור מקומי, מאגר GitHub ותיקייה ב־Work.

- צפייה (פתוח לכולם, לא מופיע בגוגל): https://lawebs.co.il/allsee/
- עריכה (סיסמה): https://lawebs.co.il/allsee/admin
  שמות, תיאורים, סדר הכרטיסים, הסתרה, קישורים, צילומי מסך, טקסטים של העמוד וסדר ברירת המחדל.

## הסיסמה

הסיסמה שמורה רק במחשב הזה, בקובץ `.data/admin-password.txt` (לא נכנס ל־Git).
להחלפה: `node tools/set-password.mjs` (סיסמה אקראית) או `node tools/set-password.mjs --ask` (סיסמה משלך),
ואז `.\deploy.ps1 -Target Prod`. החלפה מנתקת את כל החיבורים הפתוחים.

## הרצה מקומית

לחיצה כפולה על `start.cmd`, נפתח ב־http://localhost:4310/allsee/ (הנתונים המקומיים ב־`.data/`).

## פרסום

`.\deploy.ps1` שומר ל־GitHub ואז מעלה לשרת. `-Target GitHub` או `-Target Prod` מריצים רק חצי.
העריכות בשרת נשמרות ב־`/var/lib/allsee` ולא נדרסות בפרסום. `data/seed.json` משמש רק בהפעלה הראשונה.
צילומי מסך חדשים: השורה הראשונה ב־`tools/refresh-shots.cjs`.
