"""
Generate dataset for queue_model.pkl training (for test_ml.py)
"""
import os
import csv
import random

def generate_csv():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(out_dir, exist_ok=True)
    csv_file = os.path.join(out_dir, "training_data.csv")

    headers = [
        "center_id", "district", "crop", "farmers_arrived",
        "farmers_processed", "queue_length", "number_of_counters",
        "average_processing_time", "arrival_rate", "hour",
        "day_of_week", "is_weekend", "is_holiday", "waiting_time"
    ]

    centers = [
        ("C001", "Karnal"),
        ("C002", "Ludhiana"),
        ("C003", "Indore"),
        ("C004", "Sehore"),
        ("C005", "Nashik")
    ]
    crops = ["Wheat", "Paddy", "Mustard", "Soybean", "Gram", "Maize"]

    random.seed(42)
    rows = []

    for _ in range(2500):
        center_id, district = random.choice(centers)
        crop = random.choice(crops)
        counters = random.choice([2, 3, 4, 5, 6])
        avg_proc_time = random.choice([4.0, 5.0, 6.0, 7.0, 8.0])
        queue_len = random.randint(1, 45)
        farmers_arrived = queue_len + random.randint(5, 50)
        farmers_processed = farmers_arrived - queue_len
        arrival_rate = round(random.uniform(2.0, 10.0), 2)
        hour = random.randint(8, 18)
        day_of_week = random.randint(0, 6)
        is_weekend = 1 if day_of_week in [0, 6] else 0
        is_holiday = 1 if (random.random() < 0.05 and not is_weekend) else 0

        # Waiting time formula
        base_time = (queue_len * avg_proc_time) / counters
        peak = 1.25 if (11 <= hour <= 14) else 1.0
        weekend_factor = 1.15 if is_weekend else 1.0
        holiday_factor = 0.8 if is_holiday else 1.0
        noise = random.uniform(-2.0, 2.0)

        waiting_time = max(1, round((base_time * peak * weekend_factor * holiday_factor) + (queue_len * 0.12) + noise, 1))

        rows.append([
            center_id, district, crop, farmers_arrived,
            farmers_processed, queue_len, counters,
            avg_proc_time, arrival_rate, hour,
            day_of_week, is_weekend, is_holiday, waiting_time
        ])

    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    print(f"Generated {len(rows)} records in {csv_file}")

if __name__ == "__main__":
    generate_csv()
