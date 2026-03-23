FROM python:3.12-slim

# Set the working directory
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY . .

# Run the FastAPI server using Uvicorn
# Render automatically provides a PORT environment variable, so we bind to it
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-10000}
