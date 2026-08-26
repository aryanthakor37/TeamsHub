const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-account-tokens', 'x-user-emails', 'x-user-email', 'x-client-request-id']
  })
);
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// 404 & Error Handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;
