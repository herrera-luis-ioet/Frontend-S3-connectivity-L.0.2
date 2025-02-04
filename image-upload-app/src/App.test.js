import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import s3Service from './services/s3Service';

// Mock s3Service
jest.mock('./services/s3Service');

describe('App Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('renders main heading', async () => {
    await act(async () => {
      render(<App />);
    });
    const headingElement = screen.getByRole('heading', { 
      name: /Image Upload and Display Component/i 
    });
    expect(headingElement).toBeInTheDocument();
  });

  test('renders ImageUpload component with proper elements', async () => {
    await act(async () => {
      render(<App />);
    });
    const uploadArea = screen.getByTestId('drop-zone');
    const uploadText = screen.getByText(/Drag and drop images here/i);
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    
    expect(uploadArea).toBeInTheDocument();
    expect(uploadText).toBeInTheDocument();
    expect(uploadButton).toBeInTheDocument();
  });

  test('renders ImageDisplay component in initial state', async () => {
    await act(async () => {
      render(<App />);
    });
    const noImagesText = screen.getByText(/No images to display/i);
    const sortButton = screen.getByRole('button', { name: /sort/i });
    
    expect(noImagesText).toBeInTheDocument();
    expect(sortButton).toBeInTheDocument();
  });

  test('handles successful image upload', async () => {
    // Mock successful upload
    const mockUrl = 'https://test-bucket.s3.region.amazonaws.com/test.png';
    s3Service.uploadImage.mockResolvedValueOnce(mockUrl);

    await act(async () => {
      render(<App />);
    });
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test image'], 'test.png', { type: 'image/png' });
    
    // Trigger file upload
    await act(async () => {
      await userEvent.upload(fileInput, file);
    });
    
    // Check loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText(/Upload successful/i)).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Verify s3Service was called correctly
    expect(s3Service.uploadImage).toHaveBeenCalledWith(file, expect.any(String));
  });

  test('handles upload failure with proper error message', async () => {
    // Mock upload failure
    s3Service.uploadImage.mockRejectedValueOnce(new Error('Failed to upload image'));

    await act(async () => {
      render(<App />);
    });
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test image'], 'test.png', { type: 'image/png' });
    
    // Trigger file upload
    await act(async () => {
      await userEvent.upload(fileInput, file);
    });
    
    // Wait for and verify error message
    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent(/Failed to upload image/i);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  test('validates file type before upload', async () => {
    await act(async () => {
      render(<App />);
    });
    const fileInput = screen.getByTestId('file-input');
    const invalidFile = new File(['invalid'], 'test.txt', { type: 'text/plain' });
    
    // Trigger invalid file upload
    await act(async () => {
      await userEvent.upload(fileInput, invalidFile);
    });
    
    // Check for validation error
    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid file type/i);
    expect(s3Service.uploadImage).not.toHaveBeenCalled();
  });

  test('handles multiple file upload', async () => {
    // Mock successful uploads
    const mockUrls = [
      'https://test-bucket.s3.region.amazonaws.com/test1.png',
      'https://test-bucket.s3.region.amazonaws.com/test2.jpg'
    ];
    s3Service.uploadImage
      .mockResolvedValueOnce(mockUrls[0])
      .mockResolvedValueOnce(mockUrls[1]);

    await act(async () => {
      render(<App />);
    });
    const fileInput = screen.getByTestId('file-input');
    const files = [
      new File(['test1'], 'test1.png', { type: 'image/png' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    ];
    
    // Trigger multiple file upload
    await act(async () => {
      await userEvent.upload(fileInput, files);
    });
    
    // Verify uploads were processed
    await waitFor(() => {
      expect(s3Service.uploadImage).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Upload successful/i)).toBeInTheDocument();
    });
  });
});
