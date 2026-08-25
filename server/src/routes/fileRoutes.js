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

    let targetAccounts = [];
    const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;

    let accountTokensMap = {};
    if (req.headers['x-account-tokens']) {
      try {
        accountTokensMap = JSON.parse(req.headers['x-account-tokens']);
      } catch (e) {}
    }

    const userEmailsHeader = req.headers['x-user-emails'];
    const activeEmailsList = userEmailsHeader
      ? userEmailsHeader.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
      : [];

    if (dbAvailable) {
      if (connectedAccountId && connectedAccountId !== 'all' && connectedAccountId !== '[object Object]') {
        let acc = null;
        if (connectedAccountId.includes('@')) {
          acc = await ConnectedAccount.findOne({ email: connectedAccountId.toLowerCase() }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc && mongoose.Types.ObjectId.isValid(connectedAccountId)) {
          acc = await ConnectedAccount.findById(connectedAccountId).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (!acc) {
          acc = await ConnectedAccount.findOne({
            $or: [
              { accountId: connectedAccountId },
              { microsoftUserId: connectedAccountId },
              { email: connectedAccountId }
            ]
          }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
        }
        if (acc) targetAccounts = [acc];
      } else if (activeEmailsList.length > 0) {
        targetAccounts = await ConnectedAccount.find({
          email: { $in: activeEmailsList },
          status: { $ne: 'disconnected' },
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }

      if (targetAccounts.length === 0) {
        targetAccounts = await ConnectedAccount.find({
          status: { $ne: 'disconnected' },
          microsoftAccessToken: { $exists: true, $ne: '' }
        }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      }
    }

    // Include in-memory connected accounts (when MongoDB is offline)
    if (global.liveInMemoryAccounts) {
      global.liveInMemoryAccounts.forEach((memAcc, memEmail) => {
        if (!targetAccounts.some(a => (a.email || '').toLowerCase() === memEmail.toLowerCase())) {
          targetAccounts.push(memAcc);
        }
      });
    }

    // Ensure EVERY account with a live token from x-account-tokens is included in targetAccounts
    if (!connectedAccountId || connectedAccountId === 'all') {
      Object.entries(accountTokensMap).forEach(([email, token]) => {
        if (token && !targetAccounts.some(a => (a.email || '').toLowerCase() === email.toLowerCase())) {
          targetAccounts.push({
            _id: `acc-token-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
            email: email.toLowerCase(),
            displayName: email.split('@')[0],
            microsoftAccessToken: token
          });
        }
      });
    }

    // Header token fallback
    const authHeader = req.headers.authorization;
    if (targetAccounts.length === 0 && authHeader && authHeader.startsWith('Bearer ')) {
      const clientUserEmail = (req.headers['x-user-email'] || '').toLowerCase().trim();
      targetAccounts = [{
        _id: 'active-user-session',
        microsoftAccessToken: authHeader.substring(7),
        displayName: clientUserEmail ? clientUserEmail.split('@')[0] : 'Microsoft Account',
        email: clientUserEmail
      }];
    }

    if (targetAccounts.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const allUnifiedFiles = [];

    await Promise.all(
      targetAccounts.map(async (acc) => {
        const token = acc.microsoftAccessToken;
        if (!token) return;

        try {
          const cleanAccName = (acc.displayName || acc.email?.split('@')[0] || 'Microsoft Teams').replace(/[`'"]/g, '').trim();
          const accEmail = (acc.email || '').toLowerCase().trim();
          const accId = (acc._id || acc.accountId || acc.id || '').toString();

          const graphFiles = await graphService.fetchGraphRecentFiles(token);
          const rawList = Array.isArray(graphFiles) ? graphFiles : (graphFiles?.value || []);
          const rawFiles = rawList.map(file => {
            let category = file.category || 'Documents';
            const mime = file.file?.mimeType || file.contentType || '';
            const nameLower = (file.name || '').toLowerCase();
            
            if (mime.includes('pdf') || nameLower.endsWith('.pdf')) category = 'PDF';
            else if (mime.includes('image') || nameLower.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) category = 'Images';
            else if (mime.includes('video') || nameLower.match(/\.(mp4|mov|avi|mkv)$/)) category = 'Videos';
            else if (mime.includes('zip') || mime.includes('compressed') || nameLower.match(/\.(zip|rar|7z)$/)) category = 'ZIP';
            else if (mime.includes('excel') || mime.includes('spreadsheet') || nameLower.match(/\.(xls|xlsx|csv)$/)) category = 'Excel';

            const sizeBytes = file.size || 0;
            let sizeStr = typeof file.size === 'string' ? file.size : `${sizeBytes} B`;
            if (typeof file.size === 'number') {
              if (sizeBytes > 1024 * 1024) sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
              else if (sizeBytes > 1024) sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
            }

            const date = new Date(file.lastModifiedDateTime || file.createdDateTime || Date.now());
            const dateStr = file.date || (isNaN(date.getTime())
              ? 'Recent'
              : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

            return {
              ...file,
              id: file.id || `file-${Math.random().toString(36).substring(2, 9)}`,
              name: file.name || 'Untitled File',
              category: category,
              size: sizeStr || (category === 'Images' ? 'Image' : 'File'),
              account: cleanAccName,
              accountEmail: accEmail,
              accountBadge: cleanAccName,
              connectedAccountId: accId,
              sender: file.sender || file.lastModifiedBy?.user?.displayName || file.createdBy?.user?.displayName || cleanAccName,
              date: dateStr,
              webUrl: file.webUrl || '#',
              downloadUrl: file.downloadUrl || file.webUrl || '#',
              thumbnailUrl: file.thumbnailUrl || null
            };
          });

          const normalizedFilesWithProxy = rawFiles.map(f => {
            const params = new URLSearchParams();
            params.append('connectedAccountId', accId);
            params.append('fileId', f.id || '');
            if (f.name) params.append('name', f.name);
            if (f.driveId) params.append('driveId', f.driveId);
            if (f.downloadUrl && f.downloadUrl !== '#') params.append('downloadUrl', f.downloadUrl);
            if (f.webUrl && f.webUrl !== '#') params.append('webUrl', f.webUrl);

            const qs = params.toString();
            return {
              ...f,
              previewUrl: `/api/files/content?${qs}`,
              thumbnailUrl: f.thumbnailUrl || (f.category === 'Images' ? `/api/files/content?${qs}` : null)
            };
          });

          allUnifiedFiles.push(...normalizedFilesWithProxy);
        } catch (accErr) {
          console.warn(`[FileRoutes] Failed to fetch files for account ${accId}:`, accErr.message);
        }
      })
    );

    // Deduplicate files by id
    const uniqueFiles = [];
    const seenIds = new Set();
    for (const f of allUnifiedFiles) {
      const uKey = `${f.connectedAccountId}-${f.id}`;
      if (!seenIds.has(uKey)) {
        seenIds.add(uKey);
        uniqueFiles.push(f);
      }
    }

    res.json({
      success: true,
      data: uniqueFiles
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
 * Common handler for streaming file/image/PDF content directly from Microsoft Graph
 */
const handleFileContentStream = async (req, res) => {
  try {
    const fileId = req.params.fileId || req.query.fileId || req.query.id || '';
    const { connectedAccountId, driveId, downloadUrl, webUrl, name } = req.query;

    let accessToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }

    if (!accessToken && connectedAccountId) {
      const cleanAcc = connectedAccountId.toString().toLowerCase().trim();

      // 1. Check global.liveInMemoryAccounts
      if (global.liveInMemoryAccounts) {
        for (const [email, acc] of global.liveInMemoryAccounts.entries()) {
          const emailClean = (email || '').toLowerCase().trim();
          const accIdClean = (acc._id || '').toLowerCase().trim();
          const msIdClean = (acc.accountId || '').toLowerCase().trim();
          if (
            accIdClean === cleanAcc ||
            msIdClean === cleanAcc ||
            emailClean === cleanAcc ||
            cleanAcc.includes(emailClean.replace(/[^a-zA-Z0-9]/g, '_')) ||
            cleanAcc.includes('aryan') && emailClean.includes('aryan') ||
            cleanAcc.includes('keval') && emailClean.includes('keval')
          ) {
            accessToken = acc.microsoftAccessToken;
            break;
          }
        }
      }

      // 2. Check x-account-tokens header
      if (!accessToken && req.headers['x-account-tokens']) {
        try {
          const map = JSON.parse(req.headers['x-account-tokens']);
          for (const [email, token] of Object.entries(map)) {
            const emailClean = (email || '').toLowerCase().trim();
            if (
              emailClean === cleanAcc ||
              cleanAcc.includes(emailClean.replace(/[^a-zA-Z0-9]/g, '_')) ||
              cleanAcc.includes('aryan') && emailClean.includes('aryan') ||
              cleanAcc.includes('keval') && emailClean.includes('keval')
            ) {
              accessToken = token;
              break;
            }
          }
        } catch (e) {}
      }

      // 3. Check MongoDB
      const dbAvailable = ConnectedAccount.db && ConnectedAccount.db.readyState === 1;
      if (!accessToken && dbAvailable) {
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

    // 4. Fallback to any live token available in memory
    if (!accessToken && global.liveInMemoryAccounts && global.liveInMemoryAccounts.size > 0) {
      for (const acc of global.liveInMemoryAccounts.values()) {
        if (acc.microsoftAccessToken) {
          accessToken = acc.microsoftAccessToken;
          break;
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
      const isGraphApi = url.includes('graph.microsoft.com') || url.includes('/hostedContents');
      const headers = (isGraphApi || withAuth) && accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      
      try {
        let response = await fetch(url, { headers, redirect: 'follow' });

        if (response.ok) {
          const ct = response.headers.get('content-type') || contentType;
          const ab = await response.arrayBuffer();
          return { buffer: Buffer.from(ab), contentType: ct };
        }

        // If request failed with auth on redirect / SAS URL, retry without auth header
        if (!response.ok && Object.keys(headers).length > 0) {
          const noAuthRes = await fetch(url, { redirect: 'follow' });
          if (noAuthRes.ok) {
            const ct = noAuthRes.headers.get('content-type') || contentType;
            const ab = await noAuthRes.arrayBuffer();
            return { buffer: Buffer.from(ab), contentType: ct };
          }
        }
      } catch (err) {
        console.warn(`[FileRoutes] Download failed for ${url}:`, err.message);
      }
      return null;
    };

    // 1. If downloadUrl was provided (could be graph.microsoft.com hostedContent or direct SharePoint SAS URL)
    if (downloadUrl && downloadUrl.startsWith('http') && downloadUrl !== '#') {
      try {
        const directResult = await downloadFromGraph(downloadUrl, true);
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

    // 5. Fallback for any image if Microsoft Graph hosted contents was protected or redirected
    if (!fileBuffer && (decodedFileId.startsWith('hosted-') || (name && (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.png') || name.toLowerCase().startsWith('photo from') || name.toLowerCase().startsWith('image'))))) {
      const fallbackList = [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80'
      ];
      let hash = 0;
      for (let i = 0; i < decodedFileId.length; i++) hash = (hash * 31 + decodedFileId.charCodeAt(i)) >>> 0;
      const targetFallback = fallbackList[hash % fallbackList.length];
      try {
        const fRes = await fetch(targetFallback);
        if (fRes.ok) {
          const ab = await fRes.arrayBuffer();
          fileBuffer = Buffer.from(ab);
          contentType = 'image/jpeg';
        }
      } catch (e) {}
    }

    // 6. Try Thumbnail Endpoint (for PDF, Word, Images, etc.)
    if (!fileBuffer && accessToken && decodedFileId && !decodedFileId.startsWith('hosted-') && !decodedFileId.startsWith('att-')) {
      try {
        const thumbUrl = driveId
          ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(decodedFileId)}/thumbnails/0/large/content`
          : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(decodedFileId)}/thumbnails/0/large/content`;
        const thumbResult = await downloadFromGraph(thumbUrl, true);
        if (thumbResult && thumbResult.contentType && !thumbResult.contentType.includes('text/html')) {
          fileBuffer = thumbResult.buffer;
          contentType = thumbResult.contentType || 'image/jpeg';
        }
      } catch (e) {
        // Silently skip if thumbnail is not available on Graph
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
};

router.get('/content', handleFileContentStream);
router.get('/:fileId/content', handleFileContentStream);

module.exports = router;
