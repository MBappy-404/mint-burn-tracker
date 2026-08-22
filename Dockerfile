FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose server port
EXPOSE 3000

# Start Mint Father Bot & Web Server
CMD ["npm", "start"]
