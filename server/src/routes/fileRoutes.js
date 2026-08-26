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

    const authHeader = req.headers.authorization;
    const clientUserEmail = (req.headers['x-user-email'] || '').toLowerCase().trim();

    // 1. Populate from accountTokensMap
    Object.entries(accountTokensMap).forEach(([email, token]) => {
      const cleanEmail = email.toLowerCase().trim();
      if (token && !targetAccounts.some(a => (a.email || '').toLowerCase() === cleanEmail)) {
        targetAccounts.push({
          _id: `acc-token-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0],
          microsoftAccessToken: token
        });
      }
    });

    // 2. Add from DB if available
    if (dbAvailable) {
      const dbAccs = await ConnectedAccount.find({
        microsoftAccessToken: { $exists: true, $ne: '' }
      }).select('+microsoftAccessToken +tokenExpiresAt email displayName');
      dbAccs.forEach(acc => {
        const cleanEmail = (acc.email || '').toLowerCase().trim();
        if (cleanEmail && !targetAccounts.some(a => (a.email || '').toLowerCase() === cleanEmail)) {
          targetAccounts.push(acc);
        }
      });
    }

    // 3. Add from in-memory accounts
    if (global.liveInMemoryAccounts) {
      global.liveInMemoryAccounts.forEach((memAcc, memEmail) => {
        const cleanEmail = memEmail.toLowerCase().trim();
        if (memAcc.status !== 'disconnected' && !targetAccounts.some(a => (a.email || '').toLowerCase() === cleanEmail)) {
          targetAccounts.push(memAcc);
        }
      });
    }

    // 4. Header token fallback
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const email = clientUserEmail || 'default-account';
        if (!targetAccounts.some(a => (a.email || '').toLowerCase() === email)) {
          targetAccounts.push({
            _id: 'active-user-session',
            microsoftAccessToken: token,
            displayName: email.split('@')[0],
            email: email
          });
        }
      }
    }

    // Filter by specific connectedAccountId if requested
    if (connectedAccountId && connectedAccountId !== 'all' && connectedAccountId !== '[object Object]') {
      const filterKey = connectedAccountId.toLowerCase().trim();
      const matched = targetAccounts.filter(a => {
        const aEmail = (a.email || '').toLowerCase().trim();
        const aId = (a._id || a.accountId || '').toString().toLowerCase().trim();
        return aEmail === filterKey || aId === filterKey || aEmail.includes(filterKey) || filterKey.includes(aEmail) ||
               (filterKey.includes('aryan') && aEmail.includes('aryan')) ||
               (filterKey.includes('keval') && aEmail.includes('keval'));
      });
      if (matched.length > 0) {
        targetAccounts = matched;
      }
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
            else if (mime.includes('image') || nameLower.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|tif|tiff|heic)$/) || nameLower.startsWith('photo from') || nameLower.startsWith('image')) category = 'Images';
            else if (mime.includes('video') || nameLower.match(/\.(mp4|mov|avi|mkv|webm|wmv|flv)$/)) category = 'Videos';
            else if (mime.includes('zip') || mime.includes('compressed') || nameLower.match(/\.(zip|rar|7z|tar|gz)$/)) category = 'ZIP';
            else if (mime.includes('excel') || mime.includes('spreadsheet') || nameLower.match(/\.(xls|xlsx|csv|tsv|ods)$/)) category = 'Excel';
            else category = 'Documents';

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

    // Helper: fetch binary from URL, sending Bearer token to Microsoft Graph endpoints, trying all connected account tokens
    const downloadFromGraph = async (url, withAuth = false) => {
      const isGraphApi = url.includes('graph.microsoft.com') || url.includes('/hostedContents');
      const tokensToTry = [];
      if (accessToken) tokensToTry.push(accessToken);
      if (global.liveInMemoryAccounts) {
        for (const acc of global.liveInMemoryAccounts.values()) {
          if (acc.microsoftAccessToken && !tokensToTry.includes(acc.microsoftAccessToken)) {
            tokensToTry.push(acc.microsoftAccessToken);
          }
        }
      }
      if (tokensToTry.length === 0) tokensToTry.push(null);

      for (const t of tokensToTry) {
        const headers = (isGraphApi || withAuth) && t ? { Authorization: `Bearer ${t}` } : {};
        try {
          let response = await fetch(url, { headers, redirect: 'follow' });

          if (response.ok) {
            const ct = response.headers.get('content-type') || contentType;
            if (!ct.includes('text/html')) {
              const ab = await response.arrayBuffer();
              return { buffer: Buffer.from(ab), contentType: ct };
            }
          }

          // If request failed with auth on redirect / SAS URL, retry without auth header
          if (!response.ok && Object.keys(headers).length > 0) {
            const noAuthRes = await fetch(url, { redirect: 'follow' });
            if (noAuthRes.ok) {
              const ct = noAuthRes.headers.get('content-type') || contentType;
              if (!ct.includes('text/html')) {
                const ab = await noAuthRes.arrayBuffer();
                return { buffer: Buffer.from(ab), contentType: ct };
              }
            }
          }
        } catch (err) {}
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
    if (!fileBuffer && decodedFileId.startsWith('hosted-')) {
      try {
        // Find exact hosted URL if available from targetWebUrl or reconstruct
        const hostedTarget = (downloadUrl && downloadUrl.includes('hostedContents')) ? downloadUrl : null;
        if (hostedTarget) {
          const hostedResult = await downloadFromGraph(hostedTarget, true);
          if (hostedResult) {
            fileBuffer = hostedResult.buffer;
            contentType = hostedResult.contentType || 'image/png';
          }
        }
      } catch (e) {}
    }

    // 3. Drive Item Content with specific driveId (for shared files or group files)
    if (!fileBuffer && driveId) {
      try {
        const driveContentUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(decodedFileId)}/content`;
        const result = await downloadFromGraph(driveContentUrl, true);
        if (result) {
          fileBuffer = result.buffer;
          contentType = result.contentType;
        }
      } catch (e) {}
    }

    // 4. User's Personal Drive Content
    if (!fileBuffer) {
      try {
        const graphContentUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(decodedFileId)}/content`;
        const result = await downloadFromGraph(graphContentUrl, true);
        if (result) {
          fileBuffer = result.buffer;
          contentType = result.contentType;
        }
      } catch (e) {}
    }

    // 5. SharePoint / OneDrive Sharing URL via Shares API
    const targetWebUrl = (webUrl && webUrl !== '#') ? webUrl : (decodedFileId.startsWith('http') ? decodedFileId : null);
    if (!fileBuffer && targetWebUrl && targetWebUrl.startsWith('http')) {
      try {
        const cleanUrl = targetWebUrl.split('?')[0];
        const shareId = 'u!' + Buffer.from(cleanUrl, 'utf8').toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
        const shareUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`;
        const shareResult = await downloadFromGraph(shareUrl, true);
        if (shareResult) {
          fileBuffer = shareResult.buffer;
          contentType = shareResult.contentType;
        }
      } catch (e) {}
    }

    // 6. Try Thumbnail Endpoint (for PDF, Word, Images, etc.)
    if (!fileBuffer && decodedFileId && !decodedFileId.startsWith('hosted-') && !decodedFileId.startsWith('att-')) {
      try {
        const thumbUrl = driveId
          ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(decodedFileId)}/thumbnails/0/large/content`
          : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(decodedFileId)}/thumbnails/0/large/content`;
        const thumbResult = await downloadFromGraph(thumbUrl, true);
        if (thumbResult && thumbResult.contentType && !thumbResult.contentType.includes('text/html')) {
          fileBuffer = thumbResult.buffer;
          contentType = thumbResult.contentType || 'image/jpeg';
        }
      } catch (e) {}
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
