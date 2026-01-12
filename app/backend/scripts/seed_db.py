import sys
import os
import uuid
import pandas as pd
import numpy as np
from sqlalchemy import create_engine

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.app.core.config import settings

def seed_database():
    print(f"Seeding Database: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    employees = pd.DataFrame({
        'id': range(101, 111),
        'name': [f"Employee_{i}" for i in range(1, 11)],
        'department': np.random.choice(['Engineering', 'Sales', 'HR'], 10),
        'salary': np.random.randint(50000, 150000, 10),
        'join_date': pd.date_range(start='2023-01-01', periods=10)
    })
    employees.to_sql('employees', engine, if_exists='replace', index=False)
    
    transactions = pd.DataFrame({
        'txn_id': [str(uuid.uuid4())[:8] for _ in range(20)],
        'amount': np.random.uniform(100.0, 5000.0, 20).round(2),
        'category': np.random.choice(['Software', 'Hardware', 'Services'], 20),
        'status': np.random.choice(['Completed', 'Pending'], 20)
    })
    
    transactions.to_sql('transactions', engine, if_exists='replace', index=False)
    
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()