import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Gallery from './Gallery';
import './ExhibitionDetail.css';

function ExhibitionDetail() {
  const { id } = useParams(); // reverse "display id" (show number)
  const { isAuthenticated } = useAuth();

  const [exhibition, setExhibition] = useState(null);
  const [photos, setPhotos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dbExhibitionId, setDbExhibitionId] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionSaving, setDescriptionSaving] = useState(false);

  const getMediaUrl = (filename) => `/media/${filename}`;

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const exRes = await axios.get(`/api/exhibitions/display/${id}`);
        const ex = exRes.data || null;
        const exId = ex?.id;
        if (!exId) throw new Error('Exhibition not found');

        const photoRes = await axios.get(`/api/exhibitions/${exId}/photos`);

        if (!mounted) return;
        setExhibition(ex);
        setDbExhibitionId(exId);
        setPhotos(photoRes.data || []);
        setDescriptionDraft(ex?.description || '');
      } catch (err) {
        console.error('Error loading exhibition detail:', err);
        if (!mounted) return;
        setError(err.response?.data?.error || 'Failed to load exhibition');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleUploadPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!dbExhibitionId) return;

    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('photos', f));

      const res = await axios.post(`/api/exhibitions/${dbExhibitionId}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotos(res.data || []);
    } catch (err) {
      console.error('Error uploading exhibition photos:', err);
      alert(err.response?.data?.error || 'Failed to upload photos');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Delete this exhibition photo?')) return;
    if (!dbExhibitionId) return;
    try {
      await axios.delete(`/api/exhibitions/${dbExhibitionId}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      console.error('Error deleting exhibition photo:', err);
      alert(err.response?.data?.error || 'Failed to delete photo');
    }
  };

  const handleSaveDescription = async () => {
    if (!dbExhibitionId) return;
    setDescriptionSaving(true);
    try {
      const res = await axios.put(`/api/exhibitions/${dbExhibitionId}/description`, {
        description: descriptionDraft || ''
      });
      setExhibition((prev) => ({
        ...(prev || {}),
        description: res.data?.description ?? descriptionDraft
      }));
    } catch (err) {
      console.error('Error saving exhibition description:', err);
      alert(err.response?.data?.error || 'Failed to save description');
    } finally {
      setDescriptionSaving(false);
    }
  };

  if (loading) return <div className="exhibition-detail-page loading">Loading exhibition...</div>;
  if (error) return <div className="exhibition-detail-page error">{error}</div>;
  if (!exhibition) return <div className="exhibition-detail-page error">Exhibition not found</div>;

  return (
    <div className="exhibition-detail-page">
      <div className="exhibition-detail-top">
        <Link to="/exhibitions" className="exhibition-back-link">← Back to Exhibitions</Link>
      </div>

      <header className="exhibition-detail-header">
        <div className="exhibition-detail-year">#{exhibition.display_id || id} • {exhibition.year}</div>
        <h1 className="exhibition-detail-title">{exhibition.title}</h1>
        {exhibition.location && <div className="exhibition-detail-location">{exhibition.location}</div>}
        {exhibition.notes && <div className="exhibition-detail-notes">{exhibition.notes}</div>}
      </header>

      {(isAuthenticated || exhibition.description) && (
        <section className="exhibition-description-section">
          <h2>Description</h2>
          {isAuthenticated ? (
            <>
              <textarea
                className="exhibition-description-input"
                placeholder="Add a description for this exhibition..."
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                rows={4}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveDescription}
                disabled={descriptionSaving}
              >
                {descriptionSaving ? 'Saving...' : 'Save Description'}
              </button>
            </>
          ) : (
            <div className="exhibition-description-text">{exhibition.description}</div>
          )}
        </section>
      )}

      <section className="exhibition-detail-section">
        <div className="exhibition-detail-section-header">
          <h2>Exhibition Photos</h2>
          <div className="exhibition-detail-count">{photos.length} photo{photos.length !== 1 ? 's' : ''}</div>
        </div>

        {isAuthenticated && (
          <div className="exhibition-photo-upload">
            <label className="btn btn-primary">
              {uploading ? 'Uploading...' : 'Upload Photos'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadPhotos}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {photos.length === 0 ? (
          <div className="exhibition-detail-empty">No exhibition photos yet.</div>
        ) : (
          <div className="exhibition-photo-grid">
            {photos.map((p) => (
              <div key={p.id} className="exhibition-photo-tile">
                <a href={getMediaUrl(p.filename)} target="_blank" rel="noreferrer" className="exhibition-photo-link">
                  <img src={getMediaUrl(p.filename)} alt="" className="exhibition-photo-img" />
                </a>
                {isAuthenticated && (
                  <button
                    type="button"
                    className="exhibition-photo-delete"
                    onClick={() => handleDeletePhoto(p.id)}
                    title="Delete photo"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="exhibition-detail-section">
        <Gallery
          pageTitle={`Exhibition Artwork`}
          forcedPastExhibitionsIncludes={exhibition.title}
          initialSearchTerm=""
        />
      </section>
    </div>
  );
}

export default ExhibitionDetail;

