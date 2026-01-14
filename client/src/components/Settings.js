import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import BulkUpload from './BulkUpload';
import CSVUpload from './CSVUpload';
import './Settings.css';

function Settings() {
  const [activeTab, setActiveTab] = useState('bulk-upload');
  const { user } = useAuth();
  const [missingData, setMissingData] = useState([]);
  const [loadingMissing, setLoadingMissing] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordChange, setNewPasswordChange] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [missingDataFilters, setMissingDataFilters] = useState({
    title: false,
    year: false,
    medium: false,
    dimensions: false,
    owner_name: false,
    description: false,
    more_info: false,
    media: false
  });
  const [dbCheckResults, setDbCheckResults] = useState(null);
  const [dbCheckLoading, setDbCheckLoading] = useState(false);
  const [dbFixLoading, setDbFixLoading] = useState(false);
  const [dbFixResults, setDbFixResults] = useState(null);
  const [exportFields, setExportFields] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [serverStatus, setServerStatus] = useState(null);
  const [serverLogs, setServerLogs] = useState([]);
  const [serverLoading, setServerLoading] = useState(true);
  const [artistInfo, setArtistInfo] = useState({
    name: '',
    bio: '',
    statement: '',
    contact_bio: '',
    contact_statement: '',
    inquiry_email: '',
    photo_filename: ''
  });
  const [artistLoading, setArtistLoading] = useState(false);
  const [artistSaving, setArtistSaving] = useState(false);
  const [artistError, setArtistError] = useState('');
  const [artistSuccess, setArtistSuccess] = useState('');
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const fetchMissingData = async () => {
    setLoadingMissing(true);
    try {
      const response = await axios.get('/api/artworks');
      const artworks = response.data;
      
      const missing = artworks.filter(artwork => {
        const checks = [];
        if (missingDataFilters.title && !artwork.title) checks.push('Title');
        if (missingDataFilters.year && !artwork.year) checks.push('Year');
        if (missingDataFilters.medium && !artwork.medium) checks.push('Medium');
        if (missingDataFilters.dimensions && !artwork.dimensions) checks.push('Dimensions');
        if (missingDataFilters.owner_name && !artwork.owner_name) checks.push('Owner Name');
        if (missingDataFilters.description && !artwork.description) checks.push('Description');
        if (missingDataFilters.more_info && !artwork.more_info) checks.push('More Info');
        if (missingDataFilters.media && (!artwork.media_files || artwork.media_files.length === 0)) checks.push('Media');
        
        return checks.length > 0;
      }).map(artwork => {
        const missingFields = [];
        if (missingDataFilters.title && !artwork.title) missingFields.push('Title');
        if (missingDataFilters.year && !artwork.year) missingFields.push('Year');
        if (missingDataFilters.medium && !artwork.medium) missingFields.push('Medium');
        if (missingDataFilters.dimensions && !artwork.dimensions) missingFields.push('Dimensions');
        if (missingDataFilters.owner_name && !artwork.owner_name) missingFields.push('Owner Name');
        if (missingDataFilters.description && !artwork.description) missingFields.push('Description');
        if (missingDataFilters.more_info && !artwork.more_info) missingFields.push('More Info');
        if (missingDataFilters.media && (!artwork.media_files || artwork.media_files.length === 0)) missingFields.push('Media');
        
        return {
          ...artwork,
          missingFields
        };
      });
      
      setMissingData(missing);
    } catch (error) {
      console.error('Error fetching missing data:', error);
      alert('Failed to load missing data');
    } finally {
      setLoadingMissing(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUserError('');
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setUserError('Authentication required. Please log in to manage users.');
      } else {
        setUserError('Failed to load users: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserError('');
    setUserSuccess('');

    try {
      await axios.post('/api/users', {
        username: newUsername,
        password: newPassword
      });
      setUserSuccess('User created successfully');
      setNewUsername('');
      setNewPassword('');
      await fetchUsers();
    } catch (error) {
      setUserError(error.response?.data?.error || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await axios.delete(`/api/users/${userId}`);
      setUserSuccess('User deleted successfully');
      await fetchUsers();
    } catch (error) {
      setUserError(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPasswordChange || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPasswordChange.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    if (newPasswordChange !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword: newPasswordChange
      });
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPasswordChange('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (error) {
      setPasswordError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const fetchArtistInfo = async () => {
    setArtistLoading(true);
    setArtistError('');
    try {
      const response = await axios.get('/api/artist');
      setArtistInfo(response.data || {
        name: '',
        bio: '',
        statement: '',
        contact_bio: '',
        contact_statement: '',
        inquiry_email: '',
        photo_filename: ''
      });
    } catch (error) {
      console.error('Error fetching artist info:', error);
      setArtistError('Failed to load artist information');
    } finally {
      setArtistLoading(false);
    }
  };

  const handleArtistChange = (e) => {
    const { name, value } = e.target;
    setArtistInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArtistSave = async (e) => {
    e.preventDefault();
    setArtistSaving(true);
    setArtistError('');
    setArtistSuccess('');
    
    try {
      await axios.put('/api/artist', artistInfo);
      setArtistSuccess('Artist information saved successfully');
      setTimeout(() => setArtistSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving artist info:', error);
      setArtistError('Failed to save artist information: ' + (error.response?.data?.error || error.message));
    } finally {
      setArtistSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setArtistSaving(true);
    setArtistError('');
    setArtistSuccess('');

    try {
      const response = await axios.post('/api/artist/photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setArtistInfo(prev => ({
        ...prev,
        photo_filename: response.data.filename
      }));
      setArtistSuccess('Photo uploaded successfully');
      setTimeout(() => setArtistSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setArtistError('Failed to upload photo: ' + (error.response?.data?.error || error.message));
    } finally {
      setArtistSaving(false);
    }
  };

  const fetchGalleryImages = async () => {
    setGalleryLoading(true);
    try {
      const response = await axios.get('/api/artist/gallery');
      setGalleryImages(response.data);
    } catch (error) {
      console.error('Error fetching gallery images:', error);
      setArtistError('Failed to load gallery images');
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleGalleryImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    setGalleryUploading(true);
    setArtistError('');
    setArtistSuccess('');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Upload files one by one
    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);

      try {
        await axios.post('/api/artist/gallery', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        successCount++;
      } catch (error) {
        console.error('Error uploading gallery image:', error);
        errorCount++;
        errors.push(`${file.name}: ${error.response?.data?.error || error.message}`);
      }
    }

    // Show success/error messages
    if (successCount > 0 && errorCount === 0) {
      setArtistSuccess(`${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully`);
      setTimeout(() => setArtistSuccess(''), 5000);
    } else if (successCount > 0 && errorCount > 0) {
      setArtistSuccess(`${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully`);
      setArtistError(`${errorCount} image${errorCount > 1 ? 's' : ''} failed: ${errors.join('; ')}`);
      setTimeout(() => {
        setArtistSuccess('');
        setArtistError('');
      }, 5000);
    } else {
      setArtistError(`Failed to upload images: ${errors.join('; ')}`);
      setTimeout(() => setArtistError(''), 5000);
    }

    fetchGalleryImages(); // Refresh the list
    e.target.value = ''; // Reset file input
    setGalleryUploading(false);
  };

  const handleGalleryImageDelete = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this gallery image?')) {
      return;
    }

    setGalleryLoading(true);
    setArtistError('');
    setArtistSuccess('');

    try {
      await axios.delete(`/api/artist/gallery/${imageId}`);
      setArtistSuccess('Gallery image deleted successfully');
      setTimeout(() => setArtistSuccess(''), 3000);
      fetchGalleryImages(); // Refresh the list
    } catch (error) {
      console.error('Error deleting gallery image:', error);
      setArtistError('Failed to delete gallery image: ' + (error.response?.data?.error || error.message));
    } finally {
      setGalleryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'missing-data') {
      fetchMissingData();
    }
    if (activeTab === 'server') {
      fetchServerStatus();
      const interval = setInterval(fetchServerStatus, 2000); // Update every 2 seconds
      return () => clearInterval(interval);
    }
    if (activeTab === 'users') {
      fetchUsers();
    }
    if (activeTab === 'artist') {
      fetchArtistInfo();
      fetchGalleryImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, missingDataFilters]);

  const handleFilterChange = (field) => {
    setMissingDataFilters(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Export functions
  const exportToCSV = async (fields = 'all') => {
    try {
      const response = await axios.get('/api/artworks');
      const artworks = response.data;

      // Define all possible fields
      const allFields = [
        'id', 'id_display', 'year', 'title', 'dimensions', 'medium', 'value',
        'availability', 'for_sale_price', 'description', 'owner_name',
        'owner_address', 'owner_phone', 'more_info', 'storage_location',
        'past_exhibitions', 'created_at', 'updated_at'
      ];

      // Select fields based on option
      let selectedFields = allFields;
      if (fields === 'basic') {
        selectedFields = ['id', 'id_display', 'year', 'title', 'medium', 'availability', 'value'];
      } else if (fields === 'owner') {
        selectedFields = ['id', 'id_display', 'title', 'owner_name', 'owner_address', 'owner_phone'];
      } else if (fields === 'inventory') {
        selectedFields = ['id', 'id_display', 'title', 'year', 'dimensions', 'medium', 'value', 'availability', 'for_sale_price', 'storage_location'];
      }

      // Create CSV header
      const header = selectedFields.join(',');
      
      // Create CSV rows
      const rows = artworks.map(artwork => {
        return selectedFields.map(field => {
          let value = artwork[field] || '';
          // Escape commas and quotes in CSV
          if (typeof value === 'string') {
            value = value.replace(/"/g, '""'); // Escape quotes
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              value = `"${value}"`;
            }
          }
          return value;
        }).join(',');
      });

      const csvContent = [header, ...rows].join('\n');
      
      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `artworks_export_${fields}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data');
    }
  };

  const exportToXLS = async (fields = 'all') => {
    try {
      // Dynamically import xlsx
      const XLSX = await import('xlsx');
      const response = await axios.get('/api/artworks');
      const artworks = response.data;

      // Define all possible fields
      const allFields = [
        'id', 'id_display', 'year', 'title', 'dimensions', 'medium', 'value',
        'availability', 'for_sale_price', 'description', 'owner_name',
        'owner_address', 'owner_phone', 'more_info', 'storage_location',
        'past_exhibitions', 'created_at', 'updated_at'
      ];

      // Select fields based on option
      let selectedFields = allFields;
      if (fields === 'basic') {
        selectedFields = ['id', 'id_display', 'year', 'title', 'medium', 'availability', 'value'];
      } else if (fields === 'owner') {
        selectedFields = ['id', 'id_display', 'title', 'owner_name', 'owner_address', 'owner_phone'];
      } else if (fields === 'inventory') {
        selectedFields = ['id', 'id_display', 'title', 'year', 'dimensions', 'medium', 'value', 'availability', 'for_sale_price', 'storage_location'];
      }

      // Create worksheet data
      const worksheetData = artworks.map(artwork => {
        const row = {};
        selectedFields.forEach(field => {
          row[field] = artwork[field] || '';
        });
        return row;
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Artworks');

      // Generate file and download
      XLSX.writeFile(workbook, `artworks_export_${fields}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exporting XLS:', error);
      if (error.message && error.message.includes('xlsx')) {
        alert('XLSX library not found. Please install it: npm install xlsx');
      } else {
        alert('Failed to export data');
      }
    }
  };

  const handleMediaBackup = () => {
    // Create a link to download the backup
    const link = document.createElement('a');
    link.href = '/api/backup/media';
    link.download = `media_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImagesBackup = () => {
    const link = document.createElement('a');
    link.href = '/api/backup/images';
    link.download = `image_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportData = () => {
    if (exportFormat === 'csv') {
      exportToCSV(exportFields);
    } else {
      exportToXLS(exportFields);
    }
  };

  const handleDbCheck = async () => {
    setDbCheckLoading(true);
    setDbCheckResults(null);
    try {
      const response = await axios.get('/api/db/check-media');
      setDbCheckResults(response.data);
    } catch (error) {
      console.error('Error checking database:', error);
      alert('Failed to check database: ' + (error.response?.data?.error || error.message));
    } finally {
      setDbCheckLoading(false);
    }
  };

  const handleDbFix = async () => {
    if (!window.confirm('This will add missing media files to the database. Continue?')) {
      return;
    }
    setDbFixLoading(true);
    setDbFixResults(null);
    try {
      const response = await axios.post('/api/db/fix-media');
      setDbFixResults(response.data);
      // Refresh check results after fixing
      if (dbCheckResults) {
        handleDbCheck();
      }
    } catch (error) {
      console.error('Error fixing database:', error);
      alert('Failed to fix database: ' + (error.response?.data?.error || error.message));
    } finally {
      setDbFixLoading(false);
    }
  };

  const fetchServerStatus = async () => {
    try {
      const response = await axios.get('/api/admin/status');
      setServerStatus(response.data);
      if (response.data.logs) {
        setServerLogs(response.data.logs);
      }
    } catch (error) {
      console.error('Error fetching server status:', error);
      setServerStatus({
        status: 'error',
        message: 'Unable to connect to server'
      });
    } finally {
      setServerLoading(false);
    }
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Helper function to format artwork ID (6 digits with leading zeros)
  const formatArtworkId = (id) => {
    return String(id).padStart(6, '0');
  };

  return (
    <div className="settings">
      <h1>Settings</h1>
      
      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'bulk-upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk-upload')}
        >
          Bulk Media Upload
        </button>
        <button
          className={`tab-button ${activeTab === 'csv-import' ? 'active' : ''}`}
          onClick={() => setActiveTab('csv-import')}
        >
          CSV Import
        </button>
        <button
          className={`tab-button ${activeTab === 'missing-data' ? 'active' : ''}`}
          onClick={() => setActiveTab('missing-data')}
        >
          Missing Data
        </button>
        <button
          className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export Data
        </button>
        <button
          className={`tab-button ${activeTab === 'db-management' ? 'active' : ''}`}
          onClick={() => setActiveTab('db-management')}
        >
          Database Management
        </button>
        <button
          className={`tab-button ${activeTab === 'server' ? 'active' : ''}`}
          onClick={() => setActiveTab('server')}
        >
          Server
        </button>
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button
          className={`tab-button ${activeTab === 'artist' ? 'active' : ''}`}
          onClick={() => setActiveTab('artist')}
        >
          Edit Artist Page
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'bulk-upload' && (
          <div className="settings-section">
            <h2>Bulk Media Upload</h2>
            <p className="section-description">
              Upload multiple media files at once. Files will be automatically organized by artwork ID.
            </p>
            <BulkUpload />
          </div>
        )}

        {activeTab === 'csv-import' && (
          <div className="settings-section">
            <h2>CSV Import</h2>
            <p className="section-description">
              Import artwork data from a CSV file. This will create new artwork entries in the database.
            </p>
            <CSVUpload />
          </div>
        )}

        {activeTab === 'missing-data' && (
          <div className="settings-section">
            <h2>Missing Data Report</h2>
            <p className="section-description">
              Find artworks that are missing specific fields. Select which fields to check for missing data.
            </p>
            
            <div className="missing-data-filters">
              <h3>Check for Missing:</h3>
              <div className="filter-checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.title}
                    onChange={() => handleFilterChange('title')}
                  />
                  Title
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.year}
                    onChange={() => handleFilterChange('year')}
                  />
                  Year
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.medium}
                    onChange={() => handleFilterChange('medium')}
                  />
                  Medium
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.dimensions}
                    onChange={() => handleFilterChange('dimensions')}
                  />
                  Dimensions
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.owner_name}
                    onChange={() => handleFilterChange('owner_name')}
                  />
                  Owner Name
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.description}
                    onChange={() => handleFilterChange('description')}
                  />
                  Description
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.more_info}
                    onChange={() => handleFilterChange('more_info')}
                  />
                  More Info
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={missingDataFilters.media}
                    onChange={() => handleFilterChange('media')}
                  />
                  Media Files
                </label>
              </div>
              <button onClick={fetchMissingData} className="refresh-button">
                Refresh
              </button>
            </div>

            {loadingMissing ? (
              <div className="loading">Loading missing data...</div>
            ) : (
              <>
                <div className="missing-data-summary">
                  <p>
                    Found <strong>{missingData.length}</strong> artwork{missingData.length !== 1 ? 's' : ''} with missing data
                  </p>
                </div>

                {missingData.length === 0 ? (
                  <div className="no-missing-data">
                    <p>✓ All artworks have the selected fields filled in!</p>
                  </div>
                ) : (
                  <div className="missing-data-list">
                    <table className="missing-data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Title</th>
                          <th>Year</th>
                          <th>Missing Fields</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingData.map((artwork) => (
                          <tr key={artwork.id}>
                            <td>#{artwork.id_display}</td>
                            <td>{artwork.title || <em>No Title</em>}</td>
                            <td>{artwork.year || <em>No Year</em>}</td>
                            <td>
                              <div className="missing-fields">
                                {artwork.missingFields.map((field, index) => (
                                  <span key={index} className="missing-field-badge">
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <Link
                                to={`/edit/${artwork.id}`}
                                className="edit-link"
                              >
                                Edit
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div className="settings-section">
            <h2>Export Database</h2>
            <p className="section-description">
              Export artwork data in CSV or XLS format. Choose from different field selections based on your needs.
            </p>

            <div className="export-options">
              <div className="export-section">
                <h3>Artwork Data Export</h3>
                <p className="export-description">
                  Choose a field set and format, then export your data.
                </p>
                <div className="export-controls">
                  <div className="export-control">
                    <label htmlFor="export-fields">Fields</label>
                    <select
                      id="export-fields"
                      value={exportFields}
                      onChange={(e) => setExportFields(e.target.value)}
                    >
                      <option value="all">All Fields</option>
                      <option value="basic">Basic Information</option>
                      <option value="owner">Owner Information</option>
                      <option value="inventory">Inventory Information</option>
                    </select>
                  </div>
                  <div className="export-control">
                    <label htmlFor="export-format">Format</label>
                    <select
                      id="export-format"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                    >
                      <option value="csv">CSV</option>
                      <option value="xls">XLS</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleExportData}
                  className="btn btn-primary export-btn"
                >
                  Export Data
                </button>
              </div>

              <div className="export-section">
                <h3>Media Files Backup</h3>
                <p className="export-description">
                  Download all media files (images, videos, audio) as a ZIP archive. Preserves folder structure by artwork ID.
                </p>
                <div className="export-buttons">
                  <button
                    onClick={handleMediaBackup}
                    className="btn btn-primary export-btn"
                  >
                    Download Media Backup (ZIP)
                  </button>
                </div>
              </div>

              <div className="export-section">
                <h3>Image Files Backup</h3>
                <p className="export-description">
                  Download all image files only (jpg, png, gif, webp, etc.) as a ZIP archive.
                </p>
                <div className="export-buttons">
                  <button
                    onClick={handleImagesBackup}
                    className="btn btn-primary export-btn"
                  >
                    Download Images Only (ZIP)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'db-management' && (
          <div className="settings-section">
            <h2>Database Management</h2>
            <p className="section-description">
              Check and fix discrepancies between the filesystem and database. This tool compares media files on disk with database records.
            </p>

            <div className="db-management-tools">
              <div className="db-tool-section">
                <h3>Check Database</h3>
                <p className="tool-description">
                  Scan the media directory and compare it with the database to find missing entries, orphaned files, and other discrepancies.
                </p>
                <button
                  onClick={handleDbCheck}
                  disabled={dbCheckLoading}
                  className="btn btn-primary db-tool-btn"
                >
                  {dbCheckLoading ? 'Checking...' : 'Check Database'}
                </button>
              </div>

              <div className="db-tool-section">
                <h3>Fix Database</h3>
                <p className="tool-description">
                  Automatically add missing media files to the database. This will register files that exist on disk but are not in the database.
                </p>
                <button
                  onClick={handleDbFix}
                  disabled={dbFixLoading || !dbCheckResults}
                  className="btn btn-primary db-tool-btn"
                >
                  {dbFixLoading ? 'Fixing...' : 'Fix Database'}
                </button>
              </div>
            </div>

            {dbCheckResults && (
              <div className="db-results">
                <h3>Check Results</h3>
                <div className="db-summary">
                  <div className="summary-item">
                    <strong>Total Folders:</strong> {dbCheckResults.summary.totalFolders}
                  </div>
                  <div className="summary-item">
                    <strong>Total Artworks:</strong> {dbCheckResults.summary.totalArtworks}
                  </div>
                  <div className="summary-item">
                    <strong>Total Media Records:</strong> {dbCheckResults.summary.totalMediaRecords}
                  </div>
                  <div className="summary-item">
                    <strong>Total Issues:</strong> {dbCheckResults.summary.totalIssues}
                  </div>
                </div>

                {dbCheckResults.summary.totalIssues === 0 ? (
                  <div className="db-success">
                    ✅ All checks passed! No discrepancies found.
                  </div>
                ) : (
                  <div className="db-issues">
                    {dbCheckResults.foldersWithoutArtwork.length > 0 && (
                      <div className="issue-group">
                        <h4>⚠️ Folders Without Artwork ({dbCheckResults.foldersWithoutArtwork.length})</h4>
                        <ul>
                          {dbCheckResults.foldersWithoutArtwork.map((issue, idx) => (
                            <li key={idx}>Folder: {issue.folder} (Artwork ID: {issue.artworkId})</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {dbCheckResults.filesNotInMediaTable.length > 0 && (
                      <div className="issue-group">
                        <h4>⚠️ Files Not in Media Table ({dbCheckResults.filesNotInMediaTable.length})</h4>
                        <ul>
                          {dbCheckResults.filesNotInMediaTable.slice(0, 20).map((issue, idx) => (
                            <li key={idx}>
                              {issue.folder}/{issue.filename} (Artwork ID: {issue.artworkId}, Type: {issue.fileType})
                            </li>
                          ))}
                          {dbCheckResults.filesNotInMediaTable.length > 20 && (
                            <li>... and {dbCheckResults.filesNotInMediaTable.length - 20} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {dbCheckResults.artworksWithoutFolders.length > 0 && (
                      <div className="issue-group">
                        <h4>⚠️ Artworks Without Folders ({dbCheckResults.artworksWithoutFolders.length})</h4>
                        <ul>
                          {dbCheckResults.artworksWithoutFolders.map((issue, idx) => (
                            <li key={idx}>
                              Artwork ID: {issue.artworkId} - "{issue.title}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {dbCheckResults.mediaRecordsWithoutFiles.length > 0 && (
                      <div className="issue-group">
                        <h4>⚠️ Media Records Without Files ({dbCheckResults.mediaRecordsWithoutFiles.length})</h4>
                        <ul>
                          {dbCheckResults.mediaRecordsWithoutFiles.map((issue, idx) => (
                            <li key={idx}>
                              Artwork ID: {issue.artworkId}, File: {issue.filename} (Type: {issue.fileType})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {dbCheckResults.artworksWithoutMedia.length > 0 && (
                      <div className="issue-group">
                        <h4>⚠️ Artworks Without Media Records ({dbCheckResults.artworksWithoutMedia.length})</h4>
                        <ul>
                          {dbCheckResults.artworksWithoutMedia.map((issue, idx) => (
                            <li key={idx}>
                              Artwork ID: {issue.artworkId} - "{issue.title}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {dbFixResults && (
              <div className="db-results">
                <h3>Fix Results</h3>
                <div className="db-summary">
                  <div className="summary-item success">
                    <strong>Added:</strong> {dbFixResults.added}
                  </div>
                  {dbFixResults.errors > 0 && (
                    <div className="summary-item error">
                      <strong>Errors:</strong> {dbFixResults.errors}
                    </div>
                  )}
                </div>
                {dbFixResults.message && (
                  <div className={`db-message ${dbFixResults.errors > 0 ? 'error' : 'success'}`}>
                    {dbFixResults.message}
                  </div>
                )}
                {dbFixResults.fixes && dbFixResults.fixes.length > 0 && (
                  <div className="fix-details">
                    <h4>Files Fixed:</h4>
                    <ul>
                      {dbFixResults.fixes.slice(0, 20).map((fix, idx) => (
                        <li key={idx} className={fix.success ? 'success' : 'error'}>
                          {fix.success ? '✓' : '✗'} {formatArtworkId(fix.artworkId)}/{fix.filename} ({fix.fileType})
                          {fix.error && <span className="error-text"> - {fix.error}</span>}
                        </li>
                      ))}
                      {dbFixResults.fixes.length > 20 && (
                        <li>... and {dbFixResults.fixes.length - 20} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="settings-section">
            <h2>User Management</h2>
            {!user ? (
              <div className="error-message">
                You must be logged in to manage users. Please log in first.
              </div>
            ) : (
              <div className="user-management">
                {userError && (
                  <div className="error-message">{userError}</div>
                )}
                {userSuccess && (
                  <div className="success-message">{userSuccess}</div>
                )}

              <div className="change-password-section">
                <h3>Change Your Password</h3>
                <form onSubmit={handleChangePassword} className="change-password-form">
                  {passwordError && (
                    <div className="error-message">{passwordError}</div>
                  )}
                  {passwordSuccess && (
                    <div className="success-message">{passwordSuccess}</div>
                  )}
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="current-password">Current Password</label>
                      <input
                        type="password"
                        id="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        disabled={changingPassword}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new-password-change">New Password</label>
                      <small style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Minimum 6 characters</small>
                      <input
                        type="password"
                        id="new-password-change"
                        value={newPasswordChange}
                        onChange={(e) => setNewPasswordChange(e.target.value)}
                        required
                        minLength={6}
                        disabled={changingPassword}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="confirm-password">Confirm New Password</label>
                      <input
                        type="password"
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={changingPassword}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="form-group">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={changingPassword || !currentPassword || !newPasswordChange || !confirmPassword}
                      >
                        {changingPassword ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="create-user-section">
                <h3>Create New User</h3>
                <form onSubmit={handleCreateUser} className="create-user-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="new-username">Username</label>
                      <input
                        type="text"
                        id="new-username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required
                        autoComplete="username"
                        disabled={creatingUser}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new-password">Password</label>
                      <small style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Minimum 6 characters</small>
                      <input
                        type="password"
                        id="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={creatingUser}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="form-group">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingUser || !newUsername || !newPassword}
                      >
                        {creatingUser ? 'Creating...' : 'Create User'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="users-list-section">
                <h3>All Users</h3>
                {usersLoading ? (
                  <div className="loading">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="no-results">No users found</div>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.id}</td>
                          <td>
                            {u.username}
                            {user && u.id === user.id && (
                              <span className="current-user-badge"> (You)</span>
                            )}
                          </td>
                          <td>
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString()
                              : '—'}
                          </td>
                          <td>
                            {user && u.id === user.id ? (
                              <span className="cannot-delete">Cannot delete yourself</span>
                            ) : (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'artist' && (
          <div className="settings-section">
            <h2>Edit Artist Page</h2>
            <p className="section-description">
              Edit the artist biography, statement, and contact information displayed on the Artist and Contact pages.
            </p>
            
            {artistLoading ? (
              <div className="loading">Loading artist information...</div>
            ) : (
              <form onSubmit={handleArtistSave} className="artist-form">
                {artistError && (
                  <div className="error-message">{artistError}</div>
                )}
                {artistSuccess && (
                  <div className="success-message">{artistSuccess}</div>
                )}

                <div className="form-group">
                  <label htmlFor="artist-name">Name</label>
                  <input
                    type="text"
                    id="artist-name"
                    name="name"
                    value={artistInfo.name || ''}
                    onChange={handleArtistChange}
                    className="form-input"
                    placeholder="Artist name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="artist-bio">Biography (Artist Page)</label>
                  <textarea
                    id="artist-bio"
                    name="bio"
                    value={artistInfo.bio || ''}
                    onChange={handleArtistChange}
                    className="form-input"
                    rows="6"
                    placeholder="Biography displayed on the Artist page"
                  />
                  <small>This appears on the Artist page</small>
                </div>

                <div className="form-group">
                  <label htmlFor="artist-statement">Artist Statement (Artist Page)</label>
                  <textarea
                    id="artist-statement"
                    name="statement"
                    value={artistInfo.statement || ''}
                    onChange={handleArtistChange}
                    className="form-input"
                    rows="6"
                    placeholder="Artist statement displayed on the Artist page"
                  />
                  <small>This appears on the Artist page</small>
                </div>

                <div className="form-group">
                  <label htmlFor="artist-contact-bio">About the Artist (Contact Page)</label>
                  <textarea
                    id="artist-contact-bio"
                    name="contact_bio"
                    value={artistInfo.contact_bio || ''}
                    onChange={handleArtistChange}
                    className="form-input"
                    rows="6"
                    placeholder="About the Artist section on the Contact page"
                  />
                  <small>This appears on the Contact page</small>
                </div>

                <div className="form-group">
                  <label htmlFor="artist-contact-statement">Artist Statement (Contact Page)</label>
                  <textarea
                    id="artist-contact-statement"
                    name="contact_statement"
                    value={artistInfo.contact_statement || ''}
                    onChange={handleArtistChange}
                    className="form-input"
                    rows="6"
                    placeholder="Artist statement displayed on the Contact page"
                  />
                  <small>This appears on the Contact page</small>
                </div>

                <div className="form-group">
                  <label htmlFor="artist-inquiry-email">Inquiry Email</label>
                  <input
                    type="email"
                    id="artist-inquiry-email"
                    name="inquiry_email"
                    value={artistInfo.inquiry_email || ''}
                    onChange={handleArtistChange}
                    className="form-input"
                    placeholder="email@example.com"
                  />
                  <small>Email address displayed on the Contact page for inquiries</small>
                </div>

                <div className="form-group">
                  <label htmlFor="artist-photo">Artist Photo</label>
                  <input
                    type="file"
                    id="artist-photo"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="form-input"
                  />
                  {artistInfo.photo_filename && (
                    <div className="photo-preview">
                      <img
                        src={`/media/artist/${artistInfo.photo_filename}`}
                        alt="Artist photo"
                        style={{ maxWidth: '300px', marginTop: '1rem', borderRadius: '8px' }}
                      />
                      <p className="photo-filename">Current photo: {artistInfo.photo_filename}</p>
                    </div>
                  )}
                  <small>Upload a photo to display on the Artist page</small>
                </div>

                <div className="form-group">
                  <label htmlFor="artist-gallery-images">Artist Gallery Images</label>
                  <input
                    type="file"
                    id="artist-gallery-images"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryImageUpload}
                    className="form-input"
                    disabled={galleryUploading}
                  />
                  <small>Upload one or more images to display in the Artist Gallery (click the artist photo on the Artist page to view). You can select multiple images at once.</small>
                  {galleryUploading && <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Uploading images...</p>}
                </div>

                {galleryLoading ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Loading gallery images...</p>
                ) : galleryImages.length > 0 ? (
                  <div className="gallery-images-list">
                    <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Gallery Images ({galleryImages.length})</h4>
                    <div className="gallery-images-grid">
                      {galleryImages.map((image) => (
                        <div key={image.id} className="gallery-image-item">
                          <img
                            src={`/media/artist/gallery/${image.filename}`}
                            alt={`Gallery image ${image.id}`}
                            className="gallery-image-preview"
                          />
                          <button
                            type="button"
                            onClick={() => handleGalleryImageDelete(image.id)}
                            className="btn btn-danger btn-sm"
                            style={{ marginTop: '0.5rem' }}
                            disabled={galleryLoading}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>No gallery images yet.</p>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={artistSaving}>
                    {artistSaving ? 'Saving...' : 'Save Artist Information'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === 'server' && (
          <div className="settings-section">
            <h2>Server Status</h2>
            <p className="section-description">
              Monitor server status, system resources, database statistics, and view server logs.
            </p>

            {serverLoading && !serverStatus ? (
              <div className="loading">Loading server status...</div>
            ) : serverStatus ? (
              <div className="server-status-wrapper">
                <div className="server-status-cards">
                  <div className="server-status-card">
                    <div className="server-status-card-header">
                      <h3>Server Status</h3>
                      <span className={`server-status-badge server-status-${serverStatus.status || 'unknown'}`}>
                        {serverStatus.status === 'running' ? '🟢 Running' : 
                         serverStatus.status === 'error' ? '🔴 Error' : '⚪ Unknown'}
                      </span>
                    </div>
                    <div className="server-status-card-content">
                      <div className="server-status-item">
                        <span className="server-status-label">Uptime:</span>
                        <span className="server-status-value">{formatUptime(serverStatus.uptime || 0)}</span>
                      </div>
                      <div className="server-status-item">
                        <span className="server-status-label">Port:</span>
                        <span className="server-status-value">{serverStatus.port || 'N/A'}</span>
                      </div>
                      <div className="server-status-item">
                        <span className="server-status-label">Environment:</span>
                        <span className="server-status-value">{serverStatus.environment || 'N/A'}</span>
                      </div>
                      <div className="server-status-item">
                        <span className="server-status-label">Node Version:</span>
                        <span className="server-status-value">{serverStatus.nodeVersion || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {serverStatus.memory && (
                    <div className="server-status-card">
                      <div className="server-status-card-header">
                        <h3>Memory Usage</h3>
                      </div>
                      <div className="server-status-card-content">
                        <div className="server-status-item">
                          <span className="server-status-label">Heap Used:</span>
                          <span className="server-status-value">{formatBytes(serverStatus.memory.used || 0)}</span>
                        </div>
                        <div className="server-status-item">
                          <span className="server-status-label">Heap Total:</span>
                          <span className="server-status-value">{formatBytes(serverStatus.memory.total || 0)}</span>
                        </div>
                        <div className="server-status-item">
                          <span className="server-status-label">RSS:</span>
                          <span className="server-status-value">{formatBytes(serverStatus.memory.rss || 0)}</span>
                        </div>
                        {serverStatus.memory.percentage !== undefined && (
                          <div className="server-status-item">
                            <span className="server-status-label">System Memory:</span>
                            <span className="server-status-value">
                              {formatBytes(serverStatus.memory.systemUsed || 0)} / {formatBytes(serverStatus.memory.systemTotal || 0)} 
                              ({serverStatus.memory.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {serverStatus.database && (
                    <div className="server-status-card">
                      <div className="server-status-card-header">
                        <h3>Database Statistics</h3>
                      </div>
                      <div className="server-status-card-content">
                        <div className="server-status-item">
                          <span className="server-status-label">Artworks:</span>
                          <span className="server-status-value">{serverStatus.database.artworks || 0}</span>
                        </div>
                        <div className="server-status-item">
                          <span className="server-status-label">Media Files:</span>
                          <span className="server-status-value">{serverStatus.database.media || 0}</span>
                        </div>
                        <div className="server-status-item">
                          <span className="server-status-label">Series:</span>
                          <span className="server-status-value">{serverStatus.database.series || 0}</span>
                        </div>
                        <div className="server-status-item">
                          <span className="server-status-label">Exhibitions:</span>
                          <span className="server-status-value">{serverStatus.database.exhibitions || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="server-logs-section">
                  <div className="server-logs-header">
                    <h3>Server Logs</h3>
                    <button
                      onClick={fetchServerStatus}
                      className="btn btn-secondary btn-sm"
                      title="Refresh logs"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                  <div className="server-logs-container">
                    {serverLogs.length > 0 ? (
                      <div className="server-logs-list">
                        {serverLogs.slice(-50).reverse().map((log, index) => (
                          <div key={index} className={`server-log-entry server-log-${log.level || 'info'}`}>
                            <span className="server-log-time">{log.time}</span>
                            <span className="server-log-message">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="server-no-logs">No logs available</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="server-error">Unable to fetch server status</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;

