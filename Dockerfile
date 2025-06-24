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

# Install dependencies (using npm install instead of ci)
RUN npm install --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE 8080

# Run the application
CMD ["node", "main.js"]