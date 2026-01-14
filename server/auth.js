const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { db } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Optional auth middleware: if a valid token is present, sets req.user; otherwise continues unauthenticated.
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }
    req.user = user;
    next();
  });
}

// Login endpoint
function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ error: 'Login failed' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      bcrypt.compare(password, user.password_hash, (compareErr, isMatch) => {
        if (compareErr) {
          console.error('Error comparing passwords:', compareErr);
          return res.status(500).json({ error: 'Login failed' });
        }

        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
          token,
          user: {
            id: user.id,
            username: user.username
          }
        });
      });
    }
  );
}

// Verify token endpoint (for checking if user is still authenticated)
function verifyToken(req, res) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username
      }
    });
  });
}

// Change password endpoint (requires authentication)
function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ error: 'Failed to change password' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    bcrypt.compare(currentPassword, user.password_hash, (compareErr, isMatch) => {
      if (compareErr) {
        console.error('Error comparing passwords:', compareErr);
        return res.status(500).json({ error: 'Failed to change password' });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      bcrypt.hash(newPassword, 10, (hashErr, hash) => {
        if (hashErr) {
          console.error('Error hashing new password:', hashErr);
          return res.status(500).json({ error: 'Failed to change password' });
        }

        db.run(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [hash, userId],
          (updateErr) => {
            if (updateErr) {
              console.error('Error updating password:', updateErr);
              return res.status(500).json({ error: 'Failed to change password' });
            }

            res.json({ message: 'Password changed successfully' });
          }
        );
      });
    });
  });
}

// Get all users (admin only)
function getAllUsers(req, res) {
  db.all(
    'SELECT id, username, created_at FROM users ORDER BY username',
    [],
    (err, users) => {
      if (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }
      res.json(users || []);
    }
  );
}

// Create new user (admin only)
function createUser(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Check if username already exists
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      console.error('Error checking username:', err);
      return res.status(500).json({ error: 'Failed to check username' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password and create user
    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) {
        console.error('Error hashing password:', hashErr);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      db.run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, hash],
        function(insertErr) {
          if (insertErr) {
            console.error('Error creating user:', insertErr);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          res.status(201).json({
            id: this.lastID,
            username,
            message: 'User created successfully'
          });
        }
      );
    });
  });
}

// Update user password (admin can update any user, user can update own)
function updateUserPassword(req, res) {
  const userId = parseInt(req.params.id);
  const { newPassword } = req.body;
  const currentUserId = req.user.id;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  // Users can only update their own password unless they're admin (we'll add admin check later if needed)
  // For now, allow users to update their own password
  if (userId !== currentUserId) {
    return res.status(403).json({ error: 'You can only update your own password' });
  }

  bcrypt.hash(newPassword, 10, (hashErr, hash) => {
    if (hashErr) {
      console.error('Error hashing password:', hashErr);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hash, userId],
      function(updateErr) {
        if (updateErr) {
          console.error('Error updating password:', updateErr);
          return res.status(500).json({ error: 'Failed to update password' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Password updated successfully' });
      }
    );
  });
}

// Delete user (admin only - for now, allow users to delete themselves)
function deleteUser(req, res) {
  const userId = parseInt(req.params.id);
  const currentUserId = req.user.id;

  // Prevent deleting yourself
  if (userId === currentUserId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  });
}

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  login,
  verifyToken,
  changePassword,
  getAllUsers,
  createUser,
  updateUserPassword,
  deleteUser
};

