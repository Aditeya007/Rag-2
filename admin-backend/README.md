# Admin Backend API

Production-ready Express.js backend for the RAG Chatbot Admin System. Provides authentication, user management, and bot interaction endpoints with enterprise-grade security.

## 🚀 Features

- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **User Management**: Registration, login, profile management with validation
- **Bot Integration**: Seamless integration with Python FastAPI RAG bot
- **Tenant Isolation**: Automatic per-user resource provisioning (MongoDB, vector endpoints, schedulers, scrapers)
- **Rate Limiting**: Protection against brute force and API abuse
- **Security Headers**: Helmet.js for security-related HTTP headers
- **CORS Configuration**: Strict origin control for production security
- **Error Handling**: Comprehensive error handling with production-safe messages
- **Environment-Based**: Full configuration through environment variables
- **MongoDB Integration**: Mongoose ODM with connection pooling

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- MongoDB (local or Atlas)
- Python FastAPI Bot Backend (running separately)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   cd admin-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your configuration
   # CRITICAL: Update all REQUIRED variables!
   ```

4. **Generate secure JWT secret**
   ```bash
   # Generate a secure random secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   
   # Copy the output and set it as JWT_SECRET in .env
   ```

## ⚙️ Configuration

### Required Environment Variables

Create a `.env` file with these REQUIRED variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Database (REQUIRED)
MONGO_URI=mongodb://localhost:27017/rag-admin

# Authentication (REQUIRED - change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS (REQUIRED - never use "*" in production!)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# FastAPI Bot (REQUIRED)
FASTAPI_BOT_URL=http://localhost:8000

# Tenant Context Cache (Optional)
USER_CONTEXT_CACHE_TTL_MS=60000

# Tenant Vector Store Base (Optional)
DEFAULT_VECTOR_BASE_PATH=./storage/vector-stores

> Ensure this directory is shared (or replicated) with your FastAPI service so it can read tenant-specific vector stores.

# FastAPI Inter-Service Auth (Optional)
# FASTAPI_SHARED_SECRET=change-me
```

See `.env.example` for complete configuration options and detailed documentation.

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```
Uses nodemon for automatic reloading on file changes.

### Production Mode
```bash
npm start
```

### Verify Installation
```bash
# Check health endpoint
curl http://localhost:5000/api/health
```

## 📡 API Endpoints

### Authentication (`/api/auth`)

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user",
    "isActive": true,
    "resourceId": "johndoe-abc123def4",
    "databaseUri": "mongodb://localhost:27017/rag_johndoe_def4",
    "botEndpoint": "http://localhost:8000/api/bots/johndoe-abc123def4",
    "schedulerEndpoint": "http://localhost:9000/api/schedules/johndoe-abc123def4",
    "scraperEndpoint": "http://localhost:7000/api/scrape/johndoe-abc123def4"
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user",
    "isActive": true,
    "resourceId": "johndoe-abc123def4",
    "databaseUri": "mongodb://localhost:27017/rag_johndoe_def4",
    "botEndpoint": "http://localhost:8000/api/bots/johndoe-abc123def4",
    "schedulerEndpoint": "http://localhost:9000/api/schedules/johndoe-abc123def4",
    "scraperEndpoint": "http://localhost:7000/api/scrape/johndoe-abc123def4"
  }
}
```

### User Management (`/api/user`)

#### Get Profile (Protected)
```http
GET /api/user/me
Authorization: Bearer <your-jwt-token>
```

#### Update Profile (Protected)
```http
PUT /api/user/me
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "John Updated",
  "email": "john.new@example.com"
}
```

### Bot Interaction (`/api/bot`)

#### Run Bot Query (Protected)
```http
POST /api/bot/run
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "input": "What is machine learning?"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Machine learning is a subset of artificial intelligence...",
  "session_id": "user_507f1f77bcf86cd799439011_1698765432000",
  "user_id": "507f1f77bcf86cd799439011",
  "resource_id": "johndoe-abc123def4",
  "timestamp": "2025-10-23T12:34:56.789Z",
  "sources": [
    "Snippet 1 from the knowledge base...",
    "Snippet 2 from the knowledge base..."
  ]
}
```

> The admin backend injects tenant metadata (`user_id`, `resource_id`, `database_uri`, `vector_store_path`) when calling the FastAPI service. Third-party clients should always use this proxy instead of calling FastAPI directly.

> `sources` lists truncated context passages that supported the answer. Additional metadata (e.g., `resource_id`, `user_id`) may also be returned when helpful.

### Health Check (`/api/health`)

```http
GET /api/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-10-23T12:34:56.789Z",
  "service": "admin-backend",
  "mongodb": "connected"
}
```

## 🔒 Security Features

### 1. **Rate Limiting**
- **Auth endpoints**: 5 requests per 15 minutes per IP
- **Bot endpoints**: 10 requests per minute per IP
- **User endpoints**: 50 requests per 5 minutes per IP
- **General**: 100 requests per 15 minutes per IP

### 2. **Security Headers (Helmet.js)**
- Content Security Policy
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security (HSTS)

### 3. **Authentication**
- JWT tokens with HS256 algorithm
- Bearer token authentication
- Token expiration (default: 1 day)
- Password hashing with bcrypt (10 salt rounds)

## 🤝 FastAPI Integration

The Python chatbot service (`BOT/app_20.py`) now operates in multi-tenant mode. Every request must provide tenant metadata:

- `resource_id`: Shared tenant identifier generated by the admin backend.
- `database_uri`: Tenant-specific MongoDB URI (or database) where leads are stored.
- `vector_store_path`: Filesystem location for the tenant’s Chroma embeddings.
- `user_id`: Optional, used for logging and personalized responses.

