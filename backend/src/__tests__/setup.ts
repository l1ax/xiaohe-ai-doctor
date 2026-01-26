import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables for testing
config({ path: join(__dirname, '../../.env') });

// Set mock mode for testing
process.env.MOCK_MODE = 'true';
