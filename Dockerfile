FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code
COPY . .

# Expose server port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
