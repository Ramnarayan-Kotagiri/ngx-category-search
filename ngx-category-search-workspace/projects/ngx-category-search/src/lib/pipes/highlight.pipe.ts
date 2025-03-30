import { Pipe, PipeTransform } from '@angular/core';

// Function to escape special characters for regex
function escapeRegex(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

@Pipe({
  name: 'highlight',
  standalone: true
})
export class HighlightPipe implements PipeTransform {

  transform(text: string, searchTerm: string): string {
    if (!searchTerm?.trim()) {
      return text; // No search term, return original text
    }
    if (!text) {
      return ''; // No text to highlight
    }

    // Escape the search term for safe regex use and ensure word boundaries (\b)
    // Use 'gi' for global (all occurrences) and case-insensitive matching
    const escapedTerm = escapeRegex(searchTerm.trim());
    const regex = new RegExp('\\b(' + escapedTerm + ')\\b', 'gi');

    // Replace matches with <b> tag for bolding
    const highlightedText = text.replace(regex, (match) => `<b>${match}</b>`);

    return highlightedText;
  }

}
