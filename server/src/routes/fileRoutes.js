const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ConnectedAccount = require('../models/ConnectedAccount');
const graphService = require('../services/graphService');

/**
 * GET /api/files
 * Fetch recent files for the connected Microsoft account
 */
router.get('/', async (req, res) => {
  try {
    const { connectedAccountId } = req.query;

    if (!connectedAccountId || connectedAccountId === 'all' || connectedAccountId === '[object Object]') {
      return res.status(200).json({ success: true, data: [] });
    }

    // 1. Resolve access token from Authorization header if passed
    let accessToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }

    // 2. Look up account in MongoDB safely
    let account = null;
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
    if (dbAvailable) {
      if (mongoose.Types.ObjectId.isValid(connectedAccountId)) {
        account = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt');
      }
      if (!account) {
        account = await ConnectedAccount.findOne({
          $or: [
            { accountId: connectedAccountId },
            { microsoftUserId: connectedAccountId },
            { email: connectedAccountId }
          ]
        }).select('+microsoftAccessToken +tokenExpiresAt');
      }
    }

    // 3. If no header token, use token from database account if available
    if (!accessToken && account && account.microsoftAccessToken) {
      if (!account.tokenExpiresAt || new Date(account.tokenExpiresAt) >= new Date()) {
        accessToken = account.microsoftAccessToken;
      }
    }

    // 4. Mock / Demo fallback if mock mode is on or no token found for demo accounts
    if (graphService.isMockMode() || (!accessToken && (!account || !account.microsoftAccessToken))) {
      return res.json({
        success: true,
        source: 'mock',
        data: []
      });
    }

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'GRAPH_AUTH_REQUIRED',
          message: 'Microsoft Graph access token is required or expired. Please re-authenticate.'
        }
      });
    }

    // 5. Fetch Files from Graph API
    let graphFiles = { value: [] };
    try {
      graphFiles = await graphService.fetchGraphRecentFiles(accessToken);
    } catch (graphError) {
      console.warn('[FileRoutes] Graph API fetch warning:', graphError.message);
      return res.status(graphError.statusCode || 500).json({
        success: false,
        error: {
          code: graphError.code || 'GRAPH_ERROR',
          message: graphError.message || 'Failed to fetch files from Microsoft Graph.'
        }
      });
    }

    // 6. Return Normalized Files with Proxy Preview URLs
    const rawFiles = graphFiles.isNormalized ? graphFiles.value : (graphFiles?.value || []).map(file => {
      let category = 'Documents';
      const mime = file.file?.mimeType || '';
      const nameLower = (file.name || '').toLowerCase();
      
      if (mime.includes('pdf') || nameLower.endsWith('.pdf')) category = 'PDF';
      else if (mime.includes('image') || nameLower.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) category = 'Images';
      else if (mime.includes('video') || nameLower.match(/\.(mp4|mov|avi|mkv)$/)) category = 'Videos';
      else if (mime.includes('zip') || mime.includes('compressed') || nameLower.match(/\.(zip|rar|7z)$/)) category = 'ZIP';
      else if (mime.includes('excel') || mime.includes('spreadsheet') || nameLower.match(/\.(xls|xlsx|csv)$/)) category = 'Excel';

      const sizeBytes = file.size || 0;
      let sizeStr = `${sizeBytes} B`;
      if (sizeBytes > 1024 * 1024) sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
      else if (sizeBytes > 1024) sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;

      const date = new Date(file.lastModifiedDateTime || file.createdDateTime || Date.now());
      const dateStr = isNaN(date.getTime())
        ? 'Recent'
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      return {
        id: file.id || `file-${Math.random().toString(36).substring(2, 9)}`,
        name: file.name || 'Untitled File',
        category: category,
        size: sizeStr,
        account: account?.displayName || 'Microsoft Teams',
        sender: file.lastModifiedBy?.user?.displayName || file.createdBy?.user?.displayName || 'Unknown',
        date: dateStr,
        webUrl: file.webUrl || '#'
      };
    });

    const normalizedFilesWithProxy = rawFiles.map(f => {
      const params = new URLSearchParams();
      if (connectedAccountId) params.append('connectedAccountId', connectedAccountId);
      if (f.name) params.append('name', f.name);
      if (f.driveId) params.append('driveId', f.driveId);
      if (f.downloadUrl && f.downloadUrl !== '#') params.append('downloadUrl', f.downloadUrl);
      if (f.webUrl && f.webUrl !== '#') params.append('webUrl', f.webUrl);

      const qs = params.toString();
      return {
        ...f,
        previewUrl: `/api/files/${encodeURIComponent(f.id)}/content?${qs}`,
        thumbnailUrl: `/api/files/${encodeURIComponent(f.id)}/content?${qs}`
      };
    });

    res.json({
      success: true,
      data: normalizedFilesWithProxy
    });
  } catch (error) {
    console.error('[FileRoutes] Error fetching files:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Internal server error while fetching files.'
      }
    });
  }
});

