FROM python:3.12-slim

# Set the working directory
WORKDIR /app

# Copy the requirements from the backend folder
COPY backend/requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the backend code
COPY backend/ .

# Expose port and run the server
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-10000}
