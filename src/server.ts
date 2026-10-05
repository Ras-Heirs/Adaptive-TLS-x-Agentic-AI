import app from './app';

const PORT = process.env.PORT || 3000;

const startServer = () => {
  try {
    app.listen(PORT, () => {
      console.log(`[INFO] Server is running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to start server:`, error);
    process.exit(1);
  }
};

startServer();