import React, { useState } from 'react';
import axios from 'axios';
import './BulkUpload.css';

function BulkUpload() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [overallProgress, setOverallProgress] = useState({ current: 0, total: 0 });
  const [currentFile, setCurrentFile] = useState(null);
  const [results, setResults] = useState(null);
  const [autoCreate, setAutoCreate] = useState(false);
  const [skipIfMediaExists, setSkipIfMediaExists] = useState(false);

  const parseArtworkId = (filename) => {
    // Extract artwork ID and title from various filename patterns:
    // 001_cross_the_divine.jpg, 078.jpg, 000001.jpg, 000001a.jpg, 001a_alternate.jpg
    // 366 Since You Died, Life Goes On and On (4).jpg
    // 366a Since You Died, Life Goes On And On...JPG
    // 414King.jpg
    
    // Pattern 1: ID with letter suffix, then space (366a Since You Died...)
    let match = filename.match(/^(\d{1,6})([a-z])\s+(.+?)(?:\.[^.]+)?$/i);
    if (match) {
      return {
        id: parseInt(match[1]),
        suffix: match[2].toLowerCase(),
        title: match[3].trim(),
        filename: filename
      };
    }
    
    // Pattern 2: ID at start, followed by space (366 Since You Died...)
    match = filename.match(/^(\d{1,6})\s+(.+?)(?:\.[^.]+)?$/i);
    if (match) {
      return {
        id: parseInt(match[1]),
        suffix: '',
        title: match[2].trim(),
        filename: filename
      };
    }
    
    // Pattern 3: ID with letter suffix, then underscore (001a_title.jpg, 000001a_description.jpg)
    match = filename.match(/^(\d{1,6})([a-z])[_.](.+?)(?:\.[^.]+)?$/i);
    if (match) {
      return {
        id: parseInt(match[1]),
        suffix: match[2].toLowerCase(),
        title: match[3].trim().replace(/[_.]/g, ' '),
        filename: filename
      };
    }
    
    // Pattern 4: ID at start, followed by underscore (001_title.jpg, 000001_description.jpg)
    match = filename.match(/^(\d{1,6})[_.](.+?)(?:\.[^.]+)?$/i);
    if (match) {
      return {
        id: parseInt(match[1]),
        suffix: '',
        title: match[2].trim().replace(/[_.]/g, ' '),
        filename: filename
      };
    }
    
    // Pattern 5: ID directly followed by text (no space/underscore) - 414King.jpg
    // Check if ID is followed by a letter (could be suffix or part of title)
    match = filename.match(/^(\d{1,6})([a-zA-Z].+?)(?:\.[^.]+)?$/);
    if (match) {
      const letter = match[2][0];
      if (letter === letter.toLowerCase()) {
        // Lowercase letter - likely a suffix (like 414a)
        const remaining = match[2].substring(1);
        return {
          id: parseInt(match[1]),
          suffix: letter.toLowerCase(),
          title: remaining.trim() || '',
          filename: filename
        };
      } else {
        // Uppercase letter - likely part of title (like 414King), so no suffix
        return {
          id: parseInt(match[1]),
          suffix: '',
          title: match[2].trim(),
          filename: filename
        };
      }
    }
    
    // Pattern 6: ID at start, followed directly by extension (078.jpg, 000001.jpg)
    match = filename.match(/^(\d{1,6})\.([^.]+)$/i);
    if (match) {
      return {
        id: parseInt(match[1]),
        suffix: '',
        title: '',
        filename: filename
      };
    }
    
    // Pattern 7: Standard 6-digit format with optional letter before extension (000001a.jpg)
    match = filename.match(/^(\d{6})([a-z]?)\.([^.]+)$/i);
    if (match) {
      return {
        id: parseInt(match[1]),
        suffix: match[2] ? match[2].toLowerCase() : '',
        title: '',
        filename: filename
      };
    }
    
    return null;
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const fileGroups = {};
    
    selectedFiles.forEach(file => {
      const parsed = parseArtworkId(file.name);
      if (parsed) {
        const key = parsed.id;
        if (!fileGroups[key]) {
          fileGroups[key] = [];
        }
        fileGroups[key].push({
          ...parsed,
          file: file
        });
      } else {
        // Files that don't match pattern go to "unmatched"
        if (!fileGroups['unmatched']) {
          fileGroups['unmatched'] = [];
        }
        fileGroups['unmatched'].push({
          filename: file.name,
          file: file,
          error: 'Filename does not match pattern (000001.jpg, 000001a.jpg, etc.)'
        });
      }
    });

    setFiles(fileGroups);
    setResults(null);
  };

  const uploadFile = async (artworkId, fileData, isPrimary) => {
    const formData = new FormData();
    formData.append('media', fileData.file);
    formData.append('is_primary', isPrimary ? 'true' : 'false');

    const response = await axios.post(`/api/artworks/${artworkId}/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  };

  const ensureArtworkExists = async (artworkId, fileList) => {
    try {
      // Check if artwork exists
      const response = await axios.get(`/api/artworks/${artworkId}`);
      return { exists: true, artwork: response.data };
    } catch (error) {
      if (error.response?.status === 404) {
        // Artwork doesn't exist
        if (autoCreate) {
          // Create a minimal artwork entry with ID and extracted title
          try {
            // Try to extract title from the first file's filename
            let extractedTitle = '';
            if (fileList && fileList.length > 0) {
              const firstFile = fileList[0];
              if (firstFile.title) {
                extractedTitle = firstFile.title;
              }
            }
            
            // Use extracted title if available, otherwise use ID as title
            const artworkTitle = extractedTitle || `Artwork ${artworkId}`;
            
            console.log(`Creating artwork ${artworkId} automatically with title: "${artworkTitle}"...`);
            const createResponse = await axios.post('/api/artworks', {
              id: artworkId,
              title: artworkTitle,
              year: '',
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
              past_exhibitions: ''
            });
            console.log(`✓ Artwork ${artworkId} created successfully`);
            // Fetch the newly created artwork
            const newArtworkResponse = await axios.get(`/api/artworks/${artworkId}`);
            return { exists: true, artwork: newArtworkResponse.data };
          } catch (createError) {
            console.error(`Failed to create artwork ${artworkId}:`, createError);
            return { exists: false, artwork: null };
          }
        } else {
          // Auto-create is disabled - must be created via CSV first
          console.warn(`Artwork ${artworkId} does not exist. Enable "Auto-create artworks" to create it automatically.`);
          return { exists: false, artwork: null };
        }
      }
      throw error;
    }
  };

  const handleUpload = async () => {
    if (Object.keys(files).length === 0) {
      alert('Please select files first');
      return;
    }

    setUploading(true);
    setProgress({});
    setCurrentFile(null);
    const uploadResults = {
      success: [],
      failed: [],
      skipped: []
    };

    // Calculate total files to process
    let totalFiles = 0;
    for (const [key, fileList] of Object.entries(files)) {
      if (key !== 'unmatched') {
        totalFiles += fileList.length;
      } else {
        totalFiles += fileList.length; // Count skipped files too
      }
    }
    setOverallProgress({ current: 0, total: totalFiles });

    let processedFiles = 0;

    try {
      // Process each artwork group
      for (const [key, fileList] of Object.entries(files)) {
        if (key === 'unmatched') {
          // Handle unmatched files
          for (const fileData of fileList) {
            setCurrentFile({ filename: fileData.filename, artworkId: null, status: 'Skipping (unmatched)' });
            uploadResults.skipped.push({
              filename: fileData.filename,
              reason: fileData.error
            });
            processedFiles++;
            setOverallProgress({ current: processedFiles, total: totalFiles });
          }
          continue;
        }

        const artworkId = parseInt(key);
        setCurrentFile({ filename: null, artworkId, status: 'Checking artwork...' });
        setProgress(prev => ({ ...prev, [artworkId]: { status: 'Checking artwork...', current: 0, total: fileList.length } }));

        // Ensure artwork exists
        const artworkCheck = await ensureArtworkExists(artworkId, fileList);
        if (!artworkCheck.exists) {
          for (const fileData of fileList) {
            setCurrentFile({ filename: fileData.filename, artworkId, status: 'Failed - artwork not found' });
            uploadResults.failed.push({
              artworkId,
              filename: fileData.filename,
              reason: 'Artwork does not exist. Please import artwork via CSV first.'
            });
            processedFiles++;
            setOverallProgress({ current: processedFiles, total: totalFiles });
          }
          setProgress(prev => ({ ...prev, [artworkId]: { status: 'Skipped - artwork not found', current: fileList.length, total: fileList.length } }));
          continue;
        }

        // Check if we should skip because media already exists
        if (skipIfMediaExists && artworkCheck.artwork) {
          const hasMedia = artworkCheck.artwork.media_files && artworkCheck.artwork.media_files.length > 0;
          if (hasMedia) {
            for (const fileData of fileList) {
              setCurrentFile({ filename: fileData.filename, artworkId, status: 'Skipped - media exists' });
              uploadResults.skipped.push({
                artworkId,
                filename: fileData.filename,
                reason: 'Artwork already has media files. Skipping to avoid duplicates.'
              });
              processedFiles++;
              setOverallProgress({ current: processedFiles, total: totalFiles });
            }
            setProgress(prev => ({ ...prev, [artworkId]: { status: 'Skipped - media already exists', current: fileList.length, total: fileList.length } }));
            continue;
          }
        }

        // Sort files: primary first (no suffix), then alphabetical by suffix
        const sortedFiles = [...fileList].sort((a, b) => {
          // Primary files (no suffix) come first
          if (!a.suffix && b.suffix) return -1;
          if (a.suffix && !b.suffix) return 1;
          // If both have suffixes, sort alphabetically
          if (a.suffix && b.suffix) {
            return a.suffix.localeCompare(b.suffix);
          }
          // If neither has suffix, maintain original order
          return 0;
        });

        // Upload files
        for (let i = 0; i < sortedFiles.length; i++) {
          const fileData = sortedFiles[i];
          const isPrimary = i === 0 && !fileData.suffix;
          
          setCurrentFile({ 
            filename: fileData.filename, 
            artworkId, 
            status: `Uploading... (${i + 1}/${sortedFiles.length})`,
            isPrimary 
          });
          setProgress(prev => ({ 
            ...prev, 
            [artworkId]: { 
              status: `Uploading ${fileData.filename}...`, 
              current: i + 1, 
              total: sortedFiles.length 
            } 
          }));

          try {
            await uploadFile(artworkId, fileData, isPrimary);
            uploadResults.success.push({
              artworkId,
              filename: fileData.filename
            });
            setCurrentFile(prev => prev ? { ...prev, status: '✓ Uploaded' } : null);
          } catch (error) {
            uploadResults.failed.push({
              artworkId,
              filename: fileData.filename,
              reason: error.response?.data?.error || 'Upload failed'
            });
            setCurrentFile(prev => prev ? { ...prev, status: '✗ Failed' } : null);
          }
          
          processedFiles++;
          setOverallProgress({ current: processedFiles, total: totalFiles });
        }

        setProgress(prev => ({ ...prev, [artworkId]: { status: '✓ Complete', current: sortedFiles.length, total: sortedFiles.length } }));
      }

      setResults(uploadResults);
      setCurrentFile(null);
      setOverallProgress({ current: totalFiles, total: totalFiles });
      // Don't clear files automatically - let user see results
      // setFiles({});
      alert(`Upload complete! ${uploadResults.success.length} files uploaded, ${uploadResults.failed.length} failed, ${uploadResults.skipped.length} skipped.`);
    } catch (error) {
      console.error('Bulk upload error:', error);
      setCurrentFile(null);
      alert('Bulk upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
      // Keep progress visible after completion
    }
  };

  const getFileCount = () => {
    return Object.values(files).reduce((total, fileList) => total + fileList.length, 0);
  };

  const getArtworkCount = () => {
    return Object.keys(files).filter(key => key !== 'unmatched').length;
  };

  return (
    <div className="bulk-upload">
      <h1>Bulk Media Upload</h1>
      
      <div className="bulk-upload-options">
        <label className="auto-create-option">
          <input
            type="checkbox"
            checked={autoCreate}
            onChange={(e) => setAutoCreate(e.target.checked)}
            disabled={uploading}
          />
          <span>Auto-create artworks</span>
        </label>
        <p className="option-description">
          {autoCreate 
            ? '✓ Artworks will be automatically created if they don\'t exist (with minimal data).'
            : 'Artworks must exist in the database first. Enable this option to create them automatically.'}
        </p>
        
        <label className="auto-create-option" style={{ marginTop: '1rem' }}>
          <input
            type="checkbox"
            checked={skipIfMediaExists}
            onChange={(e) => setSkipIfMediaExists(e.target.checked)}
            disabled={uploading}
          />
          <span>Skip if media exists</span>
        </label>
        <p className="option-description">
          {skipIfMediaExists
            ? '✓ Enabled: Only upload media if artwork has no existing media files. Prevents duplicates when re-running bulk uploads.'
            : 'Disabled: Will upload media even if artwork already has media files (may create duplicates).'}
        </p>
      </div>
      
      <div className="bulk-upload-info">
        <p>
          Upload multiple media files at once. Files will be automatically organized by artwork ID.
        </p>
        <div className="info-note">
          <p><strong>File naming convention:</strong> Files can be named in various formats:</p>
          <ul>
            <li><code>001_cross_the_divine.jpg</code> - Artwork #1 (primary)</li>
            <li><code>078.jpg</code> - Artwork #78 (primary)</li>
            <li><code>000001.jpg</code> - Artwork #1 (primary)</li>
            <li><code>001a_alternate_view.jpg</code> - Artwork #1, additional media</li>
            <li><code>000001a.jpg</code> - Artwork #1, additional media</li>
          </ul>
          <p>
            The artwork ID is extracted from the beginning of the filename (1-6 digits). 
            Files with a letter suffix (a-z) after the ID are treated as additional media.
          </p>
        </div>
      </div>

      <div className="bulk-upload-controls">
        <div className="file-select-section">
          <label htmlFor="bulk-file-input" className="bulk-upload-label">
            📁 Select Media Files
          </label>
          <input
            type="file"
            id="bulk-file-input"
            multiple
            onChange={handleFileSelect}
            disabled={uploading}
            accept="image/*,video/*,audio/*,.txt,.pdf,.webm"
            className="file-input"
          />
          {getFileCount() > 0 && (
            <div className="file-summary">
              <p><strong>{getFileCount()}</strong> files selected</p>
              <p><strong>{getArtworkCount()}</strong> unique artwork IDs</p>
              {files.unmatched && files.unmatched.length > 0 && (
                <p className="warning">
                  ⚠️ {files.unmatched.length} file(s) don't match naming pattern
                </p>
              )}
            </div>
          )}
        </div>


        {Object.keys(files).length > 0 && (
          <div className="file-preview">
            <h3>Files to Upload:</h3>
            {Object.entries(files).map(([key, fileList]) => {
              if (key === 'unmatched') {
                return (
                  <div key={key} className="file-group unmatched">
                    <h4>Unmatched Files (will be skipped):</h4>
                    <ul>
                      {fileList.map((fileData, idx) => (
                        <li key={idx} className="error-text">
                          {fileData.filename} - {fileData.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              
              const artworkId = parseInt(key);
              return (
                <div key={key} className="file-group">
                  <h4>Artwork #{artworkId} ({fileList.length} files)</h4>
                  <ul>
                    {fileList
                      .sort((a, b) => {
                        // Primary files (no suffix) come first
                        if (!a.suffix && b.suffix) return -1;
                        if (a.suffix && !b.suffix) return 1;
                        // If both have suffixes, sort alphabetically
                        if (a.suffix && b.suffix) {
                          return a.suffix.localeCompare(b.suffix);
                        }
                        return 0;
                      })
                      .map((fileData, idx) => {
                        // Determine if this is primary (first file without suffix)
                        const isPrimary = idx === 0 && !fileData.suffix;
                        return (
                          <li key={idx}>
                            {fileData.filename}
                            {isPrimary && (
                              <span className="primary-badge">Primary</span>
                            )}
                            {fileData.suffix && (
                              <span className="suffix-badge">{fileData.suffix}</span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                  {progress[artworkId] && (
                    <div className="progress-container">
                      <div className="progress-status">
                        {typeof progress[artworkId] === 'string' 
                          ? progress[artworkId] 
                          : progress[artworkId].status}
                      </div>
                      {typeof progress[artworkId] === 'object' && (
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar" 
                            style={{ 
                              width: `${(progress[artworkId].current / progress[artworkId].total) * 100}%` 
                            }}
                          />
                          <span className="progress-text">
                            {progress[artworkId].current} / {progress[artworkId].total} files
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {uploading && (
          <div className="upload-progress-section">
            <div className="overall-progress">
              <div className="overall-progress-header">
                <h4>Overall Progress</h4>
                <span className="progress-percentage">
                  {overallProgress.total > 0 
                    ? Math.round((overallProgress.current / overallProgress.total) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar overall-progress-bar" 
                  style={{ 
                    width: `${overallProgress.total > 0 ? (overallProgress.current / overallProgress.total) * 100 : 0}%` 
                  }}
                />
              </div>
              <div className="progress-counts">
                {overallProgress.current} of {overallProgress.total} files processed
              </div>
            </div>
            {currentFile && (
              <div className="current-file-status">
                <strong>Current:</strong>
                {currentFile.artworkId && <span> Artwork #{currentFile.artworkId}</span>}
                {currentFile.filename && <span> - {currentFile.filename}</span>}
                {currentFile.isPrimary && <span className="primary-badge">Primary</span>}
                <div className="current-status">{currentFile.status}</div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || Object.keys(files).length === 0}
          className="btn btn-primary bulk-upload-btn"
        >
          {uploading ? 'Uploading...' : 'Upload All Files'}
        </button>
      </div>

      {results && (
        <div className="upload-results">
          <div className="results-header">
            <h3>Upload Results</h3>
            <button
              onClick={() => {
                setResults(null);
                setFiles({});
                setProgress({});
                setOverallProgress({ current: 0, total: 0 });
                setCurrentFile(null);
              }}
              className="btn btn-secondary clear-results-btn"
            >
              Clear & Start New Upload
            </button>
          </div>
          <div className="results-summary">
            <div className="result-item success">
              <strong>✓ Success:</strong> {results.success.length} files
            </div>
            <div className="result-item failed">
              <strong>✗ Failed:</strong> {results.failed.length} files
            </div>
            <div className="result-item skipped">
              <strong>⊘ Skipped:</strong> {results.skipped.length} files
            </div>
          </div>
          
          {results.failed.length > 0 && (
            <div className="failed-list">
              <h4>Failed Uploads:</h4>
              <ul>
                {results.failed.map((item, idx) => (
                  <li key={idx}>
                    Artwork #{item.artworkId} - {item.filename}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BulkUpload;

