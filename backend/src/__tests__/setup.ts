import { config } from 'dotenv';

// Load environment variables for testing
config();

// Set mock mode for testing
process.env.MOCK_MODE = 'true';
