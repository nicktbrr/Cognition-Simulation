# Use the official Python 3.11 image as the base
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port that the app will run on
EXPOSE 8080

# Command to run the application using Gunicorn, setting a 4-minute timeout
CMD ["gunicorn", "-b", "0.0.0.0:8080", "--timeout", "240", "app:app"]
