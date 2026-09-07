import joblib
model=joblib.load("models/waiting_time_model.pkl")
import pandas as pd
current_data=pd.DataFrame({
    "centre":["Centre_A"],
    "day":["Wednesday"],
    "hour":[11],
    "farmers":[42],
    "counters":[4],
    "avg_processing_time":[6],
    "procurement_quantity":[260]
})
prediction=model.predict(current_data)
from congestion import get_congestion_level
waiting_time=prediction[0]
congestion=get_congestion_level(waiting_time)
print("Predicted waiting time: ",round(waiting_time,2),"minutes")
print("Congestion level: ",congestion)