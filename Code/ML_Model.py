import pandas as pd

# pyrefly: ignore [missing-import]
import numpy as np
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt
from sklearn.ensemble import GradientBoostingRegressor

import joblib

print("--- Loading Data ---")
import os

csv_path = "Super_Supply_Chain_Data_Fixed.csv"
if not os.path.exists(csv_path):
    print(f"{csv_path} not found. Generating dummy dataset.")
    # Generate dummy data with required columns
    import numpy as np

    num_rows = 1000
    df = pd.DataFrame(
        {
            "Leg_Type": np.random.choice(["A", "B", "C"], size=num_rows),
            "Origin_Node": np.random.choice(["X", "Y", "Z"], size=num_rows),
            "Destination_Node": np.random.choice(
                ["P", "Q", "R"], size=num_rows
            ),
            "Transport_Mode": np.random.choice(
                ["Air", "Sea", "Road"], size=num_rows
            ),
            "Condition_Flag": np.random.choice([0, 1], size=num_rows),
            "Other_Feature1": np.random.rand(num_rows),
            "Other_Feature2": np.random.rand(num_rows),
            "Delay_Hours": np.random.exponential(scale=5, size=num_rows),
        }
    )
else:
    df = pd.read_csv(csv_path, encoding="latin1")

df = df.dropna(subset=["Transport_Mode"])
print(f"Data ready. Total rows: {df.shape[0]}")

print("\n--- Categorical Encoding ---")
le_dict = {}
categorical_cols = [
    "Leg_Type",
    "Origin_Node",
    "Destination_Node",
    "Transport_Mode",
    "Condition_Flag",
]

for col in categorical_cols:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col].astype(str))
    le_dict[col] = le

print("Text features successfully converted to numeric matrices.")

print("\n--- Splitting Data for Training & Testing ---")

X = df.drop(["Delay_Hours"], axis=1)

y = df["Delay_Hours"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(
    f"Training on {X_train.shape[0]} scenarios, Testing on {X_test.shape[0]} scenarios."
)

print("\n--- Training the Risk-Aware Decision Brain ---")

model = GradientBoostingRegressor(
    loss="quantile",
    alpha=0.85,
    n_estimators=250,
    learning_rate=0.1,
    max_depth=6,
    random_state=42,
)

y_train_clean = np.maximum(0, y_train)
model.fit(X_train, y_train_clean)
print("Quantile Model successfully trained for worst-case routing!")

print("\n--- Running Blind Test ---")

y_pred = model.predict(X_test)

y_pred = np.maximum(0, y_pred)

mae = mean_absolute_error(y_test, y_pred)
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)

print(f"Mean Absolute Error (MAE): {mae:.2f} hours")
print(f"Root Mean Squared Error (RMSE): {rmse:.2f} hours")
print(f"R-Squared (R2) Score: {r2:.4f}")

results_df = pd.DataFrame(
    {
        "Actual Delay (Hours)": y_test.values[:10],
        "AI Predicted Worst-Case (Hours)": np.round(y_pred[:10], 2),
    }
)
print("\n--- Prediction Analysis Table (First 10 Blind Test Rows) ---")
print(results_df)


print("\nExporting to Disk ---")
joblib.dump(model, "risk_model.pkl")
joblib.dump(le_dict, "label_encoders.pkl")
print("Model and Encoders successfully saved")
