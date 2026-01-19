import Anthropic from '@anthropic-ai/sdk';
import { SiftBookmark, CategorySuggestion, RenameSuggestion } from '../utils/types';
import { getApiKey } from './storage';

const MODEL = 'claude-3-5-haiku-20241022';
const MAX_BOOKMARKS_PER_REQUEST = 50;

async function getClient(): Promise<Anthropic> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Claude API key not configured. Please set it in the extension options.');
  }
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for Chrome extension context
  });
}

export async function suggestCategories(
  bookmarks: SiftBookmark[]
): Promise<CategorySuggestion[]> {
  const client = await getClient();

  // Process in batches if needed
  const batches: SiftBookmark[][] = [];
  for (let i = 0; i < bookmarks.length; i += MAX_BOOKMARKS_PER_REQUEST) {
    batches.push(bookmarks.slice(i, i + MAX_BOOKMARKS_PER_REQUEST));
  }

  const allSuggestions: CategorySuggestion[] = [];

  for (const batch of batches) {
    const bookmarkList = batch
      .map((b, i) => `${i + 1}. "${b.title}" - ${b.url}`)
      .join('\n');

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze these bookmarks and suggest logical folder categories for organizing them. Group related bookmarks together based on topic, purpose, or domain.

Bookmarks:
${bookmarkList}

Respond in JSON format only:
{
  "categories": [
    {
      "folderName": "Category Name",
      "bookmarkIndices": [1, 2, 5]
    }
  ]
}

Be concise with folder names. Use common categories like: Development, Documentation, News, Social, Shopping, Entertainment, Finance, Learning, Tools, etc.`,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        const parsed = JSON.parse(content.text);
        for (const category of parsed.categories) {
          const categoryBookmarks = category.bookmarkIndices
            .map((idx: number) => batch[idx - 1])
            .filter(Boolean);
          if (categoryBookmarks.length > 0) {
            allSuggestions.push({
              folderName: category.folderName,
              bookmarks: categoryBookmarks,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse AI category response:', error);
    }
  }

  return allSuggestions;
}

export async function suggestRenames(
  bookmarks: SiftBookmark[]
): Promise<RenameSuggestion[]> {
  const client = await getClient();

  // Only process bookmarks with unclear titles
  const unclearBookmarks = bookmarks.filter((b) => {
    const title = b.title.toLowerCase();
    return (
      title.length < 5 ||
      title === 'untitled' ||
      title.startsWith('http') ||
      /^[a-f0-9-]+$/.test(title) // UUID-like
    );
  });

  if (unclearBookmarks.length === 0) {
    return [];
  }

  const batches: SiftBookmark[][] = [];
  for (let i = 0; i < unclearBookmarks.length; i += MAX_BOOKMARKS_PER_REQUEST) {
    batches.push(unclearBookmarks.slice(i, i + MAX_BOOKMARKS_PER_REQUEST));
  }

  const suggestions: RenameSuggestion[] = [];

  for (const batch of batches) {
    const bookmarkList = batch
      .map((b, i) => `${i + 1}. Current: "${b.title}" | URL: ${b.url}`)
      .join('\n');

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `These bookmarks have unclear titles. Suggest better, descriptive names based on the URLs.

Bookmarks:
${bookmarkList}

Respond in JSON format only:
{
  "renames": [
    {
      "index": 1,
      "suggestedTitle": "Descriptive Title"
    }
  ]
}

Keep titles concise (under 50 characters). Make them descriptive of the content.`,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        const parsed = JSON.parse(content.text);
        for (const rename of parsed.renames) {
          const bookmark = batch[rename.index - 1];
          if (bookmark) {
            suggestions.push({
              bookmark,
              suggestedTitle: rename.suggestedTitle,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse AI rename response:', error);
    }
  }

  return suggestions;
}
