import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ScrollToTopButton from './ScrollToTopButton';
import './Gallery.css';

function Gallery({ pageTitle = 'Art Gallery', initialSearchTerm = '', forcedPastExhibitionsIncludes = null }) {
  const { isAuthenticated } = useAuth();
  const { isArtistic, theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [artworks, setArtworks] = useState([]);
  const [filteredArtworks, setFilteredArtworks] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => initialSearchTerm || '');
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [infoPopupArtwork, setInfoPopupArtwork] = useState(null);
  const [mediaTab, setMediaTab] = useState('images'); // 'images' | 'av' | 'audio-desc'
  const [currentAVIndex, setCurrentAVIndex] = useState(0);
  const [currentAudioDescIndex, setCurrentAudioDescIndex] = useState(0);
  const [sortBy, setSortBy] = useState('year');
  const [sortOrder, setSortOrder] = useState('desc');
  const [hideArtWithoutImages, setHideArtWithoutImages] = useState(() => {
    return localStorage.getItem('galleryHideArtWithoutImages') === 'true';
  });
  const [viewMode, setViewMode] = useState(() => {
    // Check URL params first, then localStorage
    const urlView = searchParams.get('view');
    if (urlView) return urlView;
    const saved = localStorage.getItem('galleryViewMode');
    // If not authenticated and saved view is 'list', default to 'regular'
    return saved || 'regular';
  });

  // Reset view mode if user logs out and was in list view
  useEffect(() => {
    if (!isAuthenticated && viewMode === 'list') {
      setViewMode('regular');
      localStorage.setItem('galleryViewMode', 'regular');
    }
  }, [isAuthenticated, viewMode]);

  // Persist logged-in filter preference
  useEffect(() => {
    if (!isAuthenticated) return;
    localStorage.setItem('galleryHideArtWithoutImages', hideArtWithoutImages ? 'true' : 'false');
  }, [hideArtWithoutImages, isAuthenticated]);

  const shouldHideWithoutImages = !isAuthenticated || hideArtWithoutImages;
  const shouldHideImagesForPublic = (artwork) => {
    const flag = artwork?.hide_images_public;
    return !isAuthenticated && (flag === 1 || flag === '1' || flag === true);
  };

  const getMediaArrays = (artwork) => {
    const files = Array.isArray(artwork?.media_files) ? artwork.media_files : [];
    const types = Array.isArray(artwork?.media_types) ? artwork.media_types : [];
    const primary = Array.isArray(artwork?.media_primary) ? artwork.media_primary : [];
    const displayNames = Array.isArray(artwork?.media_display_names) ? artwork.media_display_names : [];
    const publicFlags = Array.isArray(artwork?.media_public) ? artwork.media_public : [];

    if (isAuthenticated || publicFlags.length === 0) {
      return { files, types, primary, displayNames };
    }

    const filtered = { files: [], types: [], primary: [], displayNames: [] };
    files.forEach((file, idx) => {
      const isPublic = publicFlags[idx] !== 0 && publicFlags[idx] !== '0';
      if (!isPublic) return;
      if (shouldHideImagesForPublic(artwork) && isImageFile(file)) return;
      filtered.files.push(file);
      filtered.types.push(types[idx]);
      filtered.primary.push(primary[idx]);
      filtered.displayNames.push(displayNames[idx]);
    });

    return filtered;
  };

  const artworkHasImage = (artwork) => {
    const { files } = getMediaArrays(artwork);
    if (!Array.isArray(files) || files.length === 0) return false;
    return files.some((f) => {
      if (!f) return false;
      const filename = String(f).split('?')[0]; // defensive, in case URLs are ever used
      const ext = filename.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    });
  };
  const [allSeries, setAllSeries] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(() => {
    // Check URL params for series ID
    return searchParams.get('series') || null;
  });
  const [editingDisplayName, setEditingDisplayName] = useState(null);
  const [displayNameValue, setDisplayNameValue] = useState('');
  const [mobileSeriesMenuOpen, setMobileSeriesMenuOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [miscVideos, setMiscVideos] = useState([]);
  const [selectedMiscVideo, setSelectedMiscVideo] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);
  // Zoom presets:
  // - 'fit': fit to screen (default)
  // - 1, 1.5, 2: zoom levels (100%, 150%, 200%)
  const [zoomPreset, setZoomPreset] = useState('fit');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mosaicSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000));
  const [mosaicRatios, setMosaicRatios] = useState(() => ({})); // filename -> width/height
  const mosaicContainerRef = useRef(null);
  const [mosaicContainerWidth, setMosaicContainerWidth] = useState(0);
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

  // Fetch on mount
  useEffect(() => {
    fetchArtworks();
    fetchSeries();
    fetchMiscVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track mosaic container width (so we don't overflow/clamp inside bordered containers)
  useEffect(() => {
    const el = mosaicContainerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.getBoundingClientRect().width;
      setMosaicContainerWidth(w);
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [viewMode]);
  
  // Handle URL parameters on mount
  useEffect(() => {
    const urlSeries = searchParams.get('series');
    const urlView = searchParams.get('view');
    
    if (urlSeries) {
      setSelectedSeriesId(urlSeries);
    }
    
    if (urlView) {
      setViewMode(urlView);
      localStorage.setItem('galleryViewMode', urlView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMiscVideos = async () => {
    try {
      const response = await axios.get('/api/misc-videos');
      setMiscVideos(response.data);
    } catch (error) {
      console.error('Error fetching misc videos:', error);
    }
  };
  
  // Filter and sort artworks
  useEffect(() => {
    let filtered = artworks;
    const forcedExh = (forcedPastExhibitionsIncludes || '').toLowerCase().trim();

    // Guests: always hide artworks without any images.
    // Logged-in users: optional toggle.
    if (shouldHideWithoutImages) {
      filtered = filtered.filter(artworkHasImage);
    }
    
    // In series view, filter by selected series
    if (viewMode === 'series' && selectedSeriesId) {
      filtered = filtered.filter(artwork => {
        return artwork.series && artwork.series.some(s => s.id === parseInt(selectedSeriesId));
      });
    } else if (viewMode === 'series' && !selectedSeriesId) {
      // Show all artworks when no series is selected
      filtered = filtered;
    }

    // Optional forced filter: only show artworks whose past_exhibitions includes a given string
    if (forcedExh) {
      filtered = filtered.filter((artwork) => {
        const past = String(artwork.past_exhibitions || '').toLowerCase();
        return past.includes(forcedExh);
      });
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(artwork => {
        const title = String(artwork.title || '').toLowerCase();
        const year = String(artwork.year || '').toLowerCase();
        const medium = String(artwork.medium || '').toLowerCase();
        const id = String(artwork.id_display || '').toLowerCase();
        const owner = String(artwork.owner_name || '').toLowerCase();
        const past = String(artwork.past_exhibitions || '').toLowerCase();
        
        return title.includes(searchLower) ||
               year.includes(searchLower) ||
               medium.includes(searchLower) ||
               id.includes(searchLower) ||
               owner.includes(searchLower) ||
               past.includes(searchLower);
      });
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'id':
          aValue = parseInt(a.id) || 0;
          bValue = parseInt(b.id) || 0;
          break;
        case 'year':
          // Extract first number from year string for sorting
          const aYearStr = String(a.year || '');
          const bYearStr = String(b.year || '');
          const aYearMatch = aYearStr.match(/\d{4}/);
          const bYearMatch = bYearStr.match(/\d{4}/);
          aValue = aYearMatch ? parseInt(aYearMatch[0]) : 0;
          bValue = bYearMatch ? parseInt(bYearMatch[0]) : 0;
          break;
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'medium':
          aValue = (a.medium || '').toLowerCase();
          bValue = (b.medium || '').toLowerCase();
          break;
        case 'owner_name':
          aValue = (a.owner_name || '').toLowerCase();
          bValue = (b.owner_name || '').toLowerCase();
          break;
        case 'availability':
          aValue = (a.availability || '').toLowerCase();
          bValue = (b.availability || '').toLowerCase();
          break;
        case 'value':
          // Try to extract numeric value from for_sale_price or value field
          const aPriceStr = (a.for_sale_price || a.value || '').toString().replace(/[^0-9.]/g, '');
          const bPriceStr = (b.for_sale_price || b.value || '').toString().replace(/[^0-9.]/g, '');
          aValue = aPriceStr ? parseFloat(aPriceStr) : 0;
          bValue = bPriceStr ? parseFloat(bPriceStr) : 0;
          break;
        default:
          aValue = a.id || 0;
          bValue = b.id || 0;
      }
      
      if (sortBy === 'id' || sortBy === 'year' || sortBy === 'value') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
    });
    
    setFilteredArtworks(sorted);
  }, [searchTerm, sortBy, sortOrder, artworks, viewMode, selectedSeriesId, forcedPastExhibitionsIncludes, hideArtWithoutImages, isAuthenticated]);

  const fetchArtworks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/artworks');
      setArtworks(response.data);
      // Avoid a 1-render flash of "no-image" artworks before the filter effect runs.
      setFilteredArtworks(shouldHideWithoutImages ? response.data.filter(artworkHasImage) : response.data);
    } catch (error) {
      console.error('Error fetching artworks:', error);
      console.error('Error details:', error.response?.data);
      alert('Failed to load artworks: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchSeries = async () => {
    try {
      const response = await axios.get('/api/series');
      setAllSeries(response.data || []);
    } catch (error) {
      console.error('Error fetching series:', error);
    }
  };


  const handleSearch = (e) => {
    e.preventDefault();
    // Search is handled instantly via useEffect
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleHeaderClick = (field) => {
    if (sortBy === field) {
      // If clicking the same column, toggle sort order
      toggleSortOrder();
    } else {
      // If clicking a different column, set it as sort column and default to ascending
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortableHeader = (field, label, className) => {
    const isActive = sortBy === field;
    const sortIcon = isActive ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';
    const Tag = className === 'artwork-title' ? 'h3' : 'div';
    return (
      <Tag 
        className={`${className} sortable-header ${isActive ? 'active' : ''}`}
        onClick={() => handleHeaderClick(field)}
        title={`Click to sort by ${label}`}
      >
        {label}{sortIcon}
      </Tag>
    );
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('galleryViewMode', mode);
  };

  const getPrimaryMedia = (artwork) => {
    const { files, types, primary } = getMediaArrays(artwork);
    if (!files || files.length === 0) {
      return { filename: null, index: -1, type: null };
    }
    
    // Find primary media
    const primaryIndex = primary?.findIndex(p => p === '1' || p === 1);
    if (primaryIndex !== -1 && primaryIndex !== undefined) {
      return {
        filename: files[primaryIndex],
        index: primaryIndex,
        type: types?.[primaryIndex] || null
      };
    }
    
    // Fallback to first media
    return {
      filename: files[0],
      index: 0,
      type: types?.[0] || null
    };
  };

  const getMediaUrl = (filename) => {
    return `/media/${filename}`;
  };

  // Helper to check if file is an image
  const isImageFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  };

  // Helper to check if file is audio
  const isAudioFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
  };

  // Recorded audio description files are named like: audio_description_*.webm/mp4/etc
  const isAudioDescriptionFile = (filename) => {
    const actualFilename = filename.includes('/') ? filename.split('/').pop() : filename;
    return actualFilename.toLowerCase().startsWith('audio_description_');
  };

  // Helper to check if file is video
  const isVideoFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['mp4', 'avi', 'mov', 'webm', 'mkv', 'flv', 'wmv'].includes(ext);
  };

  // Helper to check if file is AV (audio or video)
  const isAVFile = (filename) => {
    return isAudioFile(filename) || isVideoFile(filename);
  };

  // Get separated media files
  const getSeparatedMedia = (artwork) => {
    const { files, types, displayNames } = getMediaArrays(artwork);
    if (!files || files.length === 0) {
      return { images: [], av: [], audioDescriptions: [] };
    }

    const images = [];
    const av = [];
    const audioDescriptions = [];
    const mediaTypes = types || [];

    // Create a map of actual filename to display name for reliable matching
    const displayNameMap = new Map();
    files.forEach((filename, index) => {
      const actualFilename = filename.includes('/') ? filename.split('/').pop() : filename;
      const displayName = displayNames[index];
      // Handle empty strings from COALESCE as null
      if (displayName && displayName.trim() !== '' && displayName !== '') {
        displayNameMap.set(actualFilename, displayName.trim());
      }
    });

    files.forEach((filename, index) => {
      // Extract actual filename (without path) for matching
      const actualFilename = filename.includes('/') ? filename.split('/').pop() : filename;
      
      // Get display name from map
      const displayName = displayNameMap.get(actualFilename) || null;
      const typeFromDb = mediaTypes[index] || null;
      
      if (typeFromDb === 'audio_description' || isAudioDescriptionFile(filename)) {
        audioDescriptions.push({
          filename,
          index,
          type: 'audio',
          displayName: displayName,
          actualFilename: actualFilename
        });
      } else if (isImageFile(filename)) {
        images.push({ filename, index, type: 'image' });
      } else if (isAVFile(filename)) {
        av.push({ 
          filename, 
          index, 
          type: isAudioFile(filename) ? 'audio' : 'video',
          displayName: displayName,
          actualFilename: actualFilename
        });
      }
    });

    // Debug logging
    if (av.length > 0) {
      console.log('Gallery - Artwork ID:', artwork.id);
      console.log('Gallery - Media files:', artwork.media_files);
      console.log('Gallery - Display names array:', displayNames);
      console.log('Gallery - Display name map:', Array.from(displayNameMap.entries()));
      console.log('Gallery - AV files with display names:', av.map(a => ({ 
        filename: a.actualFilename, 
        displayName: a.displayName 
      })));
    }

    return { images, av, audioDescriptions };
  };

  const mosaicItems = useMemo(() => {
    // Deterministic RNG so layout is stable within a page load, but changes on refresh
    const mulberry32 = (a) => {
      return () => {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    const rand = mulberry32(mosaicSeed);

    // Flatten all images across the currently filtered set
    const flat = [];
    filteredArtworks.forEach((artwork) => {
      if (shouldHideImagesForPublic(artwork)) return;
      const { images } = getSeparatedMedia(artwork);
      images.forEach((img) => {
        flat.push({
          artworkId: artwork.id,
          artworkTitle: artwork.title || 'Untitled',
          idDisplay: artwork.id_display || artwork.id,
          filename: img.filename
        });
      });
    });

    // Shuffle (Fisher–Yates)
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }

    return flat.map((item) => {
      return {
        ...item,
        url: getMediaUrl(item.filename)
      };
    });
  }, [filteredArtworks, mosaicSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const mosaicLayout = useMemo(() => {
    // Justified layout:
    // - preserves aspect ratios (no crop/letterbox)
    // - 0 gaps
    // - rows fill width exactly
    const width = mosaicContainerWidth || 0;
    if (width <= 0 || mosaicItems.length === 0) {
      return { tiles: [], height: 0 };
    }

    const baseTargetH = Math.max(90, Math.min(220, Math.round(width / 7))); // responsive-ish
    const maxRowH = Math.round(baseTargetH * 1.35);

    // First, build rows
    const rows = [];
    let current = [];
    let sum = 0;

    const pushRow = () => {
      if (current.length === 0) return;
      rows.push({ items: current, sum });
      current = [];
      sum = 0;
    };

    mosaicItems.forEach((item, idx) => {
      const ratio = mosaicRatios[item.filename] || 1; // fallback square until loaded
      current.push({ ...item, _ratio: ratio, _idx: idx });
      sum += ratio;
      if (sum * baseTargetH >= width) {
        pushRow();
      }
    });
    pushRow();

    // Rebalance last row to avoid a gigantic final tile/row.
    // If last row height would be too tall, move items from the previous row into the last row
    // until the last row height is reasonable (or we can't move more).
    if (rows.length >= 2) {
      const last = rows[rows.length - 1];
      const prev = rows[rows.length - 2];

      const lastHeight = () => (last.sum > 0 ? width / last.sum : maxRowH);

      while (
        (last.items.length < 3 || lastHeight() > maxRowH) &&
        prev.items.length > 2
      ) {
        const moved = prev.items.pop();
        if (!moved) break;
        prev.sum -= moved._ratio;
        last.items.unshift(moved);
        last.sum += moved._ratio;
      }
    }

    // Layout rows
    const tiles = [];
    let y = 0;
    rows.forEach((rowObj) => {
      const rowH = Math.max(50, Math.round(width / rowObj.sum));
      let x = 0;
      rowObj.items.forEach((item, i) => {
        const rawW = rowH * item._ratio;
        const w = i === rowObj.items.length - 1 ? Math.max(1, Math.round(width - x)) : Math.max(1, Math.floor(rawW));
        tiles.push({
          key: `${item.filename}-${item._idx}`,
          left: x,
          top: y,
          width: w,
          height: rowH,
          url: item.url,
          title: `${item.artworkTitle} (#${item.idDisplay})`,
          filename: item.filename
        });
        x += w;
      });
      y += rowH;
    });

    return { tiles, height: y };
  }, [mosaicItems, mosaicRatios, mosaicContainerWidth, mosaicSeed]);

  const handleMediaClick = (e, artwork) => {
    e.preventDefault();
    e.stopPropagation();
    const primaryMedia = getPrimaryMedia(artwork);
    if (shouldHideImagesForPublic(artwork) && primaryMedia.filename && isImageFile(primaryMedia.filename)) {
      return;
    }
    if (primaryMedia.filename) {
      setSelectedMedia(primaryMedia.filename);
      setSelectedArtwork(artwork);
      
      // Set correct tab and AV index
      const { images, av, audioDescriptions } = getSeparatedMedia(artwork);
      if (isImageFile(primaryMedia.filename)) {
        setMediaTab('images');
        setCurrentAudioDescIndex(0);
      } else if (isAVFile(primaryMedia.filename)) {
        if (isAudioDescriptionFile(primaryMedia.filename)) {
          setMediaTab('audio-desc');
          const idx = audioDescriptions.findIndex(item => item.filename === primaryMedia.filename);
          setCurrentAudioDescIndex(idx !== -1 ? idx : 0);
        } else {
          setMediaTab('av');
          const avIndex = av.findIndex(item => item.filename === primaryMedia.filename);
          if (avIndex !== -1) {
            setCurrentAVIndex(avIndex);
          }
        }
      }
    }
  };

  const handleCloseModal = () => {
    setSelectedMedia(null);
    setSelectedArtwork(null);
    setMediaTab('images');
    setCurrentAVIndex(0);
    setCurrentAudioDescIndex(0);
    setEditingDisplayName(null);
    setDisplayNameValue('');
  };

  const handleUpdateDisplayName = async (filename, displayName) => {
    if (!selectedArtwork) return;
    if (!isAuthenticated) return;
    
    try {
      // Extract actual filename (without path)
      const actualFilename = filename.includes('/') ? filename.split('/').pop() : filename;
      
      await axios.put(`/api/media/${selectedArtwork.id}/${encodeURIComponent(actualFilename)}/display-name`, {
        display_name: displayName.trim() || null
      });
      
      // Refresh artwork data
      const response = await axios.get(`/api/artworks/${selectedArtwork.id}`);
      setSelectedArtwork(response.data);
      
      // Also update in the main artworks list
      setArtworks(prev => prev.map(art => 
        art.id === selectedArtwork.id ? response.data : art
      ));
      
      setEditingDisplayName(null);
      setDisplayNameValue('');
    } catch (error) {
      console.error('Error updating display name:', error);
      alert('Failed to update display name: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateMiscVideoDisplayName = async (filename, displayName) => {
    if (!isAuthenticated) return;
    try {
      await axios.put(`/api/misc-videos/${encodeURIComponent(filename)}/display-name`, {
        display_name: displayName.trim() || null
      });
      
      // Refresh misc videos
      await fetchMiscVideos();
      
      setEditingDisplayName(null);
      setDisplayNameValue('');
    } catch (error) {
      console.error('Error updating misc video display name:', error);
      alert('Failed to update display name: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleMiscVideoClick = (video) => {
    setSelectedMiscVideo(video);
    setSelectedMedia(video.filename);
    setSelectedArtwork({
      id: 0,
      title: 'Misc Videos',
      id_display: 'Misc',
      media_files: [video.filename],
      media_types: ['video'],
      media_display_names: [video.displayName || '']
    });
    setMediaTab('av');
    setCurrentAVIndex(0);
  };

  const handleEditClick = (e, artworkId) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/edit/${artworkId}`);
  };

  const handleListClick = (e, artwork) => {
    // Only handle clicks in list view, and not on buttons or images
    if (viewMode === 'list' && !e.target.closest('button') && !e.target.closest('.artwork-image-container')) {
      e.preventDefault();
      e.stopPropagation();
      setInfoPopupArtwork(artwork);
    }
  };

  const handleCloseInfoPopup = () => {
    setInfoPopupArtwork(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (zoomedImage) {
        handleCloseZoom();
      } else if (selectedMedia) {
        handleCloseModal();
      } else if (infoPopupArtwork) {
        handleCloseInfoPopup();
      }
    }
  };

  const handleFullSizeClick = (e, mediaUrl) => {
    e.stopPropagation();
    setZoomedImage(mediaUrl);
    // Default to "Full Size" (fit-to-screen) when opening zoom
    setZoomPreset('fit');
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleCloseZoom = () => {
    setZoomedImage(null);
    setZoomPreset('fit');
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    setIsPanning(false);
  };

  const handleZoomMouseDown = (e) => {
    if (zoomPreset !== 'fit' && zoomLevel > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleZoomMouseMove = (e) => {
    if (isPanning && zoomPreset !== 'fit' && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleZoomMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    if (selectedMedia || infoPopupArtwork || zoomedImage) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedMedia, infoPopupArtwork, zoomedImage]);

  // Auto-set tab when artwork changes if only one media type exists
  useEffect(() => {
    if (selectedArtwork) {
      const { images, av } = getSeparatedMedia(selectedArtwork);
      const hasImages = images.length > 0;
      const hasAV = av.length > 0;
      
      // If only one type exists, set tab automatically
      if (hasImages && !hasAV) {
        setMediaTab('images');
      } else if (hasAV && !hasImages) {
        setMediaTab('av');
      }
    }
  }, [selectedArtwork]);

  if (loading) {
    return <div className="loading">Loading artworks...</div>;
  }

  return (
    <div className="gallery">
      <div className="gallery-top-section" style={{ backgroundImage: (isArtistic || theme === 'artistic-dark') ? 'url(/dragon.png)' : 'none' }}>
        <div className="gallery-header">
          <div className="gallery-title-row">
            <h1>{pageTitle}</h1>
            <div className="gallery-count">
              {filteredArtworks.length} artwork{filteredArtworks.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="gallery-controls">
            <div className="gallery-controls-desktop">
              <form onSubmit={handleSearch} className="search-form">
                <input
                  type="text"
                  placeholder="Search artworks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="clear-button"
                  >
                    Clear
                  </button>
                )}
              </form>
              <div className="sort-controls">
                <label className="sort-label">Sort:</label>
                <select
                  value={sortBy}
                  onChange={handleSortChange}
                  className="sort-select"
                >
                  <option value="year">Year</option>
                  <option value="id">ID</option>
                  <option value="title">Title</option>
                  <option value="medium">Medium</option>
                  <option value="owner_name">Owner</option>
                  <option value="availability">Availability</option>
                  <option value="value">Value</option>
                </select>
                <button
                  type="button"
                  onClick={toggleSortOrder}
                  className="sort-order-button"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
                {isAuthenticated && (
                  <label className="image-filter-toggle" title="Hide artworks that have no image media">
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
            <div className="gallery-controls-mobile">
              <button 
                className="mobile-controls-toggle"
                onClick={() => setMobileControlsOpen(!mobileControlsOpen)}
              >
                <span>🔍 Search & Sort</span>
                <span className="mobile-controls-icon">{mobileControlsOpen ? '▲' : '▼'}</span>
              </button>
              {mobileControlsOpen && (
                <div className="mobile-controls-menu">
                  <form onSubmit={handleSearch} className="search-form">
                    <input
                      type="text"
                      placeholder="Search artworks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="clear-button"
                      >
                        Clear
                      </button>
                    )}
                  </form>
                  <div className="sort-controls">
                    <label className="sort-label">Sort:</label>
                    <select
                      value={sortBy}
                      onChange={handleSortChange}
                      className="sort-select"
                    >
                      <option value="year">Year</option>
                      <option value="id">ID</option>
                      <option value="title">Title</option>
                      <option value="medium">Medium</option>
                      <option value="owner_name">Owner</option>
                      <option value="availability">Availability</option>
                      <option value="value">Value</option>
                    </select>
                    <button
                      type="button"
                      onClick={toggleSortOrder}
                      className="sort-order-button"
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                    {isAuthenticated && (
                      <label className="image-filter-toggle" title="Hide artworks that have no image media">
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
              )}
            </div>
            <div className="view-controls">
              <label className="view-label">View:</label>
              <div className="view-buttons">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('small')}
                  className={`view-button ${viewMode === 'small' ? 'active' : ''}`}
                  title="Small Thumbnails"
                >
                  ⚫⚫⚫
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('regular')}
                  className={`view-button ${viewMode === 'regular' ? 'active' : ''}`}
                  title="Regular Grid"
                >
                  ⬜⬜
                </button>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('list')}
                    className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                    title="List View"
                  >
                    ☰
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleViewModeChange('series')}
                  className={`view-button ${viewMode === 'series' ? 'active' : ''}`}
                  title="Series View"
                >
                  📚
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('mosaic')}
                  className={`view-button ${viewMode === 'mosaic' ? 'active' : ''}`}
                  title="Mosaic View"
                >
                  ▦
                </button>
                {miscVideos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('misc-videos')}
                    className={`view-button ${viewMode === 'misc-videos' ? 'active' : ''}`}
                    title="Misc Videos"
                  >
                    🎬
                  </button>
                )}
              </div>
            </div>
        </div>
      </div>
      </div>

      <div className={`gallery-content ${viewMode === 'mosaic' ? 'gallery-content-mosaic' : ''}`}>
      {filteredArtworks.length === 0 ? (
        <div className="no-results">
          <p>{searchTerm ? 'No artworks match your search.' : 'No artworks found.'}</p>
          {!searchTerm && (
            <Link to="/add" className="add-link">Add your first artwork</Link>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <div className="artwork-list-header">
              <div className="artwork-list-header-card">
                <div className="artwork-list-header-image"></div>
                <div className="artwork-list-header-content">
                  {renderSortableHeader('id', 'ID', 'artwork-id')}
                  {renderSortableHeader('title', 'Title', 'artwork-title')}
                  {renderSortableHeader('year', 'Year', 'artwork-year')}
                  <div className="artwork-dimensions">Dimensions</div>
                  {renderSortableHeader('availability', 'Availability', 'artwork-availability')}
                  {renderSortableHeader('owner_name', 'Owner', 'artwork-owner')}
                  <div className="artwork-owner-address">Address</div>
                  <div className="artwork-owner-phone">Phone</div>
                  {renderSortableHeader('value', 'Value', 'artwork-value')}
                  <div className="artwork-storage">Storage</div>
                  <div className="artwork-description">Description</div>
                  <div className="artwork-more-info">More Info</div>
                  <div className="artwork-exhibitions">Exhibitions</div>
                  <div className="artwork-edit-header"></div>
                </div>
              </div>
            </div>
          )}
          
          {viewMode === 'misc-videos' ? (
            <div className="misc-videos-section">
              <div className="misc-videos-header">
                <h2>Misc Videos</h2>
              </div>
              <div className="misc-videos-grid">
                {miscVideos.map((video, index) => (
                  <div
                    key={index}
                    className="misc-video-card"
                    onClick={() => handleMiscVideoClick(video)}
                  >
                    <div className="misc-video-preview">
                      <video
                        src={getMediaUrl(video.filename)}
                        className="misc-video-thumbnail"
                        muted
                        preload="metadata"
                      />
                      <div className="misc-video-play-overlay">▶</div>
                    </div>
                    <div className="misc-video-info">
                      {isAuthenticated && editingDisplayName === `misc-${index}` ? (
                        <input
                          type="text"
                          value={displayNameValue}
                          onChange={(e) => setDisplayNameValue(e.target.value)}
                          onBlur={() => {
                            handleUpdateMiscVideoDisplayName(video.filename, displayNameValue);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateMiscVideoDisplayName(video.filename, displayNameValue);
                            } else if (e.key === 'Escape') {
                              setEditingDisplayName(null);
                              setDisplayNameValue('');
                            }
                          }}
                          placeholder="Enter display name..."
                          className="misc-video-name-input"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div
                          className="misc-video-name"
                          onClick={(e) => {
                            if (isAuthenticated) {
                              e.stopPropagation();
                              setEditingDisplayName(`misc-${index}`);
                              setDisplayNameValue(video.displayName || '');
                            }
                          }}
                          title={isAuthenticated ? "Click to edit display name" : ""}
                          style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
                        >
                          {video.displayName || video.filename}
                          {isAuthenticated && <span className="misc-video-edit-hint">✏️</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'mosaic' ? (
            <div className="mosaic-view">
              <div ref={mosaicContainerRef} className="mosaic-grid" style={{ height: mosaicLayout.height }}>
                {mosaicLayout.tiles.map((tile) => (
                  <div
                    key={tile.key}
                    className="mosaic-tile"
                    style={{
                      left: `${tile.left}px`,
                      top: `${tile.top}px`,
                      width: `${tile.width}px`,
                      height: `${tile.height}px`
                    }}
                    onClick={(e) => handleFullSizeClick(e, tile.url)}
                    title={tile.title}
                  >
                    <img
                      src={tile.url}
                      alt={tile.title}
                      className={`mosaic-image ${!isAuthenticated ? 'no-save-image' : ''}`}
                      loading="lazy"
                      {...antiSaveImageProps}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const w = img.naturalWidth || 0;
                        const h = img.naturalHeight || 0;
                        if (w > 0 && h > 0) {
                          const ratio = w / h;
                          setMosaicRatios((prev) => {
                            const prevRatio = prev[tile.filename];
                            if (prevRatio && Math.abs(prevRatio - ratio) < 0.0001) return prev;
                            return { ...prev, [tile.filename]: ratio };
                          });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'series' ? (
            <div className="series-view-container">
              <div className="series-sidebar">
                <h3>Series & Collections</h3>
                <button
                  className={`series-filter-item ${selectedSeriesId === null ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSeriesId(null);
                    setMobileSeriesMenuOpen(false);
                  }}
                >
                  All Artworks ({shouldHideWithoutImages ? artworks.filter(artworkHasImage).length : artworks.length})
                </button>
                {allSeries.map(series => {
                  const seriesArtworks = artworks
                    .filter(a => a.series && a.series.some(s => s.id === series.id))
                    .filter(a => (shouldHideWithoutImages ? artworkHasImage(a) : true));
                  return (
                    <button
                      key={series.id}
                      className={`series-filter-item ${selectedSeriesId === series.id.toString() ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedSeriesId(series.id.toString());
                        setMobileSeriesMenuOpen(false);
                      }}
                    >
                      <span className="series-filter-name">{series.name}</span>
                      <span className="series-filter-count">({seriesArtworks.length})</span>
                    </button>
                  );
                })}
                {allSeries.length === 0 && (
                  <p className="no-series-hint">
                    No series created yet. <Link to="/series">Create a series</Link> to organize your artwork.
                  </p>
                )}
              </div>
              <div className="series-content">
                <div className="series-mobile-selector">
                  <button 
                    className="series-mobile-toggle"
                    onClick={() => setMobileSeriesMenuOpen(!mobileSeriesMenuOpen)}
                  >
                    <span>
                      {selectedSeriesId 
                        ? (allSeries.find(s => s.id.toString() === selectedSeriesId)?.name || 'Select Series')
                        : 'All Artworks'}
                    </span>
                    <span className="series-mobile-toggle-icon">{mobileSeriesMenuOpen ? '▲' : '▼'}</span>
                  </button>
                  {mobileSeriesMenuOpen && (
                    <div className="series-mobile-menu">
                      <button
                        className={`series-mobile-menu-item ${selectedSeriesId === null ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedSeriesId(null);
                          setMobileSeriesMenuOpen(false);
                        }}
                      >
                        All Artworks ({shouldHideWithoutImages ? artworks.filter(artworkHasImage).length : artworks.length})
                      </button>
                      {allSeries.map(series => {
                        const seriesArtworks = artworks
                          .filter(a => a.series && a.series.some(s => s.id === series.id))
                          .filter(a => (shouldHideWithoutImages ? artworkHasImage(a) : true));
                        return (
                          <button
                            key={series.id}
                            className={`series-mobile-menu-item ${selectedSeriesId === series.id.toString() ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedSeriesId(series.id.toString());
                              setMobileSeriesMenuOpen(false);
                            }}
                          >
                            {series.name} ({seriesArtworks.length})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedSeriesId ? (
                  <>
                    {(() => {
                      const selectedSeries = allSeries.find(s => s.id.toString() === selectedSeriesId);
                      return selectedSeries ? (
                        <>
                          <div className="series-header-section">
                            <h2>{selectedSeries.name}</h2>
                            {selectedSeries.description && (
                              <p className="series-description">{selectedSeries.description}</p>
                            )}
                            <p className="series-artwork-count">
                              {filteredArtworks.length} artwork{filteredArtworks.length !== 1 ? 's' : ''} in this series
                            </p>
                          </div>
                        </>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <div className="series-header-section">
                    <h2>All Artworks</h2>
                    <p className="series-artwork-count">
                      {filteredArtworks.length} artwork{filteredArtworks.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
                <div className={`artwork-grid artwork-grid-regular`}>
                  {filteredArtworks.map((artwork) => {
                    const primaryMedia = getPrimaryMedia(artwork);
                    const hidePublicImage = shouldHideImagesForPublic(artwork) && primaryMedia.filename && isImageFile(primaryMedia.filename);
                    const displayMedia = hidePublicImage ? { filename: null, type: null } : primaryMedia;
                    const isVideo = displayMedia.type === 'video';
                    const isAudio = displayMedia.type === 'audio';
                    const { av } = getSeparatedMedia(artwork);
                    const mediaCount = getMediaArrays(artwork).files.length;
                    const hasVideo = av.some(item => item.type === 'video');
                    const hasAudio = av.some(item => item.type === 'audio');
                    
                    return (
                      <div 
                        key={artwork.id} 
                        className="artwork-card artwork-card-regular"
                      >
                        <div className="artwork-image-container" onClick={(e) => handleMediaClick(e, artwork)}>
                          {displayMedia.filename ? (
                            isVideo ? (
                              <video
                                src={getMediaUrl(displayMedia.filename)}
                                className="artwork-media"
                                controls
                                muted
                              />
                            ) : isAudio ? (
                              <div className="artwork-media audio-placeholder">
                                <span>🎵</span>
                                <audio
                                  src={getMediaUrl(displayMedia.filename)}
                                  controls
                                  className="audio-player"
                                />
                              </div>
                            ) : (
                              <img
                                src={getMediaUrl(displayMedia.filename)}
                                alt={artwork.title || 'Artwork'}
                                className={`artwork-media ${!isAuthenticated ? 'no-save-image' : ''}`}
                                {...antiSaveImageProps}
                              />
                            )
                          ) : (
                            <div className="artwork-media no-media">
                              <span>No Media</span>
                            </div>
                          )}
                        </div>
                        <div className="artwork-info">
                          <div className="artwork-id">
                            {artwork.id_display ? `#${artwork.id_display}` : 'No ID'}
                          </div>
                          <h3 className="artwork-title">{artwork.title || 'Untitled'}</h3>
                          {artwork.year && (
                            <div className="artwork-year">{artwork.year}</div>
                          )}
                          {isAuthenticated && (
                            <button
                              className="edit-button edit-button-icon"
                              onClick={(e) => handleEditClick(e, artwork.id)}
                              title="Edit artwork"
                            >
                              ⚙️
                            </button>
                          )}
                        </div>
                        <div className="media-badges">
                          {av.length > 0 && (
                            <div className="media-type-badge">
                              {hasVideo ? '🎬' : '🎵'}
                            </div>
                          )}
                          {mediaCount > 1 && (
                            <div className="media-count-badge">
                              +{mediaCount - 1}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : viewMode !== 'misc-videos' ? (
            <div className={`artwork-grid artwork-grid-${viewMode}`}>
              {filteredArtworks.map((artwork) => {
            const primaryMedia = getPrimaryMedia(artwork);
            const hidePublicImage = shouldHideImagesForPublic(artwork) && primaryMedia.filename && isImageFile(primaryMedia.filename);
            const displayMedia = hidePublicImage ? { filename: null, type: null } : primaryMedia;
            const isVideo = displayMedia.type === 'video';
            const isAudio = displayMedia.type === 'audio';
            const { av } = getSeparatedMedia(artwork);
            const mediaCount = getMediaArrays(artwork).files.length;
            const hasVideo = av.some(item => item.type === 'video');
            const hasAudio = av.some(item => item.type === 'audio');
            
            return (
              <div 
                key={artwork.id} 
                className={`artwork-card artwork-card-${viewMode}`}
                onClick={(e) => handleListClick(e, artwork)}
                style={{ cursor: viewMode === 'list' ? 'pointer' : 'default' }}
              >
                <div className="artwork-image-container" onClick={(e) => handleMediaClick(e, artwork)}>
                  {displayMedia.filename ? (
                    isVideo ? (
                      <video
                        src={getMediaUrl(displayMedia.filename)}
                        className="artwork-media"
                        controls
                        muted
                      />
                    ) : isAudio ? (
                      <div className="artwork-media audio-placeholder">
                        <span>🎵</span>
                        <audio
                          src={getMediaUrl(displayMedia.filename)}
                          controls
                          className="audio-player"
                        />
                      </div>
                    ) : (
                      <img
                        src={getMediaUrl(displayMedia.filename)}
                        alt={artwork.title || 'Artwork'}
                        className={`artwork-media ${!isAuthenticated ? 'no-save-image' : ''}`}
                        {...antiSaveImageProps}
                      />
                    )
                  ) : (
                    <div className="artwork-media no-media">
                      <span>No Media</span>
                    </div>
                  )}
                </div>
                {viewMode !== 'small' && (
                  <div className="artwork-info">
                    <div className="artwork-id">
                      {artwork.id_display ? `#${artwork.id_display}` : (viewMode === 'list' ? '—' : 'No ID')}
                    </div>
                    <h3 className="artwork-title">{artwork.title || 'Untitled'}</h3>
                    {viewMode === 'list' ? (
                      <>
                        <div className="artwork-year">{artwork.year || '—'}</div>
                        <div className="artwork-dimensions">{artwork.dimensions || '—'}</div>
                        <div className="artwork-availability">{artwork.availability || '—'}</div>
                        <div className="artwork-owner">{artwork.owner_name || '—'}</div>
                        <div className="artwork-owner-address">{artwork.owner_address || '—'}</div>
                        <div className="artwork-owner-phone">{artwork.owner_phone || '—'}</div>
                        <div className="artwork-value">
                          {artwork.for_sale_price ? `$${artwork.for_sale_price}` : (artwork.value || '—')}
                        </div>
                        <div className="artwork-storage">{artwork.storage_location || '—'}</div>
                        <div 
                          className="artwork-description" 
                          title={artwork.description && artwork.description.length > 50 ? artwork.description : ''}
                        >
                          {artwork.description 
                            ? (artwork.description.length > 50 
                                ? `${artwork.description.substring(0, 50)}...` 
                                : artwork.description)
                            : '—'}
                        </div>
                        <div 
                          className="artwork-more-info" 
                          title={artwork.more_info && artwork.more_info.length > 50 ? artwork.more_info : ''}
                        >
                          {artwork.more_info 
                            ? (artwork.more_info.length > 50 
                                ? `${artwork.more_info.substring(0, 50)}...` 
                                : artwork.more_info)
                            : '—'}
                        </div>
                        <div 
                          className="artwork-exhibitions" 
                          title={artwork.past_exhibitions && artwork.past_exhibitions.length > 50 ? artwork.past_exhibitions : ''}
                        >
                          {artwork.past_exhibitions 
                            ? (artwork.past_exhibitions.length > 50 
                                ? `${artwork.past_exhibitions.substring(0, 50)}...` 
                                : artwork.past_exhibitions)
                            : '—'}
                        </div>
                      </>
                    ) : (
                      <>
                        {artwork.year && (
                          <div className="artwork-year">{artwork.year}</div>
                        )}
                        <div className="artwork-dimensions">{artwork.dimensions || '—'}</div>
                      </>
                    )}
                    {isAuthenticated && (
                      <button
                        className={`edit-button ${viewMode === 'regular' ? 'edit-button-icon' : ''}`}
                        onClick={(e) => handleEditClick(e, artwork.id)}
                        title="Edit artwork"
                      >
                        {viewMode === 'regular' ? '⚙️' : 'Edit'}
                      </button>
                    )}
                  </div>
                )}
                <div className="media-badges">
                  {av.length > 0 && (
                    <div className="media-type-badge">
                      {hasVideo ? '🎬' : '🎵'}
                    </div>
                  )}
                  {mediaCount > 1 && viewMode !== 'list' && (
                    <div className="media-count-badge">
                      +{mediaCount - 1}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          ) : null}
        </>
      )}
      </div>

      {selectedMedia && selectedArtwork && (
        <div className="media-modal" onClick={handleCloseModal}>
          <div className="media-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="media-modal-close" onClick={handleCloseModal}>
              ×
            </button>
            <div className="media-modal-header">
              <h2>{selectedArtwork.title || 'Untitled'}</h2>
              <div className="media-modal-info">
                <span>ID: #{selectedArtwork.id_display}</span>
                {selectedArtwork.year && <span>Year: {selectedArtwork.year}</span>}
                {selectedArtwork.medium && <span>Medium: {selectedArtwork.medium}</span>}
                <span>Dimensions: {selectedArtwork.dimensions || '—'}</span>
              </div>
            </div>
            {(() => {
              const { images, av, audioDescriptions } = getSeparatedMedia(selectedArtwork);
              const hasImages = images.length > 0;
              const hasAV = av.length > 0;
              const hasAudioDesc = audioDescriptions.length > 0;
              const tabCount = (hasImages ? 1 : 0) + (hasAV ? 1 : 0) + (hasAudioDesc ? 1 : 0);
              const showTabs = tabCount > 1;

              return (
                <>
                  {showTabs && (
                    <div className="media-modal-tabs">
                      <button
                        className={`media-tab ${mediaTab === 'images' ? 'active' : ''}`}
                        onClick={() => {
                          setMediaTab('images');
                          if (images.length > 0) {
                            setSelectedMedia(images[0].filename);
                          }
                        }}
                        disabled={!hasImages}
                      >
                        Images ({images.length})
                      </button>
                      <button
                        className={`media-tab ${mediaTab === 'av' ? 'active' : ''}`}
                        onClick={() => {
                          setMediaTab('av');
                          if (av.length > 0) {
                            setSelectedMedia(av[0].filename);
                            setCurrentAVIndex(0);
                          }
                        }}
                        disabled={!hasAV}
                      >
                        Audio/Video ({av.length})
                      </button>
                      <button
                        className={`media-tab ${mediaTab === 'audio-desc' ? 'active' : ''}`}
                        onClick={() => {
                          setMediaTab('audio-desc');
                          if (audioDescriptions.length > 0) {
                            setSelectedMedia(audioDescriptions[0].filename);
                            setCurrentAudioDescIndex(0);
                          }
                        }}
                        disabled={!hasAudioDesc}
                      >
                        Audio Description ({audioDescriptions.length})
                      </button>
                    </div>
                  )}
                  {/* Single-tab cases */}
                  {!showTabs && !hasImages && hasAV && (
                    <div className="media-modal-tabs">
                      <button
                        className={`media-tab active`}
                        disabled
                      >
                        Audio/Video ({av.length})
                      </button>
                    </div>
                  )}
                  {!showTabs && !hasImages && !hasAV && hasAudioDesc && (
                    <div className="media-modal-tabs">
                      <button className={`media-tab active`} disabled>
                        Audio Description ({audioDescriptions.length})
                      </button>
                    </div>
                  )}
                  {!showTabs && hasImages && !hasAV && !hasAudioDesc && (
                    <div className="media-modal-tabs">
                      <button className={`media-tab active`} disabled>
                        Images ({images.length})
                      </button>
                    </div>
                  )}

                  <div className="media-modal-body">
                    {mediaTab === 'images' && hasImages ? (
                      <div className="media-images-gallery">
                        <div className="image-gallery-main">
                          {(() => {
                            const currentImageIndex = images.findIndex(img => img.filename === selectedMedia);
                            const currentImage = currentImageIndex !== -1 ? images[currentImageIndex] : images[0];
                            
                            return (
                              <>
                                <div className="image-gallery-viewer">
                                  <img
                                    src={getMediaUrl(currentImage.filename)}
                                    alt={selectedArtwork.title || 'Artwork'}
                                    className={`gallery-main-image clickable-media ${!isAuthenticated ? 'no-save-image' : ''}`}
                                    onClick={(e) => handleFullSizeClick(e, getMediaUrl(currentImage.filename))}
                                    title="Click to view full size"
                                    {...antiSaveImageProps}
                                  />
                                  {images.length > 1 && (
                                    <>
                                      <button
                                        className="gallery-nav-btn gallery-nav-prev"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const prevIndex = currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1;
                                          setSelectedMedia(images[prevIndex].filename);
                                        }}
                                        title="Previous image"
                                      >
                                        ‹
                                      </button>
                                      <button
                                        className="gallery-nav-btn gallery-nav-next"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const nextIndex = currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0;
                                          setSelectedMedia(images[nextIndex].filename);
                                        }}
                                        title="Next image"
                                      >
                                        ›
                                      </button>
                                      <div className="gallery-image-counter">
                                        {currentImageIndex + 1} / {images.length}
                                      </div>
                                    </>
                                  )}
                                </div>
                                {images.length > 1 && (
                                  <div className="image-gallery-thumbnails">
                                    {images.map((img, idx) => (
                                      <div
                                        key={idx}
                                        className={`gallery-thumbnail ${img.filename === currentImage.filename ? 'active' : ''}`}
                                        onClick={() => setSelectedMedia(img.filename)}
                                      >
                                        <img
                                          src={getMediaUrl(img.filename)}
                                          alt={`Thumbnail ${idx + 1}`}
                                          className={!isAuthenticated ? 'no-save-image' : ''}
                                          {...antiSaveImageProps}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : mediaTab === 'audio-desc' && hasAudioDesc ? (
                      <div className="media-av-player">
                        {(() => {
                          const idx = audioDescriptions.findIndex(a => a.filename === selectedMedia);
                          const currentIdx = idx !== -1 ? idx : currentAudioDescIndex;
                          const current = audioDescriptions[currentIdx] || audioDescriptions[0];
                          if (!current) return null;

                          return (
                            <div className="av-player-main">
                              <div className="av-player-audio">
                                <div className="audio-visualizer">🎙️</div>
                                <audio
                                  key={current.filename}
                                  src={getMediaUrl(current.filename)}
                                  controls
                                  autoPlay
                                  className="av-player-audio-element"
                                />
                                <div className="audio-filename">
                                  {current.displayName || current.actualFilename || current.filename.split('/').pop()}
                                </div>
                              </div>
                              {audioDescriptions.length > 1 && (
                                <div className="av-player-controls">
                                  <button
                                    className="av-nav-btn"
                                    onClick={() => setCurrentAudioDescIndex(Math.max(0, currentIdx - 1))}
                                    disabled={currentIdx === 0}
                                  >
                                    ‹ Previous
                                  </button>
                                  <span className="av-counter">
                                    {currentIdx + 1} / {audioDescriptions.length}
                                  </span>
                                  <button
                                    className="av-nav-btn"
                                    onClick={() => setCurrentAudioDescIndex(Math.min(audioDescriptions.length - 1, currentIdx + 1))}
                                    disabled={currentIdx === audioDescriptions.length - 1}
                                  >
                                    Next ›
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : mediaTab === 'av' && hasAV ? (
                      <div className="media-av-player">
                        <div className="av-player-main">
                          {(() => {
                            const currentAV = av[currentAVIndex];
                            if (!currentAV) return null;

                            return (
                              <>
                                {currentAV.type === 'video' ? (
                                  <video
                                    key={currentAV.filename}
                                    src={getMediaUrl(currentAV.filename)}
                                    className="av-player-video"
                                    controls
                                    autoPlay
                                    onEnded={() => {
                                      // Auto-play next if available
                                      if (currentAVIndex < av.length - 1) {
                                        setCurrentAVIndex(currentAVIndex + 1);
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="av-player-audio">
                                    <div className="audio-visualizer">🎵</div>
                                    <audio
                                      key={currentAV.filename}
                                      src={getMediaUrl(currentAV.filename)}
                                      controls
                                      autoPlay
                                      className="av-player-audio-element"
                                      onEnded={() => {
                                        // Auto-play next if available
                                        if (currentAVIndex < av.length - 1) {
                                          setCurrentAVIndex(currentAVIndex + 1);
                                        }
                                      }}
                                    />
                                    <div className="audio-filename">
                                      {isAuthenticated && editingDisplayName === currentAVIndex ? (
                                        <div className="av-display-name-editor" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="text"
                                            value={displayNameValue}
                                            onChange={(e) => setDisplayNameValue(e.target.value)}
                                            onBlur={() => {
                                              handleUpdateDisplayName(currentAV.filename, displayNameValue);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                handleUpdateDisplayName(currentAV.filename, displayNameValue);
                                              } else if (e.key === 'Escape') {
                                                setEditingDisplayName(null);
                                                setDisplayNameValue('');
                                              }
                                            }}
                                            placeholder="Enter display name..."
                                            className="av-display-name-input"
                                            autoFocus
                                          />
                                        </div>
                                      ) : (
                                        <div 
                                          onClick={(e) => {
                                            if (!isAuthenticated) return;
                                            e.stopPropagation();
                                            setEditingDisplayName(currentAVIndex);
                                            setDisplayNameValue(currentAV.displayName || '');
                                          }}
                                          title={isAuthenticated ? "Click to edit display name" : ""}
                                          style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
                                        >
                                          {currentAV.displayName || currentAV.actualFilename || currentAV.filename.split('/').pop()}
                                          {isAuthenticated && <span className="av-edit-hint" style={{ marginLeft: '0.5rem' }}>✏️</span>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {/* Show display name editor for video */}
                                {currentAV.type === 'video' && (
                                  <div className="video-display-name-section">
                                    {isAuthenticated && editingDisplayName === currentAVIndex ? (
                                      <div className="av-display-name-editor">
                                        <input
                                          type="text"
                                          value={displayNameValue}
                                          onChange={(e) => setDisplayNameValue(e.target.value)}
                                          onBlur={() => {
                                            handleUpdateDisplayName(currentAV.filename, displayNameValue);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              handleUpdateDisplayName(currentAV.filename, displayNameValue);
                                            } else if (e.key === 'Escape') {
                                              setEditingDisplayName(null);
                                              setDisplayNameValue('');
                                            }
                                          }}
                                          placeholder="Enter display name..."
                                          className="av-display-name-input"
                                          autoFocus
                                        />
                                      </div>
                                    ) : (
                                      <div 
                                        className="video-display-name-display"
                                        onClick={() => {
                                          if (!isAuthenticated) return;
                                          setEditingDisplayName(currentAVIndex);
                                          setDisplayNameValue(currentAV.displayName || '');
                                        }}
                                        title={isAuthenticated ? "Click to edit display name" : ""}
                                        style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
                                      >
                                        <span className="video-display-name-label">Display Name:</span>
                                        <span className="video-display-name-value">
                                          {currentAV.displayName || currentAV.actualFilename || currentAV.filename.split('/').pop()}
                                        </span>
                                        {isAuthenticated && <span className="av-edit-hint">✏️</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {av.length > 1 && (
                                  <div className="av-player-controls">
                                    <button
                                      className="av-nav-btn"
                                      onClick={() => setCurrentAVIndex(Math.max(0, currentAVIndex - 1))}
                                      disabled={currentAVIndex === 0}
                                    >
                                      ‹ Previous
                                    </button>
                                    <span className="av-counter">
                                      {currentAVIndex + 1} / {av.length}
                                    </span>
                                    <button
                                      className="av-nav-btn"
                                      onClick={() => setCurrentAVIndex(Math.min(av.length - 1, currentAVIndex + 1))}
                                      disabled={currentAVIndex === av.length - 1}
                                    >
                                      Next ›
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {av.length > 1 && (
                          <div className="av-playlist">
                            <h3>Playlist ({av.length})</h3>
                            <div className="av-playlist-items">
                              {av.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={`av-playlist-item ${idx === currentAVIndex ? 'active' : ''}`}
                                  onClick={() => setCurrentAVIndex(idx)}
                                >
                                  <div className="av-playlist-icon">
                                    {item.type === 'video' ? '🎬' : '🎵'}
                                  </div>
                                  <div className="av-playlist-info">
                                    {isAuthenticated && editingDisplayName === idx ? (
                                      <div className="av-display-name-editor" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={displayNameValue}
                                          onChange={(e) => setDisplayNameValue(e.target.value)}
                                          onBlur={() => {
                                            handleUpdateDisplayName(item.filename, displayNameValue);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              handleUpdateDisplayName(item.filename, displayNameValue);
                                            } else if (e.key === 'Escape') {
                                              setEditingDisplayName(null);
                                              setDisplayNameValue('');
                                            }
                                          }}
                                          placeholder="Enter display name..."
                                          className="av-display-name-input"
                                          autoFocus
                                        />
                                      </div>
                                    ) : (
                                      <div 
                                        className="av-playlist-filename"
                                        onClick={(e) => {
                                          if (!isAuthenticated) return;
                                          e.stopPropagation();
                                          setEditingDisplayName(idx);
                                          setDisplayNameValue(item.displayName || '');
                                        }}
                                        title={isAuthenticated ? "Click to edit display name" : ""}
                                        style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
                                      >
                                        {item.displayName || item.actualFilename || item.filename.split('/').pop()}
                                        {isAuthenticated && <span className="av-edit-hint">✏️</span>}
                                      </div>
                                    )}
                                    <div className="av-playlist-type">{item.type === 'video' ? 'Video' : 'Audio'}</div>
                                  </div>
                                  {idx === currentAVIndex && <div className="av-playlist-playing">▶</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Show display name editor for single AV file */}
                        {av.length === 1 && (
                          <div className="av-single-display-name">
                            {isAuthenticated && editingDisplayName === 0 ? (
                              <div className="av-display-name-editor">
                                <input
                                  type="text"
                                  value={displayNameValue}
                                  onChange={(e) => setDisplayNameValue(e.target.value)}
                                  onBlur={() => {
                                    handleUpdateDisplayName(av[0].filename, displayNameValue);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateDisplayName(av[0].filename, displayNameValue);
                                    } else if (e.key === 'Escape') {
                                      setEditingDisplayName(null);
                                      setDisplayNameValue('');
                                    }
                                  }}
                                  placeholder="Enter display name..."
                                  className="av-display-name-input"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div 
                                className="av-display-name-display"
                                onClick={() => {
                                  if (!isAuthenticated) return;
                                  setEditingDisplayName(0);
                                  setDisplayNameValue(av[0].displayName || '');
                                }}
                                title={isAuthenticated ? "Click to edit display name" : ""}
                                style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
                              >
                                <span className="av-display-name-label">Display Name:</span>
                                <span className="av-display-name-value">
                                  {av[0].displayName || av[0].actualFilename || av[0].filename.split('/').pop()}
                                </span>
                                {isAuthenticated && <span className="av-edit-hint">✏️</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </>
              );
            })()}
            {selectedArtwork.description && (
              <div className="media-modal-description">
                <h3>Description</h3>
                <p>{selectedArtwork.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {infoPopupArtwork && (
        <div className="info-popup-modal" onClick={handleCloseInfoPopup}>
          <div className="info-popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="info-popup-close" onClick={handleCloseInfoPopup}>
              ×
            </button>
            <div className="info-popup-header">
              <h2>{infoPopupArtwork.title || 'Untitled'}</h2>
              <div className="info-popup-id">ID: #{infoPopupArtwork.id_display || '—'}</div>
            </div>
            <div className="info-popup-body">
              <div className="info-popup-grid">
                {infoPopupArtwork.year && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Year:</span>
                    <span className="info-popup-value">{infoPopupArtwork.year}</span>
                  </div>
                )}
                {infoPopupArtwork.medium && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Medium:</span>
                    <span className="info-popup-value">{infoPopupArtwork.medium}</span>
                  </div>
                )}
                <div className="info-popup-item">
                  <span className="info-popup-label">Dimensions:</span>
                  <span className="info-popup-value">{infoPopupArtwork.dimensions || '—'}</span>
                </div>
                {infoPopupArtwork.availability && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Availability:</span>
                    <span className="info-popup-value">{infoPopupArtwork.availability}</span>
                  </div>
                )}
                {infoPopupArtwork.value && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Value:</span>
                    <span className="info-popup-value">{infoPopupArtwork.value}</span>
                  </div>
                )}
                {infoPopupArtwork.for_sale_price && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">For Sale Price:</span>
                    <span className="info-popup-value">${infoPopupArtwork.for_sale_price}</span>
                  </div>
                )}
                {infoPopupArtwork.owner_name && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Owner:</span>
                    <span className="info-popup-value">{infoPopupArtwork.owner_name}</span>
                  </div>
                )}
                {infoPopupArtwork.owner_address && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Address:</span>
                    <span className="info-popup-value">{infoPopupArtwork.owner_address}</span>
                  </div>
                )}
                {infoPopupArtwork.owner_phone && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Phone:</span>
                    <span className="info-popup-value">{infoPopupArtwork.owner_phone}</span>
                  </div>
                )}
                {infoPopupArtwork.storage_location && (
                  <div className="info-popup-item">
                    <span className="info-popup-label">Storage:</span>
                    <span className="info-popup-value">{infoPopupArtwork.storage_location}</span>
                  </div>
                )}
                {infoPopupArtwork.description && (
                  <div className="info-popup-item info-popup-item-full">
                    <span className="info-popup-label">Description:</span>
                    <span className="info-popup-value">{infoPopupArtwork.description}</span>
                  </div>
                )}
                {infoPopupArtwork.more_info && (
                  <div className="info-popup-item info-popup-item-full">
                    <span className="info-popup-label">More Info:</span>
                    <span className="info-popup-value">{infoPopupArtwork.more_info}</span>
                  </div>
                )}
                {infoPopupArtwork.past_exhibitions && (
                  <div className="info-popup-item info-popup-item-full">
                    <span className="info-popup-label">Past Exhibitions:</span>
                    <span className="info-popup-value">{infoPopupArtwork.past_exhibitions}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="info-popup-footer">
              <button
                className="info-popup-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseInfoPopup();
                  navigate(`/edit/${infoPopupArtwork.id}`);
                }}
              >
                Edit Artwork
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomedImage && (
        <div 
          className="zoom-modal" 
          onClick={handleCloseZoom}
          onMouseDown={handleZoomMouseDown}
          onMouseMove={handleZoomMouseMove}
          onMouseUp={handleZoomMouseUp}
          onMouseLeave={handleZoomMouseUp}
        >
          <button className="zoom-close" onClick={handleCloseZoom}>
            ×
          </button>
          <div className="zoom-controls">
            <button
              type="button"
              className={zoomPreset === 'fit' ? 'active' : ''}
              onClick={(e) => {
                e.stopPropagation();
                setZoomPreset('fit');
                setZoomLevel(1);
                setPanPosition({ x: 0, y: 0 });
              }}
            >
              Full
            </button>
            <button
              type="button"
              className={zoomPreset === '100' ? 'active' : ''}
              onClick={(e) => {
                e.stopPropagation();
                setZoomPreset('100');
                setZoomLevel(1);
                setPanPosition({ x: 0, y: 0 });
              }}
            >
              100%
            </button>
            <button
              type="button"
              className={zoomPreset === '150' ? 'active' : ''}
              onClick={(e) => {
                e.stopPropagation();
                setZoomPreset('150');
                setZoomLevel(1.5);
                setPanPosition({ x: 0, y: 0 });
              }}
            >
              150%
            </button>
            <button
              type="button"
              className={zoomPreset === '200' ? 'active' : ''}
              onClick={(e) => {
                e.stopPropagation();
                setZoomPreset('200');
                setZoomLevel(2);
                setPanPosition({ x: 0, y: 0 });
              }}
            >
              200%
            </button>
          </div>
          <div 
            className="zoom-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
              cursor: zoomPreset !== 'fit' && zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <img
              src={zoomedImage}
              alt="Zoomed artwork"
              className={`zoomed-image ${!isAuthenticated ? 'no-save-image' : ''}`}
              style={zoomPreset === 'fit' ? undefined : { maxWidth: 'none', maxHeight: 'none' }}
              {...antiSaveImageProps}
            />
          </div>
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

export default Gallery;

