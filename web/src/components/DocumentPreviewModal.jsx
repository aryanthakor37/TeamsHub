import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Archive,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Loader2,
  X
} from 'lucide-react';
import { fetchFileBlob, fetchFileArrayBuffer } from '../services/fileService';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { renderAsync } from 'docx-preview';

// Helper to determine category & colors
export const getFileCategoryMeta = (fileName = '', category = '') => {
  const lower = fileName.toLowerCase();
  if (category === 'Images' || lower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/)) {
    return { category: 'Images', icon: ImageIcon, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', label: 'IMAGE' };
  }
  if (category === 'PDF' || lower.endsWith('.pdf')) {
    return { category: 'PDF', icon: FileText, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'PDF' };
  }
  if (category === 'Excel' || lower.match(/\.(xlsx|xls|csv)$/)) {
    return { category: 'Excel', icon: FileSpreadsheet, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'EXCEL' };
  }
  if (category === 'Videos' || lower.match(/\.(mp4|mov|avi|mkv|webm)$/)) {
    return { category: 'Videos', icon: Video, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', label: 'VIDEO' };
  }
  if (lower.match(/\.(docx|doc)$/)) {
    return { category: 'Word', icon: FileText, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'WORD' };
  }
  if (category === 'ZIP' || lower.match(/\.(zip|rar|7z|tar|gz)$/)) {
    return { category: 'ZIP', icon: Archive, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'ZIP' };
  }
  return { category: 'Documents', icon: FileText, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'DOC' };
};

// In-App Excel Spreadsheet Viewer
export function ExcelSpreadsheetViewer({ arrayBuffer, fileName }) {
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [sheetData, setSheetData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [parseError, setParseError] = useState(null);

  useEffect(() => {
    try {
      if (!arrayBuffer) return;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      if (workbook.SheetNames && workbook.SheetNames.length > 0) {
        setSheetNames(workbook.SheetNames);
        setActiveSheet(workbook.SheetNames[0]);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        setSheetData(json);
      }
    } catch (err) {
      console.warn('[ExcelViewer] Parse error:', err);
      setParseError(err.message || 'Failed to parse Excel file');
    }
  }, [arrayBuffer]);

  const handleSheetChange = (name) => {
    try {
      setActiveSheet(name);
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      setSheetData(json);
    } catch (err) {
      console.warn('[ExcelViewer] Sheet switch error:', err);
    }
  };

  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) return sheetData;
    const term = searchTerm.toLowerCase();
    return sheetData.filter((row, idx) => {
      if (idx === 0) return true; // keep header row
      return row.some(cell => String(cell).toLowerCase().includes(term));
    });
  }, [sheetData, searchTerm]);

  if (parseError) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', color: 'var(--text-muted)' }}>
        <FileSpreadsheet size={54} color="#10b981" style={{ marginBottom: '16px', opacity: 0.8 }} />
        <p style={{ fontWeight: '600', marginBottom: '8px' }}>Unable to parse spreadsheet contents</p>
        <p style={{ fontSize: '0.85rem' }}>{parseError}</p>
      </div>
    );
  }

  const headers = filteredData.length > 0 ? filteredData[0] : [];
  const rows = filteredData.slice(1);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', gap: '16px', flexWrap: 'wrap' }}>
        {/* Sheet Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', maxWidth: '60%' }}>
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => handleSheetChange(name)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: activeSheet === name ? '1px solid #10b981' : '1px solid var(--border-color)',
                backgroundColor: activeSheet === name ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: activeSheet === name ? '#10b981' : 'var(--text-secondary)',
                fontWeight: activeSheet === name ? '700' : '500',
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              📊 {name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search spreadsheet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
              width: '180px'
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {rows.length} rows
          </span>
        </div>
      </div>

      {/* Spreadsheet Table Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {sheetData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            This sheet is empty.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '8px 12px', border: '1px solid var(--border-color)', width: '45px', color: 'var(--text-muted)', textAlign: 'center' }}>#</th>
                {headers.map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: '700', textAlign: 'left', minWidth: '110px' }}>
                    {String(h || `Column ${i + 1}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '6px 10px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                    {rIdx + 1}
                  </td>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} style={{ padding: '6px 10px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {String(row[cIdx] !== undefined ? row[cIdx] : '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// In-App Word Document (.docx) Viewer
export function WordDocumentViewer({ arrayBuffer, fileName, webUrl }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    const renderDocx = async () => {
      if (!arrayBuffer || !containerRef.current) return;
      try {
        setLoading(true);
        setError(false);
        containerRef.current.innerHTML = '';

        await renderAsync(arrayBuffer, containerRef.current, null, {
          className: 'docx-rendered-page',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true
        });

        if (active) setLoading(false);
      } catch (err) {
        console.warn('[WordViewer] docx-preview failed, trying mammoth fallback:', err);
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (active && containerRef.current) {
            containerRef.current.innerHTML = `
              <div class="paper-3d-sheet">
                ${result.value || '<p style="color:#64748b; font-style:italic;">[Blank Word Document]</p>'}
              </div>
            `;
            setLoading(false);
          }
        } catch (mammothErr) {
          console.warn('[WordViewer] Mammoth also failed:', mammothErr);
          if (active) {
            setError(true);
            setLoading(false);
          }
        }
      }
    };

    renderDocx();

    return () => {
      active = false;
    };
  }, [arrayBuffer]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#e2e8f0', position: 'relative', overflow: 'hidden' }}>
      {/* Top Document Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={20} color="#3b82f6" />
          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{fileName}</span>
          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: '600' }}>
            Word Document
          </span>
        </div>
        {webUrl && webUrl !== '#' && (
          <a
            href={webUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--accent-primary)',
              fontSize: '0.82rem',
              fontWeight: '600',
              textDecoration: 'none'
            }}
          >
            <ExternalLink size={14} />
            <span>Open in Word Online</span>
          </a>
        )}
      </div>

      {/* Document Content Scroll Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px', color: 'var(--text-muted)' }}>
            <Loader2 size={42} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.92rem', fontWeight: '500' }}>Rendering Word document...</span>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={64} color="#3b82f6" style={{ marginBottom: '18px', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>{fileName}</h3>
            <p style={{ maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
              This Word document can be opened in Microsoft 365 or downloaded directly.
            </p>
            {webUrl && webUrl !== '#' && (
              <a
                href={webUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'var(--accent-primary)',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                <ExternalLink size={18} />
                <span>Open in Microsoft Word</span>
              </a>
            )}
          </div>
        )}

        <div 
          ref={containerRef} 
          style={{ width: '100%', display: loading || error ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center' }} 
        />
      </div>
    </div>
  );
}

// Fullscreen Interactive Document Preview Modal for Chats and Files
export default function DocumentPreviewModal({ file, accountId, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [arrayBuffer, setArrayBuffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fileName = file?.name || 'Document';
  const targetUrl = file?.previewUrl || file?.contentUrl || file?.downloadUrl || file?.thumbnailUrl || file?.webUrl;
  const webUrl = file?.webUrl || targetUrl;
  const meta = getFileCategoryMeta(fileName, file?.category);
  const Icon = meta.icon;

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    const loadContent = async () => {
      if (!file || !targetUrl || targetUrl === '#') {
        setLoading(false);
        setError(true);
        return;
      }

      setLoading(true);
      setError(false);
      setBlobUrl(null);
      setArrayBuffer(null);

      const isExcel = meta.category === 'Excel';
      const isWord = meta.category === 'Word';

      try {
        if (isExcel || isWord) {
          const ab = await fetchFileArrayBuffer(targetUrl, accountId);
          if (active) {
            if (ab) {
              setArrayBuffer(ab);
            } else {
              setError(true);
            }
            setLoading(false);
          }
        } else {
          // PDF, Image, Video
          const objUrl = await fetchFileBlob(targetUrl, accountId);
          if (active) {
            if (objUrl) {
              createdUrl = objUrl;
              setBlobUrl(objUrl);
            } else {
              setBlobUrl(targetUrl);
            }
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('[DocPreviewModal] Error loading content:', err);
        if (active) {
          setBlobUrl(targetUrl);
          setLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, accountId]);

  if (!file) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(6px)'
    }}>
      {/* Top Navigation Header */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '65px',
        backgroundColor: 'rgba(20, 20, 30, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        color: '#fff',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: meta.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: meta.color
          }}>
            <Icon size={22} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: '#fff', maxWidth: '480px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.65)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{meta.label}</span>
              {file.size && <span>• {file.size}</span>}
              {file.account && <span>• {file.account}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Download button */}
          <a
            href={blobUrl || targetUrl}
            download={fileName}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
          >
            <Download size={16} />
            <span>Download</span>
          </a>

          {/* Open in M365 */}
          {webUrl && webUrl !== '#' && (
            <a
              href={webUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'var(--accent-primary)',
                borderRadius: '8px',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <ExternalLink size={16} />
              <span>Open in M365</span>
            </a>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              marginLeft: '6px'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Modal Preview Body */}
      <div style={{
        width: '88vw',
        height: '80vh',
        marginTop: '65px',
        backgroundColor: meta.category === 'Images' ? 'rgba(15, 15, 25, 0.95)' : 'var(--bg-secondary)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        position: 'relative'
      }}>
        {meta.category === 'Images' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                <Loader2 size={44} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Loading image preview...</span>
              </div>
            ) : blobUrl ? (
              <img
                src={blobUrl}
                alt={fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                }}
                onError={() => setBlobUrl(null)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                <ImageIcon size={64} color="#8b5cf6" style={{ marginBottom: '18px', opacity: 0.8 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>{fileName}</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                  This image is protected or requires direct SharePoint access to view in browser.
                </p>
                {webUrl && (
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'var(--accent-primary)',
                      borderRadius: '8px',
                      padding: '10px 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    <ExternalLink size={18} />
                    <span>Open Image in Browser</span>
                  </a>
                )}
              </div>
            )}
          </div>
        ) : meta.category === 'PDF' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                <Loader2 size={44} className="animate-spin" style={{ color: '#ef4444' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Loading PDF document...</span>
              </div>
            ) : blobUrl ? (
              <iframe
                src={blobUrl}
                title={fileName}
                style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                <FileText size={64} color="#ef4444" style={{ marginBottom: '18px', opacity: 0.8 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{fileName}</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                  PDF document from Microsoft Teams.
                </p>
                {webUrl && (
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'var(--accent-primary)',
                      borderRadius: '8px',
                      padding: '10px 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    <ExternalLink size={18} />
                    <span>Open in Microsoft 365</span>
                  </a>
                )}
              </div>
            )}
          </div>
        ) : meta.category === 'Excel' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                <Loader2 size={44} className="animate-spin" style={{ color: '#10b981' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Reading spreadsheet data...</span>
              </div>
            ) : arrayBuffer ? (
              <ExcelSpreadsheetViewer arrayBuffer={arrayBuffer} fileName={fileName} />
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                <FileSpreadsheet size={64} color="#10b981" style={{ marginBottom: '18px', opacity: 0.8 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{fileName}</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                  Excel Spreadsheet from Microsoft Teams.
                </p>
                {webUrl && (
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'var(--accent-primary)',
                      borderRadius: '8px',
                      padding: '10px 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    <ExternalLink size={18} />
                    <span>Open in Microsoft Excel</span>
                  </a>
                )}
              </div>
            )}
          </div>
        ) : meta.category === 'Word' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                <Loader2 size={44} className="animate-spin" style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Loading document preview...</span>
              </div>
            ) : arrayBuffer ? (
              <WordDocumentViewer arrayBuffer={arrayBuffer} fileName={fileName} webUrl={webUrl} />
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                <FileText size={64} color="#3b82f6" style={{ marginBottom: '18px', opacity: 0.8 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{fileName}</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                  Word document from Microsoft Teams.
                </p>
                {webUrl && (
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'var(--accent-primary)',
                      borderRadius: '8px',
                      padding: '10px 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    <ExternalLink size={18} />
                    <span>Open in Microsoft Word</span>
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
            <FileText size={64} color={meta.color} style={{ marginBottom: '18px', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{fileName}</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
              {meta.label} file from Microsoft Teams.
            </p>
            {webUrl && (
              <a
                href={webUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'var(--accent-primary)',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                <ExternalLink size={18} />
                <span>Open in Microsoft 365</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
