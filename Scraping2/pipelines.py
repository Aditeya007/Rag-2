# Scraping2/pipelines.py

import logging
import os
import re
import hashlib
import time
from datetime import datetime
from typing import List, Set
from urllib.parse import urlparse
from scrapy.exceptions import DropItem
import nltk
from nltk.tokenize import sent_tokenize
from collections import Counter

logger = logging.getLogger(__name__)

class ContentPipeline:
    def __init__(self):
        self.processed_count = 0
        self.seen_content_hashes: Set[str] = set()

    def process_item(self, item, spider):
        text = item.get("text", "")
        if not text or not text.strip():
            raise DropItem(f"Empty text: {item.get('url', 'unknown')}")
        
        # Minimal cleaning
        cleaned_text = re.sub(r'\s+', ' ', text.strip())
        if not cleaned_text:
            raise DropItem(f"No content after cleaning")
        
        # MUCH LESS STRICT duplicate detection - only for very long content
        
        content_hash = hashlib.md5(cleaned_text.encode()).hexdigest()
        if content_hash in self.seen_content_hashes:
            raise DropItem(f"Duplicate content hash")
        self.seen_content_hashes.add(content_hash)
        
        # MINIMAL word count - accept almost everything
        word_count = len(cleaned_text.split())
        if word_count < 3:  # Only reject 1-2 word fragments
            raise DropItem(f"Text too short: {word_count} words")
        
        item["word_count"] = word_count
        return item

class ChunkingPipeline:
    def __init__(self):
        self.max_chunk_size = 3250
        self.min_chunk_size = 250   
        self.overlap_size = 1000
        self.processed_count = 0

    def process_item(self, item, spider):
        text = item.get("text", "")
        if not text or len(text.strip()) < 10:  # Very minimal filter
            raise DropItem(f"Text too short")
        
        # Simple chunking - prioritize keeping content over perfect chunking
        sentences = sent_tokenize(text)
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            potential_chunk = current_chunk + " " + sentence if current_chunk else sentence
            
            if len(potential_chunk) > self.max_chunk_size and current_chunk:
                if len(current_chunk.strip()) >= self.min_chunk_size:
                    chunks.append(current_chunk.strip())
                
                words = current_chunk.split()
                overlap_words = min(len(words), 15)
                
                if overlap_words > 0:
                    overlap_text = " ".join(words[-overlap_words:])
                    current_chunk = overlap_text + " " + sentence
                else:
                    current_chunk = sentence
            else:
                current_chunk = potential_chunk
        
        if current_chunk and len(current_chunk.strip()) >= self.min_chunk_size:
            chunks.append(current_chunk.strip())
        
        # If no chunks, use original text if substantial enough
        if not chunks and len(text.strip()) >= self.min_chunk_size:
            chunks = [text.strip()]
        
        if not chunks:
            raise DropItem(f"No chunks created")
        
        # MUCH MORE PERMISSIVE final filter
        quality_chunks = []
        for chunk in chunks:
            if len(chunk.split()) >= 3:  # Only need 3+ words now
                quality_chunks.append(chunk)
        
        if not quality_chunks:
            raise DropItem(f"No quality chunks")
        
        item["chunks"] = quality_chunks
        return item






