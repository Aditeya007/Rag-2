# Scraping2/items.py

import scrapy
from scrapy import Field

class ScrapedContentItem(scrapy.Item):
    url = Field()
    text = Field()
    title = Field()
    chunks = Field()
    content_type = Field()
    scraped_with_playwright = Field()
    timestamp = Field()
    content_id = Field()
    extraction_order = Field()
    text_length = Field()
    word_count = Field()
    domain = Field()
    scraped_at = Field()
    resource_id = Field()
    tenant_user_id = Field()

    def __setitem__(self, key, value):
        if key == 'url':
            if not value or not isinstance(value, str) or not value.strip():
                raise ValueError(f"URL cannot be empty or invalid: {value}")
            if not value.startswith(('http://', 'https://')):
                raise ValueError(f"URL must start with http:// or https://: {value}")
        elif key == 'text':
            if not value or not isinstance(value, str) or not value.strip():
                raise ValueError(f"Text content cannot be empty: {value}")
            # Reduced minimum length requirement for flexibility
            if len(value.strip()) < 1:
                raise ValueError(f"Text content too short (minimum 1 char)")
        elif key == 'word_count':
            if value is not None and (not isinstance(value, int) or value < 0):
                raise ValueError(f"Word count must be a non-negative integer: {value}")
        elif key == 'text_length':
            if value is not None and (not isinstance(value, int) or value < 0):
                raise ValueError(f"Text length must be a non-negative integer: {value}")
        super().__setitem__(key, value)

    def validate(self):
        required = ['url', 'text']
        missing = [f for f in required if not self.get(f)]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")
        return True

    @classmethod
    def from_response(cls, response, text, **kwargs):
        from urllib.parse import urlparse
        from datetime import datetime
        item = cls()
        item['url'] = response.url
        item['text'] = text
        item['domain'] = urlparse(response.url).netloc
        item['text_length'] = len(text)
        item['word_count'] = len(text.split())
        item['timestamp'] = datetime.utcnow().isoformat()
        item['scraped_with_playwright'] = response.meta.get('playwright', False)
        for k, v in kwargs.items():
            if k in item.fields:
                item[k] = v
        return item
