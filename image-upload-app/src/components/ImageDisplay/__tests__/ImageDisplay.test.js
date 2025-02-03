import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageDisplay from '../ImageDisplay';
import s3Service from '../../../services/s3Service';

// Mock s3Service
jest.mock('../../../services/s3Service');

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockObjectUrl = 'blob:http://localhost/mock-url';
global.URL.createObjectURL = jest.fn(() => mockObjectUrl);
global.URL.revokeObjectURL = jest.fn();

// Mock window.matchMedia for responsive design tests
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};

// Mock focus management
const mockFocus = jest.fn();
HTMLElement.prototype.focus = mockFocus;

describe('ImageDisplay Component', () => {
  const mockImageUrls = [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the getImage response
    s3Service.getImage.mockImplementation(() => 
      Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))
    );
  });

  it('renders empty state when no images are provided', async () => {
    await act(async () => {
      render(<ImageDisplay imageUrls={[]} />);
    });
    expect(screen.getByText(/no images to display/i)).toBeInTheDocument();
  });

  it('renders loading state while fetching images', async () => {
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.getImage.mockImplementation(() => loadingPromise);

    await act(async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    await act(async () => {
      resolvePromise(new Blob(['test']));
      await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
    });

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('loads and displays images correctly', async () => {
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.getImage.mockImplementation(() => loadingPromise);

    await act(async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);
    });

    await act(async () => {
      resolvePromise(new Blob(['test']));
      await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
    });

    const images = await screen.findAllByRole('img');
    expect(images).toHaveLength(mockImageUrls.length);
    expect(s3Service.getImage).toHaveBeenCalledTimes(mockImageUrls.length);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles image loading errors correctly', async () => {
    s3Service.getImage.mockRejectedValueOnce(new Error('Failed to load image'));
    
    render(<ImageDisplay imageUrls={mockImageUrls} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load image')).toBeInTheDocument();
    });
  });

  it('handles sorting functionality correctly', async () => {
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.getImage.mockImplementation(() => loadingPromise);

    await act(async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);
    });

    await act(async () => {
      resolvePromise(new Blob(['test']));
      await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
    });

    const images = await screen.findAllByRole('img');
    expect(images).toHaveLength(mockImageUrls.length);

    // Test sort by name
    const sortSelect = screen.getByLabelText('Sort by');
    await act(async () => {
      fireEvent.mouseDown(sortSelect);
      fireEvent.click(screen.getByText('Name'));
    });

    // Test sort by size
    await act(async () => {
      fireEvent.mouseDown(sortSelect);
      fireEvent.click(screen.getByText('Size'));
    });

    // Test sort by date
    await act(async () => {
      fireEvent.mouseDown(sortSelect);
      fireEvent.click(screen.getByText('Date'));
    });
  });

  it('opens and closes image preview modal', async () => {
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.getImage.mockImplementation(() => loadingPromise);

    await act(async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);
    });

    await act(async () => {
      resolvePromise(new Blob(['test']));
      await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
    });

    const images = await screen.findAllByRole('img');
    expect(images).toHaveLength(mockImageUrls.length);

    // Click on first image to open modal
    await act(async () => {
      fireEvent.click(images[0]);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click close button
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Close image preview'));
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('creates thumbnails for images', async () => {
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.getImage.mockImplementation(() => loadingPromise);

    await act(async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);
    });

    await act(async () => {
      resolvePromise(new Blob(['test']));
      await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
    });

    const images = await screen.findAllByRole('img');
    expect(images).toHaveLength(mockImageUrls.length);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(mockImageUrls.length * 2); // Original + thumbnail
  });

  it('cleans up object URLs on unmount', async () => {
    const { unmount } = render(<ImageDisplay imageUrls={mockImageUrls} />);

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(mockImageUrls.length);
    });

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  // Visual feedback and animation tests
  describe('Visual feedback and animations', () => {
    it('shows hover effects and animations on image cards', async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);

      await waitFor(() => {
        expect(screen.getAllByRole('img')).toHaveLength(mockImageUrls.length);
      });

      const imageCard = screen.getAllByRole('listitem')[0];
      const image = screen.getAllByRole('img')[0];
      
      // Test card hover effects
      fireEvent.mouseEnter(imageCard);
      expect(imageCard).toHaveClass('MuiGrid-item');
      expect(imageCard).toHaveAttribute('style', expect.stringContaining('transform: translateY(-4px)'));
      expect(imageCard).toHaveAttribute('style', expect.stringContaining('transition: transform 0.2s ease-in-out'));

      // Test image hover effects
      expect(image).toHaveAttribute('style', expect.stringContaining('transform: scale(1.05)'));
      expect(image).toHaveAttribute('style', expect.stringContaining('transition: transform 0.3s ease-in-out'));

      fireEvent.mouseLeave(imageCard);
      expect(imageCard).not.toHaveAttribute('style', expect.stringContaining('transform: translateY(-4px)'));
      expect(image).not.toHaveAttribute('style', expect.stringContaining('transform: scale(1.05)'));
    });

    it('shows modal transition animations', async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);

      await waitFor(() => {
        expect(screen.getAllByRole('img')).toHaveLength(mockImageUrls.length);
      });

      // Open modal
      fireEvent.click(screen.getAllByRole('img')[0]);
      const modal = screen.getByRole('dialog');

      expect(modal).toHaveAttribute('style', expect.stringContaining('backdrop-filter: blur(5px)'));
      const modalContent = modal.firstChild;
      expect(modalContent).toHaveAttribute('style', expect.stringContaining('opacity: 1'));
      expect(modalContent).toHaveAttribute('style', expect.stringContaining('transform: scale(1)'));
      expect(modalContent).toHaveAttribute('style', expect.stringContaining('transition: transform 0.3s ease-out, opacity 0.3s ease-out'));

      // Test navigation button animations
      const prevButton = screen.getByLabelText('Previous image');
      const nextButton = screen.getByLabelText('Next image');

      fireEvent.mouseEnter(prevButton);
      expect(prevButton).toHaveAttribute('style', expect.stringContaining('transform: translateX(-4px)'));

      fireEvent.mouseEnter(nextButton);
      expect(nextButton).toHaveAttribute('style', expect.stringContaining('transform: translateX(4px)'));
    });

    it('shows loading animations with correct styles', async () => {
      let resolvePromise;
      const loadingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      s3Service.getImage.mockImplementation(() => loadingPromise);

      render(<ImageDisplay imageUrls={mockImageUrls} />);

      const loadingSpinner = await screen.findByRole('progressbar');
      expect(loadingSpinner).toBeInTheDocument();
      expect(loadingSpinner).toHaveClass('MuiCircularProgress-root');
      expect(loadingSpinner).toHaveAttribute('style', expect.stringContaining('animation'));

      await act(async () => {
        resolvePromise(new Blob(['test']));
        await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
      });

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('shows error state with visual feedback', async () => {
      s3Service.getImage.mockRejectedValueOnce(new Error('Failed to load image'));
      
      render(<ImageDisplay imageUrls={mockImageUrls} />);

      await waitFor(() => {
        const errorMessage = screen.getByText('Failed to load image');
        expect(errorMessage).toBeInTheDocument();
        
        const errorContainer = errorMessage.closest('div');
        expect(errorContainer).toHaveClass('MuiBox-root');
        expect(errorContainer).toHaveAttribute('style', expect.stringContaining('background-color: rgb(229, 115, 115)'));
        expect(errorContainer).toHaveAttribute('style', expect.stringContaining('color: rgb(255, 255, 255)'));
        
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toHaveClass('MuiButton-containedError');
        expect(retryButton).toHaveAttribute('style', expect.stringContaining('transition'));
      });
    });
  });

  it('shows loading animation while fetching images', async () => {
    let resolvePromise;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.getImage.mockImplementation(() => loadingPromise);

    render(<ImageDisplay imageUrls={mockImageUrls} />);

    const loadingSpinner = await screen.findByRole('progressbar');
    expect(loadingSpinner).toBeInTheDocument();
    expect(loadingSpinner).toHaveClass('MuiCircularProgress-root');
    expect(loadingSpinner).toHaveAttribute('style', expect.stringContaining('animation'));

    await act(async () => {
      resolvePromise(new Blob(['test']));
      await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
    });

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // Modal and keyboard navigation tests
  it('handles keyboard navigation in image preview modal', async () => {
    render(<ImageDisplay imageUrls={mockImageUrls} />);

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(mockImageUrls.length);
    });

    // Open modal
    fireEvent.click(screen.getAllByRole('img')[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Test arrow key navigation
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(screen.getByAltText(expect.stringContaining('Full size preview of'))).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    expect(screen.getByAltText(expect.stringContaining('Full size preview of'))).toBeInTheDocument();

    // Test escape key
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // Focus management tests
  it('manages focus correctly for accessibility', async () => {
    render(<ImageDisplay imageUrls={mockImageUrls} />);

    await act(async () => {
      await Promise.all(mockImageUrls.map(() => s3Service.getImage()));
    });

    const firstImage = await screen.findByRole('button');
    
    // Test focus styles
    await act(async () => {
      fireEvent.focus(firstImage);
    });
    expect(firstImage).toHaveClass('MuiCard-root');
    expect(firstImage).toHaveAttribute('style', expect.stringContaining('outline: 2px solid'));
    expect(firstImage).toHaveAttribute('style', expect.stringContaining('outline-color: rgb(25, 118, 210)'));

    // Test keyboard interaction
    await act(async () => {
      fireEvent.keyDown(firstImage, { key: 'Enter' });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Test focus trap in modal
    expect(mockFocus).toHaveBeenCalled();
  });

  // Responsive layout tests
  describe('Responsive layout behavior', () => {
    it('applies correct responsive styles for mobile viewport', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 600px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      render(<ImageDisplay imageUrls={mockImageUrls} />);
      const grid = screen.getByRole('list');
      const container = grid.parentElement;

      expect(grid).toHaveClass('MuiGrid-container');
      expect(grid).toHaveAttribute('style', expect.stringContaining('margin: 0px'));
      expect(grid).toHaveAttribute('style', expect.stringContaining('width: 100%'));
      expect(container).toHaveAttribute('style', expect.stringContaining('padding: 8px'));

      // Check grid item sizes
      const gridItems = screen.getAllByRole('listitem');
      gridItems.forEach(item => {
        expect(item).toHaveAttribute('class', expect.stringContaining('MuiGrid-grid-xs-12'));
      });
    });

    it('applies correct responsive styles for tablet viewport', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(min-width: 600px) and (max-width: 959px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      render(<ImageDisplay imageUrls={mockImageUrls} />);
      const grid = screen.getByRole('list');
      const container = grid.parentElement;

      expect(grid).toHaveAttribute('style', expect.stringContaining('margin: 8px -8px'));
      expect(container).toHaveAttribute('style', expect.stringContaining('padding: 16px'));

      // Check grid item sizes
      const gridItems = screen.getAllByRole('listitem');
      gridItems.forEach(item => {
        expect(item).toHaveAttribute('class', expect.stringContaining('MuiGrid-grid-sm-6'));
      });
    });

    it('applies correct responsive styles for desktop viewport', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(min-width: 960px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      render(<ImageDisplay imageUrls={mockImageUrls} />);
      const grid = screen.getByRole('list');
      const container = grid.parentElement;

      expect(grid).toHaveAttribute('style', expect.stringContaining('margin: 16px -16px'));
      expect(grid).toHaveAttribute('style', expect.stringContaining('width: auto'));
      expect(container).toHaveAttribute('style', expect.stringContaining('padding: 24px'));

      // Check grid item sizes
      const gridItems = screen.getAllByRole('listitem');
      gridItems.forEach(item => {
        expect(item).toHaveAttribute('class', expect.stringContaining('MuiGrid-grid-md-4'));
        expect(item).toHaveAttribute('class', expect.stringContaining('MuiGrid-grid-lg-3'));
      });
    });

    it('applies correct responsive styles for modal', async () => {
      render(<ImageDisplay imageUrls={mockImageUrls} />);

      await waitFor(() => {
        expect(screen.getAllByRole('img')).toHaveLength(mockImageUrls.length);
      });

      // Open modal
      fireEvent.click(screen.getAllByRole('img')[0]);
      const modal = screen.getByRole('dialog');
      const modalContent = modal.firstChild;

      // Mobile viewport
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 600px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      expect(modalContent).toHaveAttribute('style', expect.stringContaining('max-width: 90vw'));
      expect(modalContent).toHaveAttribute('style', expect.stringContaining('max-height: 90vh'));
      expect(modalContent).toHaveAttribute('style', expect.stringContaining('padding: 16px'));

      // Desktop viewport
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(min-width: 960px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      expect(modalContent).toHaveAttribute('style', expect.stringContaining('padding: 24px'));
    });
  });

  // Sort functionality with animation
  it('shows animation when sorting images', async () => {
    render(<ImageDisplay imageUrls={mockImageUrls} />);

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(mockImageUrls.length);
    });

    const sortSelect = screen.getByLabelText('Sort by');
    fireEvent.mouseDown(sortSelect);
    fireEvent.click(screen.getByText('Name'));

    const imageCards = screen.getAllByRole('listitem');
    imageCards.forEach(card => {
      expect(card).toHaveClass('MuiGrid-item');
      expect(card).toHaveAttribute('style', expect.stringContaining('transition: transform 0.2s ease-in-out'));
    });
  });

  // Error state visual feedback
  it('shows visual feedback for image loading errors', async () => {
    s3Service.getImage.mockRejectedValueOnce(new Error('Failed to load image'));
    
    render(<ImageDisplay imageUrls={mockImageUrls} />);

    await waitFor(() => {
      const errorMessage = screen.getByText('Failed to load image');
      expect(errorMessage).toBeInTheDocument();
      const errorContainer = errorMessage.closest('div');
      expect(errorContainer).toHaveClass('MuiBox-root');
      expect(errorContainer).toHaveAttribute('style', expect.stringContaining('background-color: rgb(229, 115, 115)'));
      expect(errorContainer).toHaveAttribute('style', expect.stringContaining('color: rgb(255, 255, 255)'));
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toHaveClass('MuiButton-containedError');
  });
});
