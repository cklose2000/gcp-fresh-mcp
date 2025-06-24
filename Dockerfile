FROM node:20-slim

# Install gcloud CLI for gcloud commands
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    && curl https://sdk.cloud.google.com | bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Add gcloud to PATH
ENV PATH="/root/google-cloud-sdk/bin:${PATH}"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Set Google Cloud environment variables
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json

# Expose port
EXPOSE 8080

# Run the application
CMD ["node", "main.js"]