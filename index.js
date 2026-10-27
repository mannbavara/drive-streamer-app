const express = require('express');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google Drive API Client using environment variable
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

app.use(express.static('public'));

// Endpoint to list files in the Drive folder
app.get('/api/files', async (req, res) => {
  try {
    const folderId = process.env.DRIVE_FOLDER_ID;
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
    });
    
    // Filter for streamable media (optional)
    const mediaFiles = response.data.files.filter(f => 
      f.mimeType.startsWith('video/') || f.mimeType.startsWith('audio/')
    );
    
    res.json(mediaFiles);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).send('Error fetching files');
  }
});

// Endpoint to stream the file
app.get('/api/stream/:id', async (req, res) => {
  const fileId = req.params.id;
  
  try {
    // Pass the client's Range header to Google Drive for partial content streaming
    const options = { fileId, alt: 'media' };
    const requestConfig = {
      responseType: 'stream',
      headers: { Range: req.headers.range || '' }
    };

    const response = await drive.files.get(options, requestConfig);

    // Forward the necessary headers back to the client player
    res.status(response.status);
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }

    // Pipe the Drive stream to the response
    response.data.pipe(res);
  } catch (error) {
    console.error('Error streaming file:', error);
    res.status(500).send('Error streaming file');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});