import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageUpload from '../ImageUpload';
import s3Service from '../../../services/s3Service';

// Mock s3Service
jest.mock('../../../services/s3Service');

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

describe('ImageUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnUploadError = jest.fn();
  const defaultProps = {
    onUploadSuccess: mockOnUploadSuccess,
    onUploadError: mockOnUploadError,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload area with correct text', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    expect(screen.getByText(/drag and drop images here/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to select files/i)).toBeInTheDocument();
    expect(screen.getByText(/supports: jpg, png, gif/i)).toBeInTheDocument();
  });

  it('handles drag enter and leave events', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const uploadArea = screen.getByText(/drag and drop images here/i).parentElement;

    await act(async () => {
      fireEvent.dragEnter(uploadArea);
    });
    expect(screen.getByText(/drop images here/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.dragLeave(uploadArea);
    });
    expect(screen.getByText(/drag and drop images here/i)).toBeInTheDocument();
  });

  it('validates file type correctly', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    const input = screen.getByLabelText('Choose image files to upload');

    // Test invalid file type
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(mockOnUploadError).toHaveBeenCalledWith('test.txt is not an image file');

    // Test valid file type
    s3Service.uploadImage.mockResolvedValueOnce('https://example.com/test.jpg');
    await act(async () => {
      fireEvent.change(input, { target: { files: [imageFile] } });
    });
    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(['https://example.com/test.jpg']);
    });
  });

  it('validates file size correctly', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const largeFile = new File(['test'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Choose image files to upload');

    await act(async () => {
      fireEvent.change(input, { target: { files: [largeFile] } });
    });

    expect(mockOnUploadError).toHaveBeenCalledWith('large.jpg is too large (max 5MB)');
  });

  it('handles multiple file upload correctly', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const files = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
    ];

    s3Service.uploadImage
      .mockResolvedValueOnce('https://example.com/test1.jpg')
      .mockResolvedValueOnce('https://example.com/test2.jpg');

    const input = screen.getByLabelText('Choose image files to upload');
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith([
        'https://example.com/test1.jpg',
        'https://example.com/test2.jpg',
      ]);
    });
  });

  it('shows upload progress during file upload', async () => {
    let resolvePromise;
    const uploadPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.uploadImage.mockImplementation(() => uploadPromise);

    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Choose image files to upload');

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const progressBar = await screen.findByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText('Uploading your images...')).toBeInTheDocument();

    await act(async () => {
      resolvePromise('https://example.com/test.jpg');
    });

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(['https://example.com/test.jpg']);
    });
  });

  it('handles upload errors correctly', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    s3Service.uploadImage.mockRejectedValueOnce(new Error('Upload failed'));

    const input = screen.getByLabelText('Choose image files to upload');
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(mockOnUploadError).toHaveBeenCalledWith('Upload failed');
  });

  // Visual feedback and animation tests
  it('shows hover state styles and animations on upload area', () => {
    render(<ImageUpload {...defaultProps} />);
    const uploadArea = screen.getByRole('region');

    // Test hover state
    fireEvent.mouseEnter(uploadArea);
    expect(uploadArea).toHaveClass('MuiBox-root');
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('border-color: rgb(25, 118, 210)'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('background-color: rgba(25, 118, 210, 0.08)'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('transform: scale(1.01)'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1)'));

    fireEvent.mouseLeave(uploadArea);
    expect(uploadArea).not.toHaveAttribute('style', expect.stringContaining('border-color: rgb(25, 118, 210)'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('transform: scale(1)'));
    expect(uploadArea).not.toHaveAttribute('style', expect.stringContaining('box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1)'));
  });

  it('shows drag state animations and visual feedback', async () => {
    render(<ImageUpload {...defaultProps} />);
    const uploadArea = screen.getByRole('region');

    // Test drag enter state
    await act(async () => {
      fireEvent.dragEnter(uploadArea);
    });
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('transform: scale(1.02)'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('box-shadow: 0 0 20px rgba(25, 118, 210, 0.4)'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('background-color: rgba(25, 118, 210, 0.12)'));
    expect(screen.getByText('Drop images here')).toBeInTheDocument();

    // Test drag leave state
    await act(async () => {
      fireEvent.dragLeave(uploadArea);
    });
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('transform: scale(1)'));
    expect(uploadArea).not.toHaveAttribute('style', expect.stringContaining('box-shadow: 0 0 20px rgba(25, 118, 210, 0.4)'));
    expect(screen.getByText('Drag and drop images here')).toBeInTheDocument();
  });

  it('shows correct loading indicator and progress during upload', async () => {
    render(<ImageUpload {...defaultProps} />);
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    s3Service.uploadImage.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve('https://example.com/test.jpg'), 100);
      });
    });

    const input = screen.getByLabelText('Choose image files to upload');
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Check loading indicators
    const progressBar = await screen.findByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText('Uploading your images...')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload progress')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(['https://example.com/test.jpg']);
    });
  });

  // Keyboard navigation tests
  it('handles keyboard navigation correctly', async () => {
    render(<ImageUpload {...defaultProps} />);
    const uploadArea = screen.getByRole('region');
    const input = screen.getByLabelText('Choose image files to upload');

    // Test Enter key
    await act(async () => {
      fireEvent.keyDown(uploadArea, { key: 'Enter' });
    });
    expect(mockFocus).toHaveBeenCalled();

    // Test Space key
    await act(async () => {
      fireEvent.keyDown(uploadArea, { key: ' ' });
    });
    expect(mockFocus).toHaveBeenCalled();

    // Test focus styles
    await act(async () => {
      fireEvent.focus(uploadArea);
    });
    expect(uploadArea).toHaveClass('MuiBox-root');
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('outline: 3px solid'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('outline-color: rgb(144, 202, 249)'));
  });

  // Responsive design tests
  describe('Responsive design behavior', () => {
    it('applies correct responsive styles for mobile viewport', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 600px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByRole('region');

      expect(uploadArea).toHaveClass('MuiBox-root');
      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('padding: 16px'));
      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('min-height: 200px'));

      const icon = screen.getByTestId('CloudUploadIcon');
      expect(icon).toHaveAttribute('style', expect.stringContaining('font-size: 48px'));

      const heading = screen.getByText('Drag and drop images here');
      expect(heading).toHaveAttribute('style', expect.stringContaining('font-size: 1.1rem'));
    });

    it('applies correct responsive styles for tablet viewport', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(min-width: 600px) and (max-width: 959px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByRole('region');

      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('padding: 24px'));
      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('min-height: 250px'));

      const icon = screen.getByTestId('CloudUploadIcon');
      expect(icon).toHaveAttribute('style', expect.stringContaining('font-size: 64px'));

      const heading = screen.getByText('Drag and drop images here');
      expect(heading).toHaveAttribute('style', expect.stringContaining('font-size: 1.25rem'));
    });

    it('applies correct responsive styles for desktop viewport', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(min-width: 960px)',
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByRole('region');

      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('padding: 32px'));
      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('min-height: 300px'));

      const icon = screen.getByTestId('CloudUploadIcon');
      expect(icon).toHaveAttribute('style', expect.stringContaining('font-size: 72px'));

      const heading = screen.getByText('Drag and drop images here');
      expect(heading).toHaveAttribute('style', expect.stringContaining('font-size: 1.5rem'));
    });
  });

  // Disabled state tests
  it('shows correct styles and behavior in disabled state', () => {
    render(<ImageUpload {...defaultProps} disabled={true} />);
    const uploadArea = screen.getByRole('region');

    expect(uploadArea).toHaveClass('MuiBox-root');
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('cursor: not-allowed'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('opacity: 0.7'));

    // Hover should not change styles in disabled state
    fireEvent.mouseEnter(uploadArea);
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('border-color: rgb(224, 224, 224)'));
    expect(uploadArea).toHaveAttribute('style', expect.stringContaining('background-color: rgb(245, 245, 245)'));

    // Drag events should not work in disabled state
    fireEvent.dragEnter(uploadArea);
    expect(screen.queryByText('Drop images here')).not.toBeInTheDocument();
  });
});
