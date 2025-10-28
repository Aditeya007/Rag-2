
MONGO_URI = "mongodb://localhost:27017/"
MONGO_DATABASE = "fresh_update"
MONGO_COLLECTION_URL_TRACKING = "url_tracking"

# ChromaDB Configuration
CHROMA_DB_PATH = "./tech1"
CHROMA_COLLECTION_NAME = "scraped_content"
CHROMA_EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Spider Configuration
MAX_CRAWL_DEPTH = 999
MAX_LINKS_PER_PAGE = 1000
RESPECT_ROBOTS = True
AGGRESSIVE_DISCOVERY = True

# Pipeline Configuration
CHUNK_BATCH_SIZE = 50
MAX_RETRIES = 3
RETRY_DELAY = 1

MINIMUM_CONTENT_LENGTH = 20

# Logging Configuration
LOG_LEVEL = "INFO"
LOG_FILE_UPDATER = "LOG_FILE"
LOG_FILE_SCHEDULER = "LOG_FILE"

# Content Detection
MINIMUM_CONTENT_LENGTH = 100
HASH_ALGORITHM = "sha256"  # sha256 or md5

# Metadata Fields
METADATA_FIELDS = [
    'url', 'title', 'content_type', 'extraction_method',
    'page_depth', 'response_status', 'content_length',
    'page_title', 'meta_description', 'extracted_at',
    'scraped_at', 'word_count', 'domain', 'text_length'
]
