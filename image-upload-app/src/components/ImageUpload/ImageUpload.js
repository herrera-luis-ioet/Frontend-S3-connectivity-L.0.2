import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, CircularProgress, Typography, LinearProgress, Alert, Fade, Backdrop } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import s3Service from '../../services/s3Service';

// Define ERROR_TYPES as a constant
export const ERROR_TYPES = {
  INVALID_TYPE: 'INVALID_TYPE',
  SIZE_EXCEEDED: 'SIZE_EXCEEDED',
  NO_VALID_FILES: 'NO_VALID_FILES'
};

// PUBLIC_INTERFACE
/**
 * Image Upload component with drag and drop functionality
 */
const ImageUpload = ({ 
  onUploadSuccess, 
  onUploadError, 
  onUploadStart = () => {}, 
  disabled = false 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragCounter, setDragCounter] = useState(0);
  const [error, setError] = useState('');


  const formatErrorMessage = useCallback((type, fileName) => {
    const messages = {
      [ERROR_TYPES.INVALID_TYPE]: `Invalid file type: "${fileName}" is not an image file`,
      [ERROR_TYPES.SIZE_EXCEEDED]: `File size exceeded: "${fileName}" is too large (max 5MB)`,
      [ERROR_TYPES.NO_VALID_FILES]: 'No valid files: Please provide at least one valid image file'
    };
    return messages[type] || 'An unknown error occurred';
  }, []);

  const validateFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) {
      throw new Error(formatErrorMessage(ERROR_TYPES.INVALID_TYPE, file.name));
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error(formatErrorMessage(ERROR_TYPES.SIZE_EXCEEDED, file.name));
    }
    return true;
  }, [formatErrorMessage]);

  const handleFiles = useCallback(async (fileList) => {
    if (fileList.length === 0 || disabled) return;

    setIsLoading(true);
    setUploadProgress(0);
    onUploadStart();

    try {
      const files = Array.from(fileList);
      const validFiles = [];
      const errors = [];

      for (const file of files) {
        try {
          if (validateFile(file)) {
            validFiles.push(file);
          }
        } catch (error) {
          errors.push(error.message);
        }
      }

      if (errors.length > 0) {
        const errorMessage = errors.join('\n');
        setError(errorMessage);
        onUploadError(errorMessage);
        if (validFiles.length === 0) {
          throw new Error(formatErrorMessage(ERROR_TYPES.NO_VALID_FILES));
        }
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
      data-testid="upload-area"
      role="region"
      aria-label="Image upload area"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Space') {
          e.preventDefault();
          document.getElementById('file-input').click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          const closeButton = document.querySelector('.MuiAlert-action button');
          if (closeButton && error) {
            closeButton.focus();
          }
        }
      }}
      onFocus={() => setError('')}
      sx={{
        border: 3,
        borderRadius: 2,
        borderColor: isDragging ? 'primary.main' : disabled ? 'grey.200' : 'grey.300',
        borderStyle: 'dashed',
        p: { xs: 2, sm: 3, md: 4, lg: 5 },
        textAlign: 'center',
        backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.12)' : disabled ? 'grey.100' : 'background.paper',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isDragging ? 'scale(1.02)' : 'scale(1.0)',
        boxShadow: isDragging ? '0 0 20px rgba(25, 118, 210, 0.4)' : 'none',
        position: 'relative',
        minHeight: { xs: '180px', sm: '220px', md: '280px', lg: '320px' },
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
        data-testid="file-input"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
        aria-label="Choose image files to upload"
      />
      <Box 
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-label="Upload error notification"
        sx={{
          position: 'absolute',
          top: { xs: 8, sm: 12, md: 16, lg: 20 },
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: { xs: '92%', sm: '88%', md: '84%', lg: '80%' },
          zIndex: 3,
        }}
      >
        <Fade 
          in={!!error}
          timeout={{
            enter: 400,
            exit: 300
          }}
          unmountOnExit
        >
          <Alert 
            severity="error"
            icon={<ErrorOutlineIcon fontSize="large" />}
            onClose={() => setError('')}
            sx={{
              width: '100%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              border: '1px solid #d32f2f',
              borderRadius: '8px',
              backgroundColor: 'rgba(211, 47, 47, 0.05)',
              '& .MuiAlert-icon': {
                fontSize: '2.5rem',
                color: '#d32f2f',
                alignItems: 'center'
              },
              '& .MuiAlert-message': {
                fontSize: '1rem',
                fontWeight: 500,
                padding: '8px 0'
              },
              '& .MuiAlert-action': {
                paddingTop: '8px',
                alignItems: 'center'
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Box 
              component="pre" 
              sx={{ 
                margin: 0, 
                whiteSpace: 'pre-line', 
                fontFamily: 'inherit',
                '& ::selection': {
                  backgroundColor: 'rgba(211, 47, 47, 0.15)'
                }
              }}
            >
              {error}
            </Box>
          </Alert>
        </Fade>
      </Box>
      <Backdrop
        open={isLoading}
        sx={{
          position: 'absolute',
          zIndex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(4px)',
        }}
      />
      {isLoading ? (
        <Box sx={{ width: '100%', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <Box sx={{ position: 'relative', mb: 3 }}>
            <CircularProgress 
              size={70}
              thickness={4.5}
              sx={{ 
                color: 'primary.main',
                animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
              size={70}
              thickness={4.5}
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
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backgroundImage: 'linear-gradient(90deg, #1976d2, #42a5f5)',
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
          <Box 
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}
            role="status"
            aria-live="polite"
          >
            <Typography 
              variant="body1" 
              color="primary" 
              component="div"
              sx={{ fontWeight: 500 }}
            >
              Uploading your images
              <Box 
                component="span" 
                sx={{ 
                  display: 'inline-block',
                  marginLeft: 1,
                  animation: 'ellipsis 1.4s infinite',
                  '@keyframes ellipsis': {
                    '0%': { content: "''" },
                    '33%': { content: "'.''" },
                    '66%': { content: "'..''" },
                    '100%': { content: "'...'" }
                  }
                }} 
              />
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
          {isDragging ? (
            <ImageIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          ) : (
            <CloudUploadIcon sx={{ 
              fontSize: { xs: 40, sm: 56, md: 64, lg: 72 }, 
              color: 'primary.main', 
              mb: { xs: 1, sm: 2 } 
            }} />
          )}
          <Box sx={{ mb: 2 }}>
            <Typography 
              variant="h6" 
              component="div"
              sx={{
                fontSize: { xs: '1rem', sm: '1.15rem', md: '1.35rem', lg: '1.5rem' },
                mb: 1
              }}
            >
              {isDragging ? 'Drop images here' : 'Drag and drop images here'}
            </Typography>
            <Typography 
              variant="body2" 
              color="textSecondary" 
              component="div"
              sx={{ mb: 1 }}
            >
              or click to select files
            </Typography>
            <Typography 
              variant="caption" 
              color="textSecondary" 
              component="div"
            >
              Supports: JPG, PNG, GIF (max 5MB per file)
            </Typography>
          </Box>
          <Button
            variant="contained"
            component="span"
            sx={{ 
              mt: { xs: 1.5, sm: 2, md: 2.5 },
              px: { xs: 2, sm: 3, md: 4 },
              py: { xs: 1, sm: 1.25, md: 1.5 },
              fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' }
            }}
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

export default ImageUpload;
