import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  CircularProgress,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Modal,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import s3Service from '../../services/s3Service';

// PUBLIC_INTERFACE
/**
 * Image Display component for showing uploaded images in a grid layout with sorting and preview features
 * @param {Object} props - Component props
 * @param {Array<string>} props.imageUrls - Array of image URLs to display
 */
const ImageDisplay = ({ imageUrls = [] }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [images, setImages] = useState([]);
  const [loadingStates, setLoadingStates] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [modalOpen, setModalOpen] = useState(false);

  const loadImages = useCallback(async () => {
    if (!imageUrls.length) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadedImages = await Promise.all(
        imageUrls.map(async (url) => {
          const fileName = url.split('/').pop();
          setLoadingStates(prev => ({ ...prev, [fileName]: true }));
          try {
            const blob = await s3Service.getImage(fileName);
            const objectUrl = URL.createObjectURL(blob);
            setLoadingStates(prev => ({ ...prev, [fileName]: false }));
            setImageErrors(prev => ({ ...prev, [fileName]: null }));
            return {
              id: fileName,
              url: objectUrl,
              name: fileName,
              size: blob.size,
              date: new Date(url.split('?')[0]).getTime() || Date.now(),
              thumbnail: await createThumbnail(blob),
            };
          } catch (err) {
            setImageErrors(prev => ({ ...prev, [fileName]: 'Failed to load image' }));
            setLoadingStates(prev => ({ ...prev, [fileName]: false }));
            console.error(`Error loading image ${fileName}:`, err);
            return null;
          }
        })
      );

      setImages(loadedImages.filter(Boolean));
    } catch (err) {
      setError('Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [imageUrls]);

  useEffect(() => {
    loadImages();
    return () => {
      // Cleanup object URLs
      images.forEach((image) => {
        URL.revokeObjectURL(image.url);
        URL.revokeObjectURL(image.thumbnail);
      });
    };
  }, [loadImages, images]);

  const createThumbnail = async (blob) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((thumbnailBlob) => {
          resolve(URL.createObjectURL(thumbnailBlob));
        }, 'image/jpeg', 0.7);
      };
      img.src = URL.createObjectURL(blob);
    });
  };

  const handleSort = (event) => {
    const value = event.target.value;
    setSortBy(value);
    
    const sortedImages = [...images].sort((a, b) => {
      switch (value) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'date':
        default:
          return b.date - a.date;
      }
    });
    
    setImages(sortedImages);
  };

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedImage(null);
  };

  if (!imageUrls.length) {
    return (
      <Typography variant="body1" align="center">
        No images to display
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%', p: { xs: 1, sm: 2, md: 3 } }}>
      <Box sx={{ 
        mb: { xs: 1, sm: 2 }, 
        display: 'flex', 
        justifyContent: 'flex-end',
        px: { xs: 1, sm: 0 }
      }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="sort-select-label">Sort by</InputLabel>
          <Select
            labelId="sort-select-label"
            id="sort-select"
            value={sortBy}
            label="Sort by"
            onChange={handleSort}
            startAdornment={<SortIcon sx={{ mr: 1 }} aria-hidden="true" />}
            aria-label="Sort images by"
          >
            <MenuItem value="date">Date</MenuItem>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="size">Size</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress aria-label="Loading images" />
        </Box>
      )}

      {error && (
        <Typography color="error" variant="body1" align="center" role="alert">
          {error}
        </Typography>
      )}

      <Grid 
        container 
        spacing={{ xs: 1, sm: 2, md: 3 }}
        role="list"
        aria-label="Image grid"
        sx={{ 
          mt: { xs: 1, sm: 2 },
          mx: { xs: -1, sm: -2 },
          width: 'auto',
          '& .MuiGrid-item': {
            display: 'flex',
            padding: { xs: 1, sm: 2 },
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
            }
          },
          '@media (max-width: 600px)': {
            mx: 0,
            width: '100%',
            '& .MuiGrid-item': {
              padding: 1
            }
          }
        }}
      >
        {images.map((image) => (
          <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={image.id} role="listitem">
            <Card
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleImageClick(image);
                }
              }}
              aria-label={`View ${image.name}`}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 6,
                },
                '&:focus': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                },
              }}
              onClick={() => handleImageClick(image)}
            >
              <Box 
                sx={{ 
                  position: 'relative', 
                  pt: '75%',
                  backgroundColor: 'grey.100'
                }}
              >
                {imageErrors[image.id] ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      backgroundColor: 'error.light',
                      color: 'error.contrastText',
                      p: 2,
                    }}
                  >
                    <Typography variant="body2" align="center" gutterBottom role="alert">
                      Failed to load image
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadImages();
                      }}
                      aria-label={`Retry loading ${image.name}`}
                    >
                      Retry
                    </Button>
                  </Box>
                ) : loadingStates[image.id] ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CircularProgress 
                      size={40} 
                      aria-label={`Loading ${image.name}`}
                    />
                  </Box>
                ) : (
                  <CardMedia
                    component="img"
                    image={image.thumbnail}
                    alt={image.name}
                    loading="lazy"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.05)',
                      },
                    }}
                  />
                )}
                <IconButton
                  aria-label={`Zoom in ${image.name}`}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    },
                  }}
                >
                  <ZoomInIcon aria-hidden="true" />
                </IconButton>
              </Box>
              <CardContent sx={{ flexGrow: 1, p: 1 }}>
                <Typography variant="body2" noWrap>
                  {image.name}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        aria-labelledby="image-preview-title"
        aria-describedby="image-preview-description"
        closeAfterTransition
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            handleCloseModal();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const currentIndex = images.findIndex(img => img.id === selectedImage?.id);
            if (currentIndex === -1) return;
              
            let newIndex;
            if (e.key === 'ArrowLeft') {
              newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
            } else {
              newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
            }
            setSelectedImage(images[newIndex]);
          }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
            opacity: modalOpen ? 1 : 0,
            transform: modalOpen ? 'scale(1)' : 'scale(0.95)',
            transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
          }}
        >
          <IconButton
            onClick={handleCloseModal}
            aria-label="Close image preview"
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              zIndex: 1,
            }}
          >
            <CloseIcon aria-hidden="true" />
          </IconButton>
          {selectedImage && (
            <>
              <Typography id="image-preview-title" variant="h6" sx={{ position: 'absolute', left: -9999 }}>
                Image Preview: {selectedImage.name}
              </Typography>
              <Typography id="image-preview-description" sx={{ position: 'absolute', left: -9999 }}>
                Full size preview of {selectedImage.name}
              </Typography>
              <Box 
                sx={{ 
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 1,
                    }
                  }}
                >
                  <img
                    src={selectedImage.url}
                    alt={`Full size preview of ${selectedImage.name}`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 'calc(90vh - 100px)',
                      objectFit: 'contain',
                      opacity: 0,
                      animation: 'fadeIn 0.3s ease-out forwards',
                      borderRadius: '4px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    opacity: 0,
                    transform: 'translateY(20px)',
                    animation: 'slideUp 0.3s ease-out 0.2s forwards',
                    '@keyframes slideUp': {
                      to: {
                        opacity: 1,
                        transform: 'translateY(0)',
                      },
                    },
                    '@keyframes fadeIn': {
                      to: {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = images.findIndex(img => img.id === selectedImage.id);
                      if (currentIndex > 0) {
                        setSelectedImage(images[currentIndex - 1]);
                      }
                    }}
                    disabled={images.findIndex(img => img.id === selectedImage.id) === 0}
                    aria-label="Previous image"
                    sx={{
                      minWidth: '120px',
                      '&:not(:disabled):hover': {
                        transform: 'translateX(-4px)',
                      },
                      transition: 'transform 0.2s ease-in-out',
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = images.findIndex(img => img.id === selectedImage.id);
                      if (currentIndex < images.length - 1) {
                        setSelectedImage(images[currentIndex + 1]);
                      }
                    }}
                    disabled={images.findIndex(img => img.id === selectedImage.id) === images.length - 1}
                    aria-label="Next image"
                    sx={{
                      minWidth: '120px',
                      '&:not(:disabled):hover': {
                        transform: 'translateX(4px)',
                      },
                      transition: 'transform 0.2s ease-in-out',
                    }}
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
};

ImageDisplay.propTypes = {
  imageUrls: PropTypes.arrayOf(PropTypes.string),
};

export default ImageDisplay;