/**
 * GET /api/files/:fileId/content
 * Stream the raw file/image/PDF content directly from Microsoft Graph
 */
router.get('/:fileId/content', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { connectedAccountId, driveId, downloadUrl, webUrl, name } = req.query;

    let accessToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }

    if (!accessToken && connectedAccountId) {
      const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
      if (dbAvailable) {
        let account = null;
        if (mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          account = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt');
        }
        if (!account) {
          account = await ConnectedAccount.findOne({
            $or: [
              { accountId: connectedAccountId },
              { microsoftUserId: connectedAccountId },
              { email: connectedAccountId }
            ]
          }).select('+microsoftAccessToken +tokenExpiresAt');
        }
        if (account && account.microsoftAccessToken) {
          accessToken = account.microsoftAccessToken;
        }
      }
    }



    const decodedFileId = decodeURIComponent(fileId);
    let fileBuffer = null;
    let contentType = 'application/octet-stream';

    // Demo / Mock files image fallback handler
    const demoImageMap = {
      'file-photo-aryan-1': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      'file-photo-pratham-1': 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80',
      'file-image-jpg-1': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
      'file-2': 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
      'file-photo-aryan-2': 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
      'file-photo-aryan-3': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
      'file-photo-aryan-4': 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=600&q=80'
    };

    if (demoImageMap[decodedFileId] || (downloadUrl && downloadUrl.includes('unsplash.com'))) {
      const targetImgUrl = demoImageMap[decodedFileId] || downloadUrl;
      try {
        const imgRes = await fetch(targetImgUrl);
        if (imgRes.ok) {
          const ab = await imgRes.arrayBuffer();
          res.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
          res.set('Cache-Control', 'public, max-age=86400');
          return res.send(Buffer.from(ab));
        }
      } catch (e) {
        console.warn('[FileRoutes] Demo image fetch error:', e.message);
      }
    }

    // Helper: fetch binary from URL, sending Bearer token ONLY to Microsoft Graph endpoints, and omitting for pre-authenticated CDN/SharePoint URLs
    const downloadFromGraph = async (url, withAuth = false) => {
      const isGraphApi = url.includes('graph.microsoft.com');
      const headers = (isGraphApi || withAuth) && accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      
      try {
        let response = await fetch(url, { headers, redirect: 'manual' });

        // If Graph redirects with 302/301/307 (pre-authenticated SAS / SharePoint download URL)
        if (response.status === 302 || response.status === 301 || response.status === 303 || response.status === 307) {
          const locationUrl = response.headers.get('location');
          if (locationUrl) {
            // Fetch from location WITHOUT Authorization header (it is pre-authenticated with query token)
            const directRes = await fetch(locationUrl);
            if (directRes.ok) {
              const ct = directRes.headers.get('content-type') || contentType;
              const ab = await directRes.arrayBuffer();
              return { buffer: Buffer.from(ab), contentType: ct };
            }
          }
        } else if (response.status === 401 && !withAuth && accessToken) {
          // Retry with auth header if unauthenticated request failed
          const authRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (authRes.ok) {
            const ct = authRes.headers.get('content-type') || contentType;
            const ab = await authRes.arrayBuffer();
            return { buffer: Buffer.from(ab), contentType: ct };
          }
        } else if (response.ok) {
          const ct = response.headers.get('content-type') || contentType;
          const ab = await response.arrayBuffer();
          return { buffer: Buffer.from(ab), contentType: ct };
        }
      } catch (err) {
        console.warn(`[FileRoutes] Download failed for ${url}:`, err.message);
      }
      return null;
    };

    // 1. If downloadUrl was provided (could be graph.microsoft.com hostedContent or direct SharePoint SAS URL)
    if (downloadUrl && downloadUrl.startsWith('http') && downloadUrl !== '#') {
      try {
        const directResult = await downloadFromGraph(downloadUrl);
        if (directResult) {
          fileBuffer = directResult.buffer;
          contentType = directResult.contentType;
        }
      } catch (e) {
        console.warn('[FileRoutes] Direct downloadUrl fetch error:', e.message);
      }
    }

    // 2. If it's a hosted chat image (hosted-{chatId}-{msgId}-{contentId})
    if (!fileBuffer && decodedFileId.startsWith('hosted-') && accessToken) {
      try {
        const parts = decodedFileId.split('-');
        if (parts.length >= 4) {
          const chatId = parts[1];
          const msgId = parts[2];
          const contentId = parts.slice(3).join('-');
          const hostedUrl = `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(msgId)}/hostedContents/${encodeURIComponent(contentId)}/$value`;
          const hostedResult = await downloadFromGraph(hostedUrl, true);
          if (hostedResult) {
            fileBuffer = hostedResult.buffer;
            contentType = hostedResult.contentType || 'image/png';
          }
        }
      } catch (e) {
        console.warn('[FileRoutes] Hosted chat image error:', e.message);
      }
    }

    // 3. Drive Item Content with specific driveId (for shared files or group files)
    if (!fileBuffer && driveId && accessToken) {
      try {
        const driveContentUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(decodedFileId)}/content`;
        const result = await downloadFromGraph(driveContentUrl, true);
        if (result) {
          fileBuffer = result.buffer;
          contentType = result.contentType;
        }
      } catch (e) {
        console.warn('[FileRoutes] DriveId item content fetch error:', e.message);
      }
    }

    // 4. User's Personal Drive Content
    if (!fileBuffer && accessToken) {
      try {
        const graphContentUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(decodedFileId)}/content`;
        const result = await downloadFromGraph(graphContentUrl, true);
        if (result) {
          fileBuffer = result.buffer;
          contentType = result.contentType;
        }
      } catch (e) {
        console.warn('[FileRoutes] Me drive content fetch error:', e.message);
      }
    }

    // 5. SharePoint / OneDrive Sharing URL via Shares API
    const targetWebUrl = (webUrl && webUrl !== '#') ? webUrl : (decodedFileId.startsWith('http') ? decodedFileId : null);
    if (!fileBuffer && targetWebUrl && targetWebUrl.startsWith('http') && accessToken) {
      try {
        const cleanUrl = targetWebUrl.split('?')[0]; // strip query string for clean token
        const shareId = 'u!' + Buffer.from(cleanUrl, 'utf8').toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
        const shareUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`;
        const shareResult = await downloadFromGraph(shareUrl, true);
        if (shareResult) {
          fileBuffer = shareResult.buffer;
          contentType = shareResult.contentType;
        }
      } catch (e) {
        console.warn('[FileRoutes] Shares API fetch error:', e.message);
      }
    }

    // 6. Try Thumbnail Endpoint (for images)
    if (!fileBuffer && accessToken) {
      try {
        const thumbUrl = driveId
          ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(decodedFileId)}/thumbnails/0/large/content`
          : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(decodedFileId)}/thumbnails/0/large/content`;
        const thumbResult = await downloadFromGraph(thumbUrl, true);
        if (thumbResult) {
          fileBuffer = thumbResult.buffer;
          contentType = thumbResult.contentType || 'image/jpeg';
        }
      } catch (e) {
        console.warn('[FileRoutes] Thumbnail fetch error:', e.message);
      }
    }

    if (!fileBuffer) {
      console.warn(`[FileRoutes] Failed to stream file ${decodedFileId}`);
      return res.status(404).send('File not found or access denied');
    }

    // Determine MIME type by filename if generic octet-stream
    const fileName = (name || '').toLowerCase();
    if (contentType === 'application/octet-stream' || contentType.includes('text/html')) {
      if (fileName.endsWith('.png')) contentType = 'image/png';
      else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (fileName.endsWith('.gif')) contentType = 'image/gif';
      else if (fileName.endsWith('.svg')) contentType = 'image/svg+xml';
      else if (fileName.endsWith('.webp')) contentType = 'image/webp';
      else if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(name || 'file')}"`);
    return res.send(fileBuffer);
  } catch (error) {
    console.error('[FileRoutes] Error streaming file:', error.message);
    return res.status(500).send('Failed to stream file');
  }
});

module.exports = router;
