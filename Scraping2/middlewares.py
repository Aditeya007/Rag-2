# Scraping2/middlewares.py

import logging
import random
from scrapy.downloadermiddlewares.retry import RetryMiddleware
from scrapy.utils.response import response_status_message

logger = logging.getLogger(__name__)

try:
    from scrapy_playwright.page import PageMethod
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    PageMethod = None

class RotateUserAgentMiddleware:
    def __init__(self, user_agent_list):
        self.user_agent_list = user_agent_list

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            user_agent_list=getattr(crawler.settings, 'USER_AGENT_LIST', [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/119.0.0.0'
            ])
        )

    def process_request(self, request, spider):
        request.headers['User-Agent'] = random.choice(self.user_agent_list)
        return None


class StealthMiddleware:
    def process_request(self, request, spider):
        request.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        })
        return None

    def process_response(self, request, response, spider):
        if response.status == 403 and PLAYWRIGHT_AVAILABLE:
            retry_count = request.meta.get('retry_403', 0)
            if retry_count < 2:
                logger.warning(f"403 for {request.url}, retrying with Playwright ({retry_count + 1})")
                new_meta = {**request.meta, 'playwright': True, 'retry_403': retry_count + 1}
                new_meta['playwright_page_methods'] = [
                    PageMethod("wait_for_timeout", 2000),
                    PageMethod("wait_for_load_state", "networkidle")
                ]
                return request.replace(meta=new_meta)

        if response.status == 406:
            retry_count = request.meta.get('retry_406', 0)
            if retry_count < 1:
                logger.warning(f"406 for {request.url}, adjusting headers")
                new_request = request.replace()
                new_request.headers['Accept'] = '*/*'
                if PLAYWRIGHT_AVAILABLE:
                    new_request.meta['playwright'] = True
                    new_request.meta['playwright_page_methods'] = [
                        PageMethod("wait_for_load_state", "networkidle")
                    ]
                new_request.meta['retry_406'] = retry_count + 1
                return new_request

        if response.status == 429:
            retry_count = request.meta.get('retry_429', 0)
            if retry_count < 3:
                logger.warning(f"429 for {request.url}, scheduling retry ({retry_count + 1})")
                new_meta = {**request.meta, 'retry_429': retry_count + 1}
                return request.replace(meta=new_meta)

        return response


class CustomRetryMiddleware(RetryMiddleware):
    def __init__(self, settings):
        super().__init__(settings)
        self.retry_http_codes = settings.getlist('RETRY_HTTP_CODES') or [500, 502, 503, 504, 522, 524, 408, 429, 403]

    def process_response(self, request, response, spider):
        if response.status in self.retry_http_codes:
            reason = response_status_message(response.status)
            retry_times = request.meta.get('retry_times', 0)
            logger.warning(f"Retrying {request.url} (attempt {retry_times + 1}) due to HTTP {response.status}")
            if PLAYWRIGHT_AVAILABLE and response.status in (403, 429):
                request.meta['playwright'] = True
                request.meta['playwright_page_methods'] = [
                    PageMethod("wait_for_timeout", 3000),
                    PageMethod("wait_for_load_state", "networkidle")
                ]
            return self._retry(request, reason, spider) or response
        return response

    def process_exception(self, request, exception, spider):
        if PLAYWRIGHT_AVAILABLE and 'timeout' in str(exception).lower():
            request.meta['playwright'] = True
            request.meta['playwright_page_methods'] = [
                PageMethod("wait_for_timeout", 5000),
                PageMethod("wait_for_load_state", "networkidle")
            ]
        return self._retry(request, exception, spider)


class ProxyMiddleware:
    def __init__(self):
        self.proxy_list = []
        self.current_proxy = 0

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls()
        middleware.proxy_list = crawler.settings.get('PROXY_LIST', []) or []
        if middleware.proxy_list:
            logger.info(f"Loaded {len(middleware.proxy_list)} proxies")
        return middleware

    def process_request(self, request, spider):
        if self.proxy_list:
            proxy = self.proxy_list[self.current_proxy % len(self.proxy_list)]
            self.current_proxy += 1
            request.meta['proxy'] = proxy
            logger.debug(f"Using proxy: {proxy} for {request.url}")
        return None

    def process_exception(self, request, exception, spider):
        if 'proxy' in request.meta:
            logger.warning(f"Proxy {request.meta['proxy']} failed for {request.url}: {exception}")
        return None


class DebugMiddleware:
    def __init__(self):
        self.request_count = 0
        self.response_count = 0
        self.error_count = 0

    def process_request(self, request, spider):
        self.request_count += 1
        if self.request_count % 100 == 0:
            logger.info(f"🕷️ MW Stats: {self.request_count} requests, {self.response_count} responses, {self.error_count} errors")
        return None

    def process_response(self, request, response, spider):
        self.response_count += 1
        return response

    def process_exception(self, request, exception, spider):
        self.error_count += 1
        return None
