import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './CSVUpload.css';

function CSVUpload() {
  const [csvFile, setCsvFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [dbBackups, setDbBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupActionBusy, setBackupActionBusy] = useState(false);
  const [lastPreImportBackup, setLastPreImportBackup] = useState(null);
  const [existingArtworkIds, setExistingArtworkIds] = useState(null); // Set<number> | null
  const [loadingExistingIds, setLoadingExistingIds] = useState(false);
  const [rowStatuses, setRowStatuses] = useState({}); // rowNumber -> { status, label, detail }

  const fetchDbBackups = async () => {
    setLoadingBackups(true);
    try {
      const response = await axios.get('/api/admin/db-backups');
      setDbBackups(response.data?.backups || []);
    } catch (error) {
      console.error('Error fetching DB backups:', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchDbBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (!n) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    const val = n / Math.pow(1024, idx);
    return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const createDbBackup = async (label) => {
    const response = await axios.post('/api/admin/db-backups', { label });
    const backup = response.data?.backup;
    if (backup) {
      setLastPreImportBackup(backup);
      await fetchDbBackups();
    }
    return backup;
  };

  const handleRestoreBackup = async (filename) => {
    const confirm1 = window.confirm(
      `Restore database from backup?\n\n${filename}\n\nThis will REPLACE current database contents.\n\nContinue?`
    );
    if (!confirm1) return;
    const typed = window.prompt(`Type RESTORE to confirm restoring from:\n${filename}`);
    if (typed !== 'RESTORE') return;

    setBackupActionBusy(true);
    try {
      const resp = await axios.post('/api/admin/db-backups/restore', { filename });
      alert(
        `${resp.data?.message || 'Database restored.'}\n\nSafety backup created: ${resp.data?.safetyBackupCreated || 'unknown'}\n\nReloading the page now.`
      );
      window.location.reload();
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('Restore failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setBackupActionBusy(false);
    }
  };

  const parseCSVLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote (double quote inside quoted field)
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          // Don't add the quote character itself to current
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator (only when not in quotes)
        values.push(current);
        current = '';
      } else {
        // Regular character
        current += char;
      }
    }
    
    // Add last value (even if line doesn't end with comma)
    values.push(current);
    
    return values;
  };

  const parseCSV = (text) => {
    try {
      // Remove BOM if present
      let cleanText = text;
      if (text.charCodeAt(0) === 0xFEFF) {
        cleanText = text.slice(1);
      }
      
      // Handle different line endings
      const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const allLines = normalizedText.split('\n');
      const lines = allLines.filter(line => line.trim());
      
      console.log('Total lines in file:', allLines.length);
      console.log('Non-empty lines:', lines.length);
      
      if (lines.length === 0) {
        return { headers: [], rows: [], error: 'CSV file is empty' };
      }

      // Parse header using the same CSV parsing logic
      const headerLine = lines[0];
      console.log('Raw header line:', JSON.stringify(headerLine));
      console.log('Header line length:', headerLine.length);
      console.log('Header line first 100 chars:', headerLine.substring(0, 100));
      
      const headerValues = parseCSVLine(headerLine);
      console.log('Header values after parseCSVLine:', headerValues);
      console.log('Number of header values:', headerValues.length);
      console.log('Header values details:', headerValues.map((v, i) => `[${i}]: "${v}" (length: ${v.length})`));
      
      const headers = headerValues.map((h, index) => {
        let cleaned = h.trim();
        // Remove surrounding quotes if present
        if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 1) {
          cleaned = cleaned.slice(1, -1).trim();
        }
        // If header is empty, use a default name
        if (!cleaned && index < 12) {
          const defaultNames = ['ID', 'Year', 'Title', 'Dimensions', 'Medium', 'Value', 'For Sale Y/N', 'For Sale Price', 'Owner', 'Address', 'Phone #', 'More info'];
          cleaned = defaultNames[index] || `Column_${index + 1}`;
        }
        return cleaned;
      });
      
      // Check if we have any non-empty headers
      const nonEmptyHeaders = headers.filter(h => h && h.trim() !== '');
      console.log('Non-empty headers:', nonEmptyHeaders);
      console.log('Non-empty headers count:', nonEmptyHeaders.length);
      
      if (nonEmptyHeaders.length === 0) {
        return { 
          headers: [], 
          rows: [], 
          error: `No valid headers found. Parsed ${headerValues.length} values: ${JSON.stringify(headerValues)}` 
        };
      }
      
      console.log('Final headers:', headers);
      console.log('Number of headers:', headers.length);
      
      // Parse rows
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const values = parseCSVLine(line);
        console.log(`Row ${i} raw values (${values.length}):`, values);
        
        // Map values to headers
        const row = {};
        headers.forEach((header, index) => {
          // Use header as key, even if empty (for trailing commas)
          const headerKey = header || `Column_${index + 1}`;
          let value = values[index] !== undefined ? values[index] : '';
          value = value.trim();
          // Remove surrounding quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          row[headerKey] = value;
        });
        
        rows.push(row);
      }
      
      console.log('First parsed row:', rows[0]);
      return { headers, rows, error: null };
    } catch (error) {
      console.error('CSV parsing error:', error);
      return { headers: [], rows: [], error: error.message };
    }
  };

  const mapCSVToArtwork = (csvRow) => {
    // Map CSV columns to artwork fields
    // Year field uses fuzzy logic - accepts: single year (1982), range (1977-1983), 
    // decade (90s), uncertain (1982?), or Unknown
    let yearValue = csvRow.Year || '';
    // Keep year as text to support fuzzy formats - don't parse as integer
    if (yearValue) {
      yearValue = yearValue.trim();
    }
    
    // Parse ID more carefully - handle various formats and whitespace
    let artworkId = null;
    const idValue = csvRow.ID || csvRow.id || csvRow['ID'] || csvRow['id'];
    if (idValue !== undefined && idValue !== null && idValue !== '') {
      const cleanedId = String(idValue).trim().replace(/[^0-9]/g, '');
      if (cleanedId) {
        const parsedId = parseInt(cleanedId, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
          artworkId = parsedId;
        }
      }
    }
    
    console.log('Mapping CSV row:', {
      rawID: idValue,
      rawIDType: typeof idValue,
      cleanedID: idValue ? String(idValue).trim().replace(/[^0-9]/g, '') : null,
      parsedID: artworkId,
      parsedIDType: typeof artworkId,
      title: csvRow.Title,
      year: yearValue
    });
    
    return {
      id: artworkId,
      year: yearValue, // Text field supporting fuzzy formats
      title: (csvRow.Title || '').trim(),
      dimensions: (csvRow.Dimensions || '').trim(),
      medium: (csvRow.Medium || '').trim(),
      value: (csvRow.Value || '').trim(),
      availability: (csvRow['For Sale Y/N'] || csvRow['For Sale Y/N'] || '').trim(),
      for_sale_price: (csvRow['For Sale Price'] || '').trim(),
      owner_name: (csvRow.Owner || '').trim(),
      owner_address: (csvRow.Address || '').trim(),
      owner_phone: (csvRow['Phone #'] || csvRow['Phone #'] || '').trim(),
      more_info: (csvRow['More info'] || '').trim(),
      description: '',
      storage_location: '',
      past_exhibitions: ''
    };
  };

  const parseArtworkIdFromCsvRow = (csvRow) => {
    const idValue = csvRow.ID || csvRow.id || csvRow['ID'] || csvRow['id'];
    if (idValue === undefined || idValue === null || idValue === '') return null;
    const cleanedId = String(idValue).trim().replace(/[^0-9]/g, '');
    if (!cleanedId) return null;
    const parsedId = parseInt(cleanedId, 10);
    if (isNaN(parsedId) || parsedId <= 0) return null;
    return parsedId;
  };

  const fetchExistingIds = async () => {
    setLoadingExistingIds(true);
    try {
      const res = await axios.get('/api/artworks');
      const ids = new Set((res.data || []).map((a) => Number(a.id)).filter((n) => Number.isFinite(n)));
      setExistingArtworkIds(ids);
      return ids;
    } catch (err) {
      console.error('Error fetching existing artwork IDs:', err);
      setExistingArtworkIds(null);
      return null;
    } finally {
      setLoadingExistingIds(false);
    }
  };

  const computedRowStatuses = useMemo(() => {
    if (!preview?.rows?.length) return {};
    const ids = existingArtworkIds;
    const out = {};
    for (let i = 0; i < preview.rows.length; i++) {
      const rowNumber = i + 2; // header is row 1
      const csvRow = preview.rows[i];
      const idNum = parseArtworkIdFromCsvRow(csvRow);

      if (!idNum) {
        out[rowNumber] = { status: 'skipped', label: 'Skipped', detail: 'Missing/invalid ID' };
        continue;
      }

      if (!ids) {
        out[rowNumber] = { status: 'pending', label: 'Planned', detail: 'Will decide at import time' };
        continue;
      }

      const exists = ids.has(idNum);
      if (exists) {
        out[rowNumber] = overwriteExisting
          ? { status: 'planned-update', label: 'Will update', detail: 'ID exists (overwrite ON)' }
          : { status: 'planned-skip', label: 'Will skip', detail: 'ID exists (overwrite OFF)' };
      } else {
        out[rowNumber] = { status: 'planned-create', label: 'Will create', detail: 'New ID' };
      }
    }
    return out;
  }, [preview, existingArtworkIds, overwriteExisting]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    setResults(null);
    setRowStatuses({});
    setExistingArtworkIds(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        console.log('File read successfully, length:', text.length);
        console.log('First 200 characters:', text.substring(0, 200));
        const parsed = parseCSV(text);
        if (parsed.error) {
          console.error('CSV parsing error:', parsed.error);
          alert('Error parsing CSV: ' + parsed.error + '\n\nCheck the browser console (F12) for more details.');
          setPreview(null);
        } else {
          console.log('CSV parsed successfully');
          setPreview(parsed);
          // Prefetch existing IDs so the preview can show what will be skipped/created.
          fetchExistingIds();
        }
      } catch (error) {
        console.error('File reading error:', error);
        alert('Error reading file: ' + error.message);
        setPreview(null);
      }
    };
    reader.onerror = () => {
      alert('Error reading file');
      setPreview(null);
    };
    // Read as UTF-8 text
    reader.readAsText(file, 'UTF-8');
  };

  const handleUpload = async () => {
    if (!csvFile || !preview || preview.rows.length === 0) {
      alert('Please select a CSV file first');
      return;
    }

    // Always create a DB backup right before importing, so we can restore if something goes wrong.
    try {
      await createDbBackup('pre-csv-import');
    } catch (error) {
      console.error('Pre-import DB backup failed:', error);
      const ok = window.confirm(
        'Could not create a database backup before import.\n\nContinuing may be risky.\n\nContinue anyway?'
      );
      if (!ok) return;
    }

    if (overwriteExisting) {
      const ok = window.confirm(
        'Overwrite mode is ON.\n\nExisting artworks with matching IDs will be UPDATED/OVERWRITTEN.\n\nContinue?'
      );
      if (!ok) return;
    }

    setUploading(true);
    // Seed the per-row status table from the latest preview calculation.
    setRowStatuses((prev) => ({ ...computedRowStatuses, ...prev }));
    let localRowStatuses = { ...computedRowStatuses };

    // Refresh existing IDs right before importing so decisions are accurate.
    const idsAtImport = (await fetchExistingIds()) || existingArtworkIds;

    const uploadResults = {
      success: [],
      failed: [],
      skipped: []
    };

    try {
      for (let i = 0; i < preview.rows.length; i++) {
        const csvRow = preview.rows[i];
        const rowNumber = i + 2;
        console.log(`Processing row ${i + 2}:`, csvRow);
        const artwork = mapCSVToArtwork(csvRow);
        console.log(`Mapped artwork for row ${i + 2}:`, artwork);

        // Skip if no ID
        if (!artwork.id || isNaN(artwork.id)) {
          console.warn(`Row ${i + 2} skipped - invalid ID:`, csvRow.ID, '->', artwork.id);
          uploadResults.skipped.push({
            row: i + 2, // +2 because row 1 is header, and we're 0-indexed
            reason: `Missing or invalid ID (found: "${csvRow.ID || 'empty'}")`
          });
          localRowStatuses[rowNumber] = { status: 'skipped', label: 'Skipped', detail: 'Missing/invalid ID' };
          continue;
        }

        try {
          // Check if artwork exists
          let artworkExists = false;
          try {
            if (idsAtImport && idsAtImport instanceof Set) {
              artworkExists = idsAtImport.has(Number(artwork.id));
            } else {
              await axios.get(`/api/artworks/${artwork.id}`);
              artworkExists = true;
            }
          } catch (error) {
            if (error.response?.status !== 404) {
              throw error;
            }
          }

          if (artworkExists) {
            if (!overwriteExisting) {
              uploadResults.skipped.push({
                row: i + 2,
                reason: `Artwork ID ${artwork.id} already exists (skipped; overwrite is OFF)`
              });
              localRowStatuses[rowNumber] = { status: 'skipped', label: 'Skipped', detail: 'ID exists (overwrite OFF)' };
              continue;
            }

            // Update existing artwork (explicit overwrite mode)
            console.log(`Updating artwork ID ${artwork.id}`);
            const response = await axios.put(`/api/artworks/${artwork.id}`, artwork);
            console.log(`Updated artwork ID ${artwork.id}, response:`, response.data);
            uploadResults.success.push({
              id: artwork.id,
              action: 'updated',
              title: artwork.title
            });
            localRowStatuses[rowNumber] = { status: 'updated', label: 'Updated', detail: 'Overwrite applied' };
          } else {
            // Create new artwork with explicit ID
            console.log('========================================');
            console.log('CLIENT: Creating artwork with ID', artwork.id);
            console.log('Artwork object:', artwork);
            console.log('Artwork.id:', artwork.id, 'type:', typeof artwork.id);
            console.log('Has id property:', 'id' in artwork);
            console.log('========================================');
            
            // CRITICAL: Ensure ID is sent as a NUMBER, explicitly
            const payload = {
              ...artwork,
              id: Number(artwork.id) // Force to number
            };
            
            console.log('Payload being sent:', JSON.stringify(payload, null, 2));
            console.log('Payload.id:', payload.id, 'type:', typeof payload.id);
            console.log('========================================');
            
            const response = await axios.post('/api/artworks', payload);
            console.log(`Response received - ID:`, response.data.id, 'expected:', artwork.id);
            console.log('Response full:', response.data);
            
            if (response.data.id !== artwork.id) {
              console.error('========================================');
              console.error('ID MISMATCH ERROR!');
              console.error('Expected:', artwork.id);
              console.error('Got:', response.data.id);
              console.error('Request payload:', payload);
              console.error('Response:', response.data);
              console.error('========================================');
              alert(`Warning: Artwork ID mismatch! Expected ${artwork.id}, got ${response.data.id}. Check server logs.`);
            }
            uploadResults.success.push({
              id: response.data.id,
              action: 'created',
              title: artwork.title
            });
            localRowStatuses[rowNumber] = { status: 'created', label: 'Created', detail: 'New artwork added' };
          }
        } catch (error) {
          uploadResults.failed.push({
            id: artwork.id,
            row: i + 2,
            reason: error.response?.data?.error || 'Failed to save artwork',
            title: artwork.title
          });
          localRowStatuses[rowNumber] = { status: 'failed', label: 'Failed', detail: error.response?.data?.error || error.message };
        }

        // Throttle UI updates to keep scrolling responsive
        if ((i + 1) % 20 === 0) {
          // eslint-disable-next-line no-loop-func
          setRowStatuses((prev) => ({ ...prev, ...localRowStatuses }));
        }
      }

      setRowStatuses((prev) => ({ ...prev, ...localRowStatuses }));
      setResults(uploadResults);
      await fetchExistingIds();
      alert(`Import complete! ${uploadResults.success.length} artworks processed, ${uploadResults.failed.length} failed, ${uploadResults.skipped.length} skipped.`);
    } catch (error) {
      console.error('CSV import error:', error);
      alert('CSV import failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="csv-upload">
      <h1>CSV Import</h1>
      
      <div className="csv-upload-info">
        <p>
          Import artworks from a CSV file. The CSV should have the following columns:
        </p>
        <div className="csv-format">
          <code>
            ID,Year,Title,Dimensions,Medium,Value,For Sale Y/N,For Sale Price,Owner,Address,Phone #,More info
          </code>
        </div>
        <p className="info-note">
          <strong>Default behavior:</strong> existing artworks are <strong>NOT</strong> modified. Rows whose IDs already exist will be skipped unless you enable overwrite mode.
        </p>
      </div>

      <div className="csv-upload-controls">
        <div className="db-backups">
          <div className="db-backups-header">
            <h3>Database Backups</h3>
            <div className="db-backups-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchDbBackups}
                disabled={loadingBackups || uploading || backupActionBusy}
              >
                {loadingBackups ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  setBackupActionBusy(true);
                  try {
                    await createDbBackup('manual');
                    alert('Backup created.');
                  } catch (error) {
                    console.error('Manual backup failed:', error);
                    alert('Backup failed: ' + (error.response?.data?.error || error.message));
                  } finally {
                    setBackupActionBusy(false);
                  }
                }}
                disabled={uploading || backupActionBusy}
              >
                Create Backup Now
              </button>
            </div>
          </div>

          {lastPreImportBackup && (
            <div className="db-backups-last">
              <strong>Last pre-import backup:</strong> {lastPreImportBackup.filename} ({formatBytes(lastPreImportBackup.sizeBytes)})
            </div>
          )}

          {dbBackups.length === 0 ? (
            <div className="db-backups-empty">
              {loadingBackups ? 'Loading backups…' : 'No backups found yet.'}
            </div>
          ) : (
            <div className="db-backups-list">
              {dbBackups.slice(0, 15).map((b) => (
                <div key={b.filename} className="db-backup-item">
                  <div className="db-backup-meta">
                    <div className="db-backup-filename">{b.filename}</div>
                    <div className="db-backup-sub">
                      {new Date(b.modifiedAt).toLocaleString()} • {formatBytes(b.sizeBytes)}
                    </div>
                  </div>
                  <div className="db-backup-buttons">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleRestoreBackup(b.filename)}
                      disabled={uploading || backupActionBusy}
                      title="Restore database from this backup"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
              {dbBackups.length > 15 && (
                <div className="db-backups-note">
                  Showing newest 15 backups.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="file-select-section">
          <label htmlFor="csv-file-input" className="csv-upload-label">
            📄 Select CSV File
          </label>
          <input
            type="file"
            id="csv-file-input"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={uploading}
            className="file-input"
          />
          {csvFile && (
            <div className="file-info">
              <p><strong>File:</strong> {csvFile.name}</p>
              {preview && (
                <p><strong>{preview.rows.length}</strong> artworks found</p>
              )}
            </div>
          )}
        </div>

        <label className="csv-overwrite-toggle">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
            disabled={uploading}
          />
          Overwrite existing artworks (update matching IDs)
        </label>

        {preview && (
          <div className="csv-preview">
            {preview.error ? (
              <div className="preview-error">
                <p className="error-text">Error: {preview.error}</p>
              </div>
            ) : preview.rows.length > 0 ? (
              <>
                <h3>
                  Preview ({preview.rows.length} rows)
                  {loadingExistingIds && <span className="preview-subtle"> — checking which rows will be skipped…</span>}
                </h3>
                <div className="preview-table-container">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Import</th>
                        {preview.headers.map((header, idx) => (
                          <th key={idx}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {(() => {
                            const rowNumber = rowIdx + 2;
                            const status = rowStatuses[rowNumber] || computedRowStatuses[rowNumber] || { status: 'pending', label: 'Planned', detail: '' };
                            return (
                              <td>
                                <span className={`row-status row-status-${status.status}`} title={status.detail || ''}>
                                  {status.label}
                                </span>
                              </td>
                            );
                          })()}
                          {preview.headers.map((header, colIdx) => {
                            const headerKey = header || `Column_${colIdx + 1}`;
                            const value = row[headerKey] || row[header] || '';
                            return (
                              <td key={colIdx} title={value}>
                                {value || <span className="empty-cell">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="preview-note">Scroll to review all rows.</p>
              </>
            ) : (
              <div className="preview-error">
                <p className="error-text">No data rows found in CSV file</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !csvFile || !preview || preview.rows.length === 0}
          className="btn btn-primary csv-upload-btn"
        >
          {uploading ? 'Importing...' : 'Import CSV'}
        </button>
      </div>

      {results && (
        <div className="import-results">
          <h3>Import Results</h3>
          <div className="results-summary">
            <div className="result-item success">
              <strong>✓ Success:</strong> {results.success.length} artworks
            </div>
            <div className="result-item failed">
              <strong>✗ Failed:</strong> {results.failed.length} artworks
            </div>
            <div className="result-item skipped">
              <strong>⊘ Skipped:</strong> {results.skipped.length} rows
            </div>
          </div>
          
          {results.failed.length > 0 && (
            <div className="failed-list">
              <h4>Failed Imports:</h4>
              <ul>
                {results.failed.map((item, idx) => (
                  <li key={idx}>
                    Row {item.row} - ID {item.id} ({item.title || 'No title'}): {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.skipped.length > 0 && (
            <div className="skipped-list">
              <h4>Skipped Rows:</h4>
              <ul>
                {results.skipped.map((item, idx) => (
                  <li key={idx}>
                    Row {item.row}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.success.length > 0 && results.success.length <= 20 && (
            <div className="success-list">
              <h4>Successfully Imported:</h4>
              <ul>
                {results.success.map((item, idx) => (
                  <li key={idx}>
                    ID {item.id} - {item.title || 'No title'} ({item.action})
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

export default CSVUpload;

