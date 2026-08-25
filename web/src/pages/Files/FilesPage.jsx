import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Archive, 
  FileSpreadsheet, 
  Search, 
  Grid, 
  List, 
  Download, 
  ExternalLink,
  Eye,
  Loader2, 
  AlertCircle,
  X,
  Maximize2,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchFilesFromBackend, fetchFileBlob, fetchFileArrayBuffer, fetchFileText } from '../../services/fileService';
import { getAvatarColor, getInitials } from '../../utils/avatarUtils';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { renderAsync } from 'docx-preview';

// Secure Document & Image Thumbnail for Grid Gallery
function SecureThumbnail({ file, accountId, alt, fallbackColor, fallbackIcon: FallbackIcon }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    const targetUrl = file.thumbnailUrl || file.previewUrl || file.contentUrl || file.downloadUrl;
    if (!targetUrl || targetUrl === '#') {
      if (active) {
        setLoading(false);
        setError(true);
      }
      return;
    }

    if (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:')) {
      if (active) {
        setImgSrc(targetUrl);
        setLoading(false);
      }
    } else {
      fetchFileBlob(targetUrl, accountId).then((blob) => {
        if (active) {
          if (blob) {
            createdUrl = blob;
            setImgSrc(blob);
          } else {
            setImgSrc(targetUrl);
          }
          setLoading(false);
        }
      }).catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    }

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file.id, file.previewUrl, file.thumbnailUrl, accountId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: 'var(--bg-tertiary)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: fallbackColor || 'var(--text-muted)' }} />
      </div>
    );
  }

  if (error || !imgSrc) {
    const IconComponent = FallbackIcon || FileText;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: `${fallbackColor}15` }}>
        <IconComponent size={40} style={{ color: fallbackColor, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.1))' }} />
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setError(true)}
    />
  );
}

