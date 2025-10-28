// admin-backend/jobs/botJob.js

/**
 * Bot Job Module
 * 
 * Handles communication between Express backend and Python FastAPI RAG bot.
 * Makes HTTP requests to FastAPI endpoints and processes responses.
 * Includes error handling, timeout management, and retry logic.
 */

const axios = require('axios');

/**
 * Launch the RAG bot for a user by calling Python FastAPI backend
 * 
 * @param {string} userId - The MongoDB user ID for tracking and personalization
 * @param {string} userInput - The user's query/input
 * @returns {Promise<Object>} - Bot's response data matching FastAPI AnswerResponse model
 * @throws {Error} - Throws descriptive errors for connection, timeout, or API issues
 */
exports.runBotForUser = async (tenantContext, userInput, options = {}) => {
  if (!tenantContext || !tenantContext.userId) {
    throw new Error('Tenant context with userId is required to run the bot');
  }

  const { userId, username, botEndpoint, resourceId, vectorStorePath, databaseUri } = tenantContext;
  const { sessionId: requestedSessionId } = options;

  const fallbackBotUrl = process.env.FASTAPI_BOT_URL;
  const baseUrl = botEndpoint || fallbackBotUrl;

  if (!baseUrl) {
    throw new Error('No bot endpoint configured for this user and FASTAPI_BOT_URL fallback is not set');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const botApiUrl = normalizedBaseUrl.endsWith('/chat')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/chat`;

  const effectiveResourceId = resourceId || userId;
  const effectiveVectorPath = vectorStorePath || '';
  const effectiveDatabaseUri = databaseUri || process.env.MONGO_URI || '';
  const sessionId = requestedSessionId && requestedSessionId.trim()
    ? requestedSessionId.trim()
    : `tenant_${effectiveResourceId}_${Date.now()}`;

  const timeout = parseInt(process.env.BOT_REQUEST_TIMEOUT, 10) || 30000;

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🤖 Calling FastAPI bot at ${botApiUrl}`);
      console.log(`   User: ${username || userId}`);
      console.log(`   Resource ID: ${effectiveResourceId}`);
      if (effectiveVectorPath) {
        console.log(`   Vector Path: ${effectiveVectorPath}`);
      }
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Query: ${userInput}`);
      console.log(`   Timeout: ${timeout}ms`);
    } else {
      console.log(`🤖 Bot API call: ${sessionId}`);
    }

    const response = await axios.post(
      botApiUrl,
      {
        query: userInput,
        session_id: sessionId,
        user_id: userId,
        resource_id: effectiveResourceId,
        vector_store_path: effectiveVectorPath,
        database_uri: effectiveDatabaseUri
      },
      {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AdminBackend/1.0',
          ...(process.env.FASTAPI_SHARED_SECRET && {
            'X-Service-Secret': process.env.FASTAPI_SHARED_SECRET,
          }),
          ...(userId && { 'X-Tenant-Id': userId }),
          ...(resourceId && { 'X-Resource-Id': resourceId })
        },
        validateStatus: (status) => status < 500
      }
    );

    if (response.status !== 200) {
      console.error(`❌ FastAPI returned status ${response.status}:`, response.data);
      throw new Error(`Bot API error (${response.status}): ${response.data?.detail || 'Unknown error'}`);
    }

    if (!response.data || typeof response.data.answer === 'undefined') {
      console.error('❌ Invalid response structure from FastAPI:', response.data);
      throw new Error('Invalid response format from bot service');
    }

    console.log(`✅ Bot response received successfully (${sessionId})`);
    const responseSessionId = response.data.session_id || sessionId;

    return {
      answer: response.data.answer,
      session_id: responseSessionId,
      ...(response.data.sources && { sources: response.data.sources }),
      ...(response.data.confidence && { confidence: response.data.confidence }),
      ...(response.data.metadata && { metadata: response.data.metadata })
    };
  } catch (err) {
    console.error('❌ Bot job execution failed:', {
      sessionId,
      userId,
      resourceId: effectiveResourceId,
      vectorStorePath: effectiveVectorPath,
      error: err.message,
      code: err.code,
      status: err.response?.status,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    if (err.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to FastAPI bot at ${botApiUrl} - service may not be running`);
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      throw new Error(`Bot request timeout after ${timeout}ms - query may be too complex`);
    } else if (err.code === 'ENOTFOUND') {
      throw new Error(`Cannot resolve bot service hostname: ${botApiUrl}`);
    } else if (err.response) {
      const detail = err.response.data?.detail || err.response.statusText || 'Unknown error';
      throw new Error(`Bot API error (${err.response.status}): ${detail}`);
    } else if (err.request) {
      throw new Error('No response from bot API - connection or timeout issue');
    } else {
      throw new Error(`Bot job failed: ${err.message}`);
    }
  }
};
