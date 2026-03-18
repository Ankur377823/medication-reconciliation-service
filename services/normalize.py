def normalize_med(med):
    return {
        "name": med["name"].lower().strip(),
        "dose": med.get("dose", "").lower().strip(),
        "status": med.get("status", "active").lower().strip()
    }