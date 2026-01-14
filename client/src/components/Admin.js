import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Admin.css';

function Admin() {
  const [serverStatus, setServerStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shuttingDown, setShuttingDown] = useState(false);

  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchServerStatus = async () => {
    try {
      const response = await axios.get('/api/admin/status');
      setServerStatus(response.data);
      if (response.data.logs) {
        setLogs(response.data.logs);
      }
    } catch (error) {
      console.error('Error fetching server status:', error);
      setServerStatus({
        status: 'error',
        message: 'Unable to connect to server'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShutdown = async () => {
    if (!window.confirm('Are you sure you want to shutdown the server? This will stop all services.')) {
      return;
    }

    setShuttingDown(true);
    try {
      await axios.post('/api/admin/shutdown');
      setTimeout(() => {
        alert('Server is shutting down. The page will become unavailable.');
      }, 1000);
    } catch (error) {
      console.error('Error shutting down server:', error);
      alert('Error shutting down server: ' + (error.response?.data?.error || error.message));
      setShuttingDown(false);
    }
  };

  const handleRestart = async () => {
    if (!window.confirm('Are you sure you want to restart the server? This will temporarily stop all services.')) {
      return;
    }

    setShuttingDown(true);
    try {
      await axios.post('/api/admin/restart');
      setTimeout(() => {
        alert('Server is restarting. Please wait a moment and refresh the page.');
      }, 1000);
    } catch (error) {
      console.error('Error restarting server:', error);
      alert('Error restarting server: ' + (error.response?.data?.error || error.message));
      setShuttingDown(false);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading && !serverStatus) {
    return (
      <div className="admin-page">
        <div className="loading">Loading server status...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Server Administration</h1>
        <div className="admin-actions">
          <button
            onClick={handleRestart}
            className="btn btn-warning"
            disabled={shuttingDown}
            title="Restart the server"
          >
            🔄 Restart
          </button>
          <button
            onClick={handleShutdown}
            className="btn btn-danger"
            disabled={shuttingDown}
            title="Shutdown the server"
          >
            ⏹️ Shutdown
          </button>
        </div>
      </div>

      {serverStatus && (
        <>
          <div className="status-cards">
            <div className="status-card">
              <div className="status-card-header">
                <h3>Server Status</h3>
                <span className={`status-badge status-${serverStatus.status || 'unknown'}`}>
                  {serverStatus.status === 'running' ? '🟢 Running' : 
                   serverStatus.status === 'error' ? '🔴 Error' : '⚪ Unknown'}
                </span>
              </div>
              <div className="status-card-content">
                <div className="status-item">
                  <span className="status-label">Uptime:</span>
                  <span className="status-value">{formatUptime(serverStatus.uptime)}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Port:</span>
                  <span className="status-value">{serverStatus.port || 'N/A'}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Environment:</span>
                  <span className="status-value">{serverStatus.environment || 'N/A'}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Node Version:</span>
                  <span className="status-value">{serverStatus.nodeVersion || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="status-card">
              <div className="status-card-header">
                <h3>System Resources</h3>
              </div>
              <div className="status-card-content">
                <div className="status-item">
                  <span className="status-label">Memory Usage:</span>
                  <span className="status-value">
                    {formatBytes(serverStatus.memory?.used)} / {formatBytes(serverStatus.memory?.total)}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">Memory %:</span>
                  <span className="status-value">
                    {serverStatus.memory?.percentage ? `${serverStatus.memory.percentage.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">CPU Usage:</span>
                  <span className="status-value">
                    {serverStatus.cpu?.usage ? `${serverStatus.cpu.usage.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="status-card">
              <div className="status-card-header">
                <h3>Database</h3>
              </div>
              <div className="status-card-content">
                <div className="status-item">
                  <span className="status-label">Artworks:</span>
                  <span className="status-value">{serverStatus.database?.artworks || 'N/A'}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Media Files:</span>
                  <span className="status-value">{serverStatus.database?.media || 'N/A'}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Series:</span>
                  <span className="status-value">{serverStatus.database?.series || 'N/A'}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Exhibitions:</span>
                  <span className="status-value">{serverStatus.database?.exhibitions || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="logs-section">
            <div className="logs-header">
              <h3>Server Logs</h3>
              <button
                onClick={fetchServerStatus}
                className="btn btn-secondary btn-sm"
                title="Refresh logs"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="logs-container">
              {logs.length > 0 ? (
                <div className="logs-list">
                  {logs.slice(-50).reverse().map((log, index) => (
                    <div key={index} className={`log-entry log-${log.level || 'info'}`}>
                      <span className="log-time">{log.time}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-logs">No logs available</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Admin;





