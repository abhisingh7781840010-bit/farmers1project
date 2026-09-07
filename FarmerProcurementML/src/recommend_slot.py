import pandas as pd
import joblib
#Load trained model
model = joblib.load(
    "models/waiting_time_model.pkl"
)
# Basic information
centre = "Centre_A"
day = "Wednesday"
farmers = 30
counters = 4
processing_time = 6
procurement_quantity = 200
# Available slots
slots = [10, 11, 12, 13, 14]
results = []
# Predict each slot
for slot in slots:

    input_data = pd.DataFrame({
        "centre": [centre],
        "day": [day],
        "hour": [slot],
        "farmers": [farmers],
        "counters": [counters],
        "avg_processing_time": [processing_time],
        "procurement_quantity": [procurement_quantity]
    })
    predicted_wait = model.predict(
        input_data
    )[0]
    results.append(
        (slot, predicted_wait)
    )
# Display predictions
print("SLOT PREDICTIONS")
print("----------------")
for slot, wait in results:
    print(slot,":", round(wait,2),"minutes")
# Find the slot with minimum waiting time
best_slot = min(
    results,
    key=lambda x: x[1]
)

print("\nRECOMMENDED SLOT")
print("----------------")

print(
    f"{best_slot[0]}:00"
)

print(
    f"Expected waiting time: "
    f"{best_slot[1]:.2f} minutes"
)