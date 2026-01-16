# ArtArc4U

An art database and gallery system for managing a collection of artworks with support for images, text, audio, and video.

## Features

- **Comprehensive Artwork Database**: Track artwork details, ownership, location, availability, and notes
- **Full-Text Search**: Search across artwork fields
- **Multi-Media Support**: Upload and manage images, videos, audio files, and text documents
- **Exhibitions & Series**: Track exhibitions and group artworks into series
- **Artist Profile**: Store artist bio, statement, contact info, and gallery images
- **User Accounts**: JWT-based auth with admin user management
- **Easy Backup**: Organized file structure for easy backup and restoration

## Project Structure

```
ArtArc4U/
├── server/           # Express.js backend
│   ├── data/        # SQLite database (created automatically)
│   ├── media/       # Media files storage (created automatically)
│   ├── database.js  # Database setup and utilities
│   ├── scripts/     # Maintenance utilities
│   └── index.js     # Express server and API routes
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Gallery.js      # Gallery page
│   │   │   └── ArtworkForm.js  # Add/Edit artwork page
│   │   ├── App.js
│   │   └── index.js
│   └── public/
└── package.json     # Root package.json
```

## Installation

1. **Install dependencies (recommended)**:
   ```bash
   npm run install-all
   ```

2. **Or install manually**:
   ```bash
   npm install
   cd server && npm install
   cd ../client && npm install
   ```

## Fresh Install (Non-Destructive)

Use this for first-time setup or reinstalling on an existing machine without wiping data:
```bash
cd server
npm run fresh-install
```
This ensures the `data/` and `media/` directories exist and creates an empty database file if missing.

## First Run Notes

- The database schema is created automatically on server start.
- A default admin user is created if no users exist: `admin` / `admin123` (change this immediately).
- Set `JWT_SECRET` in your environment for production.

## Running the Application

### Development Mode (Both Servers)

**Using PowerShell (Windows):**
```powershell
.\start-server.ps1
```

**Using npm:**
```bash
npm run start:dev
```

This will start:
- **Backend server** on `http://localhost:3000` (API endpoints)
- **React dev server** on `http://localhost:3001` (Frontend with hot reload)
- The React dev server proxies API requests to the backend automatically

### Production Mode (Single Server)

Build the React app and run the combined server:
```bash
npm run start:prod
```

This will:
- Build the React app
- Start the backend server on `http://localhost:3000`
- Serve the built React app from the same server

### Run Servers Separately

**Backend only:**
```bash
npm run start:server
# or
cd server && npm start
```

**Frontend dev server only:**
```bash
npm run start:client
# or
cd client && npm start
```

**Note:** When running separately, make sure the backend is running on port 3000 before starting the frontend.

## Windows Portable EXE (Desktop App)

Build a single portable Windows executable using Electron. This bundles the backend server and the React build into a desktop app.

1. Install dependencies:
   ```bash
   npm run install-all
   ```
2. Build the portable exe (run on Windows):
   ```bash
   npm run package:win
   ```

Output: `dist/ArtArc4U-Portable-<version>.exe`

### Desktop Mode (from source)

If you want to run the desktop app locally from source:
```bash
npm run build
npm run start:desktop
```

### Portable Data Location

- The portable exe stores data in a sibling folder named `ArtArc4U-Data` next to the exe.
- Override the storage path by setting one of these environment variables before running:
  - `ARTARC_STORAGE_DIR` (preferred)
  - `ARTARC_DATA_DIR`
  - `ARTARC_MEDIA_DIR`
  - `ARTARC_DB_PATH`

## API Endpoints

### Artworks
- `GET /api/artworks` - List artworks (supports `?search=term`)
- `GET /api/artworks/:id` - Get artwork
- `POST /api/artworks` - Create artwork
- `PUT /api/artworks/:id` - Update artwork
- `DELETE /api/artworks/:id` - Delete artwork

### Media
- `POST /api/artworks/:id/media` - Upload media (`media` file, `is_primary` boolean)
- `DELETE /api/media/:filename` - Delete media
- `GET /media/:path` - Serve media files

### Exhibitions
- `GET /api/exhibitions` - List exhibitions
- `POST /api/exhibitions` - Create exhibition
- `GET /api/exhibitions/:id` - Get exhibition
- `PUT /api/exhibitions/:id/description` - Update description
- `POST /api/exhibitions/:id/photos` - Upload exhibition photos

### Series
- `GET /api/series` - List series
- `GET /api/series/:id` - Get series with artworks
- `POST /api/series` - Create series
- `PUT /api/series/:id` - Update series
- `DELETE /api/series/:id` - Delete series

### Artist
- `GET /api/artist` - Get artist profile
- `PUT /api/artist` - Update artist profile
- `POST /api/artist/photo` - Upload artist photo
- `GET /api/artist/gallery` - List gallery images
- `POST /api/artist/gallery` - Upload gallery image
- `DELETE /api/artist/gallery/:id` - Delete gallery image

### Auth & Users
- `POST /api/auth/login` - Log in
- `GET /api/auth/verify` - Verify token
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/reset-admin` - Reset admin password (setup only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id/password` - Update user password
- `DELETE /api/users/:id` - Delete user

## Database Schema

### artworks
- `id` (INTEGER, PRIMARY KEY)
- `year` (TEXT)
- `title`, `dimensions`, `medium`, `value`, `availability`, `for_sale_price` (TEXT)
- `description`, `more_info`, `storage_location`, `past_exhibitions` (TEXT)
- `owner_name`, `owner_address`, `owner_phone` (TEXT)
- `is_hidden`, `hide_images_public` (INTEGER)
- `created_at`, `updated_at` (DATETIME)

### media
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `artwork_id` (INTEGER, FOREIGN KEY)
- `filename`, `file_type`, `display_name` (TEXT)
- `is_primary`, `is_public` (BOOLEAN)
- `created_at` (DATETIME)

### exhibitions
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `year`, `title`, `location`, `notes`, `description` (TEXT)
- `created_at` (DATETIME)

### series / artwork_series
- `series` (`id`, `name`, `description`, `created_at`)
- `artwork_series` (`id`, `artwork_id`, `series_id`, `created_at`)

### artist / artist_gallery_images
- `artist` (`id`, `name`, `bio`, `statement`, `contact_bio`, `contact_statement`, `inquiry_email`, `photo_filename`)
- `artist_gallery_images` (`id`, `filename`, `display_order`, `created_at`)

### users
- `users` (`id`, `username`, `password_hash`, `created_at`)

## Media File Naming Convention

- **Primary Media**: `000001.jpg` (6-digit ID with leading zeros)
- **Additional Media**: `000001a.jpg`, `000001b.jpg`, `000001c.jpg`, etc.
- Media files are stored under `server/media/<artwork-id>/`
- Display ID shows without leading zeros (e.g., `#1` instead of `#000001`)

## Backup

To backup your data:

1. **Database**: Copy `server/data/artarc.db`
2. **Media Files**: Copy the entire `server/media/` directory

To restore:
1. Place the database file in `server/data/`
2. Place media files in `server/media/`

## Technologies Used

- **Backend**: Node.js, Express.js, SQLite3, Multer
- **Frontend**: React, React Router, Axios
- **Database**: SQLite

## License

ISC


