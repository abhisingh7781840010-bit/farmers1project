import json
import os
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor

DATA_PATH = "data/training_data.csv"
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "queue_model.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "model_metrics.json")

features = [
    "center_id", "district", "crop", "farmers_arrived",
    "farmers_processed", "queue_length", "number_of_counters",
    "average_processing_time", "arrival_rate", "hour",
    "day_of_week", "is_weekend", "is_holiday"
]
target = "waiting_time"

df = pd.read_csv(DATA_PATH)
X = df[features]
y = df[target]

categorical = ["center_id", "district", "crop"]
numeric = [c for c in features if c not in categorical]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric),
    ("cat", Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore"))
    ]), categorical)
])

models = {
    "LinearRegression": LinearRegression(),
    "DecisionTree": DecisionTreeRegressor(max_depth=12, random_state=42),
    "RandomForest": RandomForestRegressor(
        n_estimators=250, max_depth=18, min_samples_split=4,
        random_state=42, n_jobs=-1
    ),
    "GradientBoosting": GradientBoostingRegressor(
        n_estimators=200, learning_rate=0.05, max_depth=4, random_state=42
    )
}

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42
)

results = {}
best_name = None
best_mae = float("inf")
best_pipeline = None

for name, model in models.items():
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", model)
    ])
    pipeline.fit(X_train, y_train)
    pred = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, pred)
    rmse = mean_squared_error(y_test, pred) ** 0.5
    r2 = r2_score(y_test, pred)

    results[name] = {
        "MAE_minutes": round(float(mae), 3),
        "RMSE_minutes": round(float(rmse), 3),
        "R2": round(float(r2), 4)
    }

    print(f"{name}: MAE={mae:.2f}, RMSE={rmse:.2f}, R2={r2:.4f}")

    if mae < best_mae:
        best_mae = mae
        best_name = name
        best_pipeline = pipeline

os.makedirs(MODEL_DIR, exist_ok=True)
joblib.dump(best_pipeline, MODEL_PATH)

metrics = {
    "best_model": best_name,
    "models": results,
    "note": "Performance is based on the included simulated training dataset, not official government data."
}
with open(METRICS_PATH, "w", encoding="utf-8") as f:
    json.dump(metrics, f, indent=2)

print(f"\nBest model: {best_name}")
print(f"Saved model: {MODEL_PATH}")
print(f"Saved metrics: {METRICS_PATH}")
