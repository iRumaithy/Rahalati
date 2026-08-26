# Rahalati / Supabase

هذه الملفات مرجع للبنية الخلفية التي تم إعدادها للتطبيق.

## Tables
- rahalati_profiles
- rahalati_trips
- rahalati_trip_items
- rahalati_releases
- rahalati_user_versions

كل الجداول المعروضة للواجهة محمية بـ RLS، والوصول إلى الرحلات والعناصر مقيد بصاحب الحساب النشط.

## Edge Functions
- `rahalati-login`: تسجيل الدخول بالإيميل أو اسم المستخدم.
- `rahalati-admin-users`: إدارة المستخدمين للمالك فقط.
- `rahalati-release-manager`: إدارة دورة الإصدار للمالك فقط.
- `rahalati-destination-suggestions`: اقتراح وجهات للمستخدم النشط.

## Server secret اختياري ومهم للتقييمات
أضف `GOOGLE_PLACES_API_KEY` إلى Secrets الخاصة بـ Edge Functions للحصول على تقييمات Google وعدد الآراء. لا تضع هذا المفتاح داخل `config.js` أو أي ملف Frontend.
