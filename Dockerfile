FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and data needed at runtime
COPY api/ ./api/
COPY src/ ./src/
COPY scripts/ ./scripts/

# Precomputed JSON (served directly by the API)
COPY frontend/public/precomputed/ ./frontend/public/precomputed/

# Processed data needed for live endpoints
COPY processed_data/pca/ ./processed_data/pca/
COPY processed_data/folklore/ ./processed_data/folklore/
COPY processed_data/clean/drug_landmarks/ ./processed_data/clean/drug_landmarks/
COPY processed_data/sample_info.csv ./processed_data/
COPY processed_data/cell_line_properties.csv ./processed_data/

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
