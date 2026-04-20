FROM node:22-alpine

WORKDIR /app

# Install dependencies (including devDependencies for build and tsx)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build frontend
# This generates the dist/ folder containing mcp-app.html
RUN npm run build

# Environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3001

# Start the server
CMD ["npm", "run", "serve"]
