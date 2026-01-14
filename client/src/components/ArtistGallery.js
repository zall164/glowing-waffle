import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import './ArtistGallery.css';

function ArtistGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const { isArtistic, theme } = useTheme();

  useEffect(() => {
    fetchGalleryImages();
  }, []);

  const fetchGalleryImages = async () => {
    try {
      const response = await axios.get('/api/artist/gallery');
      setImages(response.data);
    } catch (error) {
      console.error('Error fetching gallery images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (image) => {
    setSelectedImage(image);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && selectedImage) {
      handleCloseModal();
    } else if (e.key === 'ArrowRight' && selectedImage) {
      const currentIndex = images.findIndex(img => img.id === selectedImage.id);
      const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
      setSelectedImage(images[nextIndex]);
    } else if (e.key === 'ArrowLeft' && selectedImage) {
      const currentIndex = images.findIndex(img => img.id === selectedImage.id);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
      setSelectedImage(images[prevIndex]);
    }
  };

  useEffect(() => {
    if (selectedImage) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedImage, images]);

  if (loading) {
    return <div className="artist-gallery-page loading">Loading gallery...</div>;
  }

  return (
    <div className="artist-gallery-page">
      <div className="artist-gallery-header">
        <h1>Artist Gallery</h1>
        <Link to="/artist" className="artist-gallery-back-link">
          ← Back to Artist Page
        </Link>
      </div>

      {images.length === 0 ? (
        <div className="artist-gallery-empty">
          <p>No images in the gallery yet.</p>
        </div>
      ) : (
        <div className="artist-gallery-grid">
          {images.map((image) => (
            <div
              key={image.id}
              className="artist-gallery-item"
              onClick={() => handleImageClick(image)}
            >
              <img
                src={`/media/artist/gallery/${image.filename}`}
                alt={`Gallery image ${image.id}`}
                className="artist-gallery-image"
              />
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="artist-gallery-modal" onClick={handleCloseModal}>
          <button className="artist-gallery-modal-close" onClick={handleCloseModal}>
            ×
          </button>
          <div className="artist-gallery-modal-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={`/media/artist/gallery/${selectedImage.filename}`}
              alt={`Gallery image ${selectedImage.id}`}
              className="artist-gallery-modal-image"
            />
            {images.length > 1 && (
              <div className="artist-gallery-modal-nav">
                <button
                  className="artist-gallery-modal-nav-button"
                  onClick={() => {
                    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
                    setSelectedImage(images[prevIndex]);
                  }}
                >
                  ‹
                </button>
                <span className="artist-gallery-modal-counter">
                  {images.findIndex(img => img.id === selectedImage.id) + 1} / {images.length}
                </span>
                <button
                  className="artist-gallery-modal-nav-button"
                  onClick={() => {
                    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
                    const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
                    setSelectedImage(images[nextIndex]);
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ArtistGallery;


