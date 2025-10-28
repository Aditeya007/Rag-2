# check_data_simple.py - FIXED VERSION
import os
from pymongo import MongoClient
import chromadb

# Import configuration
try:
    from config import (
        MONGO_URI, MONGO_DATABASE, MONGO_COLLECTION_URL_TRACKING,
        CHROMA_DB_PATH, CHROMA_COLLECTION_NAME
    )
except ImportError:
    MONGO_URI = "mongodb://localhost:27017/"
    MONGO_DATABASE = "fresh_update"
    MONGO_COLLECTION_URL_TRACKING = "url_tracking"
    CHROMA_DB_PATH = "./tech1"
    CHROMA_COLLECTION_NAME = "scraped_content"

PREVIOUS_COUNT_FILE = ".previous_chunk_count.txt"

def check_database():
    """Simple report showing actual chunks added"""
    
    # Connect to MongoDB
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DATABASE]
    collection = db[MONGO_COLLECTION_URL_TRACKING]
    
    # Connect to ChromaDB
    chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    try:
        chroma_collection = chroma_client.get_collection(name=CHROMA_COLLECTION_NAME)
        current_chunks = chroma_collection.count()
    except:
        current_chunks = 0
    
    # Read previous chunk count
    try:
        with open(PREVIOUS_COUNT_FILE, 'r') as f:
            previous_chunks = int(f.read().strip())
    except:
        previous_chunks = current_chunks  # First run
    
    # Calculate ACTUAL chunks added
    chunks_added = current_chunks - previous_chunks
    
    print("\n" + "="*60)
    print("DATABASE STATUS")
    print("="*60)
    
    # MongoDB counts
    total_urls = collection.count_documents({})
    
    print(f"\n📊 MongoDB (url_tracking):")
    print(f"  Total URLs: {total_urls}")
    
    # ChromaDB count
    print(f"\n📦 ChromaDB (chunks):")
    print(f"  Previous total: {previous_chunks}")
    print(f"  Current total: {current_chunks}")
    print(f"  Chunks added in last run: {chunks_added}")
    
    print("\n" + "="*60)
    
    # Save current count for next time
    with open(PREVIOUS_COUNT_FILE, 'w') as f:
        f.write(str(current_chunks))
    
    mongo_client.close()

if __name__ == "__main__":
    check_database()
