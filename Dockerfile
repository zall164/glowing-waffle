# Multi-stage build for ArtArc4U
# Stage 1: Build the React client
FROM node:18-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm install

# Copy client source code
COPY client/ ./

# Build the React app
RUN npm run build

# Stage 2: Build and run the server
FROM node:18-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies
RUN cd server && npm install

# Copy server source code
COPY server/ ./server/

# Copy built React app from client-builder stage
# Server expects client/build at ../client/build relative to server directory
COPY --from=client-builder /app/client/build ./client/build

# Create directories for database and media
RUN mkdir -p server/data server/media

# Set working directory to server
WORKDIR /app/server

# Expose the port
EXPOSE 3000

# Set environment variable
ENV PORT=3000
ENV NODE_ENV=production

# Start the server
CMD ["node", "index.js"]
