import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, CircularProgress, Typography, LinearProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';
import s3Service from '../../services/s3Service';

// PUBLIC_INTERFACE
/**
 * Image Upload component with drag and drop functionality
 */
const ImageUpload = ({ onUploadSuccess, onUploadError, onUploadStart, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragCounter, setDragCounter] = useState(0);
  const [, setError] = useState('');

  const validateFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) {
      throw new Error(`${file.name} is not an image file`);
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error(`${file.name} is too large (max 5MB)`);
    }
    return true;
  }, []);

  const handleFiles = useCallback(async (files) => {
    if (files.length === 0 || disabled) return;

    setIsLoading(true);
    setUploadProgress(0);
    onUploadStart();

    try {
      const validFiles = files.filter(file => {
        try {
          return validateFile(file);
        } catch (error) {
          setError(error.message);
          onUploadError(error.message);
          return false;
        }
      });

      if (validFiles.length === 0) {
        throw new Error('No valid files to upload');
      }

      const uploadPromises = validFiles.map(async (file) => {
        const fileName = `${Date.now()}-${file.name}`;
        const url = await s3Service.uploadImage(file, fileName);
        setUploadProgress(prev => prev + (100 / validFiles.length));
        return url;
      });

      const urls = await Promise.all(uploadPromises);
      onUploadSuccess(urls);
    } catch (error) {
      setError(error.message);
      onUploadError(error.message);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  }, [disabled, onUploadError, onUploadStart, onUploadSuccess, validateFile]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setDragCounter(prev => prev + 1);
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setDragCounter(prev => prev - 1);
      if (dragCounter - 1 === 0) {
        setIsDragging(false);
      }
    }
  }, [dragCounter, disabled]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setDragCounter(0);
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      await handleFiles(files);
    }
  }, [disabled, handleFiles]);

  const handleFileInput = useCallback(async (e) => {
    if (!disabled) {
      const files = e.target.files;
      await handleFiles(files);
    }
  }, [disabled, handleFiles]);

  return (
    <Box
      role="region"
      aria-label="Image upload area"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.getElementById('file-input').click();
        }
      }}
      sx={{
        border: 3,
        borderRadius: 2,
        borderColor: isDragging ? 'primary.main' : disabled ? 'grey.200' : 'grey.300',
        borderStyle: 'dashed',
        p: { xs: 2, sm: 3, md: 4 },
        textAlign: 'center',
        backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.12)' : disabled ? 'grey.100' : 'background.paper',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isDragging ? '0 0 20px rgba(25, 118, 210, 0.4)' : 'none',
        position: 'relative',
        minHeight: { xs: '200px', sm: '250px', md: '300px' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.7 : 1,
        outline: 'none',
        '&:hover': {
          borderColor: disabled ? 'grey.200' : 'primary.main',
          backgroundColor: disabled ? 'grey.100' : 'rgba(25, 118, 210, 0.08)',
          transform: disabled ? 'none' : 'scale(1.01)',
          boxShadow: disabled ? 'none' : '0 4px 20px rgba(0, 0, 0, 0.1)',
        },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.light',
          outlineOffset: '2px',
        },
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input').click()}
    >
      <input
        type="file"
        id="file-input"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
        aria-label="Choose image files to upload"
      />
      {isLoading ? (
        <Box sx={{ width: '100%', textAlign: 'center' }}>
          <Box sx={{ position: 'relative', mb: 3 }}>
            <CircularProgress 
              size={60}
              thickness={4}
              sx={{ 
                color: 'primary.main',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1,
                  },
                  '50%': {
                    opacity: 0.5,
                  },
                },
              }}
              aria-label="Upload in progress"
            />
            <CircularProgress 
              size={60}
              thickness={4}
              sx={{ 
                position: 'absolute',
                left: 0,
                color: 'primary.light',
                opacity: 0.3,
              }}
            />
          </Box>
          <Box sx={{ position: 'relative', display: 'inline-flex', width: '100%', alignItems: 'center', mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(uploadProgress)}
              aria-label="Upload progress"
              sx={{ 
                width: '100%',
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(25, 118, 210, 0.12)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 4,
                  animation: 'shimmer 2s infinite linear',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  '@keyframes shimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' }
                  }
                }
              }} 
            />
            <Typography 
              variant="body2" 
              color="primary"
              sx={{ 
                position: 'absolute',
                right: -40,
                fontWeight: 'bold'
              }}
            >
              {Math.round(uploadProgress)}%
            </Typography>
          </Box>
          <Typography 
            variant="body1" 
            color="primary" 
            sx={{ fontWeight: 500 }}
            role="status"
            aria-live="polite"
          >
            Uploading your images...
          </Typography>
        </Box>
      ) : (
        <>
          {isDragging ? (
            <ImageIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          ) : (
            <CloudUploadIcon sx={{ 
              fontSize: { xs: 48, sm: 64, md: 72 }, 
              color: 'primary.main', 
              mb: { xs: 1, sm: 2 } 
            }} />
          )}
          <Typography 
            variant="h6" 
            gutterBottom
            sx={{
              fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' }
            }}
          >
            {isDragging ? 'Drop images here' : 'Drag and drop images here'}
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            or click to select files
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
            Supports: JPG, PNG, GIF (max 5MB per file)
          </Typography>
          <Button
            variant="contained"
            component="span"
            sx={{ mt: 2 }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select images to upload"
          >
            Select Images
          </Button>
        </>
      )}
    </Box>
  );
};

ImageUpload.propTypes = {
  onUploadSuccess: PropTypes.func.isRequired,
  onUploadError: PropTypes.func.isRequired,
  onUploadStart: PropTypes.func,
  disabled: PropTypes.bool,
};

ImageUpload.defaultProps = {
  onUploadStart: () => {},
  disabled: false,
};

export default ImageUpload;