class ChromaDBPipeline:
    def __init__(self):
        self.client = None
        self.collection = None
        self.batch_size = 50
        self.batch_items = []
        self.items_stored = 0
        self.stored_ids = set()  # Track stored IDs in memory for fast duplicate checking
        self.max_retries = 3
        self.retry_delay = 1
        
        # Metadata fields to preserve
        self.metadata_fields = [
            'url', 'title', 'content_type', 'extraction_method', 
            'page_depth', 'response_status', 'content_length',
            'page_title', 'meta_description', 'extracted_at',
            'scraped_at', 'word_count', 'domain', 'text_length',
            'resource_id', 'tenant_user_id'
        ]
        
        self.db_path = None
        self.collection_name = None 
        self.embedding_model_name = None
        self.tenant_resource_id = None
        self.tenant_user_id = None

    def open_spider(self, spider):
        """Initialize ChromaDB when spider starts"""
        try:
            import chromadb
            
            # Try different import paths for different ChromaDB versions
            try:
                # Newer ChromaDB versions
                import chromadb.utils.embedding_functions as embedding_functions
            except ImportError:
                try:
                    # Alternative import path
                    from chromadb.utils import embedding_functions
                except ImportError:
                    try:
                        # Another common path
                        from chromadb import utils
                        embedding_functions = utils.embedding_functions
                    except ImportError:
                        # Fallback for older versions
                        from chromadb import embedding_functions
            
            # Resolve tenant-specific vector store path
            vector_path = getattr(spider, 'vector_store_path', None) or spider.settings.get('CHROMA_DB_PATH')
            if not vector_path:
                raise ValueError('vector_store_path must be provided via spider argument or CHROMA_DB_PATH setting')

            self.db_path = os.path.abspath(vector_path)
            os.makedirs(self.db_path, exist_ok=True)

            self.collection_name = getattr(spider, 'collection_name', None) or spider.settings.get('CHROMA_COLLECTION_NAME', 'scraped_content')
            self.embedding_model_name = (
                getattr(spider, 'embedding_model_name', None)
                or spider.settings.get('CHROMA_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
            )
            self.tenant_resource_id = getattr(spider, 'resource_id', None)
            self.tenant_user_id = getattr(spider, 'tenant_user_id', None)

            # Create persistent client scoped to tenant directory
            self.client = chromadb.PersistentClient(path=self.db_path)
            
            # Create embedding function
            embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=self.embedding_model_name
            )
            
            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=embedding_function
            )
            
            logger.info(
                "ChromaDB initialized for resource %s at %s (collection=%s)",
                self.tenant_resource_id,
                self.db_path,
                self.collection_name
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            raise

    def close_spider(self, spider):
        """Process any remaining items when spider closes"""
        if self.batch_items:
            self._process_batch()
        logger.info(f"ChromaDBPipeline finished. Total chunks stored: {self.items_stored}")

    def process_item(self, item, spider):
        """Process individual items and batch them for efficient storage"""
        texts = item.get("chunks", [item.get("text", "")])
        
        for i, text in enumerate(texts):
            if not text.strip():
                continue
                
            url = item.get("url", "unknown")
            
            # IMPROVED ID GENERATION - More unique
            content_hash = hashlib.md5(text.encode()).hexdigest()
            ts = str(int(time.time() * 1000000))  # Use microseconds instead of milliseconds
            chunk_index = str(i)  # Add chunk index for same-URL chunks
            
            # Create truly unique ID
            doc_id = hashlib.md5(f"{url}_{content_hash}_{ts}_{chunk_index}".encode()).hexdigest()
            
            # CHECK FOR EXISTING ID before adding (MEMORY ONLY - Fast!)
            if doc_id in self.stored_ids:
                logger.warning(f"Duplicate ID detected, skipping: {doc_id}")
                continue
                
            self.stored_ids.add(doc_id)
            
            # Prepare metadata
            metadata = {}
            for field in self.metadata_fields:
                if field in item:
                    value = item[field]
                    # Ensure metadata values are strings, numbers, or booleans
                    metadata[field] = value if isinstance(value, (str, int, float, bool)) else str(value)
                    
            # Add additional metadata
            metadata.update({
                'unique_id': doc_id,
                'extraction_timestamp': ts,
                'chunk_length': len(text),
                'chunk_word_count': len(text.split()),
                'content_type': item.get('content_type', '')
            })

            if self.tenant_resource_id and 'resource_id' not in metadata:
                metadata['resource_id'] = self.tenant_resource_id
            if self.tenant_user_id and 'tenant_user_id' not in metadata:
                metadata['tenant_user_id'] = self.tenant_user_id
            
            # Add to batch
            self.batch_items.append({
                'id': doc_id,
                'document': text,
                'metadata': metadata
            })
            
            # Process batch when it reaches batch_size
            if len(self.batch_items) >= self.batch_size:
                self._process_batch()
                
        return item

    def _process_batch(self):
        """Process a batch of items with retry logic and duplicate handling"""
        if not self.batch_items:
            return
            
        batch = self.batch_items
        self.batch_items = []
        
        for attempt in range(self.max_retries + 1):
            try:
                ids = [b['id'] for b in batch]
                documents = [b['document'] for b in batch]
                metadatas = [b['metadata'] for b in batch]
                
                # Remove any duplicates within this batch
                unique_ids = []
                unique_docs = []
                unique_metas = []
                seen_in_batch = set()
                
                for id_, doc, meta in zip(ids, documents, metadatas):
                    if id_ not in seen_in_batch:
                        unique_ids.append(id_)
                        unique_docs.append(doc)
                        unique_metas.append(meta)
                        seen_in_batch.add(id_)
                        
                if unique_ids:
                    # Store in ChromaDB
                    self.collection.add(
                        documents=unique_docs, 
                        ids=unique_ids, 
                        metadatas=unique_metas
                    )
                    
                    self.items_stored += len(unique_ids)
                    logger.info(f"ChromaDB stored {self.items_stored} chunks (batch size: {len(unique_ids)})")
                
                break  # Success, exit retry loop
                
            except Exception as e:
                if "Expected IDs to be unique" in str(e):
                    logger.error(f"Duplicate IDs in batch: {e}")
                    # Try to identify and remove duplicates
                    self._process_batch_individually(batch)
                    break
                elif attempt < self.max_retries:
                    wait = self.retry_delay * (2 ** attempt)
                    logger.warning(f"ChromaDB batch failed, retry in {wait}s: {e}")
                    time.sleep(wait)
                else:
                    logger.error(f"ChromaDB batch failed after retries: {e}")
                    break

    def _process_batch_individually(self, batch):
        """Process batch items individually to handle duplicates"""
        for item in batch:
            try:
                self.collection.add(
                    documents=[item['document']], 
                    ids=[item['id']], 
                    metadatas=[item['metadata']]
                )
                self.items_stored += 1
            except Exception as e:
                if "Expected IDs to be unique" not in str(e):
                    logger.error(f"Failed to store individual item {item['id']}: {e}")