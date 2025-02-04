import { useState, useCallback } from 'react';
import { Container, Box, Alert, Snackbar, Typography, CircularProgress } from '@mui/material';
import './App.css';
import ImageUpload from './components/ImageUpload/ImageUpload';
import ImageDisplay from './components/ImageDisplay/ImageDisplay';

// PUBLIC_INTERFACE
/**
 * Main application component that handles image upload and display
 */
function App() {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadSuccess = useCallback((urls) => {
    setUploadedImages(prevUrls => [...prevUrls, ...urls]);
    setError(null);
    setSuccess('Upload successful');
    setIsLoading(false);
  }, []);

  const handleUploadError = useCallback((errorMessage) => {
    setError(errorMessage);
    setIsLoading(false);
  }, []);

  const handleUploadStart = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  return (
    <div className="App">
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ my: 4 }}>
          Image Upload and Display Component
        </Typography>
        <Box sx={{ my: 4, position: 'relative' }}>
          <ImageUpload
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
            onUploadStart={handleUploadStart}
            disabled={isLoading}
          />
          {isLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                zIndex: 1,
              }}
            >
              <CircularProgress />
            </Box>
          )}
        </Box>
        <Box sx={{ my: 4 }}>
          <ImageDisplay imageUrls={uploadedImages} />
        </Box>
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {error}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!success}
          autoHideDuration={3000}
          onClose={() => setSuccess(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            severity="success" 
            onClose={() => setSuccess(null)}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {success}
          </Alert>
        </Snackbar>
      </Container>
    </div>
  );
}

export default App;
