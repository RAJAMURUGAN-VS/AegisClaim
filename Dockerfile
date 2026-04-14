# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies that might be needed by Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY ./pa-workflow/requirements.txt /app/requirements.txt

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code into the container at /app
COPY ./pa-workflow /app/pa-workflow
COPY ./alembic /app/alembic
COPY ./alembic.ini /app/alembic.ini

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the application
# The command is specified in docker-compose.yml to allow for easier overrides
# CMD ["uvicorn", "pa-workflow.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
