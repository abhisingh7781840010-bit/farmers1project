import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
#load data
data = pd.read_csv("data/procurement_data.csv")
print("Dataset loaded successfully!")
print(data.head())
#features and target
X = data[
    [
        "centre",
        "day",
        "hour",
        "farmers",
        "counters",
        "avg_processing_time",
        "procurement_quantity"
    ]
]
y = data["waiting_time"]
#categorical and numerical features
categorical_features = [
    "centre",
    "day"
]
numerical_features = [
    "hour",
    "farmers",
    "counters",
    "avg_processing_time",
    "procurement_quantity"
]
#encoding
preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_features
        )
    ],
    remainder="passthrough"
)
#create model
model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "regressor",
            RandomForestRegressor(
                n_estimators=100,
                random_state=42
            )
        )
    ]
)
#train-test-split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)
print("\nTraining records:", len(X_train))
print("Testing records:", len(X_test))
#train model
model.fit(X_train, y_train)
print("\nModel trained successfully!")
#prediction
predictions = model.predict(X_test)
#evaluation
mae = mean_absolute_error(y_test, predictions)
rmse = mean_squared_error(
    y_test,
    predictions
) ** 0.5
r2 = r2_score(
    y_test,
    predictions
)
print("\nMODEL PERFORMANCE")
print("-------------------------")
print("MAE :", round(mae, 2), "minutes")
print("RMSE:", round(rmse, 2), "minutes")
print("R2  :", round(r2, 2))

import joblib
joblib.dump(model,"models/waiting_time_model.pkl")
print("\nModel saved successfully!")
