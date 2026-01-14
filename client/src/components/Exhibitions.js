import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import './Exhibitions.css';

function Exhibitions() {
  const { isAuthenticated } = useAuth();
  const [exhibitions, setExhibitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newExhibition, setNewExhibition] = useState({
    year: '',
    title: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    const fetchExhibitions = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/exhibitions');
        setExhibitions(response.data || []);
      } catch (err) {
        console.error('Error loading exhibitions:', err);
        setError('Failed to load exhibitions');
      } finally {
        setLoading(false);
      }
    };

    fetchExhibitions();
  }, []);

  const handleNewChange = (e) => {
    const { name, value } = e.target;
    setNewExhibition(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddExhibition = async (e) => {
    e.preventDefault();
    if (!newExhibition.year.trim() || !newExhibition.title.trim()) {
      alert('Please enter at least a year and title for the exhibition.');
      return;
    }

    try {
      setSaving(true);
      const response = await axios.post('/api/exhibitions', {
        year: newExhibition.year.trim(),
        title: newExhibition.title.trim(),
        location: newExhibition.location.trim(),
        notes: newExhibition.notes.trim()
      });

      // Prepend new exhibition to the list
      setExhibitions(prev => [response.data, ...prev]);
      setNewExhibition({ year: '', title: '', location: '', notes: '' });
    } catch (err) {
      console.error('Error adding exhibition:', err);
      alert(err.response?.data?.error || 'Failed to add exhibition');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="exhibitions-page loading">Loading exhibitions...</div>;
  }

  if (error) {
    return <div className="exhibitions-page error">{error}</div>;
  }

  return (
    <div className="exhibitions-page">
      <header className="exhibitions-header">
        <h1>Exhibitions</h1>
        <p className="exhibitions-subtitle">
          A record of exhibitions and shows where this artist&rsquo;s work has been presented.
        </p>
        <div className="exhibitions-count">
          {exhibitions.length} exhibition{exhibitions.length !== 1 ? 's' : ''}
        </div>
      </header>

      <section className="exhibitions-list">
        {exhibitions.map((ex) => (
          <Link key={ex.id} to={`/exhibitions/${ex.display_id || ex.id}`} className="exhibition-item exhibition-item-link">
            <div className="exhibition-year">
              <div className="exhibition-id">#{ex.display_id || ex.id}</div>
              <div className="exhibition-year-text">{ex.year}</div>
            </div>
            <div className="exhibition-main">
              <h2 className="exhibition-title">{ex.title}</h2>
              {ex.location && (
                <div className="exhibition-location">{ex.location}</div>
              )}
              {ex.notes && (
                <div className="exhibition-notes">{ex.notes}</div>
              )}
            </div>
          </Link>
        ))}
      </section>

      {isAuthenticated && (
        <section className="exhibitions-add">
          <h2>Add Exhibition</h2>
          <form className="exhibitions-form" onSubmit={handleAddExhibition}>
          <div className="exhibitions-form-row">
            <div className="exhibitions-form-group">
              <label htmlFor="ex-year">Year</label>
              <input
                id="ex-year"
                name="year"
                type="text"
                value={newExhibition.year}
                onChange={handleNewChange}
                className="form-input"
                placeholder="e.g., 2025 or 2024-25"
              />
            </div>
            <div className="exhibitions-form-group flex-2">
              <label htmlFor="ex-title">Title</label>
              <input
                id="ex-title"
                name="title"
                type="text"
                value={newExhibition.title}
                onChange={handleNewChange}
                className="form-input"
                placeholder="Exhibition title"
              />
            </div>
          </div>
          <div className="exhibitions-form-group">
            <label htmlFor="ex-location">Location</label>
            <input
              id="ex-location"
              name="location"
              type="text"
              value={newExhibition.location}
              onChange={handleNewChange}
              className="form-input"
              placeholder="Gallery / City / State"
            />
          </div>
          <div className="exhibitions-form-group">
            <label htmlFor="ex-notes">Notes (optional)</label>
            <textarea
              id="ex-notes"
              name="notes"
              rows="2"
              value={newExhibition.notes}
              onChange={handleNewChange}
              className="form-input"
              placeholder="Additional details"
            />
          </div>
          <div className="exhibitions-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Add Exhibition'}
            </button>
          </div>
        </form>
      </section>
      )}
    </div>
  );
}

export default Exhibitions;


