import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Artist.css';

function Artist() {
  const [artistInfo, setArtistInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtistInfo();
  }, []);

  const fetchArtistInfo = async () => {
    try {
      const response = await axios.get('/api/artist');
      setArtistInfo(response.data);
    } catch (error) {
      console.error('Error fetching artist info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="artist-page loading">Loading...</div>;
  }

  const photoUrl = artistInfo?.photo_filename 
    ? `/media/artist/${artistInfo.photo_filename}` 
    : null;

  return (
    <div className="artist-page">
      <div className="artist-header">
        <h1 className="artist-name-potra">Artist Name</h1>
        <img src="/arch1.png" alt="" className="artist-header-icon" />
      </div>
      
      <div className="artist-content">
        <div className="artist-photo-container">
          {photoUrl && (
            <Link to="/artist/gallery" className="artist-photo-link">
              <img
                src={photoUrl}
                alt="Artist portrait"
                className="artist-photo"
              />
            </Link>
          )}
          <Link to="/" className="artist-gallery-button">
            <span className="artist-gallery-text">Click to view gallery</span>
            <img src="/manb.png" alt="View Gallery" className="artist-gallery-image" />
            <span className="artist-gallery-text">Click to view gallery</span>
          </Link>
        </div>
        
        <div className="artist-text">
          {artistInfo?.bio && (
            <div className="artist-section">
              <h2>Biography</h2>
              <div className="artist-bio">
                {artistInfo.bio.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          )}
          
          {artistInfo?.statement && (
            <div className="artist-section">
              <h2 className="artist-statement-header">
                <img src="/arch1.png" alt="" className="artist-statement-icon" />
                Artist Statement
                <img src="/arch1.png" alt="" className="artist-statement-icon" />
              </h2>
              <div className="artist-statement">
                {artistInfo.statement.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <Link to="/" className="artist-gallery-button artist-gallery-button-mobile">
                <span className="artist-gallery-text">Click to view gallery</span>
                <img src="/manb.png" alt="View Gallery" className="artist-gallery-image" />
                <span className="artist-gallery-text">Click to view gallery</span>
              </Link>
            </div>
          )}
          
          {!artistInfo?.bio && !artistInfo?.statement && (
            <div className="artist-empty">
              <p>Artist information coming soon...</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="artist-footer">
        <Link to="/contact" className="artist-contact-link">
          Contact & Information →
        </Link>
      </div>
    </div>
  );
}

export default Artist;

