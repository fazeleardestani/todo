import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime

# ==========================================
# تنظیمات شخصی (این سه مورد را پر کنید)
# ==========================================
BALE_BOT_TOKEN = "YOUR_BALE_BOT_TOKEN"
BALE_CHAT_ID = "YOUR_CHAT_ID"

# مسیر فایل JSON خروجی گرفته شده از دکمه «خروجی پشتیبان» در وب‌اپ
TASKS_JSON_PATH = "hamrah-backup.json"

# فایل ذخیره وضعیت یادآورهای ارسال‌شده (برای جلوگیری از ارسال تکراری)
SENT_STATE_FILE = "sent_reminders.json"

# بازه بررسی به ثانیه
CHECK_INTERVAL_SECONDS = 30

CATEGORY_LABELS = {
    "work": "کار و مدیریت",
    "project": "پروژه‌ها",
    "personal": "شخصی و روزمره",
    "self": "خودم، رشد و استراحت",
}

PRIORITY_LABELS = {
    "high": "🔴 فوری / مهم",
    "medium": "🟡 عادی",
    "low": "🟢 کم‌اولویت",
}


def load_sent_ids():
    if not os.path.exists(SENT_STATE_FILE):
        return set()
    try:
        with open(SENT_STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return set(data if isinstance(data, list) else [])
    except Exception:
        return set()


def save_sent_ids(sent_ids):
    with open(SENT_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(list(sent_ids), f, ensure_ascii=False, indent=2)


def send_bale_message(text):
    url = f"https://tapi.bale.ai/bot{BALE_BOT_TOKEN}/sendMessage"
    payload = urllib.parse.urlencode({
        "chat_id": BALE_CHAT_ID,
        "text": text,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception as exc:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] خطا در ارسال به بله: {exc}")
        return False


def check_and_notify():
    if not os.path.exists(TASKS_JSON_PATH):
        return

    try:
        with open(TASKS_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] خطا در خواندن فایل کارها: {exc}")
        return

    tasks = data.get("tasks", [])
    sent_ids = load_sent_ids()
    now = datetime.now()
    updated = False

    for task in tasks:
        task_id = task.get("id")
        if not task_id or task.get("done") or task_id in sent_ids:
            continue

        due_date = task.get("dueDate", "").strip()
        due_time = task.get("dueTime", "").strip()
        if not due_date or not due_time:
            continue

        try:
            due_dt = datetime.strptime(f"{due_date} {due_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            continue

        if now >= due_dt:
            title = task.get("title", "بدون عنوان")
            category = CATEGORY_LABELS.get(task.get("category"), "کار")
            priority = PRIORITY_LABELS.get(task.get("priority"), "عادی")
            notes = task.get("notes", "").strip()

            message = (
                f"⏰ یادآور دستیار همراه\n\n"
                f"📌 {title}\n"
                f"📂 بخش: {category}\n"
                f"⚡ اولویت: {priority}\n"
                f"🕒 ساعت: {due_time}"
            )
            if notes:
                message += f"\n📝 یادداشت: {notes}"

            if send_bale_message(message):
                print(f"[{now.strftime('%H:%M:%S')}] یادآور ارسال شد: {title}")
                sent_ids.add(task_id)
                updated = True

    if updated:
        save_sent_ids(sent_ids)


def main():
    print("سرویس ریمایندر پس‌زمینه همراه شروع به کار کرد...")
    print(f"در حال پایش فایل: {os.path.abspath(TASKS_JSON_PATH)}")
    while True:
        check_and_notify()
        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
