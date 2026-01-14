import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AudioRecorder from './AudioRecorder';
import ScrollToTopButton from './ScrollToTopButton';
import './ArtworkForm.css';

function ArtworkForm() {
  const { isAuthenticated } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    year: '',
    title: '',
    dimensions: '',
    medium: '',
    value: '',
    availability: '',
    for_sale_price: '',
    description: '',
    owner_name: '',
    owner_address: '',
    owner_phone: '',
    more_info: '',
    storage_location: '',
    past_exhibitions: '',
    is_hidden: 0,
    hide_images_public: 0
  });

  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPrimary, setMediaPrimary] = useState([]);
  const [mediaDisplayNames, setMediaDisplayNames] = useState([]);
  const [mediaPublic, setMediaPublic] = useState([]);
  const [editingDisplayName, setEditingDisplayName] = useState(null);
  const [displayNameValue, setDisplayNameValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [artworkId, setArtworkId] = useState(id || null);
  const [manualId, setManualId] = useState('');
  const [editId, setEditId] = useState(''); // For editing ID in edit mode
  const [idCheckStatus, setIdCheckStatus] = useState(null); // null, 'checking', 'available', 'taken', 'invalid'
  const [changingId, setChangingId] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingMediaFiles, setPendingMediaFiles] = useState([]);
  const [allExhibitions, setAllExhibitions] = useState([]);
  const [selectedExhibitionIds, setSelectedExhibitionIds] = useState([]);
  const [allSeries, setAllSeries] = useState([]);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState([]);
  const [activeTab, setActiveTab] = useState('single'); // 'single', 'bulk', or 'misc-videos'
  const [formTab, setFormTab] = useState('info'); // 'info', 'media', or 'audio-desc' - for edit mode tabs
  const [miscVideos, setMiscVideos] = useState([]);
  const [editingMiscVideoDisplayName, setEditingMiscVideoDisplayName] = useState(null);
  const [miscVideoDisplayNameValue, setMiscVideoDisplayNameValue] = useState('');
  const [uploadingMiscVideo, setUploadingMiscVideo] = useState(false);
  const [bulkArtworks, setBulkArtworks] = useState([]);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkEditData, setBulkEditData] = useState({
    year: '',
    medium: '',
    availability: '',
    owner_name: '',
    owner_address: '',
    owner_phone: '',
    storage_location: ''
  });
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState({ phase: '', done: 0, total: 0 });
  const [bulkMissingDataFilters, setBulkMissingDataFilters] = useState({
    year: false,
    medium: false,
    dimensions: false,
    availability: false,
    owner_name: false,
    owner_address: false,
    owner_phone: false,
    storage_location: false,
    description: false,
    more_info: false
  });
  const [showMissingDataFilter, setShowMissingDataFilter] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState('');
  const [bulkSelectedSeriesIds, setBulkSelectedSeriesIds] = useState([]);
  const [bulkSelectedExhibitionIds, setBulkSelectedExhibitionIds] = useState([]);
  const [bulkSortBy, setBulkSortBy] = useState('id');
  const [bulkSortOrder, setBulkSortOrder] = useState('asc');
  const [imageDimensions, setImageDimensions] = useState({}); // Map filename to {width, height}
  const [dbArtworks, setDbArtworks] = useState([]);
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbLoading, setDbLoading] = useState(false);
  const [dbTwoColumnList, setDbTwoColumnList] = useState(() => {
    try {
      return localStorage.getItem('dbTwoColumnList') === 'true';
    } catch {
      return false;
    }
  });
  const [dbThreeColumnList, setDbThreeColumnList] = useState(() => {
    try {
      return localStorage.getItem('dbThreeColumnList') === 'true';
    } catch {
      return false;
    }
  });
  const [dbSortBy, setDbSortBy] = useState(() => {
    try {
      return localStorage.getItem('dbSortBy') || 'id';
    } catch {
      return 'id';
    }
  });
  const [dbSortOrder, setDbSortOrder] = useState(() => {
    try {
      return localStorage.getItem('dbSortOrder') || 'asc';
    } catch {
      return 'asc';
    }
  });

  // === Mobile: Audio Description Queue ===
  const [audioQueueLoading, setAudioQueueLoading] = useState(false);
  const [audioQueueError, setAudioQueueError] = useState(null);
  const [audioQueueCandidates, setAudioQueueCandidates] = useState([]); // artworks without audio description
  const [audioQueueCurrent, setAudioQueueCurrent] = useState(null);
  const [audioQueueBusy, setAudioQueueBusy] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchArtwork();
      // If we navigated here from another tab (e.g. Database), ensure the edit form is visible.
      setActiveTab('single');
    }
  }, [id]);

  useEffect(() => {
    if (isEditMode) return;
    const manualParam = searchParams.get('manualId');
    if (!manualParam) return;
    if (manualId === manualParam) return;
    setManualId(manualParam);
    checkIdAvailability(manualParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isEditMode]);

  // Load exhibitions and series lists for use in artwork form
  useEffect(() => {
    const fetchExhibitions = async () => {
      try {
        const response = await axios.get('/api/exhibitions');
        setAllExhibitions(response.data || []);
      } catch (err) {
        console.error('Error loading exhibitions list:', err);
      }
    };

    const fetchSeries = async () => {
      try {
        const response = await axios.get('/api/series');
        setAllSeries(response.data || []);
      } catch (err) {
        console.error('Error loading series list:', err);
      }
    };

    const fetchMiscVideos = async () => {
      try {
        const response = await axios.get('/api/misc-videos');
        setMiscVideos(response.data || []);
      } catch (err) {
        console.error('Error loading misc videos:', err);
      }
    };

    fetchExhibitions();
    fetchSeries();
  }, []);

  // Fetch misc videos when tab is switched to misc-videos
  useEffect(() => {
    if (activeTab === 'misc-videos') {
      const fetchMiscVideos = async () => {
        try {
          const response = await axios.get('/api/misc-videos');
          setMiscVideos(response.data || []);
        } catch (err) {
          console.error('Error loading misc videos:', err);
        }
      };
      fetchMiscVideos();
    }
  }, [activeTab, isEditMode]);

  const applyMediaState = (data) => {
    const files = data?.media_files || [];
    const primary = data?.media_primary || [];
    const displayNames = data?.media_display_names || [];
    const publicFlags = data?.media_public || [];

    setMediaFiles(files);
    setMediaPrimary(primary);
    setMediaDisplayNames(displayNames);
    if (publicFlags.length > 0) {
      setMediaPublic(publicFlags);
    } else {
      setMediaPublic(files.map(() => 1));
    }
  };

  const fetchArtwork = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/artworks/${id}`);
      const artwork = response.data;
      
      setFormData({
        year: artwork.year || '',
        title: artwork.title || '',
        dimensions: artwork.dimensions || '',
        medium: artwork.medium || '',
        value: artwork.value || '',
        availability: artwork.availability || '',
        for_sale_price: artwork.for_sale_price || '',
        description: artwork.description || '',
        owner_name: artwork.owner_name || '',
        owner_address: artwork.owner_address || '',
        owner_phone: artwork.owner_phone || '',
        more_info: artwork.more_info || '',
        storage_location: artwork.storage_location || '',
        past_exhibitions: artwork.past_exhibitions || '',
        is_hidden: artwork.is_hidden ? 1 : 0,
        hide_images_public: artwork.hide_images_public ? 1 : 0
      });

      applyMediaState(artwork);
      setArtworkId(artwork.id);
      
      // Load selected series
      if (artwork.series && Array.isArray(artwork.series)) {
        setSelectedSeriesIds(artwork.series.map(s => s.id));
      } else {
        setSelectedSeriesIds([]);
      }

      // Try to infer selected exhibitions from past_exhibitions text (match by title)
      if (artwork.past_exhibitions && allExhibitions.length > 0) {
        const text = artwork.past_exhibitions.toLowerCase();
        const inferredIds = allExhibitions
          .filter(ex => ex.title && text.includes(ex.title.toLowerCase()))
          .map(ex => ex.id);
        setSelectedExhibitionIds(inferredIds);
      }
      setEditId(String(artwork.id)); // Initialize edit ID with current ID
    } catch (error) {
      console.error('Error fetching artwork:', error);
      alert('Failed to load artwork');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const checkIdAvailability = async (value) => {
    if (!value) {
      setIdCheckStatus(null);
      return;
    }

    const idNum = parseInt(value, 10);
    if (isNaN(idNum) || idNum < 1 || idNum > 999999) {
      setIdCheckStatus('invalid');
      return;
    }

    if (isEditMode && idNum === artworkId) {
      setIdCheckStatus(null);
      return;
    }

    setIdCheckStatus('checking');
    try {
      const response = await axios.get(`/api/artworks/check-id/${idNum}`);
      setIdCheckStatus(response.data.available ? 'available' : 'taken');
    } catch (error) {
      console.error('Error checking ID:', error);
      setIdCheckStatus('error');
    }
  };

  const handleIdChange = async (e) => {
    const value = e.target.value.trim();
    if (isEditMode) {
      setEditId(value);
    } else {
      setManualId(value);
    }

    checkIdAvailability(value);
  };

  const handleChangeId = async () => {
    const newIdNum = parseInt(editId);
    if (isNaN(newIdNum) || newIdNum < 1 || newIdNum > 999999) {
      alert('Please enter a valid ID between 1 and 999999');
      return;
    }

    if (newIdNum === artworkId) {
      alert('New ID must be different from current ID');
      return;
    }

    if (idCheckStatus !== 'available') {
      alert('Please ensure the new ID is available before changing');
      return;
    }

    if (!window.confirm(`Are you sure you want to change the artwork ID from ${artworkId} to ${newIdNum}? This will move all media files and cannot be easily undone.`)) {
      return;
    }

    setChangingId(true);
    try {
      const response = await axios.put(`/api/artworks/${artworkId}/change-id`, {
        newId: newIdNum
      });
      
      alert('Artwork ID changed successfully!');
      // Navigate to the new ID
      navigate(`/edit/${newIdNum}`, { replace: true });
      // Reload the page to fetch the new artwork
      window.location.reload();
    } catch (error) {
      console.error('Error changing ID:', error);
      const errorMessage = error.response?.data?.error || 'Failed to change artwork ID';
      alert(errorMessage);
      // Reset edit ID to current ID on error
      setEditId(String(artworkId));
      setIdCheckStatus(null);
    } finally {
      setChangingId(false);
    }
  };

  // Auto-create artwork if needed for media upload
  const ensureArtworkExists = async () => {
    if (artworkId) return artworkId;
    
    // Validate manual ID if provided
    if (manualId && idCheckStatus !== 'available') {
      throw new Error('Please enter a valid, available ID (1-999999)');
    }
    
    const payload = {
      ...formData,
      ...(manualId ? { id: parseInt(manualId) } : {})
    };
    
    const response = await axios.post('/api/artworks', payload);
    setArtworkId(response.data.id);
    return response.data.id;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate manual ID if provided
    if (!isEditMode && manualId) {
      if (idCheckStatus !== 'available') {
        alert('Please enter a valid, available ID (1-999999)');
        return;
      }
    }
    
    setLoading(true);

    try {
      let currentArtworkId;
      if (isEditMode) {
        await axios.put(`/api/artworks/${id}`, formData);
        currentArtworkId = id;
        alert('Artwork updated successfully!');
      } else {
        const payload = {
          ...formData,
          ...(manualId ? { id: parseInt(manualId) } : {})
        };
        const response = await axios.post('/api/artworks', payload);
        currentArtworkId = response.data.id;
        setArtworkId(currentArtworkId);
        alert('Artwork created successfully!');
      }
      
      // Update series associations
      if (currentArtworkId) {
        // Get current series associations
        const artworkResponse = await axios.get(`/api/artworks/${currentArtworkId}`);
        const currentSeriesIds = (artworkResponse.data.series || []).map(s => s.id);
        
        // Add new series
        const seriesToAdd = selectedSeriesIds.filter(id => !currentSeriesIds.includes(id));
        for (const seriesId of seriesToAdd) {
          await axios.put(`/api/artworks/${currentArtworkId}/series/${seriesId}`);
        }
        
        // Remove series that are no longer selected
        const seriesToRemove = currentSeriesIds.filter(id => !selectedSeriesIds.includes(id));
        for (const seriesId of seriesToRemove) {
          await axios.delete(`/api/artworks/${currentArtworkId}/series/${seriesId}`);
        }
      }
      
      // Upload any pending media files
      if (pendingMediaFiles.length > 0) {
        const currentId = currentArtworkId || artworkId || (isEditMode ? id : null);
        if (currentId) {
          for (const file of pendingMediaFiles) {
            await uploadMediaFile(currentId, file, false);
          }
          setPendingMediaFiles([]);
        }
      }
      
      navigate('/');
    } catch (error) {
      console.error('Error saving artwork:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save artwork';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const uploadMediaFile = async (targetId, file, isPrimary) => {
    const uploadFormData = new FormData();
    uploadFormData.append('media', file);
    uploadFormData.append('is_primary', isPrimary ? 'true' : 'false');

    const response = await axios.post(`/api/artworks/${targetId}/media`, uploadFormData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  };

  const isImageFile = (filename) => {
    const ext = String(filename || '').split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  };

  const isAudioDescriptionMedia = (filename, fileType) => {
    const actualFilename = String(filename || '').includes('/') ? String(filename).split('/').pop() : String(filename || '');
    if (fileType === 'audio_description') return true;
    return actualFilename.toLowerCase().startsWith('audio_description_');
  };

  const artworkHasAudioDescription = (artwork) => {
    const files = Array.isArray(artwork?.media_files) ? artwork.media_files : [];
    const types = Array.isArray(artwork?.media_types) ? artwork.media_types : [];
    for (let i = 0; i < files.length; i++) {
      if (isAudioDescriptionMedia(files[i], types[i])) return true;
    }
    return false;
  };

  const getArtworkPreviewImage = (artwork) => {
    const files = Array.isArray(artwork?.media_files) ? artwork.media_files : [];
    const primary = Array.isArray(artwork?.media_primary) ? artwork.media_primary : [];
    const primaryIndex = primary.findIndex(p => p === '1' || p === 1);
    const primaryFile = (primaryIndex !== -1 && primaryIndex !== undefined) ? files[primaryIndex] : null;
    if (primaryFile && isImageFile(primaryFile)) return primaryFile;
    const firstImage = files.find((f) => isImageFile(f));
    return firstImage || null;
  };

  const pickNextAudioQueueArtwork = (candidates) => {
    if (!candidates || candidates.length === 0) {
      setAudioQueueCurrent(null);
      return;
    }
    // Random selection (uniform)
    const idx = Math.floor(Math.random() * candidates.length);
    setAudioQueueCurrent(candidates[idx]);
  };

  const loadAudioQueue = async () => {
    setAudioQueueLoading(true);
    setAudioQueueError(null);
    try {
      const res = await axios.get('/api/artworks');
      const all = res.data || [];
      // We only queue artworks that:
      // - have at least 1 image (so we can show a reference image)
      // - do NOT already have an audio description recording
      const candidates = all.filter((a) => {
        const hasImage = !!getArtworkPreviewImage(a);
        if (!hasImage) return false;
        return !artworkHasAudioDescription(a);
      });
      setAudioQueueCandidates(candidates);
      pickNextAudioQueueArtwork(candidates);
    } catch (err) {
      console.error('Error loading audio description queue:', err);
      setAudioQueueError(err.response?.data?.error || err.message || 'Failed to load artworks');
      setAudioQueueCandidates([]);
      setAudioQueueCurrent(null);
    } finally {
      setAudioQueueLoading(false);
    }
  };

  const skipAudioQueueArtwork = () => {
    if (!audioQueueCurrent) return;
    const remaining = audioQueueCandidates.filter((a) => a.id !== audioQueueCurrent.id);
    setAudioQueueCandidates(remaining);
    pickNextAudioQueueArtwork(remaining);
  };

  // Auto-load queue when the queue tab is opened (add mode only).
  useEffect(() => {
    const inAddModeQueue = !isEditMode && activeTab === 'audio-desc-queue';
    if (!isAuthenticated || !inAddModeQueue) return;

    // If we already have a current item, don’t clobber it on re-render.
    if (audioQueueCurrent || audioQueueCandidates.length > 0) return;

    loadAudioQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isEditMode, isAuthenticated]);

  const handleQueueRecordingComplete = async (audioFile) => {
    if (!audioQueueCurrent?.id) return;
    setAudioQueueBusy(true);
    setUploading(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const fileExtension = audioFile.name.split('.').pop() || 'webm';
      const newFileName = `audio_description_${dateStr}_${timeStr}.${fileExtension}`;
      const renamedFile = new File([audioFile], newFileName, {
        type: audioFile.type,
        lastModified: audioFile.lastModified
      });

      // Always non-primary for queue uploads (we are augmenting existing artworks)
      await uploadMediaFile(audioQueueCurrent.id, renamedFile, false);

      // Remove from queue and pick another
      const remaining = audioQueueCandidates.filter((a) => a.id !== audioQueueCurrent.id);
      setAudioQueueCandidates(remaining);
      pickNextAudioQueueArtwork(remaining);
    } catch (err) {
      console.error('Error uploading queued audio description:', err);
      alert('Failed to upload audio description: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      setAudioQueueBusy(false);
    }
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      let targetId = artworkId;
      
      // If no artwork ID exists, create the artwork first
      if (!targetId && !isEditMode) {
        targetId = await ensureArtworkExists();
      }
      
      if (!targetId) {
        // If still no ID (shouldn't happen), add to pending
        setPendingMediaFiles(prev => [...prev, file]);
        alert('Artwork will be created when you save. Media will be uploaded automatically.');
        e.target.value = '';
        setUploading(false);
        return;
      }

      const isPrimary = mediaFiles.length === 0;
      await uploadMediaFile(targetId, file, isPrimary);
      
      // Refresh media files
      const response = await axios.get(`/api/artworks/${targetId}`);
      applyMediaState(response.data);
      
      alert('Media uploaded successfully!');
      e.target.value = ''; // Reset file input
    } catch (error) {
      console.error('Error uploading media:', error);
      const errorMessage = error.response?.data?.error || 'Failed to upload media';
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleAudioRecordingComplete = async (audioFile) => {
    setShowAudioRecorder(false);
    
    setUploading(true);
    try {
      let targetId = artworkId;
      
      // If no artwork ID exists, create the artwork first
      if (!targetId && !isEditMode) {
        targetId = await ensureArtworkExists();
      }
      
      // Rename audio file to include "audio description" and date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const fileExtension = audioFile.name.split('.').pop() || 'webm';
      const newFileName = `audio_description_${dateStr}_${timeStr}.${fileExtension}`;
      
      // Create a new File object with the new name
      const renamedFile = new File([audioFile], newFileName, {
        type: audioFile.type,
        lastModified: audioFile.lastModified
      });

      if (!targetId) {
        // If still no ID, add to pending
        setPendingMediaFiles(prev => [...prev, renamedFile]);
        alert('Artwork will be created when you save. Audio description will be uploaded automatically.');
        setUploading(false);
        return;
      }

      const isPrimary = mediaFiles.length === 0;
      await uploadMediaFile(targetId, renamedFile, isPrimary);
      
      // Refresh media files
      const response = await axios.get(`/api/artworks/${targetId}`);
      applyMediaState(response.data);
      
      alert('Audio description uploaded successfully!');
    } catch (error) {
      console.error('Error uploading audio:', error);
      const errorMessage = error.response?.data?.error || 'Failed to upload audio description';
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleExhibitionToggle = (exhibitionId) => {
    setSelectedExhibitionIds(prev => {
      let next;
      if (prev.includes(exhibitionId)) {
        next = prev.filter(id => id !== exhibitionId);
      } else {
        next = [...prev, exhibitionId];
      }

      const selectedExhibitions = allExhibitions.filter(ex => next.includes(ex.id));
      const lines = selectedExhibitions.map(ex => {
        const parts = [ex.year, ex.title];
        if (ex.location) parts.push(ex.location);
        return parts.filter(Boolean).join(' – ');
      });

      setFormData(prevForm => ({
        ...prevForm,
        past_exhibitions: lines.join('\n')
      }));

      return next;
    });
  };

  const handleSeriesToggle = (seriesId) => {
    setSelectedSeriesIds(prev => {
      if (prev.includes(seriesId)) {
        return prev.filter(id => id !== seriesId);
      } else {
        return [...prev, seriesId];
      }
    });
  };

  const handleDeleteMedia = async (filename) => {
    if (!window.confirm('Are you sure you want to delete this media file?')) {
      return;
    }

    try {
      // Extract artwork ID and filename from the path (format: "000001/filename.jpg")
      const pathParts = filename.split('/');
      const artworkId = pathParts[0];
      const actualFilename = pathParts[1] || filename; // Fallback if no subfolder
      
      await axios.delete(`/api/media/${artworkId}/${actualFilename}`);
      setMediaFiles(prev => prev.filter(f => f !== filename));
      setMediaPrimary(prev => prev.filter((_, idx) => mediaFiles[idx] !== filename));
      setMediaDisplayNames(prev => prev.filter((_, idx) => mediaFiles[idx] !== filename));
      setMediaPublic(prev => prev.filter((_, idx) => mediaFiles[idx] !== filename));
      
      // Refresh to get updated primary status
      if (isEditMode && artworkId) {
        const response = await axios.get(`/api/artworks/${artworkId}`);
        applyMediaState(response.data);
      }
      
      alert('Media deleted successfully!');
    } catch (error) {
      console.error('Error deleting media:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete media';
      alert(errorMessage);
    }
  };

  const handleSetPrimary = async (filename) => {
    try {
      // Extract artwork ID and filename from the path (format: "000001/filename.jpg")
      const pathParts = filename.split('/');
      const artworkId = pathParts[0];
      const actualFilename = pathParts[1] || filename; // Fallback if no subfolder
      
      await axios.put(`/api/media/${artworkId}/${actualFilename}/set-primary`);
      
      // Refresh to get updated primary status
      if (isEditMode && artworkId) {
        const response = await axios.get(`/api/artworks/${artworkId}`);
        applyMediaState(response.data);
      }
      
      alert('Primary media updated successfully!');
    } catch (error) {
      console.error('Error setting primary media:', error);
      const errorMessage = error.response?.data?.error || 'Failed to set primary media';
      alert(errorMessage);
    }
  };

  const getMediaUrl = (filename) => {
    return `/media/${filename}`;
  };

  const handleUpdateDisplayName = async (filename, displayName) => {
    if (!isEditMode || !artworkId) return;
    
    try {
      // Extract just the filename from the path
      const actualFilename = filename.includes('/') ? filename.split('/').pop() : filename;
      
      // URL encode the filename to handle special characters
      const encodedFilename = encodeURIComponent(actualFilename);
      
      await axios.put(`/api/media/${artworkId}/${encodedFilename}/display-name`, {
        display_name: displayName || null
      });
      
      // Refresh media files to get updated display names
      const response = await axios.get(`/api/artworks/${artworkId}`);
      applyMediaState(response.data);
      
      setEditingDisplayName(null);
    } catch (error) {
      console.error('Error updating display name:', error);
      console.error('Filename:', filename, 'Actual filename:', filename.includes('/') ? filename.split('/').pop() : filename);
      const errorMessage = error.response?.data?.error || 'Failed to update display name';
      alert(errorMessage);
    }
  };

  const handleUpdateMediaPublic = async (filename, nextPublic) => {
    if (!isEditMode || !artworkId) return;
    try {
      const actualFilename = filename.includes('/') ? filename.split('/').pop() : filename;
      const encodedFilename = encodeURIComponent(actualFilename);
      await axios.put(`/api/media/${artworkId}/${encodedFilename}/public`, {
        is_public: nextPublic ? 1 : 0
      });

      setMediaPublic((prev) => {
        const idx = mediaFiles.indexOf(filename);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = nextPublic ? 1 : 0;
        return updated;
      });
    } catch (error) {
      console.error('Error updating media visibility:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update media visibility';
      alert(errorMessage);
    }
  };

  const isAudioOrVideo = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
    const videoExts = ['mp4', 'avi', 'mov', 'webm', 'mkv', 'flv', 'wmv'];
    return audioExts.includes(ext) || videoExts.includes(ext);
  };

  // Bulk edit handlers
  const fetchBulkArtworks = async () => {
    try {
      const response = await axios.get('/api/artworks');
      setBulkArtworks(response.data || []);
    } catch (error) {
      console.error('Error fetching artworks:', error);
      alert('Failed to load artworks');
    }
  };

  // Filter and sort artworks based on missing data, search term, and sorting
  const getFilteredBulkArtworks = () => {
    let filtered = bulkArtworks;
    
    // Apply search filter
    if (bulkSearchTerm.trim()) {
      const searchLower = bulkSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(artwork => {
        const title = String(artwork.title || '').toLowerCase();
        const year = String(artwork.year || '').toLowerCase();
        const medium = String(artwork.medium || '').toLowerCase();
        const id = String(artwork.id_display || artwork.id || '').toLowerCase();
        const owner = String(artwork.owner_name || '').toLowerCase();
        
        return title.includes(searchLower) ||
               year.includes(searchLower) ||
               medium.includes(searchLower) ||
               id.includes(searchLower) ||
               owner.includes(searchLower);
      });
    }
    
    // Apply missing data filter
    if (showMissingDataFilter && !Object.values(bulkMissingDataFilters).every(v => !v)) {
      filtered = filtered.filter(artwork => {
        const checks = [];
        if (bulkMissingDataFilters.year && !artwork.year) checks.push(true);
        if (bulkMissingDataFilters.medium && !artwork.medium) checks.push(true);
        if (bulkMissingDataFilters.dimensions && !artwork.dimensions) checks.push(true);
        if (bulkMissingDataFilters.availability && !artwork.availability) checks.push(true);
        if (bulkMissingDataFilters.owner_name && !artwork.owner_name) checks.push(true);
        if (bulkMissingDataFilters.owner_address && !artwork.owner_address) checks.push(true);
        if (bulkMissingDataFilters.owner_phone && !artwork.owner_phone) checks.push(true);
        if (bulkMissingDataFilters.storage_location && !artwork.storage_location) checks.push(true);
        if (bulkMissingDataFilters.description && !artwork.description) checks.push(true);
        if (bulkMissingDataFilters.more_info && !artwork.more_info) checks.push(true);
        
        return checks.length > 0;
      });
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (bulkSortBy) {
        case 'id':
          aValue = parseInt(a.id) || 0;
          bValue = parseInt(b.id) || 0;
          return bulkSortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        
        case 'title':
          aValue = String(a.title || '').toLowerCase();
          bValue = String(b.title || '').toLowerCase();
          if (aValue < bValue) return bulkSortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return bulkSortOrder === 'asc' ? 1 : -1;
          return 0;
        
        case 'year':
          // Extract first number from year string for sorting
          const aYearMatch = String(a.year || '').match(/\d{4}/);
          const bYearMatch = String(b.year || '').match(/\d{4}/);
          aValue = aYearMatch ? parseInt(aYearMatch[0]) : 0;
          bValue = bYearMatch ? parseInt(bYearMatch[0]) : 0;
          return bulkSortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        
        case 'medium':
          aValue = String(a.medium || '').toLowerCase();
          bValue = String(b.medium || '').toLowerCase();
          if (aValue < bValue) return bulkSortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return bulkSortOrder === 'asc' ? 1 : -1;
          return 0;
        
        case 'availability':
          aValue = String(a.availability || '').toLowerCase();
          bValue = String(b.availability || '').toLowerCase();
          if (aValue < bValue) return bulkSortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return bulkSortOrder === 'asc' ? 1 : -1;
          return 0;
        
        case 'owner_name':
          aValue = String(a.owner_name || '').toLowerCase();
          bValue = String(b.owner_name || '').toLowerCase();
          if (aValue < bValue) return bulkSortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return bulkSortOrder === 'asc' ? 1 : -1;
          return 0;
        
        case 'owner_address':
          aValue = String(a.owner_address || '').toLowerCase();
          bValue = String(b.owner_address || '').toLowerCase();
          if (aValue < bValue) return bulkSortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return bulkSortOrder === 'asc' ? 1 : -1;
          return 0;
        
        case 'owner_phone':
          aValue = String(a.owner_phone || '').toLowerCase();
          bValue = String(b.owner_phone || '').toLowerCase();
          if (aValue < bValue) return bulkSortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return bulkSortOrder === 'asc' ? 1 : -1;
          return 0;
        
        case 'storage_location':
          aValue = String(a.storage_location || '').toLowerCase();
          bValue = String(b.storage_location || '').toLowerCase();
          if (aValue < bValue) return bulkSortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return bulkSortOrder === 'asc' ? 1 : -1;
          return 0;
        
        default:
          return 0;
      }
    });
    
    return sorted;
  };
  
  const handleBulkSort = (field) => {
    if (bulkSortBy === field) {
      // Toggle sort order if clicking the same column
      setBulkSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column and default to ascending
      setBulkSortBy(field);
      setBulkSortOrder('asc');
    }
  };
  
  const renderBulkSortableHeader = (field, label, className) => {
    const isActive = bulkSortBy === field;
    const sortIcon = isActive ? (bulkSortOrder === 'asc' ? ' ↑' : ' ↓') : '';
    return (
      <div
        className={`${className} bulk-sortable-header ${isActive ? 'active' : ''}`}
        onClick={() => handleBulkSort(field)}
        title={`Click to sort by ${label}`}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        {label}{sortIcon}
      </div>
    );
  };

  const handleBulkFilterChange = (field) => {
    setBulkMissingDataFilters(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleBulkSelect = (artworkId) => {
    setBulkSelectedIds(prev => 
      prev.includes(artworkId) 
        ? prev.filter(id => id !== artworkId)
        : [...prev, artworkId]
    );
  };

  const handleSelectAll = () => {
    const filtered = getFilteredBulkArtworks();
    const filteredIds = filtered.map(a => a.id);
    const allFilteredSelected = filteredIds.every(id => bulkSelectedIds.includes(id));
    
    if (allFilteredSelected) {
      // Deselect all filtered items
      setBulkSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered items (add to existing selection)
      setBulkSelectedIds(prev => {
        const newIds = [...prev];
        filteredIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  const handleBulkEdit = async () => {
    if (bulkSelectedIds.length === 0) {
      alert('Please select at least one artwork to edit');
      return;
    }

    const hasFieldUpdates = Object.values(bulkEditData).some(v => v.trim() !== '');
    const hasSeriesUpdates = bulkSelectedSeriesIds.length > 0;
    const hasExhibitionUpdates = bulkSelectedExhibitionIds.length > 0;

    if (!hasFieldUpdates && !hasSeriesUpdates && !hasExhibitionUpdates) {
      alert('Please fill in at least one field to update, or select series/exhibitions to add');
      return;
    }

    if (!window.confirm(`Are you sure you want to update ${bulkSelectedIds.length} artwork(s)?`)) {
      return;
    }

    setLoading(true);
    setBulkUpdateProgress({ phase: '', done: 0, total: 0 });

    const runBatched = async (items, batchSize, worker, phase) => {
      const total = items.length;
      let done = 0;
      setBulkUpdateProgress({ phase, done, total });

      const failures = [];
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (item) => {
          try {
            await worker(item);
            return { ok: true, item };
          } catch (err) {
            return { ok: false, item, err };
          }
        }));

        results.forEach((r) => {
          if (!r.ok) failures.push(r);
        });

        done += batch.length;
        setBulkUpdateProgress({ phase, done, total });
      }

      return failures;
    };

    try {
      // Update artwork fields
      if (hasFieldUpdates) {
        const updates = {};
        Object.keys(bulkEditData).forEach(key => {
          if (bulkEditData[key].trim() !== '') {
            updates[key] = bulkEditData[key].trim();
          }
        });

        const failures = await runBatched(
          bulkSelectedIds,
          20,
          (id) => axios.put(`/api/artworks/${id}`, updates),
          'Updating fields'
        );
        if (failures.length > 0) {
          throw new Error(`Failed field updates: ${failures.length} of ${bulkSelectedIds.length}`);
        }
      }

      // Add artworks to series
      if (hasSeriesUpdates) {
        const seriesTasks = [];
        for (const artworkId of bulkSelectedIds) {
          for (const seriesId of bulkSelectedSeriesIds) {
            seriesTasks.push({ artworkId, seriesId });
          }
        }

        await runBatched(
          seriesTasks,
          30,
          async ({ artworkId, seriesId }) => {
            try {
              await axios.put(`/api/artworks/${artworkId}/series/${seriesId}`);
            } catch (err) {
              // Ignore errors if artwork is already in series
              if (err.response?.status !== 400) {
                throw err;
              }
            }
          },
          'Adding to series'
        );
      }

      // Add artworks to exhibitions (update past_exhibitions field)
      if (hasExhibitionUpdates) {
        const bulkById = new Map((bulkArtworks || []).map(a => [a.id, a]));
        const selectedExhibitions = allExhibitions.filter(ex => bulkSelectedExhibitionIds.includes(ex.id));
        const exhibitionLines = selectedExhibitions.map(ex => {
          const parts = [ex.year, ex.title];
          if (ex.location) parts.push(ex.location);
          return parts.filter(Boolean).join(' – ');
        });

        const failures = await runBatched(
          bulkSelectedIds,
          10,
          async (artworkId) => {
            // Use already-loaded bulk data when possible (avoids 400+ extra GET requests)
            let currentExhibitions = bulkById.get(artworkId)?.past_exhibitions || '';
            if (!currentExhibitions && currentExhibitions !== '') {
              const artworkResponse = await axios.get(`/api/artworks/${artworkId}`);
              currentExhibitions = artworkResponse.data.past_exhibitions || '';
            }

            const existingLines = String(currentExhibitions).split('\n').filter(l => l.trim());
            const allLines2 = [...existingLines];
            exhibitionLines.forEach(newLine => {
              if (!existingLines.includes(newLine)) {
                allLines2.push(newLine);
              }
            });

            const updatedExhibitions = allLines2.join('\n');
            await axios.put(`/api/artworks/${artworkId}`, { past_exhibitions: updatedExhibitions });
          },
          'Adding to exhibitions'
        );

        if (failures.length > 0) {
          throw new Error(`Failed exhibition updates: ${failures.length} of ${bulkSelectedIds.length}`);
        }
      }
      
      alert(`Successfully updated ${bulkSelectedIds.length} artwork(s)!`);
      
      // Reset
      setBulkSelectedIds([]);
      setBulkEditData({
        year: '',
        medium: '',
        availability: '',
        owner_name: '',
        owner_address: '',
        owner_phone: '',
        storage_location: ''
      });
      setBulkSelectedSeriesIds([]);
      setBulkSelectedExhibitionIds([]);
      
      // Refresh artworks list
      fetchBulkArtworks();
    } catch (error) {
      console.error('Error updating artworks:', error);
      alert('Failed to update artworks: ' + (error.response?.data?.error || error.message) + '\n\nNo fields were cleared. You can retry.');
    } finally {
      setLoading(false);
      setBulkUpdateProgress({ phase: '', done: 0, total: 0 });
    }
  };

  useEffect(() => {
    if (activeTab === 'bulk' && bulkArtworks.length === 0) {
      fetchBulkArtworks();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'database' && dbArtworks.length === 0) {
      (async () => {
        try {
          setDbLoading(true);
          const res = await axios.get('/api/artworks');
          setDbArtworks(res.data || []);
        } catch (err) {
          console.error('Error loading database artworks:', err);
          alert('Failed to load database list: ' + (err.response?.data?.error || err.message));
        } finally {
          setDbLoading(false);
        }
      })();
    }
  }, [activeTab, dbArtworks.length]);

  useEffect(() => {
    try {
      localStorage.setItem('dbTwoColumnList', String(dbTwoColumnList));
      localStorage.setItem('dbThreeColumnList', String(dbThreeColumnList));
      localStorage.setItem('dbSortBy', dbSortBy);
      localStorage.setItem('dbSortOrder', dbSortOrder);
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, [dbTwoColumnList, dbThreeColumnList, dbSortBy, dbSortOrder]);

  const getFilteredDbArtworks = () => {
    const term = dbSearchTerm.toLowerCase().trim();
    const filtered = term ? dbArtworks.filter((a) => {
      const hay = [
        a.id_display || a.id,
        a.year,
        a.title,
        a.dimensions,
        a.medium,
        a.value,
        a.availability,
        a.for_sale_price,
        a.description,
        a.owner_name,
        a.owner_address,
        a.owner_phone,
        a.more_info,
        a.storage_location,
        a.past_exhibitions
      ].map(v => String(v || '').toLowerCase()).join(' | ');
      return hay.includes(term);
    }) : dbArtworks;

    const getSortValue = (a) => {
      switch (dbSortBy) {
        case 'title':
          return String(a.title || '').toLowerCase();
        case 'year': {
          const y = Number.parseInt(a.year, 10);
          return Number.isFinite(y) ? y : Number.POSITIVE_INFINITY;
        }
        case 'updated': {
          const t = Date.parse(a.updated_at || '');
          return Number.isFinite(t) ? t : 0;
        }
        case 'created': {
          const t = Date.parse(a.created_at || '');
          return Number.isFinite(t) ? t : 0;
        }
        case 'id':
        default:
          return Number(a.id) || 0;
      }
    };

    const sorted = [...filtered].sort((a, b) => {
      const av = getSortValue(a);
      const bv = getSortValue(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      // tie-breaker: id asc
      const aid = Number(a.id) || 0;
      const bid = Number(b.id) || 0;
      return aid - bid;
    });

    return dbSortOrder === 'desc' ? sorted.reverse() : sorted;
  };

  const getDbArtworksWithGaps = () => {
    const list = getFilteredDbArtworks();
    if (dbSortBy !== 'id' || dbSearchTerm.trim()) return list;
    if (list.length === 0) return list;

    const sortedAsc = [...list].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    const idMap = new Map();
    sortedAsc.forEach((a) => {
      const idNum = Number(a.id) || 0;
      idMap.set(idNum, a);
    });
    const ids = new Set(idMap.keys());
    const minId = Number(sortedAsc[0].id) || 0;
    const maxId = Number(sortedAsc[sortedAsc.length - 1].id) || 0;

    const combined = [];
    for (let i = minId; i <= maxId; i += 1) {
      if (ids.has(i)) {
        const item = idMap.get(i);
        if (item) combined.push(item);
      } else {
        combined.push({ id: i, isPlaceholder: true });
      }
    }

    return dbSortOrder === 'desc' ? combined.reverse() : combined;
  };

  const handleAddMissingId = (idToAdd) => {
    setActiveTab('single');
    setFormTab('info');
    navigate(`/add?manualId=${idToAdd}`);
  };

  const handleToggleHidden = async (artworkIdToToggle, nextHidden) => {
    try {
      await axios.put(`/api/artworks/${artworkIdToToggle}`, { is_hidden: nextHidden ? 1 : 0 });
      setDbArtworks((prev) => prev.map((a) => (
        a.id === artworkIdToToggle ? { ...a, is_hidden: nextHidden ? 1 : 0 } : a
      )));
      // Keep bulk list in sync if it was loaded
      setBulkArtworks((prev) => prev.map((a) => (
        a.id === artworkIdToToggle ? { ...a, is_hidden: nextHidden ? 1 : 0 } : a
      )));
    } catch (err) {
      console.error('Error toggling is_hidden:', err);
      alert('Failed to update hide setting: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading && isEditMode) {
    return <div className="loading">Loading artwork...</div>;
  }

  return (
    <div className="artwork-form">
      <h1>{isEditMode ? 'Edit Artwork' : 'Add New Artwork'}</h1>
      
      {isAuthenticated && (
        <div className="form-tabs">
          <button
            type="button"
            className={`tab-button ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            {isEditMode ? 'Artwork' : 'Single Artwork'}
          </button>
          {!isEditMode && (
            <button
              type="button"
              className={`tab-button ${activeTab === 'audio-desc-queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('audio-desc-queue')}
              title="Record audio descriptions for artworks that are missing them"
            >
              Audio Desc
            </button>
          )}
          <button
            type="button"
            className={`tab-button ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => setActiveTab('database')}
          >
            Database
          </button>
          {!isEditMode && (
            <button
              type="button"
              className={`tab-button ${activeTab === 'bulk' ? 'active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              Bulk Edit
            </button>
          )}
          <button
            type="button"
            className={`tab-button ${activeTab === 'misc-videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('misc-videos')}
          >
            Misc Videos
          </button>
        </div>
      )}

      {activeTab === 'audio-desc-queue' && isAuthenticated && !isEditMode && (
        <div className="audio-desc-queue">
          <div className="audio-desc-queue-header">
            <h2>Record Audio Descriptions (Queue)</h2>
            <div className="audio-desc-queue-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadAudioQueue}
                disabled={audioQueueLoading || audioQueueBusy}
              >
                {audioQueueLoading ? 'Loading…' : 'Refresh'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={skipAudioQueueArtwork}
                disabled={!audioQueueCurrent || audioQueueLoading || audioQueueBusy}
              >
                Skip
              </button>
            </div>
          </div>

          <p className="upload-hint">
            When you open this tab it finds an artwork without a recorded audio description, shows its image, and lets you record. Skip picks another.
          </p>

          {audioQueueLoading ? (
            <div className="loading">Finding artworks…</div>
          ) : audioQueueError ? (
            <div className="audio-desc-queue-empty">Error: {audioQueueError}</div>
          ) : !audioQueueCurrent ? (
            <div className="audio-desc-queue-empty">
              No artworks found that are missing an audio description (with an image available).
            </div>
          ) : (
            <>
              <div className="audio-desc-preview">
                {(() => {
                  const previewFile = getArtworkPreviewImage(audioQueueCurrent);
                  if (!previewFile) {
                    return (
                      <div className="audio-desc-no-preview">
                        No image found for this artwork. (It was filtered out; try refresh.)
                      </div>
                    );
                  }
                  return (
                    <img
                      src={getMediaUrl(previewFile)}
                      alt={audioQueueCurrent.title || `Artwork ${audioQueueCurrent.id}`}
                      className="audio-desc-image"
                    />
                  );
                })()}
                <div className="audio-desc-meta">
                  <div className="audio-desc-id">#{audioQueueCurrent.id_display || audioQueueCurrent.id}</div>
                  <div className="audio-desc-title">{audioQueueCurrent.title || 'Untitled'}</div>
                  <div className="audio-desc-queue-count">
                    Remaining: {audioQueueCandidates.length}
                  </div>
                </div>
              </div>

              <div className="audio-recorder-container">
                <AudioRecorder
                  onRecordingComplete={handleQueueRecordingComplete}
                  onCancel={() => {}}
                />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'database' && isAuthenticated && (
        <div className="database-tab">
          <h2>Database</h2>
          <p className="bulk-edit-hint">
            Search and review all artworks in the database. Use the toggle to hide an artwork from public galleries (it will still be visible when logged in).
          </p>

          <div className="database-controls">
            <input
              type="text"
              placeholder="Search across all fields..."
              value={dbSearchTerm}
              onChange={(e) => setDbSearchTerm(e.target.value)}
              className="bulk-search-input"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDbSearchTerm('')}
              disabled={!dbSearchTerm}
            >
              Clear
            </button>
            <label className="database-control">
              <input
                type="checkbox"
                checked={dbTwoColumnList}
                onChange={(e) => {
                  const next = e.target.checked;
                  setDbTwoColumnList(next);
                  if (next) setDbThreeColumnList(false);
                }}
              />
              <span>2 columns</span>
            </label>
            <label className="database-control">
              <input
                type="checkbox"
                checked={dbThreeColumnList}
                onChange={(e) => {
                  const next = e.target.checked;
                  setDbThreeColumnList(next);
                  if (next) setDbTwoColumnList(false);
                }}
              />
              <span>3 columns (ID + Title)</span>
            </label>
            <label className="database-control">
              <span>Sort</span>
              <select
                value={dbSortBy}
                onChange={(e) => setDbSortBy(e.target.value)}
                className="database-sort-select"
              >
                <option value="id">ID</option>
                <option value="title">Title</option>
                <option value="year">Year</option>
                <option value="updated">Updated</option>
                <option value="created">Created</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDbSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title="Toggle sort direction"
            >
              {dbSortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {dbLoading ? (
            <div className="loading">Loading database list...</div>
          ) : (
            <div
              className={`database-list ${dbTwoColumnList ? 'two-columns' : ''} ${dbThreeColumnList ? 'three-columns database-compact' : ''}`}
            >
              {getDbArtworksWithGaps().map((a) => (
                a.isPlaceholder ? (
                  <div key={`missing-${a.id}`} className="database-item database-missing">
                    <div className="database-summary database-summary-missing">
                      <div className="database-summary-left">
                        <span className="database-id">#{a.id}</span>
                        <span className="database-title">Missing ID</span>
                      </div>
                      <div className="database-summary-right">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleAddMissingId(a.id)}
                        >
                          Add Artwork
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <details key={a.id} className={`database-item ${a.is_hidden ? 'hidden' : ''}`}>
                  <summary className="database-summary">
                    <div className="database-summary-left">
                      <span className="database-id">#{a.id_display || a.id}</span>
                      <span className="database-title">{a.title || 'Untitled'}</span>
                      {a.year && <span className="database-meta">{a.year}</span>}
                      {a.medium && <span className="database-meta">{a.medium}</span>}
                      {a.is_hidden ? <span className="database-hidden-badge">HIDDEN</span> : null}
                    </div>
                    <div className="database-summary-right" onClick={(e) => e.stopPropagation()}>
                      <label className="database-toggle">
                        <input
                          type="checkbox"
                          checked={!!a.is_hidden}
                          onChange={(e) => handleToggleHidden(a.id, e.target.checked)}
                        />
                        <span>Hide from public</span>
                      </label>
                      <Link
                        className="btn btn-secondary btn-sm"
                        to={`/edit/${a.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('single');
                          setFormTab('info');
                        }}
                      >
                        Edit
                      </Link>
                    </div>
                  </summary>

                  <div className="database-details">
                    <div><strong>ID:</strong> {a.id_display || a.id}</div>
                    <div><strong>Year:</strong> {a.year || '—'}</div>
                    <div><strong>Title:</strong> {a.title || '—'}</div>
                    <div><strong>Dimensions:</strong> {a.dimensions || '—'}</div>
                    <div><strong>Medium:</strong> {a.medium || '—'}</div>
                    <div><strong>Value:</strong> {a.value || '—'}</div>
                    <div><strong>Availability:</strong> {a.availability || '—'}</div>
                    <div><strong>For Sale Price:</strong> {a.for_sale_price || '—'}</div>
                    <div><strong>Description:</strong> {a.description || '—'}</div>
                    <div><strong>Owner Name:</strong> {a.owner_name || '—'}</div>
                    <div><strong>Owner Address:</strong> {a.owner_address || '—'}</div>
                    <div><strong>Owner Phone:</strong> {a.owner_phone || '—'}</div>
                    <div><strong>More Info:</strong> {a.more_info || '—'}</div>
                    <div><strong>Storage Location:</strong> {a.storage_location || '—'}</div>
                    <div><strong>Past Exhibitions:</strong> {a.past_exhibitions || '—'}</div>
                    <div><strong>Hidden:</strong> {a.is_hidden ? 'Yes' : 'No'}</div>
                    <div><strong>Created:</strong> {a.created_at || '—'}</div>
                    <div><strong>Updated:</strong> {a.updated_at || '—'}</div>
                  </div>
                  </details>
                )
              ))}
            </div>
          )}
          <ScrollToTopButton />
        </div>
      )}

      {activeTab === 'bulk' && !isEditMode && (
        <div className="bulk-edit-section">
          <h2>Bulk Edit Artworks</h2>
          <p className="bulk-edit-hint">
            Select multiple artworks and update common fields. Only filled fields will be updated.
          </p>

          <div className="bulk-edit-controls">
            <div className="bulk-search-container">
              <input
                type="text"
                placeholder="Search artworks by ID, title, year, medium, or owner..."
                value={bulkSearchTerm}
                onChange={(e) => setBulkSearchTerm(e.target.value)}
                className="bulk-search-input"
              />
            </div>
            <div className="bulk-controls-row">
              <button
                type="button"
                onClick={handleSelectAll}
                className="btn btn-secondary"
              >
                {bulkSelectedIds.length === getFilteredBulkArtworks().length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="selection-count">
                {bulkSelectedIds.length} of {getFilteredBulkArtworks().length} selected
                {(showMissingDataFilter || bulkSearchTerm.trim()) && getFilteredBulkArtworks().length !== bulkArtworks.length && (
                  <span className="filter-note"> (filtered from {bulkArtworks.length} total)</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowMissingDataFilter(!showMissingDataFilter)}
                className="btn btn-secondary"
              >
                {showMissingDataFilter ? 'Hide' : 'Show'} Missing Data Filter
              </button>
            </div>
          </div>

          {showMissingDataFilter && (
            <div className="bulk-missing-data-filters">
              <h3>Filter by Missing Data:</h3>
              <div className="bulk-filter-checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.year}
                    onChange={() => handleBulkFilterChange('year')}
                  />
                  Year
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.medium}
                    onChange={() => handleBulkFilterChange('medium')}
                  />
                  Medium
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.dimensions}
                    onChange={() => handleBulkFilterChange('dimensions')}
                  />
                  Dimensions
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.availability}
                    onChange={() => handleBulkFilterChange('availability')}
                  />
                  Availability
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.owner_name}
                    onChange={() => handleBulkFilterChange('owner_name')}
                  />
                  Owner Name
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.owner_address}
                    onChange={() => handleBulkFilterChange('owner_address')}
                  />
                  Owner Address
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.owner_phone}
                    onChange={() => handleBulkFilterChange('owner_phone')}
                  />
                  Owner Phone
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.storage_location}
                    onChange={() => handleBulkFilterChange('storage_location')}
                  />
                  Storage Location
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.description}
                    onChange={() => handleBulkFilterChange('description')}
                  />
                  Description
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bulkMissingDataFilters.more_info}
                    onChange={() => handleBulkFilterChange('more_info')}
                  />
                  More Info
                </label>
              </div>
              <button
                type="button"
                onClick={() => setBulkMissingDataFilters({
                  year: false,
                  medium: false,
                  dimensions: false,
                  availability: false,
                  owner_name: false,
                  owner_address: false,
                  owner_phone: false,
                  storage_location: false,
                  description: false,
                  more_info: false
                })}
                className="btn btn-secondary"
              >
                Clear Filters
              </button>
            </div>
          )}

          <div className="bulk-artworks-list">
            <div className="bulk-artwork-header">
              <div className="bulk-header-checkbox"></div>
              {renderBulkSortableHeader('id', 'ID', 'bulk-header-id')}
              {renderBulkSortableHeader('title', 'Title', 'bulk-header-title')}
              {renderBulkSortableHeader('year', 'Year', 'bulk-header-year')}
              {renderBulkSortableHeader('medium', 'Medium', 'bulk-header-medium')}
              {renderBulkSortableHeader('availability', 'Availability', 'bulk-header-availability')}
              {renderBulkSortableHeader('owner_name', 'Owner', 'bulk-header-owner')}
              {renderBulkSortableHeader('owner_address', 'Address', 'bulk-header-address')}
              {renderBulkSortableHeader('owner_phone', 'Phone', 'bulk-header-phone')}
              {renderBulkSortableHeader('storage_location', 'Storage', 'bulk-header-storage')}
            </div>
            {getFilteredBulkArtworks().map(artwork => (
              <div key={artwork.id} className="bulk-artwork-item">
                <label className="bulk-checkbox-label">
                  <input
                    type="checkbox"
                    checked={bulkSelectedIds.includes(artwork.id)}
                    onChange={() => handleBulkSelect(artwork.id)}
                    className="bulk-checkbox"
                  />
                </label>
                <div className="bulk-artwork-info">
                  <div className="bulk-artwork-id">#{artwork.id_display || artwork.id}</div>
                  <div className="bulk-artwork-title">{artwork.title || 'Untitled'}</div>
                  <div className="bulk-artwork-year">{artwork.year || '—'}</div>
                  <div className="bulk-artwork-medium">{artwork.medium || '—'}</div>
                  <div className="bulk-artwork-availability">{artwork.availability || '—'}</div>
                  <div className="bulk-artwork-owner">{artwork.owner_name || '—'}</div>
                  <div className="bulk-artwork-address">{artwork.owner_address || '—'}</div>
                  <div className="bulk-artwork-phone">{artwork.owner_phone || '—'}</div>
                  <div className="bulk-artwork-storage">{artwork.storage_location || '—'}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bulk-edit-fields">
            <h3>Fields to Update (leave blank to skip)</h3>
            
            {/* Series and Exhibitions Section */}
            <div className="bulk-series-exhibitions-section">
              <h4>Add to Series</h4>
              {allSeries.length === 0 ? (
                <p className="field-hint">No series available. <Link to="/series">Create a series</Link> first.</p>
              ) : (
                <div className="bulk-series-selector">
                  {allSeries.map(series => (
                    <label key={series.id} className="bulk-series-checkbox">
                      <input
                        type="checkbox"
                        checked={bulkSelectedSeriesIds.includes(series.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkSelectedSeriesIds(prev => [...prev, series.id]);
                          } else {
                            setBulkSelectedSeriesIds(prev => prev.filter(id => id !== series.id));
                          }
                        }}
                      />
                      <span>{series.name}</span>
                    </label>
                  ))}
                </div>
              )}
              
              <h4>Add to Exhibitions</h4>
              {allExhibitions.length === 0 ? (
                <p className="field-hint">No exhibitions available. <Link to="/exhibitions">Create an exhibition</Link> first.</p>
              ) : (
                <div className="bulk-exhibitions-selector">
                  {allExhibitions.map(exhibition => (
                    <label key={exhibition.id} className="bulk-exhibition-checkbox">
                      <input
                        type="checkbox"
                        checked={bulkSelectedExhibitionIds.includes(exhibition.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkSelectedExhibitionIds(prev => [...prev, exhibition.id]);
                          } else {
                            setBulkSelectedExhibitionIds(prev => prev.filter(id => id !== exhibition.id));
                          }
                        }}
                      />
                      <span>
                        {exhibition.year} – {exhibition.title}
                        {exhibition.location && ` (${exhibition.location})`}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bulk-form-grid">
              <div className="form-group">
                <label htmlFor="bulk-year">Year</label>
                <input
                  type="text"
                  id="bulk-year"
                  value={bulkEditData.year}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, year: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to skip"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bulk-medium">Medium</label>
                <input
                  type="text"
                  id="bulk-medium"
                  value={bulkEditData.medium}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, medium: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to skip"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bulk-availability">Availability</label>
                <input
                  type="text"
                  id="bulk-availability"
                  value={bulkEditData.availability}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, availability: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to skip"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bulk-owner">Owner Name</label>
                <input
                  type="text"
                  id="bulk-owner"
                  value={bulkEditData.owner_name}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, owner_name: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to skip"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bulk-owner-address">Owner Address</label>
                <input
                  type="text"
                  id="bulk-owner-address"
                  value={bulkEditData.owner_address}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, owner_address: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to skip"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bulk-owner-phone">Owner Phone</label>
                <input
                  type="text"
                  id="bulk-owner-phone"
                  value={bulkEditData.owner_phone}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, owner_phone: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to skip"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bulk-storage">Storage Location</label>
                <input
                  type="text"
                  id="bulk-storage"
                  value={bulkEditData.storage_location}
                  onChange={(e) => setBulkEditData(prev => ({ ...prev, storage_location: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to skip"
                />
              </div>
            </div>

            <div className="bulk-edit-actions">
              <button
                type="button"
                onClick={handleBulkEdit}
                disabled={loading || bulkSelectedIds.length === 0}
                className="btn btn-primary"
              >
                {loading ? 'Updating...' : `Update ${bulkSelectedIds.length} Artwork(s)`}
              </button>
              {loading && bulkUpdateProgress.total > 0 && (
                <div className="bulk-edit-progress">
                  <strong>{bulkUpdateProgress.phase}</strong> — {bulkUpdateProgress.done}/{bulkUpdateProgress.total}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'misc-videos' && isAuthenticated && (
        <div className="misc-videos-section">
          <h2>Misc Videos</h2>
          <p className="misc-videos-description">
            Upload videos or click on a video name to edit its display name. The display name will be shown in the gallery instead of the filename.
          </p>
          
          <div className="misc-video-upload-section">
            <label htmlFor="misc-video-upload" className="misc-video-upload-label">
              <input
                type="file"
                id="misc-video-upload"
                accept="video/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  const formData = new FormData();
                  formData.append('video', file);

                  setUploadingMiscVideo(true);
                  try {
                    await axios.post('/api/misc-videos', formData, {
                      headers: {
                        'Content-Type': 'multipart/form-data'
                      }
                    });
                    // Refresh the misc videos list
                    const response = await axios.get('/api/misc-videos');
                    setMiscVideos(response.data || []);
                    e.target.value = ''; // Reset file input
                  } catch (error) {
                    console.error('Error uploading misc video:', error);
                    alert('Failed to upload video: ' + (error.response?.data?.error || error.message));
                  } finally {
                    setUploadingMiscVideo(false);
                  }
                }}
                disabled={uploadingMiscVideo}
                style={{ display: 'none' }}
              />
              <div className="misc-video-upload-button">
                {uploadingMiscVideo ? 'Uploading...' : '📹 Upload Video'}
              </div>
            </label>
          </div>

          {miscVideos.length === 0 ? (
            <p className="no-misc-videos">No misc videos found. Upload a video to get started.</p>
          ) : (
            <div className="misc-videos-grid">
              {miscVideos.map((video, index) => (
                <div key={index} className="misc-video-card">
                  <div className="misc-video-preview">
                    <video
                      src={`/media/${video.filename}`}
                      className="misc-video-thumbnail"
                      muted
                      preload="metadata"
                    />
                    <div className="misc-video-play-overlay">▶</div>
                  </div>
                  <div className="misc-video-info">
                    {editingMiscVideoDisplayName === `misc-${index}` ? (
                      <input
                        type="text"
                        value={miscVideoDisplayNameValue}
                        onChange={(e) => setMiscVideoDisplayNameValue(e.target.value)}
                        onBlur={async () => {
                          if (!isAuthenticated) return;
                          try {
                            await axios.put(`/api/misc-videos/${encodeURIComponent(video.filename)}/display-name`, {
                              display_name: miscVideoDisplayNameValue.trim() || null
                            });
                            const response = await axios.get('/api/misc-videos');
                            setMiscVideos(response.data || []);
                            setEditingMiscVideoDisplayName(null);
                            setMiscVideoDisplayNameValue('');
                          } catch (error) {
                            console.error('Error updating misc video display name:', error);
                            alert('Failed to update display name: ' + (error.response?.data?.error || error.message));
                            setEditingMiscVideoDisplayName(null);
                            setMiscVideoDisplayNameValue('');
                          }
                        }}
                        onKeyDown={async (e) => {
                          if (!isAuthenticated) return;
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            try {
                              await axios.put(`/api/misc-videos/${encodeURIComponent(video.filename)}/display-name`, {
                                display_name: miscVideoDisplayNameValue.trim() || null
                              });
                              const response = await axios.get('/api/misc-videos');
                              setMiscVideos(response.data || []);
                              setEditingMiscVideoDisplayName(null);
                              setMiscVideoDisplayNameValue('');
                            } catch (error) {
                              console.error('Error updating misc video display name:', error);
                              alert('Failed to update display name: ' + (error.response?.data?.error || error.message));
                              setEditingMiscVideoDisplayName(null);
                              setMiscVideoDisplayNameValue('');
                            }
                          } else if (e.key === 'Escape') {
                            setEditingMiscVideoDisplayName(null);
                            setMiscVideoDisplayNameValue('');
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
                            setEditingMiscVideoDisplayName(`misc-${index}`);
                            setMiscVideoDisplayNameValue(video.displayName || '');
                          }
                        }}
                        title={isAuthenticated ? "Click to edit display name" : ""}
                        style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
                      >
                        {video.displayName || video.filename}
                        {isAuthenticated && <span className="misc-video-edit-hint">✏️</span>}
                      </div>
                    )}
                    <div className="misc-video-filename">{video.filename}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'single' && (
        <div>
      {isEditMode && (
        <div className="form-content-tabs">
          <button
            type="button"
            className={`form-content-tab ${formTab === 'info' ? 'active' : ''}`}
            onClick={() => setFormTab('info')}
          >
            Artwork Info
          </button>
          <button
            type="button"
            className={`form-content-tab ${formTab === 'media' ? 'active' : ''}`}
            onClick={() => setFormTab('media')}
          >
            Media Files
          </button>
          <button
            type="button"
            className={`form-content-tab ${formTab === 'audio-desc' ? 'active' : ''}`}
            onClick={() => setFormTab('audio-desc')}
          >
            Audio Description
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form">
        {(!isEditMode || formTab === 'info') && (
        <div className="form-grid">
          {isEditMode ? (
            <div className="form-group">
              <label htmlFor="edit_id">ID</label>
              <div className="id-edit-container">
                <input
                  type="number"
                  id="edit_id"
                  value={editId}
                  onChange={handleIdChange}
                  min="1"
                  max="999999"
                  placeholder="Enter new ID"
                  className={`form-input ${idCheckStatus === 'available' ? 'id-available' : idCheckStatus === 'taken' || idCheckStatus === 'invalid' ? 'id-error' : ''}`}
                  disabled={changingId}
                />
                {editId && parseInt(editId) !== artworkId && (
                  <button
                    type="button"
                    onClick={handleChangeId}
                    disabled={changingId || idCheckStatus !== 'available'}
                    className="btn btn-primary change-id-btn"
                  >
                    {changingId ? 'Changing...' : 'Change ID'}
                  </button>
                )}
              </div>
              {idCheckStatus === 'checking' && (
                <span className="id-status checking">Checking availability...</span>
              )}
              {idCheckStatus === 'available' && (
                <span className="id-status available">✓ ID is available</span>
              )}
              {idCheckStatus === 'taken' && (
                <span className="id-status taken">✗ This ID is already in use</span>
              )}
              {idCheckStatus === 'invalid' && (
                <span className="id-status invalid">✗ ID must be between 1 and 999999</span>
              )}
              {!editId || parseInt(editId) === artworkId ? (
                <small className="field-hint">Current ID: #{artworkId}. Enter a new ID to change it.</small>
              ) : null}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="manual_id">ID (Optional - Leave blank for auto-assign)</label>
              <input
                type="number"
                id="manual_id"
                value={manualId}
                onChange={handleIdChange}
                min="1"
                max="999999"
                placeholder="Enter ID (1-999999)"
                className={`form-input ${idCheckStatus === 'available' ? 'id-available' : idCheckStatus === 'taken' || idCheckStatus === 'invalid' ? 'id-error' : ''}`}
              />
              {idCheckStatus === 'checking' && (
                <span className="id-status checking">Checking availability...</span>
              )}
              {idCheckStatus === 'available' && (
                <span className="id-status available">✓ ID is available</span>
              )}
              {idCheckStatus === 'taken' && (
                <span className="id-status taken">✗ This ID is already in use</span>
              )}
              {idCheckStatus === 'invalid' && (
                <span className="id-status invalid">✗ ID must be between 1 and 999999</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="year">Year</label>
            <input
              type="text"
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              placeholder="e.g., 1982, 1977-1983, 90s, 1982?, Unknown"
              className="form-input"
            />
            <small className="field-hint">
              Accepts: single year (1982), range (1977-1983), decade (90s), uncertain (1982?), or Unknown
            </small>
          </div>

          <div className="form-group full-width">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dimensions">Dimensions</label>
            <input
              type="text"
              id="dimensions"
              name="dimensions"
              value={formData.dimensions}
              onChange={handleChange}
              placeholder="e.g., 24x36 inches"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="medium">Medium</label>
            <input
              type="text"
              id="medium"
              name="medium"
              value={formData.medium}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="value">Value</label>
            <input
              type="text"
              id="value"
              name="value"
              value={formData.value}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="availability">Availability</label>
            <input
              type="text"
              id="availability"
              name="availability"
              value={formData.availability}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {isEditMode && (
            <div className="form-group">
              <label className="checkbox-label" htmlFor="is_hidden">
                <input
                  type="checkbox"
                  id="is_hidden"
                  name="is_hidden"
                  checked={!!formData.is_hidden}
                  onChange={(e) => {
                    const next = e.target.checked ? 1 : 0;
                    setFormData((prev) => ({ ...prev, is_hidden: next }));
                  }}
                />
                Hide from public galleries
              </label>
              <small className="field-hint">
                When checked, this artwork will not appear to visitors unless logged in.
              </small>
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label" htmlFor="hide_images_public">
              <input
                type="checkbox"
                id="hide_images_public"
                name="hide_images_public"
                checked={!!formData.hide_images_public}
                onChange={(e) => {
                  const next = e.target.checked ? 1 : 0;
                  setFormData((prev) => ({ ...prev, hide_images_public: next }));
                }}
              />
              Hide images from public visitors
            </label>
            <small className="field-hint">
              Public viewers will see the artwork, but its images will be hidden unless logged in.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="for_sale_price">For Sale Price</label>
            <input
              type="text"
              id="for_sale_price"
              name="for_sale_price"
              value={formData.for_sale_price}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="owner_name">Owner Name</label>
            <input
              type="text"
              id="owner_name"
              name="owner_name"
              value={formData.owner_name}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="owner_phone">Owner Phone</label>
            <input
              type="tel"
              id="owner_phone"
              name="owner_phone"
              value={formData.owner_phone}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="owner_address">Owner Address</label>
            <input
              type="text"
              id="owner_address"
              name="owner_address"
              value={formData.owner_address}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="more_info">More Info</label>
            <textarea
              id="more_info"
              name="more_info"
              value={formData.more_info}
              onChange={handleChange}
              rows="2"
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="storage_location">Storage Location</label>
            <input
              type="text"
              id="storage_location"
              name="storage_location"
              value={formData.storage_location}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="past_exhibitions">Past Exhibitions</label>
            <textarea
              id="past_exhibitions"
              name="past_exhibitions"
              value={formData.past_exhibitions}
              onChange={handleChange}
              rows="2"
              placeholder="List exhibitions, one per line"
              className="form-input"
            />
            {allExhibitions.length > 0 && (
              <div className="exhibitions-selector">
                <div className="exhibitions-selector-header">
                  <span>Known Exhibitions</span>
                  <small>(check any that this artwork has been shown in)</small>
                </div>
                <div className="exhibitions-selector-list">
                  {allExhibitions.map(ex => (
                    <label key={ex.id} className="exhibitions-selector-item">
                      <input
                        type="checkbox"
                        checked={selectedExhibitionIds.includes(ex.id)}
                        onChange={() => handleExhibitionToggle(ex.id)}
                      />
                      <span className="exhibitions-selector-text">
                        <span className="exhibitions-selector-title">{ex.title}</span>
                        <span className="exhibitions-selector-meta">
                          {ex.year}{ex.location ? ` – ${ex.location}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-group full-width">
            <label>Series & Collections</label>
            {allSeries.length === 0 ? (
              <p className="field-hint">
                No series found. <Link to="/series">Create series on the Series page</Link>.
              </p>
            ) : (
              <div className="series-selector">
                <div className="series-selector-header">
                  <span>Assign to Series</span>
                  <small>(check any series this artwork belongs to)</small>
                </div>
                <div className="series-selector-list">
                  {allSeries.map(series => (
                    <label key={series.id} className="series-selector-item">
                      <input
                        type="checkbox"
                        checked={selectedSeriesIds.includes(series.id)}
                        onChange={() => handleSeriesToggle(series.id)}
                      />
                      <span className="series-selector-text">
                        <span className="series-selector-name">{series.name}</span>
                        {series.description && (
                          <span className="series-selector-description">{series.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {isEditMode && formTab === 'media' && (
          <div className="form-media-tab-content">
            <div className="media-section">
              <h2>Media Files</h2>
              
              <div className="media-upload">
                <div className="upload-options">
                  <label htmlFor="media-upload" className="upload-label">
                    {uploading ? 'Uploading...' : '📁 Upload Media File'}
                  </label>
                  <input
                    type="file"
                    id="media-upload"
                    onChange={handleMediaUpload}
                    disabled={uploading}
                    accept="image/*,video/*,audio/*,.txt,.pdf,.webm"
                    className="file-input"
                  />
                </div>
                
                <p className="upload-hint">
                  Upload images, videos, audio files, or text documents.
                  First file will be primary media.
                </p>
              </div>

              {mediaFiles.length > 0 && (
                <div className="media-grid">
                  {mediaFiles.map((filename, index) => {
                    const ext = filename.split('.').pop().toLowerCase();
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                    const isVideo = ['mp4', 'avi', 'mov', 'webm'].includes(ext);
                    const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
                    
                    // Check if this media is primary
                    const isPrimary = mediaPrimary[index] === '1' || mediaPrimary[index] === 1;
                    
                    return (
                      <div key={index} className="media-item">
                        {isImage && (
                          <img
                            src={getMediaUrl(filename)}
                            alt={filename}
                            className="media-preview"
                            onLoad={(e) => {
                              const img = e.target;
                              setImageDimensions(prev => ({
                                ...prev,
                                [filename]: {
                                  width: img.naturalWidth,
                                  height: img.naturalHeight
                                }
                              }));
                            }}
                          />
                        )}
                        {isVideo && (
                          <video
                            src={getMediaUrl(filename)}
                            className="media-preview"
                            controls
                          />
                        )}
                        {isAudio && (
                          <div className="media-preview audio-preview">
                            <span>🎵</span>
                            <audio src={getMediaUrl(filename)} controls />
                          </div>
                        )}
                        {!isImage && !isVideo && !isAudio && (
                          <div className="media-preview file-preview">
                            <span>📄</span>
                            <span>{filename}</span>
                          </div>
                        )}
                        <div className="media-info">
                          <span className="media-filename">{filename}</span>
                          {isImage && imageDimensions[filename] && (
                            <span className="media-resolution">
                              {imageDimensions[filename].width} × {imageDimensions[filename].height} px
                            </span>
                          )}
                          {isPrimary && (
                            <span className="primary-badge">Primary</span>
                          )}
                          {isEditMode && (
                            <label className="media-public-toggle">
                              <input
                                type="checkbox"
                                checked={mediaPublic[index] !== 0 && mediaPublic[index] !== '0'}
                                onChange={(e) => handleUpdateMediaPublic(filename, e.target.checked)}
                              />
                              Public
                            </label>
                          )}
                          {isEditMode && isAudioOrVideo(filename) && (
                            <div className="media-display-name">
                              {editingDisplayName === index ? (
                                <div className="display-name-editor">
                                  <input
                                    type="text"
                                    value={displayNameValue}
                                    onChange={(e) => setDisplayNameValue(e.target.value)}
                                    onBlur={() => {
                                      handleUpdateDisplayName(filename, displayNameValue);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleUpdateDisplayName(filename, displayNameValue);
                                      } else if (e.key === 'Escape') {
                                        setEditingDisplayName(null);
                                        setDisplayNameValue('');
                                      }
                                    }}
                                    placeholder="Enter display name..."
                                    className="display-name-input"
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <div 
                                  className="display-name-display"
                                  onClick={() => {
                                    setEditingDisplayName(index);
                                    setDisplayNameValue(mediaDisplayNames[index] || '');
                                  }}
                                  title="Click to edit display name"
                                >
                                  {mediaDisplayNames[index] || (
                                    <span className="display-name-placeholder">Click to add name</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="media-actions">
                          {!isPrimary && isEditMode && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(filename)}
                              className="set-primary-btn btn-small"
                              title="Set as primary media"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(filename)}
                            className="delete-media-btn btn-small"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {isEditMode && formTab === 'audio-desc' && (
          <div className="audio-desc-tab-content">
            <h2>Record Audio Description</h2>
            <p className="upload-hint">
              Use this tab to record an audio description while viewing the artwork image for reference.
            </p>

            <div className="audio-desc-preview">
              {(() => {
                const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                const primaryIndex = mediaPrimary?.findIndex(p => p === '1' || p === 1);
                const primaryFile = (primaryIndex !== -1 && primaryIndex !== undefined) ? mediaFiles?.[primaryIndex] : null;
                const primaryExt = primaryFile ? primaryFile.split('.').pop().toLowerCase() : '';
                const firstImage = (mediaFiles || []).find(f => imageExts.includes(f.split('.').pop().toLowerCase()));
                const previewFile = (primaryFile && imageExts.includes(primaryExt)) ? primaryFile : firstImage;

                if (!previewFile) {
                  return (
                    <div className="audio-desc-no-preview">
                      No image found for this artwork. Upload an image in Media Files first.
                    </div>
                  );
                }

                return (
                  <img
                    src={getMediaUrl(previewFile)}
                    alt={formData.title || `Artwork ${artworkId}`}
                    className="audio-desc-image"
                  />
                );
              })()}
              <div className="audio-desc-meta">
                <div className="audio-desc-id">#{artworkId}</div>
                <div className="audio-desc-title">{formData.title || 'Untitled'}</div>
              </div>
            </div>

            <div className="audio-recorder-container">
              <AudioRecorder
                onRecordingComplete={handleAudioRecordingComplete}
                onCancel={() => {}}
              />
            </div>
          </div>
        )}

        <div className={`form-actions ${isEditMode ? 'form-actions-floating' : ''}`}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEditMode ? 'Update Artwork' : 'Create Artwork')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>

      {!isEditMode && (
        <div className="media-section">
          <h2>Media Files</h2>
          
          <div className="media-upload">
            <div className="upload-options">
              <label htmlFor="media-upload-new" className="upload-label">
                {uploading ? 'Uploading...' : '📁 Upload Media File'}
              </label>
              <input
                type="file"
                id="media-upload-new"
                onChange={handleMediaUpload}
                disabled={uploading}
                accept="image/*,video/*,audio/*,.txt,.pdf,.webm"
                className="file-input"
              />
              <button
                type="button"
                onClick={() => setShowAudioRecorder(!showAudioRecorder)}
                className="btn btn-audio"
                disabled={uploading}
              >
                🎤 Record Audio Description
              </button>
            </div>
            
            {showAudioRecorder && (
              <div className="audio-recorder-container">
                <AudioRecorder
                  onRecordingComplete={handleAudioRecordingComplete}
                  onCancel={() => setShowAudioRecorder(false)}
                />
              </div>
            )}
            
            <p className="upload-hint">
              Upload images, videos, audio files, or text documents. Record an audio description using the microphone.
              First file will be primary media. {!artworkId && !isEditMode && 'Artwork will be created automatically when you upload media.'}
            </p>
          </div>

          {mediaFiles.length > 0 && (
            <div className="media-grid">
              {mediaFiles.map((filename, index) => {
                const ext = filename.split('.').pop().toLowerCase();
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                const isVideo = ['mp4', 'avi', 'mov', 'webm'].includes(ext);
                const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
                
                // Check if this media is primary (for add mode, first file is primary)
                const isPrimary = isEditMode 
                  ? (mediaPrimary[index] === '1' || mediaPrimary[index] === 1)
                  : index === 0;
                
                return (
                  <div key={index} className="media-item">
                    {isImage && (
                      <img
                        src={getMediaUrl(filename)}
                        alt={filename}
                        className="media-preview"
                        onLoad={(e) => {
                          const img = e.target;
                          setImageDimensions(prev => ({
                            ...prev,
                            [filename]: {
                              width: img.naturalWidth,
                              height: img.naturalHeight
                            }
                          }));
                        }}
                      />
                    )}
                    {isVideo && (
                      <video
                        src={getMediaUrl(filename)}
                        className="media-preview"
                        controls
                      />
                    )}
                    {isAudio && (
                      <div className="media-preview audio-preview">
                        <span>🎵</span>
                        <audio src={getMediaUrl(filename)} controls />
                      </div>
                    )}
                    {!isImage && !isVideo && !isAudio && (
                      <div className="media-preview file-preview">
                        <span>📄</span>
                        <span>{filename}</span>
                      </div>
                    )}
                    <div className="media-info">
                      <span className="media-filename">{filename}</span>
                      {isImage && imageDimensions[filename] && (
                        <span className="media-resolution">
                          {imageDimensions[filename].width} × {imageDimensions[filename].height} px
                        </span>
                      )}
                      {isPrimary && (
                        <span className="primary-badge">Primary</span>
                      )}
                    </div>
                    <div className="media-actions">
                      {!isPrimary && isEditMode && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(filename)}
                          className="set-primary-btn btn-small"
                          title="Set as primary media"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteMedia(filename)}
                        className="delete-media-btn btn-small"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
}

export default ArtworkForm;

