import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Series.css';

function Series() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSeries, setNewSeries] = useState({ name: '', description: '' });
  const [addingSeries, setAddingSeries] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [seriesThumbnails, setSeriesThumbnails] = useState({});
  
  const getVisibleMediaFiles = (artwork) => {
    const files = Array.isArray(artwork?.media_files) ? artwork.media_files : [];
    const publicFlags = Array.isArray(artwork?.media_public) ? artwork.media_public : [];

    if (isAuthenticated || publicFlags.length === 0) {
      return files;
    }

    return files.filter((file, idx) => {
      const isPublic = publicFlags[idx] !== 0 && publicFlags[idx] !== '0';
      if (!isPublic) return false;
      const flag = artwork?.hide_images_public;
      const hideImages = flag === 1 || flag === '1' || flag === true;
      if (hideImages && file && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file)) {
        return false;
      }
      return true;
    });
  };

  const handleThumbnailClick = (seriesId) => {
    navigate(`/?series=${seriesId}&view=series`);
  };

  useEffect(() => {
    fetchSeries();
  }, []);

  const fetchSeries = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/series');
      const seriesData = response.data || [];
      setSeries(seriesData);
      
      // Fetch artworks for each series and get random thumbnails
      const thumbnails = {};
      for (const seriesItem of seriesData) {
        try {
          const seriesResponse = await axios.get(`/api/series/${seriesItem.id}`);
          const artworks = seriesResponse.data?.artworks || [];
          
          // Get primary images from artworks
          const images = artworks
            .map(artwork => {
              const visibleFiles = getVisibleMediaFiles(artwork);
              if (visibleFiles.length === 0) {
                return null;
              }
              
              // Find primary media
              const primaryIndex = artwork.media_primary?.findIndex(p => p === '1' || p === 1 || p === true);
              if (primaryIndex !== -1 && primaryIndex !== undefined) {
                const filename = visibleFiles[primaryIndex];
                const fileType = artwork.media_types?.[primaryIndex];
                // Only include images
                if (fileType === 'image' || (filename && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename))) {
                  return {
                    artworkId: artwork.id,
                    filename: filename,
                    title: artwork.title || `Artwork #${artwork.id}`
                  };
                }
              }
              
              // Fallback to first image
              const firstFile = visibleFiles[0];
              const firstType = artwork.media_types?.[0];
              if (firstType === 'image' || (firstFile && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(firstFile))) {
                return {
                  artworkId: artwork.id,
                  filename: firstFile,
                  title: artwork.title || `Artwork #${artwork.id}`
                };
              }
              
              return null;
            })
            .filter(img => img !== null);
          
          // Select images - more for better visual fill
          if (images.length > 0) {
            const shuffled = [...images].sort(() => Math.random() - 0.5);
            // Use all available images (up to a reasonable max like 12)
            thumbnails[seriesItem.id] = shuffled.slice(0, Math.min(12, images.length));
          } else {
            thumbnails[seriesItem.id] = [];
          }
        } catch (error) {
          console.error(`Error fetching artworks for series ${seriesItem.id}:`, error);
          thumbnails[seriesItem.id] = [];
        }
      }
      
      setSeriesThumbnails(thumbnails);
    } catch (error) {
      console.error('Error fetching series:', error);
      alert('Failed to load series');
    } finally {
      setLoading(false);
    }
  };
  
  const getMediaUrl = (filename) => {
    return `/media/${filename}`;
  };

  const handleAddSeries = async (e) => {
    e.preventDefault();
    if (!newSeries.name.trim()) {
      alert('Series name is required');
      return;
    }

    setAddingSeries(true);
    try {
      await axios.post('/api/series', newSeries);
      setNewSeries({ name: '', description: '' });
      fetchSeries();
    } catch (error) {
      console.error('Error adding series:', error);
      const errorMessage = error.response?.data?.error || 'Failed to add series';
      alert(errorMessage);
    } finally {
      setAddingSeries(false);
    }
  };

  const handleEditClick = (seriesItem) => {
    setEditingSeries(seriesItem.id);
    setEditForm({ name: seriesItem.name, description: seriesItem.description || '' });
  };

  const handleUpdateSeries = async (seriesId) => {
    if (!editForm.name.trim()) {
      alert('Series name is required');
      return;
    }

    try {
      await axios.put(`/api/series/${seriesId}`, editForm);
      setEditingSeries(null);
      setEditForm({ name: '', description: '' });
      fetchSeries();
    } catch (error) {
      console.error('Error updating series:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update series';
      alert(errorMessage);
    }
  };

  const handleDeleteSeries = async (seriesId, seriesName) => {
    if (!window.confirm(`Are you sure you want to delete the series "${seriesName}"? This will remove all artwork associations with this series.`)) {
      return;
    }

    try {
      await axios.delete(`/api/series/${seriesId}`);
      fetchSeries();
    } catch (error) {
      console.error('Error deleting series:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete series';
      alert(errorMessage);
    }
  };

  if (loading) {
    return <div className="loading">Loading series...</div>;
  }

  return (
    <div className="series-page">
      <h1>Series & Collections</h1>
      <p className="page-description">
        Organize your artwork into series or collections. Assign artworks to series from the Add/Edit Artwork pages.
      </p>

      <section className="series-list-section">
        <h2>All Series ({series.length})</h2>
        {series.length === 0 ? (
          <p className="no-series">No series created yet. Add one below.</p>
        ) : (
          <div className="series-grid">
            {series.map(seriesItem => (
              <div key={seriesItem.id} className="series-card">
                {editingSeries === seriesItem.id ? (
                  <div className="series-edit-form">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="form-input"
                      placeholder="Series name"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      className="form-input"
                      placeholder="Description (optional)"
                      rows="3"
                    />
                    <div className="series-edit-actions">
                      <button
                        onClick={() => handleUpdateSeries(seriesItem.id)}
                        className="btn btn-primary"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingSeries(null);
                          setEditForm({ name: '', description: '' });
                        }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="series-header">
                      <h3>{seriesItem.name}</h3>
                      {isAuthenticated && (
                        <div className="series-actions">
                          <button
                            onClick={() => handleEditClick(seriesItem)}
                            className="btn-icon"
                            title="Edit series"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteSeries(seriesItem.id, seriesItem.name)}
                            className="btn-icon"
                            title="Delete series"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    {seriesItem.description && (
                      <p className="series-description">{seriesItem.description}</p>
                    )}
                    {seriesThumbnails[seriesItem.id] && seriesThumbnails[seriesItem.id].length > 0 && (
                      <div className="series-thumbnails">
                        {seriesThumbnails[seriesItem.id].map((thumb, index) => (
                          <img
                            key={index}
                            src={getMediaUrl(thumb.filename)}
                            alt={thumb.title}
                            className="series-thumbnail"
                            title={thumb.title}
                            onClick={() => handleThumbnailClick(seriesItem.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isAuthenticated && (
        <section className="add-series-section">
          <h2>Add New Series</h2>
          <form onSubmit={handleAddSeries} className="add-series-form">
          <div className="form-group">
            <label htmlFor="series-name">Series Name *</label>
            <input
              type="text"
              id="series-name"
              value={newSeries.name}
              onChange={(e) => setNewSeries(prev => ({ ...prev, name: e.target.value }))}
              className="form-input"
              placeholder="e.g., Abstract Works, Portraits, etc."
              required
            />
          </div>
          <div className="form-group full-width">
            <label htmlFor="series-description">Description</label>
            <textarea
              id="series-description"
              value={newSeries.description}
              onChange={(e) => setNewSeries(prev => ({ ...prev, description: e.target.value }))}
              className="form-input"
              placeholder="Optional description of this series"
              rows="3"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={addingSeries}
          >
            {addingSeries ? 'Adding...' : 'Add Series'}
          </button>
        </form>
      </section>
      )}
    </div>
  );
}

export default Series;





