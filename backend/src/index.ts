import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import aiChatRouter from './routes/aiChat';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Chat routes
app.use('/api/ai-chat', aiChatRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
