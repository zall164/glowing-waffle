# Docker Setup for ArtArc4U

This guide explains how to run ArtArc4U using Docker and Docker Compose.

## Prerequisites

- [Docker](https://www.docker.com/get-started) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed (usually included with Docker Desktop)

## Quick Start

1. **Build and start the container:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Web interface: http://localhost:3000
   - API: http://localhost:3000/api/artworks

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the container:**
   ```bash
   docker-compose down
   ```

## Building the Image

To build the Docker image manually:

```bash
docker build -t artarc4u .
```

## Running the Container

### Using Docker Compose (Recommended)

```bash
# Start in detached mode
docker-compose up -d

# Start and view logs
docker-compose up

# Stop
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Using Docker directly

```bash
# Build the image
docker build -t artarc4u .

# Run the container
docker run -d \
  --name artarc4u \
  -p 3000:3000 \
  -v $(pwd)/server/data:/app/data \
  -v $(pwd)/server/media:/app/media \
  artarc4u
```

On Windows PowerShell:
```powershell
docker run -d `
  --name artarc4u `
  -p 3000:3000 `
  -v ${PWD}/server/data:/app/data `
  -v ${PWD}/server/media:/app/media `
  artarc4u
```

## Data Persistence

The Docker setup uses volumes to persist your data:

- **Database**: `./server/data` → `/app/data` in container
- **Media files**: `./server/media` → `/app/media` in container

This means your database and media files are stored on your host machine and will persist even if you remove the container.

## Environment Variables

You can customize the configuration using environment variables:

```yaml
# In docker-compose.yml
environment:
  - PORT=3000
  - NODE_ENV=production
```

Or when using `docker run`:

```bash
docker run -d \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -p 3000:3000 \
  artarc4u
```

## Port Configuration

To use a different port on your host machine, modify the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Host:Container
```

This would make the app available at http://localhost:8080

## Updating the Application

1. **Pull latest changes** (if using git)
2. **Rebuild and restart:**
   ```bash
   docker-compose up -d --build
   ```

## Backup

To backup your data:

1. **Stop the container:**
   ```bash
   docker-compose down
   ```

2. **Copy the data directories:**
   ```bash
   # Database
   cp -r server/data ./backup/data
   
   # Media files
   cp -r server/media ./backup/media
   ```

## Restore

To restore from backup:

1. **Stop the container:**
   ```bash
   docker-compose down
   ```

2. **Restore the data:**
   ```bash
   # Database
   cp -r ./backup/data server/data
   
   # Media files
   cp -r ./backup/media server/media
   ```

3. **Start the container:**
   ```bash
   docker-compose up -d
   ```

## Troubleshooting

### Container won't start

Check the logs:
```bash
docker-compose logs
```

### Port already in use

If port 3000 is already in use, change it in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use port 3001 instead
```

### Permission issues (Linux/Mac)

If you encounter permission issues with volumes, you may need to adjust permissions:
```bash
sudo chown -R $USER:$USER server/data server/media
```

### Rebuild from scratch

To completely rebuild:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Health Check

The container includes a health check that monitors the server status. Check health status:

```bash
docker ps
```

Look for the "STATUS" column - it should show "healthy" when running properly.

## Development vs Production

This Docker setup is configured for **production** use. For development:

1. Use the local development setup (see main README.md)
2. Or modify the Dockerfile to mount source code as volumes for hot-reload

## Additional Commands

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# Execute commands in the container
docker-compose exec artarc4u sh

# View container resource usage
docker stats artarc4u

# Remove everything (including volumes - WARNING: deletes data)
docker-compose down -v
```
