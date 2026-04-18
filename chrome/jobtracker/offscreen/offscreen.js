/**
 * Offscreen Document for AI Worker Operations
 *
 * This document runs in a hidden context that supports Web Workers,
 * allowing the background service worker to use the AI service.
 */

import { aiService } from '../lib/ai-service.js';

// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false;
  }

  handleMessage(message).then(sendResponse).catch(error => {
    sendResponse({ success: false, error: error.message });
  });

  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  const { action, payload } = message;

  switch (action) {
    case 'PRELOAD_MODELS': {
      const { includeNER } = payload;

      // Set progress callback to forward to background
      aiService.setProgressCallback((progress) => {
        chrome.runtime.sendMessage({
          target: 'background',
          action: 'MODEL_PROGRESS',
          payload: progress
        }).catch(() => {
          // Ignore errors if background isn't listening
        });
      });

      // Initialize and preload models
      await aiService.init();
      await aiService.preloadModels(includeNER);

      return { success: true };
    }

    case 'PARSE_JOB_POSTING': {
      const { text, useML } = payload;
      await aiService.init();
      const result = await aiService.parseJobPosting(text, useML);
      return { success: true, data: result };
    }

    case 'PARSE_RESUME': {
      const { text, useML } = payload;
      await aiService.init();
      const result = await aiService.parseResume(text, useML);
      return { success: true, data: result };
    }

    case 'EXTRACT_JOB_WITH_LLM': {
      const { text, currentResults } = payload;
      await aiService.init();
      const result = await aiService.extractJobWithLLM(text, currentResults);
      return { success: true, data: result };
    }

    case 'GET_STATUS': {
      await aiService.init();
      const status = await aiService.getStatus();
      return { success: true, data: status };
    }

    case 'TERMINATE': {
      aiService.terminate();
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

console.log('[Offscreen] AI offscreen document loaded');
