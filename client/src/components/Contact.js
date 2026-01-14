import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Contact.css';

function Contact() {
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
    return <div className="contact-page loading">Loading...</div>;
  }

  const inquiryEmail = artistInfo?.inquiry_email || '';

  return (
    <div className="contact-page">
      <h1>Contact & Information</h1>
      
      <div className="contact-content">
        {inquiryEmail && (
          <div className="contact-section">
            <h2>Inquiries</h2>
            <p>
              For inquiries about artwork, commissions, or exhibitions, please contact:
            </p>
            <p className="contact-email">
              <a href={`mailto:${inquiryEmail}`}>{inquiryEmail}</a>
            </p>
          </div>
        )}

        {artistInfo?.contact_bio && (
          <div className="contact-section">
            <h2>About the Artist</h2>
            <div className="contact-bio">
              {artistInfo.contact_bio.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}

        {artistInfo?.contact_statement && (
          <div className="contact-section">
            <h2>Artist Statement</h2>
            <div className="contact-statement">
              {artistInfo.contact_statement.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}

        {!inquiryEmail && !artistInfo?.contact_bio && !artistInfo?.contact_statement && (
          <div className="contact-empty">
            <p>Contact information coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Contact;

