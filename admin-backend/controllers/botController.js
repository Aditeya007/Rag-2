// admin-backend/controllers/botController.js

const botJob = require('../jobs/botJob');
const { getUserTenantContext } = require('../services/userContextService');

/**
 * Run the RAG bot with user's query
 * @route   POST /api/bot/run
 * @access  Protected (requires JWT)
 * @param   {Object} req.body - { input: string }
 * @returns {Object} { answer: string, session_id: string, user_id: string } - The bot's response from FastAPI
 */
exports.runBot = async (req, res) => {
  // Get user info from JWT (set by auth middleware)
  const userId = req.tenantUserId || req.user.userId;
  const username = req.user.username;
  const { input, sessionId: clientSessionId } = req.body;
  
  try {
    // Sanitize input
    const sanitizedInput = input.trim();
    
    // Log request (mask sensitive data in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🤖 Bot request from user: ${username} (${userId})`);
      console.log(`   Query: "${sanitizedInput}"`);
    } else {
      console.log(`🤖 Bot request from user: ${username}`);
    }
    
    // Load tenant-specific resource metadata
    const tenantContext = await getUserTenantContext(userId);

    if (!tenantContext.vectorStorePath || !tenantContext.databaseUri) {
      const error = new Error('Tenant resources are not fully provisioned');
      error.statusCode = 503;
      throw error;
    }

    // Call the bot job to interact with FastAPI backend for this tenant
    const normalizedSessionId =
      typeof clientSessionId === 'string' && clientSessionId.trim()
        ? clientSessionId.trim()
        : undefined;

    const botResult = await botJob.runBotForUser(
      {
        userId,
        username,
        botEndpoint: tenantContext.botEndpoint,
        resourceId: tenantContext.resourceId,
        vectorStorePath: tenantContext.vectorStorePath,
        databaseUri: tenantContext.databaseUri
      },
      sanitizedInput,
      { sessionId: normalizedSessionId }
    );
    
    // FastAPI returns answer, session identifier, and optional metadata
    console.log(`✅ Bot response received for user: ${username}`);
    
    // Return comprehensive response matching frontend expectations
    res.json({
      success: true,
      answer: botResult.answer,
      session_id: botResult.session_id || `user_${userId}_${Date.now()}`,
      user_id: userId,
      resource_id: tenantContext.resourceId,
      timestamp: new Date().toISOString(),
      ...(botResult.sources && { sources: botResult.sources }), // Include sources if available
      ...(botResult.confidence && { confidence: botResult.confidence }), // Include confidence if available
      ...(botResult.metadata && { metadata: botResult.metadata })
    });
  } catch (err) {
    console.error(`❌ Bot error for user ${username}:`, {
      message: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    // Determine appropriate status code and user-friendly message based on error
    let statusCode = err.statusCode || 500;
    let errorMessage = err.statusCode ? err.message : 'Failed to process your request';
    let errorType = err.statusCode ? 'REQUEST_REJECTED' : 'INTERNAL_ERROR';
    
    if (err.message.includes('Cannot connect') || err.code === 'ECONNREFUSED') {
      statusCode = 503; // Service unavailable
      errorMessage = 'Bot service is currently unavailable. Please try again later.';
      errorType = 'SERVICE_UNAVAILABLE';
    } else if (err.message.includes('timeout') || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      statusCode = 504; // Gateway timeout
      errorMessage = 'Bot request timed out. Please try a shorter query or try again.';
      errorType = 'TIMEOUT';
    } else if (err.response && err.response.status === 400) {
      statusCode = 400; // Bad request
      errorMessage = 'Invalid request to bot service';
      errorType = 'BAD_REQUEST';
    } else if (err.response && err.response.status >= 500) {
      statusCode = 502; // Bad gateway
      errorMessage = 'Bot service error. Please try again later.';
      errorType = 'UPSTREAM_ERROR';
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      errorType,
      timestamp: new Date().toISOString(),
      // Include technical details only in development
      ...(process.env.NODE_ENV === 'development' && { 
        details: err.message,
        code: err.code 
      })
    });
  }
};
