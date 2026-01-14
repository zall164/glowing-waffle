import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ScrollToTopButton from './ScrollToTopButton';
import './ForSale.css';

function ForSale() {
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [hideArtWithoutImages, setHideArtWithoutImages] = useState(() => {
    return localStorage.getItem('forSaleHideArtWithoutImages') === 'true';
  });
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [artistInfo, setArtistInfo] = useState(null);
  const [mobileActionArtwork, setMobileActionArtwork] = useState(null);
  const { isAuthenticated } = useAuth();
  const { isArtistic, theme } = useTheme();
  const navigate = useNavigate();

  const handleImageContextMenu = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const antiSaveImageProps = isAuthenticated
    ? {}
    : {
        onContextMenu: handleImageContextMenu,
        draggable: false
      };

  useEffect(() => {
    if (!isAuthenticated) return;
    localStorage.setItem('forSaleHideArtWithoutImages', hideArtWithoutImages ? 'true' : 'false');
  }, [hideArtWithoutImages, isAuthenticated]);

  const shouldHideWithoutImages = !isAuthenticated || hideArtWithoutImages;
  const shouldHideImagesForPublic = (artwork) => {
    const flag = artwork?.hide_images_public;
    return !isAuthenticated && (flag === 1 || flag === '1' || flag === true);
  };

  const getVisibleMediaFiles = (artwork) => {
    const files = Array.isArray(artwork?.media_files) ? artwork.media_files : [];
    const publicFlags = Array.isArray(artwork?.media_public) ? artwork.media_public : [];

    if (isAuthenticated || publicFlags.length === 0) {
      return files;
    }

    return files.filter((file, idx) => {
      const isPublic = publicFlags[idx] !== 0 && publicFlags[idx] !== '0';
      if (!isPublic) return false;
      if (shouldHideImagesForPublic(artwork) && file && file.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
        return false;
      }
      return true;
    });
  };

  const artworkHasImage = (artwork) => {
    const files = getVisibleMediaFiles(artwork);
    if (!Array.isArray(files) || files.length === 0) return false;
    return files.some((f) => {
      if (!f) return false;
      const filename = String(f).split('?')[0];
      const ext = filename.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    });
  };

  useEffect(() => {
    fetchForSaleArtworks();
    fetchArtistInfo();
  }, []);

  const fetchArtistInfo = async () => {
    try {
      const response = await axios.get('/api/artist');
      setArtistInfo(response.data);
    } catch (error) {
      console.error('Error fetching artist info:', error);
    }
  };

  const fetchForSaleArtworks = async () => {
    try {
      const response = await axios.get('/api/artworks');
      // Filter artworks that are for sale
      let forSale = response.data.filter(artwork => 
        artwork.availability === 'Yes' && artwork.for_sale_price
      );
      // Guests always hide image-less items; logged-in optionally.
      if (shouldHideWithoutImages) {
        forSale = forSale.filter(artworkHasImage);
      }
      setArtworks(forSale);
    } catch (error) {
      console.error('Error fetching for sale artworks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const filteredAndSortedArtworks = React.useMemo(() => {
    // First filter
    let filtered = artworks.filter(artwork => {
      if (!searchTerm.trim()) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        String(artwork.title || '').toLowerCase().includes(searchLower) ||
        String(artwork.year ?? '').toLowerCase().includes(searchLower) ||
        String(artwork.medium || '').toLowerCase().includes(searchLower) ||
        String(artwork.id_display || artwork.id || '').toLowerCase().includes(searchLower)
      );
    });

    // If the toggle is changed after initial load, re-apply filtering without refetching.
    if (shouldHideWithoutImages) {
      filtered = filtered.filter(artworkHasImage);
    }

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'year':
          aValue = parseInt(a.year) || 0;
          bValue = parseInt(b.year) || 0;
          break;
        case 'price':
          // Remove dollar signs, commas, and whitespace, then parse
          const aPriceStr = String(a.for_sale_price || '0').replace(/[$,\s]/g, '');
          const bPriceStr = String(b.for_sale_price || '0').replace(/[$,\s]/g, '');
          aValue = parseFloat(aPriceStr) || 0;
          bValue = parseFloat(bPriceStr) || 0;
          break;
        case 'id':
          aValue = parseInt(a.id) || 0;
          bValue = parseInt(b.id) || 0;
          break;
        default:
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
      }
      
      if (sortBy === 'id' || sortBy === 'year' || sortBy === 'price') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
    });

    return sorted;
  }, [artworks, searchTerm, sortBy, sortOrder, shouldHideWithoutImages]);

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const getPrimaryMedia = (artwork) => {
    const files = getVisibleMediaFiles(artwork);
    if (!files || files.length === 0) {
      return null;
    }
    
    const primaryIndex = artwork.media_primary?.findIndex(p => p === '1' || p === 1);
    if (primaryIndex !== -1 && primaryIndex !== undefined) {
      const candidate = files[primaryIndex];
      if (candidate && artworkHasImage({ media_files: [candidate] })) return candidate;
    }
    
    // Prefer first image file
    const firstImage = files.find((f) => artworkHasImage({ media_files: [f] }));
    return firstImage || files[0];
  };

  const getMediaUrl = (filename) => {
    return `/media/${filename}`;
  };

  const formatForSalePrice = (price) => {
    if (price === null || price === undefined) return '';
    const raw = String(price).trim();
    if (!raw) return '';

    // Normalize "$", commas, whitespace for parsing
    const numericStr = raw.replace(/\$/g, '').replace(/,/g, '').trim();
    const parsed = Number.parseFloat(numericStr);
    if (!Number.isFinite(parsed)) {
      // Non-numeric (e.g. "Price on request") -> return as-is
      return raw;
    }

    // Preserve whether the original had a '$' prefix
    const hasDollar = raw.includes('$');

    // Only add/pad cents when missing
    let out = numericStr;
    if (!out.includes('.')) {
      out = `${out}.00`;
    } else {
      const [whole, frac = ''] = out.split('.');
      if (frac.length === 0) out = `${whole}.00`;
      else if (frac.length === 1) out = `${whole}.${frac}0`;
      else if (frac.length > 2) out = `${whole}.${frac.slice(0, 2)}`;
    }

    return `${hasDollar ? '$' : ''}${out}`;
  };

  const handleMarkAsSold = async (e, artworkId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Mark this artwork as sold? It will be removed from the for sale page.')) {
      return;
    }

    try {
      // Find artwork in current state
      const artwork = artworks.find(art => art.id === artworkId);
      
      if (!artwork) {
        alert('Artwork not found');
        return;
      }

      // Update availability to "Sold" using existing artwork data
      await axios.put(`/api/artworks/${artworkId}`, {
        year: artwork.year,
        title: artwork.title,
        dimensions: artwork.dimensions,
        medium: artwork.medium,
        value: artwork.value,
        availability: 'Sold',
        for_sale_price: artwork.for_sale_price,
        description: artwork.description,
        owner_name: artwork.owner_name,
        owner_address: artwork.owner_address,
        owner_phone: artwork.owner_phone,
        more_info: artwork.more_info,
        storage_location: artwork.storage_location,
        past_exhibitions: artwork.past_exhibitions
      });

      // Remove from local state
      setArtworks(prev => prev.filter(art => art.id !== artworkId));
    } catch (error) {
      console.error('Error marking artwork as sold:', error);
      alert('Failed to mark artwork as sold: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditClick = (e, artworkId) => {
    e.preventDefault();
    e.stopPropagation();
    setMobileActionArtwork(null); // Close mobile popup if open
    navigate(`/edit/${artworkId}`);
  };

  const handleMobileCardClick = (e, artwork) => {
    // Only show popup on mobile/touch devices
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    if (isMobile) {
      e.preventDefault();
      e.stopPropagation();
      setMobileActionArtwork(artwork);
      return false;
    }
  };

  const handleCloseMobileActions = () => {
    setMobileActionArtwork(null);
  };

  const handleArtworkClick = (e, artwork) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setSelectedArtwork(artwork);
      setSelectedMediaIndex(0);
    }
  };

  const handleClosePopup = () => {
    setSelectedArtwork(null);
    setSelectedMediaIndex(0);
  };

  const handleNextMedia = (e) => {
    e.stopPropagation();
    if (selectedArtwork) {
      const visibleFiles = getVisibleMediaFiles(selectedArtwork);
      if (visibleFiles.length === 0) return;
      setSelectedMediaIndex((prev) => 
        prev < visibleFiles.length - 1 ? prev + 1 : 0
      );
    }
  };

  const handlePrevMedia = (e) => {
    e.stopPropagation();
    if (selectedArtwork) {
      const visibleFiles = getVisibleMediaFiles(selectedArtwork);
      if (visibleFiles.length === 0) return;
      setSelectedMediaIndex((prev) => 
        prev > 0 ? prev - 1 : visibleFiles.length - 1
      );
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && selectedArtwork) {
      handleClosePopup();
    } else if (e.key === 'ArrowRight' && selectedArtwork) {
      handleNextMedia(e);
    } else if (e.key === 'ArrowLeft' && selectedArtwork) {
      handlePrevMedia(e);
    }
  };

  useEffect(() => {
    if (selectedArtwork) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedArtwork]);

  if (loading) {
    return <div className="for-sale-page loading">Loading...</div>;
  }

  return (
    <div className="for-sale-page">
      <div className="for-sale-top-section" style={{ backgroundImage: (isArtistic || theme === 'artistic-dark') ? 'url(/enter.png)' : 'none' }}>
        <div className="for-sale-header">
          <h1>Artwork For Sale</h1>
          <form onSubmit={handleSearch} className="for-sale-search-form">
            <input
              type="text"
              placeholder="Search artworks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="for-sale-search-input"
            />
          </form>
        </div>

        <div className="for-sale-controls">
          <div className="for-sale-sort-controls">
            <label htmlFor="sort-by">Sort by:</label>
            <select 
              id="sort-by"
              value={sortBy} 
              onChange={handleSortChange}
              className="for-sale-sort-select"
            >
              <option value="title">Title</option>
              <option value="year">Year</option>
              <option value="price">Price</option>
              <option value="id">ID</option>
            </select>
            <button 
              onClick={toggleSortOrder}
              className="for-sale-sort-order-btn"
              title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
            {isAuthenticated && (
              <label className="for-sale-image-filter-toggle" title="Hide for-sale artworks that have no image media">
                <input
                  type="checkbox"
                  checked={hideArtWithoutImages}
                  onChange={(e) => setHideArtWithoutImages(e.target.checked)}
                />
                Hide art without images
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="for-sale-content">
      {filteredAndSortedArtworks.length === 0 ? (
        <div className="no-results">
          <p>{searchTerm ? 'No artworks match your search.' : 'No artworks currently available for sale.'}</p>
        </div>
      ) : (
        <div className="for-sale-grid">
          {filteredAndSortedArtworks.map((artwork) => {
            const hidePublicImage = shouldHideImagesForPublic(artwork);
            const primaryMedia = hidePublicImage ? null : getPrimaryMedia(artwork);
            
            return (
              <div key={artwork.id} className="for-sale-card">
                {isAuthenticated ? (
                  <Link 
                    to={`/edit/${artwork.id}`} 
                    className="for-sale-link"
                    onClick={(e) => handleMobileCardClick(e, artwork)}
                  >
                    <div className="for-sale-image-container">
                      {primaryMedia ? (
                        <img
                          src={getMediaUrl(primaryMedia)}
                          alt={artwork.title || 'Artwork'}
                          className={`for-sale-image ${!isAuthenticated ? 'no-save-image' : ''}`}
                          {...antiSaveImageProps}
                        />
                      ) : (
                        <div className="for-sale-no-image">No Image</div>
                      )}
                      <div className="for-sale-actions-overlay">
                        <button
                          className="for-sale-edit-button"
                          onClick={(e) => handleEditClick(e, artwork.id)}
                          title="Edit artwork"
                        >
                          ✏️
                        </button>
                        <button
                          className="for-sale-sold-button"
                          onClick={(e) => handleMarkAsSold(e, artwork.id)}
                          title="Mark as sold"
                        >
                          ✓ Sold
                        </button>
                      </div>
                    </div>
                    <div className="for-sale-info">
                      <div className="for-sale-id">#{artwork.id_display}</div>
                      <h3 className="for-sale-title">{artwork.title || 'Untitled'}</h3>
                      {artwork.year && (
                        <div className="for-sale-year">{artwork.year}</div>
                      )}
                      {artwork.medium && (
                        <div className="for-sale-medium">{artwork.medium}</div>
                      )}
                      {artwork.dimensions && (
                        <div className="for-sale-dimensions">{artwork.dimensions}</div>
                      )}
                      <div className="for-sale-price">
                        {formatForSalePrice(artwork.for_sale_price) || 'Price on request'}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div 
                    className="for-sale-card-content" 
                    onClick={(e) => handleArtworkClick(e, artwork)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="for-sale-image-container">
                      {primaryMedia ? (
                        <img
                          src={getMediaUrl(primaryMedia)}
                          alt={artwork.title || 'Artwork'}
                          className={`for-sale-image ${!isAuthenticated ? 'no-save-image' : ''}`}
                          {...antiSaveImageProps}
                        />
                      ) : (
                        <div className="for-sale-no-image">No Image</div>
                      )}
                    </div>
                    <div className="for-sale-info">
                      <div className="for-sale-id">#{artwork.id_display}</div>
                      <h3 className="for-sale-title">{artwork.title || 'Untitled'}</h3>
                      {artwork.year && (
                        <div className="for-sale-year">{artwork.year}</div>
                      )}
                      {artwork.medium && (
                        <div className="for-sale-medium">{artwork.medium}</div>
                      )}
                      {artwork.dimensions && (
                        <div className="for-sale-dimensions">{artwork.dimensions}</div>
                      )}
                      <div className="for-sale-price">
                        {formatForSalePrice(artwork.for_sale_price) || 'Price on request'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {selectedArtwork && !isAuthenticated && (
        <div className="artwork-popup-modal" onClick={handleClosePopup}>
          <div className="artwork-popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="artwork-popup-close" onClick={handleClosePopup}>
              ×
            </button>
            
            {/* Media Gallery */}
            {(() => {
              const visibleMedia = getVisibleMediaFiles(selectedArtwork);
              if (visibleMedia.length === 0) {
                return (
                  <div className="artwork-popup-media">
                    <div className="for-sale-no-image">Images are hidden for public viewers.</div>
                  </div>
                );
              }
              return (
                <div className="artwork-popup-media">
                  <div className="artwork-popup-media-container">
                    {visibleMedia[selectedMediaIndex] && (() => {
                      const media = visibleMedia[selectedMediaIndex];
                      // Handle both string filenames and objects with filename property
                      const filename = typeof media === 'string' ? media : (media.filename || media);
                      const mediaType = media.type || (filename && filename.match(/\.(mp4|avi|mov|webm|mp3|wav|ogg|m4a)$/i) ? 'video' : 'image') || 'image';
                      
                      return mediaType === 'video' ? (
                        <video
                          src={getMediaUrl(filename)}
                          controls
                          className="artwork-popup-media-item"
                          autoPlay
                        />
                      ) : mediaType === 'audio' ? (
                        <div className="artwork-popup-audio">
                          <span style={{ fontSize: '4rem' }}>🎵</span>
                          <audio
                            src={getMediaUrl(filename)}
                            controls
                            className="artwork-popup-audio-player"
                            autoPlay
                          />
                        </div>
                      ) : (
                        <img
                          src={getMediaUrl(filename)}
                          alt={selectedArtwork.title || 'Artwork'}
                          className={`artwork-popup-media-item ${!isAuthenticated ? 'no-save-image' : ''}`}
                          {...antiSaveImageProps}
                        />
                      );
                    })()}
                  </div>
                  
                  {visibleMedia.length > 1 && (
                    <div className="artwork-popup-media-controls">
                      <button 
                        className="artwork-popup-nav-button"
                        onClick={handlePrevMedia}
                        aria-label="Previous"
                      >
                        ‹
                      </button>
                      <span className="artwork-popup-media-counter">
                        {selectedMediaIndex + 1} / {visibleMedia.length}
                      </span>
                      <button 
                        className="artwork-popup-nav-button"
                        onClick={handleNextMedia}
                        aria-label="Next"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Artwork Info */}
            <div className="artwork-popup-info">
              <div className="artwork-popup-header">
                <h2>{selectedArtwork.title || 'Untitled'}</h2>
                <div className="artwork-popup-id">ID: #{selectedArtwork.id_display || selectedArtwork.id}</div>
              </div>
              
              <div className="artwork-popup-body">
                <div className="artwork-popup-grid">
                  {selectedArtwork.year && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Year:</span>
                      <span className="artwork-popup-value">{selectedArtwork.year}</span>
                    </div>
                  )}
                  {selectedArtwork.medium && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Medium:</span>
                      <span className="artwork-popup-value">{selectedArtwork.medium}</span>
                    </div>
                  )}
                  {selectedArtwork.dimensions && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Dimensions:</span>
                      <span className="artwork-popup-value">{selectedArtwork.dimensions}</span>
                    </div>
                  )}
                  {selectedArtwork.for_sale_price && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Price:</span>
                      <span className="artwork-popup-value">
                        {(() => {
                          const formatted = formatForSalePrice(selectedArtwork.for_sale_price);
                          if (!formatted) return '—';
                          // Ensure popup always shows a $ for numeric values
                          return formatted.startsWith('$') ? formatted : `$${formatted}`;
                        })()}
                      </span>
                    </div>
                  )}
                  {selectedArtwork.availability && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Availability:</span>
                      <span className="artwork-popup-value">{selectedArtwork.availability}</span>
                    </div>
                  )}
                  {selectedArtwork.value && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Value:</span>
                      <span className="artwork-popup-value">{selectedArtwork.value}</span>
                    </div>
                  )}
                  {selectedArtwork.owner_address && (
                    <div className="artwork-popup-item artwork-popup-item-full">
                      <span className="artwork-popup-label">Address:</span>
                      <span className="artwork-popup-value">{selectedArtwork.owner_address}</span>
                    </div>
                  )}
                  {selectedArtwork.owner_phone && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Phone:</span>
                      <span className="artwork-popup-value">{selectedArtwork.owner_phone}</span>
                    </div>
                  )}
                  {selectedArtwork.storage_location && (
                    <div className="artwork-popup-item">
                      <span className="artwork-popup-label">Storage:</span>
                      <span className="artwork-popup-value">{selectedArtwork.storage_location}</span>
                    </div>
                  )}
                  {selectedArtwork.description && (
                    <div className="artwork-popup-item artwork-popup-item-full">
                      <span className="artwork-popup-label">Description:</span>
                      <span className="artwork-popup-value">{selectedArtwork.description}</span>
                    </div>
                  )}
                  {selectedArtwork.more_info && (
                    <div className="artwork-popup-item artwork-popup-item-full">
                      <span className="artwork-popup-label">More Info:</span>
                      <span className="artwork-popup-value">{selectedArtwork.more_info}</span>
                    </div>
                  )}
                  {selectedArtwork.past_exhibitions && (
                    <div className="artwork-popup-item artwork-popup-item-full">
                      <span className="artwork-popup-label">Past Exhibitions:</span>
                      <span className="artwork-popup-value">{selectedArtwork.past_exhibitions}</span>
                    </div>
                  )}
                </div>
                {artistInfo?.inquiry_email && (
                  <div className="artwork-popup-inquire">
                    <a
                      href={`mailto:${artistInfo.inquiry_email}?subject=Inquiry about ${selectedArtwork.title || 'Artwork'} (ID: ${selectedArtwork.id_display || selectedArtwork.id})&body=Hello,%0D%0A%0D%0AI am interested in purchasing:%0D%0A%0D%0ATitle: ${selectedArtwork.title || 'Untitled'}%0D%0AID: ${selectedArtwork.id_display || selectedArtwork.id}%0D%0A${selectedArtwork.year ? `Year: ${selectedArtwork.year}%0D%0A` : ''}${selectedArtwork.for_sale_price ? `Price: ${formatForSalePrice(selectedArtwork.for_sale_price)}%0D%0A` : ''}%0D%0APlease let me know if this artwork is still available and how I can proceed with the purchase.%0D%0A%0D%0AThank you!`}
                      className="for-sale-inquire-button"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📧 Inquire about Purchase
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Actions Popup */}
      {mobileActionArtwork && isAuthenticated && (
        <div className="for-sale-mobile-actions-modal" onClick={handleCloseMobileActions}>
          <div className="for-sale-mobile-actions-content" onClick={(e) => e.stopPropagation()}>
            <button className="for-sale-mobile-actions-close" onClick={handleCloseMobileActions}>
              ×
            </button>
            <h3 className="for-sale-mobile-actions-title">
              {mobileActionArtwork.title || 'Untitled'}
            </h3>
            <div className="for-sale-mobile-actions-buttons">
              <button
                className="for-sale-mobile-edit-button"
                onClick={(e) => handleEditClick(e, mobileActionArtwork.id)}
              >
                ✏️ Edit Artwork
              </button>
              <button
                className="for-sale-mobile-sold-button"
                onClick={(e) => {
                  handleMarkAsSold(e, mobileActionArtwork.id);
                  handleCloseMobileActions();
                }}
              >
                ✓ Mark as Sold
              </button>
            </div>
          </div>
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

export default ForSale;
