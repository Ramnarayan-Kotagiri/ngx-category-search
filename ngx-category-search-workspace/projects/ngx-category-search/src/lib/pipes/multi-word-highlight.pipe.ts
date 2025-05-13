import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Helper function to escape special characters for regex
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Pipe({
  name: 'multiWordHighlight',
  standalone: true,
})
export class MultiWordHighlightPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string | null | undefined, searchTerm: string | null | undefined): SafeHtml | string {
    if (!searchTerm || !text) {
      return text || '';
    }

    // Split search term into words, filter out empty strings, and escape each word for regex
    const searchWords = searchTerm
      .trim()
      .split(/\s+/) // Split by one or more whitespace characters
      .filter(word => word.length > 0)
      .map(escapeRegex);

    if (searchWords.length === 0) {
      return text;
    }

    // Create a regex to match any of the search words, globally and case-insensitively
    // The capturing group around the joined words ensures that 'match' in the replacer function is the exact word found.
    const regex = new RegExp(`(${searchWords.join('|')})`, 'gi');

    const highlightedText = text.replace(regex, (match) => `<b>${match}</b>`);

    // Bypass security to trust the HTML, as we are constructing it safely
    return this.sanitizer.bypassSecurityTrustHtml(highlightedText);
  }
}