The admin backend automatically includes these fields when proxying `/api/bot/run`. If you need to call FastAPI directly (for diagnostics), include them in the payload:

```json
{
  "query": "How do I reset my password?",
  "session_id": "tenant_acme-1a2b3c4d5_1730000000000",
  "user_id": "652f23e0288b6e5a6e3d5e2a",
  "resource_id": "acme-1a2b3c4d5",
  "database_uri": "mongodb://localhost:27017/rag_acme_c4d5",
  "vector_store_path": "C:/data/vector-stores/acme-1a2b3c4d5"
}
```

⚠️ Ensure the FastAPI process can access the `vector_store_path` directory (shared volume or network mount) and reach the MongoDB instance defined by `database_uri`.

### 4. **Input Validation**
- Request body validation middleware
- Email format validation
- Username pattern validation (alphanumeric + underscore)
- Password strength requirements (min 6 characters)
- Input sanitization and trimming

### 5. **Error Handling**
- No stack traces in production
- Standardized error responses
- Logging without sensitive data exposure
- Prevention of user enumeration attacks

### 6. **CORS Protection**
- Strict origin validation
- No wildcard origins in production
- Credentials support
- Environment-based configuration

## 🚢 Production Deployment

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (64+ random bytes)
- [ ] Configure production `MONGO_URI` with authentication
- [ ] Set specific `CORS_ORIGIN` domains (NO wildcards)
- [ ] Configure production `FASTAPI_BOT_URL`
- [ ] Enable SSL/TLS for all connections
- [ ] Set up MongoDB backups
- [ ] Configure firewall rules
- [ ] Set up monitoring and logging
- [ ] Review and test all endpoints
- [ ] Perform security audit
- [ ] Load testing

### Deployment Options

#### 1. **Traditional Server (PM2)**
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name admin-backend

# Enable auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

#### 2. **Docker**
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

```bash
# Build
docker build -t admin-backend .

# Run
docker run -p 5000:5000 --env-file .env admin-backend
```

#### 3. **Cloud Platforms**
- **Heroku**: Push to Heroku Git, set env vars in dashboard
- **AWS Elastic Beanstalk**: Deploy Node.js application
- **Google Cloud Run**: Deploy as container
- **Azure App Service**: Deploy Node.js web app

### Environment-Specific Configuration

#### Production `.env`
```env
NODE_ENV=production
PORT=5000

# Use Atlas or managed MongoDB
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/rag-admin

# Strong random secret (64 bytes hex)
JWT_SECRET=<generated-64-byte-hex-string>

# Specific production domains only
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# Production bot service
FASTAPI_BOT_URL=https://api.yourdomain.com
```

## 🔍 Monitoring & Logging

### Log Levels
- **Development**: Detailed logs with IP addresses and query details
- **Production**: Minimal logs, no sensitive data

### Recommended Monitoring
- **Application**: PM2, New Relic, DataDog
- **Database**: MongoDB Atlas monitoring
- **Uptime**: UptimeRobot, Pingdom
- **Errors**: Sentry, Rollbar

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Test health endpoint
curl http://localhost:5000/api/health

# Test authentication
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","username":"testuser","password":"test123"}'
```

## � Maintenance Scripts

### Backfill Resource Identifiers

Older deployments may have user documents without the new tenant resource metadata. Run the backfill script once after deploying the updated backend:

```bash
cd admin-backend
node scripts/backfillResourceIds.js
```

The script generates deterministic `resourceId` values, provisions per-user endpoints, and ensures `role`/`isActive` defaults for every user. Re-run safely at any time; it only updates documents that are missing data.

## �🐛 Troubleshooting

### MongoDB Connection Failed
```
Error: MongoDB URI not found in environment variables!
```
**Solution**: Ensure `MONGO_URI` is set in `.env` file

### CORS Error in Browser
```
Access to fetch at 'http://localhost:5000/api/auth/login' from origin 
'http://localhost:3001' has been blocked by CORS policy
```
**Solution**: Add `http://localhost:3001` to `CORS_ORIGIN` in `.env`

### Bot Service Unavailable
```
Bot service is currently unavailable. Please try again later.
```
**Solution**: Ensure FastAPI bot is running at `FASTAPI_BOT_URL`

### Token Expired
```
Your session has expired. Please login again.
```
**Solution**: Re-authenticate to get a new token. Consider implementing refresh tokens.

## 📦 Dependencies

### Core Dependencies
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **jsonwebtoken**: JWT authentication
- **bcryptjs**: Password hashing
- **cors**: CORS middleware
- **helmet**: Security headers
- **express-rate-limit**: Rate limiting
- **axios**: HTTP client for bot API
- **dotenv**: Environment variable management

### Development Dependencies
- **nodemon**: Auto-reload during development

## 🤝 Integration with Other Services

### React Frontend Integration
```javascript
// Example: Login from React
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'user', password: 'pass' })
});
const data = await response.json();
localStorage.setItem('token', data.token);

// Authenticated request
const botResponse = await fetch('http://localhost:5000/api/bot/run', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({ input: 'Your query here' })
});
```

### FastAPI Bot Integration
Your FastAPI bot should have an endpoint matching:
```python
@app.post("/chat")
async def chat(request: QuestionRequest):
    return {"answer": "Bot response", "session_id": request.session_id}
```

## 📄 License

ISC

## 👥 Support

For issues, questions, or contributions, please contact the development team.

---

**Security Notice**: Never commit `.env` files or expose secrets in code repositories. Always use environment variables for sensitive configuration.