// In-App Excel Spreadsheet Viewer
function ExcelSpreadsheetViewer({ arrayBuffer, fileName }) {
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
      } else {
        setParseError('No sheets found in spreadsheet');
      }
    } catch (err) {
      console.warn('[ExcelViewer] Parse error:', err);
      setParseError('Unable to parse spreadsheet file.');
    }
  }, [arrayBuffer]);

  useEffect(() => {
    try {
      if (!arrayBuffer || !activeSheet) return;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[activeSheet];
      if (worksheet) {
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        setSheetData(jsonData);
      }
    } catch (e) {
      console.warn('[ExcelViewer] Sheet load error:', e);
    }
  }, [arrayBuffer, activeSheet]);

  if (parseError) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', color: 'var(--text-muted)' }}>
        <FileSpreadsheet size={54} color="#10b981" style={{ marginBottom: '16px', opacity: 0.8 }} />
        <p style={{ fontWeight: '600', marginBottom: '6px' }}>{parseError}</p>
        <p style={{ fontSize: '0.85rem' }}>You can still download the file or open it in Microsoft 365.</p>
      </div>
    );
  }

  const filteredData = sheetData.filter((row, idx) => {
    if (idx === 0) return true; // Keep header
    if (!searchTerm.trim()) return true;
    return row.some(cell => String(cell).toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const headerRow = filteredData[0] || [];
  const rows = filteredData.slice(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSpreadsheet size={20} color="#10b981" />
          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{fileName}</span>
          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: '600' }}>
            {rows.length} rows • {headerRow.length} cols
          </span>
        </div>
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search spreadsheet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Spreadsheet Table Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)' }}>
            <tr>
              <th style={{ padding: '8px 12px', borderRight: '1px solid var(--border-color)', width: '50px', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                #
              </th>
              {headerRow.map((col, cIdx) => (
                <th key={cIdx} style={{ padding: '8px 14px', borderRight: '1px solid var(--border-color)', fontWeight: '600', textAlign: 'left', color: 'var(--text-primary)' }}>
                  {String(col || `Col ${cIdx + 1}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', backgroundColor: 'var(--bg-tertiary)', userSelect: 'none' }}>
                  {rIdx + 1}
                </td>
                {headerRow.map((_, cIdx) => (
                  <td key={cIdx} style={{ padding: '6px 14px', borderRight: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    {String(row[cIdx] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={Math.max(headerRow.length + 1, 1)} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {searchTerm ? 'No matching rows found' : 'Empty sheet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs Bar */}
      {sheetNames.length > 1 && (
        <div style={{ display: 'flex', gap: '4px', padding: '6px 12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', overflowX: 'auto' }}>
          {sheetNames.map((sheet) => (
            <button
              key={sheet}
              onClick={() => setActiveSheet(sheet)}
              style={{
                padding: '5px 14px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: activeSheet === sheet ? 'var(--accent-primary)' : 'transparent',
                color: activeSheet === sheet ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: activeSheet === sheet ? '600' : '500',
                cursor: 'pointer'
              }}
            >
              {sheet}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// In-App Word Document (.docx) Viewer with Full Typography & Page Rendering
function WordDocumentViewer({ arrayBuffer, fileName, webUrl }) {
  const containerRef = React.useRef(null);
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
        console.warn('[WordViewer] docx-preview render failed, trying mammoth fallback:', err);
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (active && containerRef.current) {
            containerRef.current.innerHTML = `
              <div style="background:#ffffff; color:#1e293b; padding:48px 56px; border-radius:8px; box-shadow:0 4px 24px rgba(0,0,0,0.12); max-width:850px; margin:0 auto; line-height:1.7; font-size:1rem;">
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

// In-App Text / Code / CSHTML / HTML / JSON Document Viewer
function TextCodeDocumentViewer({ textContent, fileName, webUrl }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const lines = (textContent || '').split('\n');
  const lineCount = lines.length;
  const wordCount = (textContent || '').trim().split(/\s+/).filter(Boolean).length;
  const ext = fileName?.includes('.') ? fileName.split('.').pop().toUpperCase() : 'TEXT';

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#1e1e2e', color: '#cdd6f4', overflow: 'hidden' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#181825' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} color="#89b4fa" />
          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#cdd6f4' }}>{fileName}</span>
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(137, 180, 250, 0.15)', color: '#89b4fa', fontWeight: '700' }}>
            {ext} • {lineCount} lines • {wordCount} words
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', width: '180px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6c7086' }} />
            <input
              type="text"
              placeholder="Find in file..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 8px 5px 28px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: '#11111b',
                color: '#cdd6f4',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          <button
            onClick={handleCopy}
            title="Copy content"
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: copied ? '#a6e3a1' : 'rgba(255,255,255,0.08)',
              color: copied ? '#11111b' : '#cdd6f4',
              fontSize: '0.78rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code / Text Body with Line Numbers */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', fontFamily: '"Fira Code", "Cascadia Code", Consolas, Monaco, monospace', fontSize: '0.88rem', lineHeight: '1.6' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {lines.map((line, idx) => {
              const isMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
              return (
                <tr key={idx} style={{ backgroundColor: isMatch ? 'rgba(249, 226, 175, 0.18)' : 'transparent' }}>
                  <td style={{
                    width: '45px',
                    paddingRight: '16px',
                    textAlign: 'right',
                    color: '#585b70',
                    userSelect: 'none',
                    verticalAlign: 'top',
                    fontSize: '0.8rem'
                  }}>
                    {idx + 1}
                  </td>
                  <td style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: line.trim().startsWith('//') || line.trim().startsWith('<!--') || line.trim().startsWith('/*') || line.trim().startsWith('*') ? '#6c7086' : (line.includes('<') && line.includes('>')) ? '#89dceb' : '#cdd6f4'
                  }}>
                    {line || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FilesPage({ initialFile, onClearInitialFile }) {
  const { connectedAccounts, activeAccount } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewFile, setPreviewFile] = useState(initialFile || null);
  const [targetFile, setTargetFile] = useState(initialFile || null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewArrayBuffer, setPreviewArrayBuffer] = useState(null);
  const [previewTextContent, setPreviewTextContent] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState(false);

  useEffect(() => {
    if (initialFile) {
      setTargetFile(initialFile);
      setPreviewFile(initialFile);
      setSearchQuery(''); // Do not filter out other files; show all files and highlight the target file
    }
  }, [initialFile]);

  // Smooth scroll & Bright Yellow highlight searched file card
  useEffect(() => {
    if (targetFile && !loading && files.length > 0) {
      const timer = setTimeout(() => {
        const tfId = targetFile.id || targetFile._id || targetFile.name;
        let el = document.getElementById(`file-card-${tfId}`);

        let matched = null;
        if (!el && targetFile.name) {
          const tfName = targetFile.name.toLowerCase();
          matched = files.find(f => f.name?.toLowerCase() === tfName);
          if (!matched) {
            const cleanName = tfName.replace(/_/g, ' ');
            matched = files.find(f =>
              f.name?.toLowerCase().includes(cleanName) ||
              cleanName.includes(f.name?.toLowerCase()) ||
              cleanName.split(' ').some(w => w.length > 2 && f.name?.toLowerCase().includes(w))
            );
          }
          if (matched) {
            el = document.getElementById(`file-card-${matched.id || matched.name}`);
            setPreviewFile(matched);
          }
        }

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const origBg = el.style.backgroundColor;
          const origBorder = el.style.border;
          const origShadow = el.style.boxShadow;
          const origTransform = el.style.transform;

          el.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
          el.style.backgroundColor = '#fef08a'; // Bright Yellow highlight!
          el.style.border = '2px solid #eab308';
          el.style.boxShadow = '0 0 24px rgba(234, 179, 8, 0.9)';
          el.style.transform = 'scale(1.04)';

          setTimeout(() => {
            el.style.backgroundColor = origBg;
            el.style.border = origBorder;
            el.style.boxShadow = origShadow;
            el.style.transform = origTransform;
            setTargetFile(null);
            if (onClearInitialFile) {
              onClearInitialFile();
            }
          }, 3500);
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [targetFile, loading, files, onClearInitialFile]);

  const categories = [
    { name: 'All', icon: FileText, color: 'var(--accent-primary)' },
    { name: 'PDF', icon: FileText, color: '#ef4444' },
    { name: 'Images', icon: ImageIcon, color: '#8b5cf6' },
    { name: 'Videos', icon: Video, color: '#6366f1' },
    { name: 'Documents', icon: FileText, color: '#3b82f6' },
    { name: 'ZIP', icon: Archive, color: '#f59e0b' },
    { name: 'Excel', icon: FileSpreadsheet, color: '#10b981' }
  ];

  const [selectedFilterAccount, setSelectedFilterAccount] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const isAccountConnected = connectedAccounts && connectedAccounts.length > 0;

  const loadFiles = useCallback(async (isManual = false) => {
    if (!isAccountConnected) {
      setFiles([]);
      return;
    }

    if (isManual || files.length === 0) {
      setLoading(true);
    }
    if (isManual) setRefreshing(true);
    setError(null);
    try {
      const data = await fetchFilesFromBackend('all');
      setFiles(data || []);
    } catch (err) {
      console.warn('[FilesPage] Fetch error:', err.message);
      setError(err.message || 'Failed to load files from Microsoft Graph.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAccountConnected, files.length]);

  useEffect(() => {
    loadFiles(false);
  }, [isAccountConnected, connectedAccounts.length]);

  // Securely load blob / arrayBuffer preview when modal opens
  useEffect(() => {
    let active = true;
    let createdUrl = null;

    const loadPreviewContent = async () => {
      if (!previewFile) {
        setPreviewBlobUrl(null);
        setPreviewArrayBuffer(null);
        setPreviewTextContent(null);
        setPreviewLoading(false);
        setPreviewLoadError(false);
        return;
      }

      setPreviewLoading(true);
      setPreviewLoadError(false);
      setPreviewBlobUrl(null);
      setPreviewArrayBuffer(null);
      setPreviewTextContent(null);

      const targetUrl = previewFile.previewUrl || previewFile.thumbnailUrl || previewFile.downloadUrl;
      if (!targetUrl || targetUrl === '#') {
        if (active) {
          setPreviewLoading(false);
          setPreviewLoadError(true);
        }
        return;
      }

      const fileNameLower = (previewFile.name || '').toLowerCase();
      const isExcel = previewFile.category === 'Excel' || fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv');
      const isWord = fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
      const isTextOrCode = fileNameLower.match(/\.(cshtml|html|htm|txt|json|xml|css|js|jsx|ts|tsx|md|cs|sql|log|env|yml|yaml|py|java|cpp|c|sh|bat|ps1|config|ini|svg|rtf)$/i) || (!isExcel && !isWord && previewFile.category === 'Documents');
      const previewAccId = previewFile.connectedAccountId || previewFile.accountEmail;

      try {
        if (isExcel || isWord) {
          const ab = await fetchFileArrayBuffer(targetUrl, previewAccId);
          if (active) {
            if (ab) {
              setPreviewArrayBuffer(ab);
            } else {
              setPreviewLoadError(true);
            }
            setPreviewLoading(false);
          }
        } else if (isTextOrCode) {
          const text = await fetchFileText(targetUrl, previewAccId);
          if (active) {
            if (text !== null && text !== undefined) {
              setPreviewTextContent(text);
            } else {
              const objUrl = await fetchFileBlob(targetUrl, previewAccId);
              if (objUrl) {
                createdUrl = objUrl;
                setPreviewBlobUrl(objUrl);
              } else {
                setPreviewLoadError(true);
              }
            }
            setPreviewLoading(false);
          }
        } else {
          // Images, PDF, Videos
          const objUrl = await fetchFileBlob(targetUrl, previewAccId);
          if (active) {
            if (objUrl) {
              createdUrl = objUrl;
              setPreviewBlobUrl(objUrl);
            } else {
              setPreviewBlobUrl(targetUrl);
            }
            setPreviewLoading(false);
          }
        }
      } catch (err) {
        console.warn('[FilesPage] Preview load error:', err);
        if (active) {
          setPreviewBlobUrl(targetUrl);
          setPreviewLoading(false);
        }
      }
    };

    loadPreviewContent();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [previewFile]);

  const getFileCategory = (file) => {
    if (!file) return 'Documents';
    const name = (file.name || '').toLowerCase().trim();
    const ext = name.includes('.') ? name.split('.').pop() : '';

    if (ext === 'pdf' || name.endsWith('.pdf')) return 'PDF';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tif', 'tiff'].includes(ext) || name.startsWith('photo from') || name.startsWith('image')) return 'Images';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp'].includes(ext)) return 'Videos';
    if (['xls', 'xlsx', 'csv', 'tsv', 'ods'].includes(ext)) return 'Excel';
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(ext)) return 'ZIP';
    if (['doc', 'docx', 'txt', 'pptx', 'ppt', 'rtf', 'odt', 'pages', 'md', 'cshtml', 'html', 'json', 'xml', 'css', 'js', 'ts', 'cs', 'sql', 'log'].includes(ext)) return 'Documents';
    
    const rawCat = (file.category || '').toLowerCase();
    if (rawCat === 'pdf') return 'PDF';
    if (rawCat === 'images' || rawCat === 'image') return 'Images';
    if (rawCat === 'videos' || rawCat === 'video') return 'Videos';
    if (rawCat === 'excel') return 'Excel';
    if (rawCat === 'zip' || rawCat === 'archive') return 'ZIP';
    return 'Documents';
  };

  const getFileOwnerEmail = (f) => {
    if (!f) return '';
    const email = (f.accountEmail || '').toLowerCase().trim();
    if (email && email.includes('@')) return email;
    const badge = (f.account || f.accountBadge || '').toLowerCase().trim();
    if (badge.includes('aryan') || badge.includes('kumrecha')) return 'aryankumar.kumrecha@estatic-infotech.com';
    if (badge.includes('keval') || badge.includes('trivedi')) return 'keval.trivedi@estatic-infotech.com';
    const accId = (f.connectedAccountId || '').toLowerCase().trim();
    if (accId.includes('aryan') || accId.includes('kumrecha')) return 'aryankumar.kumrecha@estatic-infotech.com';
    if (accId.includes('keval') || accId.includes('trivedi')) return 'keval.trivedi@estatic-infotech.com';
    return email;
  };

  // Files filtered by selected account first
  const accountScopedFiles = files.filter((file) => {
    if (!selectedFilterAccount || selectedFilterAccount === 'all') return true;

    const filterKey = selectedFilterAccount.toLowerCase().trim();
    const fileOwnerEmail = getFileOwnerEmail(file);

    if (filterKey.includes('aryan') || filterKey.includes('kumrecha')) {
      return fileOwnerEmail.includes('aryan') || fileOwnerEmail.includes('kumrecha');
    }
    if (filterKey.includes('keval') || filterKey.includes('trivedi')) {
      return fileOwnerEmail.includes('keval') || fileOwnerEmail.includes('trivedi');
    }

    const fileAccId = (file.connectedAccountId || '').toLowerCase().trim();
    return fileOwnerEmail === filterKey || fileAccId === filterKey;
  });

  const filteredFiles = accountScopedFiles.filter((file) => {
    const actualCategory = getFileCategory(file);
    const matchesCategory = selectedCategory === 'All' || actualCategory.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      file.name?.toLowerCase().includes(q) ||
      file.sender?.toLowerCase().includes(q) ||
      file.account?.toLowerCase().includes(q)
    );
    return matchesCategory && matchesSearch;
  });

  const getCategoryMeta = (category) => {
    switch (category) {
      case 'PDF':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'PDF', icon: FileText };
      case 'Images':
        return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', label: 'Image', icon: ImageIcon };
      case 'Videos':
        return { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', label: 'Video', icon: Video };
      case 'Excel':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Excel', icon: FileSpreadsheet };
      case 'ZIP':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'Archive', icon: Archive };
      default:
        return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Document', icon: FileText };
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Category Sidebar */}
      <div style={{
        width: '240px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.05em' }}>
          File Categories
        </h3>
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.name;
          const count = cat.name === 'All' 
            ? accountScopedFiles.length 
            : accountScopedFiles.filter(f => getFileCategory(f).toLowerCase() === cat.name.toLowerCase()).length;

          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? '600' : '500',
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon size={18} style={{ color: isActive ? 'var(--accent-primary)' : cat.color }} />
                <span>{cat.name}</span>
              </div>
              {count > 0 && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: isActive ? '#fff' : 'var(--text-muted)'
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Files Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px' }}>
        {/* Account Filter Chips Bar */}
        {connectedAccounts && connectedAccounts.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <button
              onClick={() => setSelectedFilterAccount('all')}
              title="Show files from all connected accounts"
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: selectedFilterAccount === 'all' ? '700' : '600',
                backgroundColor: selectedFilterAccount === 'all' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: selectedFilterAccount === 'all' ? '#ffffff' : 'var(--text-secondary)',
                border: selectedFilterAccount === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                boxShadow: selectedFilterAccount === 'all' ? '0 2px 8px rgba(79, 70, 229, 0.28)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.18s ease'
              }}
            >
              <span>✨</span>
              <span>All Accounts</span>
              <span style={{
                backgroundColor: selectedFilterAccount === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: '700'
              }}>
                {connectedAccounts.length}
              </span>
            </button>

            {connectedAccounts.map((acc) => {
              const accEmailKey = (acc.email || acc.username || acc._id || acc.accountId || acc.id || '').toLowerCase().trim();
              const isSelected = selectedFilterAccount === accEmailKey || (selectedFilterAccount && (
                selectedFilterAccount === (acc._id || '').toString() ||
                selectedFilterAccount === (acc.accountId || '').toString() ||
                selectedFilterAccount === (acc.email || '').toLowerCase() ||
                selectedFilterAccount === (acc.username || '').toLowerCase()
              ));
              const rawName = acc.displayName || acc.company || acc.email?.split('@')[0] || 'Account';
              const name = rawName.replace(/[`'"]/g, '').trim();
              const initial = (name[0] || 'A').toUpperCase();
              return (
                <button
                  key={acc._id || acc.email || acc.accountId}
                  onClick={() => setSelectedFilterAccount(accEmailKey)}
                  title={`${name} (${acc.email || ''})`}
                  style={{
                    padding: '4px 12px 4px 6px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? '700' : '600',
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.28)' : 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : getAvatarColor(name),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    flexShrink: 0
                  }}>
                    {initial}
                  </span>
                  <span style={{
                    maxWidth: '140px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {name}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => loadFiles(true)}
              disabled={refreshing}
              title="Refresh Graph Files for all accounts"
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
          {/* Search Field */}
          <div style={{
            flex: 1,
            maxWidth: '420px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Filter files by name, sender or account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', width: '100%' }}
            />
          </div>

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: viewMode === 'grid' ? 'var(--accent-light)' : 'var(--bg-secondary)',
                color: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}
            >
              <Grid size={16} />
              <span>Gallery</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: viewMode === 'list' ? 'var(--accent-light)' : 'var(--bg-secondary)',
                color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}
            >
              <List size={16} />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* Files Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <Loader2 className="spinner" size={32} style={{ marginBottom: '16px' }} />
              <p>Fetching files from Microsoft Graph & Teams...</p>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--error)' }}>
              <AlertCircle size={48} style={{ marginBottom: '16px', opacity: 0.8 }} />
              <p style={{ fontWeight: '600' }}>Error</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>{error}</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <FileText size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p style={{ fontWeight: '600' }}>No files found.</p>
              {!activeAccount || activeAccount === 'all' ? (
                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Please select a specific account in the sidebar to view files.</p>
              ) : null}
            </div>
) : viewMode === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '20px'
            }}>
              {filteredFiles.map((file) => {
                const actualCategory = getFileCategory(file);
                const meta = getCategoryMeta(actualCategory);
                const Icon = meta.icon;
                const isImage = actualCategory === 'Images';
                const fileExt = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : actualCategory.toUpperCase();

                return (
                  <div 
                    key={file.id}
                    id={`file-card-${file.id || file.name}`}
                    className="glass-card" 
                    style={{ 
                      borderRadius: 'var(--radius-md)', 
                      overflow: 'hidden', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      border: '1px solid var(--border-color)'
                    }}
                    onClick={() => setPreviewFile(file)}
                  >
                    {/* Visual Thumbnail Header with real Microsoft Graph document preview */}
                    <div style={{
                      height: '140px',
                      width: '100%',
                      backgroundColor: 'var(--bg-tertiary)',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <SecureThumbnail 
                        file={file}
                        accountId={file.connectedAccountId || file.accountEmail || activeAccount?._id}
                        alt={file.name}
                        fallbackColor={meta.color}
                        fallbackIcon={Icon}
                      />
                      <span style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: meta.color,
                        color: '#fff',
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        letterSpacing: '0.04em',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(4px)'
                      }}>
                        {meta.label}
                      </span>
                    </div>

                    {/* File Info */}
                    <div style={{ padding: '16px' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <h4 style={{ 
                          fontSize: '0.92rem', 
                          fontWeight: '600', 
                          marginBottom: '6px', 
                          wordBreak: 'break-word',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }} title={file.name}>
                          {file.name}
                        </h4>

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          {actualCategory} • {file.size}
                        </p>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span className="badge" style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <span style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: getAvatarColor(file.account),
                              color: '#fff',
                              fontSize: '0.55rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700'
                            }}>
                              {(file.account?.[0] || 'A').toUpperCase()}
                            </span>
                            <span>{file.account}</span>
                          </span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            By {file.sender}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewFile(file);
                            }}
                            title="Preview File"
                            style={{ 
                              background: 'var(--bg-tertiary)', 
                              border: 'none', 
                              borderRadius: '6px', 
                              padding: '6px', 
                              cursor: 'pointer', 
                              color: 'var(--accent-primary)' 
                            }}
                          >
                            <Eye size={16} />
                          </button>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (file.webUrl) window.open(file.webUrl, '_blank');
                            }}
                            title="Open in Microsoft 365"
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: file.webUrl ? 'pointer' : 'not-allowed', 
                              color: file.webUrl ? 'var(--text-secondary)' : 'var(--text-disabled)',
                              padding: '6px'
                            }}
                          >
                            <ExternalLink size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card" style={{ overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '14px 20px' }}>Name</th>
                    <th style={{ padding: '14px 20px' }}>Category</th>
                    <th style={{ padding: '14px 20px' }}>Size</th>
                    <th style={{ padding: '14px 20px' }}>Account</th>
                    <th style={{ padding: '14px 20px' }}>Shared By</th>
                    <th style={{ padding: '14px 20px' }}>Modified</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => {
                    const actualCategory = getFileCategory(file);
                    const meta = getCategoryMeta(actualCategory);
                    const Icon = meta.icon;

                    return (
                      <tr 
                        key={file.id} 
                        style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                        onClick={() => setPreviewFile(file)}
                      >
                        <td style={{ padding: '14px 20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            padding: '6px', 
                            borderRadius: '6px', 
                            backgroundColor: meta.bg, 
                            color: meta.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Icon size={18} />
                          </div>
                          <span>{file.name}</span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            backgroundColor: meta.bg, 
                            color: meta.color,
                            fontWeight: '600'
                          }}>
                            {actualCategory}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>{file.size}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span className="badge" style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <span style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: getAvatarColor(file.account),
                              color: '#fff',
                              fontSize: '0.55rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700'
                            }}>
                              {(file.account?.[0] || 'A').toUpperCase()}
                            </span>
                            <span>{file.account}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>{file.sender}</td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>{file.date}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewFile(file);
                              }}
                              title="Preview"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)' }}
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (file.webUrl) window.open(file.webUrl, '_blank');
                              }}
                              title="Open in Microsoft 365"
                              style={{ background: 'none', border: 'none', cursor: file.webUrl ? 'pointer' : 'not-allowed', color: file.webUrl ? 'var(--text-secondary)' : 'var(--text-disabled)' }}
                            >
                              <ExternalLink size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* In-App Direct File Preview Modal */}
      {previewFile && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.88)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          {/* Header Bar */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '70px',
            backgroundColor: 'rgba(20, 20, 30, 0.9)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            color: '#fff',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              {React.createElement(getCategoryMeta(previewFile.category).icon, { size: 22, color: getCategoryMeta(previewFile.category).color })}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '450px' }}>
                  {previewFile.name}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  {previewFile.category} • {previewFile.size} • Shared by {previewFile.sender} ({previewFile.account})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(previewBlobUrl || previewFile.previewUrl) && (
                <a
                  href={previewBlobUrl || previewFile.previewUrl}
                  download={previewFile.name}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fff',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={16} />
                  <span>Download</span>
                </a>
              )}

              {previewFile.webUrl && previewFile.webUrl !== '#' && (
                <a
                  href={previewFile.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'var(--accent-primary)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fff',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink size={16} />
                  <span>Open in Microsoft 365</span>
                </a>
              )}

              <button
                onClick={() => setPreviewFile(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Preview Body */}
          <div style={{
            width: '85vw',
            height: '75vh',
            marginTop: '50px',
            backgroundColor: previewFile.category === 'Images' ? 'rgba(15, 15, 25, 0.95)' : 'var(--bg-secondary)',
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
            {previewFile.category === 'Images' ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
                {previewLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                    <Loader2 size={44} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Loading image preview...</span>
                  </div>
                ) : (
                  <>
                    <img 
                      src={previewBlobUrl || previewFile.previewUrl || previewFile.thumbnailUrl || previewFile.webUrl} 
                      alt={previewFile.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ImageIcon size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
                      <p style={{ fontWeight: '600', marginBottom: '8px' }}>Unable to load preview directly</p>
                      <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>This image is protected or requires direct SharePoint access.</p>
                      {previewFile.webUrl && previewFile.webUrl !== '#' && (
                        <a
                          href={previewFile.webUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: 'var(--accent-primary)',
                            color: '#fff',
                            padding: '8px 18px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}
                        >
                          Open in Browser
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : previewFile.category === 'Videos' ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                {previewLoading ? (
                  <Loader2 size={44} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                ) : (
                  <video 
                    src={previewBlobUrl || previewFile.previewUrl || previewFile.webUrl} 
                    controls 
                    autoPlay 
                    style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px' }}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            ) : previewFile.category === 'PDF' ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {previewLoading ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                    <Loader2 size={44} className="animate-spin" style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Loading PDF document...</span>
                  </div>
                ) : previewBlobUrl ? (
                  <iframe 
                    src={previewBlobUrl}
                    title={previewFile.name}
                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                    <FileText size={64} color="#ef4444" style={{ marginBottom: '18px', opacity: 0.8 }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{previewFile.name}</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                      PDF document from {previewFile.account}.
                    </p>
                    {previewFile.webUrl && previewFile.webUrl !== '#' && (
                      <a
                        href={previewFile.webUrl}
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
            ) : (previewFile.category === 'Excel' || (previewFile.name || '').toLowerCase().match(/\.(xlsx|xls|csv)$/)) ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {previewLoading ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                    <Loader2 size={44} className="animate-spin" style={{ color: '#10b981' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Reading spreadsheet data...</span>
                  </div>
                ) : previewArrayBuffer ? (
                  <ExcelSpreadsheetViewer arrayBuffer={previewArrayBuffer} fileName={previewFile.name} />
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                    <FileSpreadsheet size={64} color="#10b981" style={{ marginBottom: '18px', opacity: 0.8 }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{previewFile.name}</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                      Excel Spreadsheet from {previewFile.account}.
                    </p>
                    {previewFile.webUrl && previewFile.webUrl !== '#' && (
                      <a
                        href={previewFile.webUrl}
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
            ) : ((previewFile.name || '').toLowerCase().match(/\.(docx|doc)$/)) ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {previewLoading ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                    <Loader2 size={44} className="animate-spin" style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Loading document preview...</span>
                  </div>
                ) : previewArrayBuffer ? (
                  <WordDocumentViewer arrayBuffer={previewArrayBuffer} fileName={previewFile.name} webUrl={previewFile.webUrl} />
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                    <FileText size={64} color="#3b82f6" style={{ marginBottom: '18px', opacity: 0.8 }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{previewFile.name}</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                      Word document from {previewFile.account}.
                    </p>
                    {previewFile.webUrl && previewFile.webUrl !== '#' && (
                      <a
                        href={previewFile.webUrl}
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
            ) : previewTextContent !== null ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <TextCodeDocumentViewer textContent={previewTextContent} fileName={previewFile.name} webUrl={previewFile.webUrl} />
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {previewLoading ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                    <Loader2 size={44} className="animate-spin" style={{ color: getCategoryMeta(previewFile.category).color }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Loading document content...</span>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                    <FileText size={64} color={getCategoryMeta(previewFile.category).color} style={{ marginBottom: '18px', opacity: 0.8 }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{previewFile.name}</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '0.9rem' }}>
                      {previewFile.category} document from {previewFile.account}.
                    </p>
                    {previewFile.webUrl && previewFile.webUrl !== '#' && (
                      <a
                        href={previewFile.webUrl}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

