# ngx-category-search

[![NPM Version](https://img.shields.io/npm/v/@r-ko/ngx-category-search.svg)](https://www.npmjs.com/package/@r-ko/ngx-category-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/r-k-o/ngx-category-search/main.yml?branch=main)](https://github.com/r-k-o/ngx-category-search/actions/workflows/main.yml)

**Version:** 0.3.0

**`ngx-category-search`** is a powerful and highly configurable Angular component designed to create intuitive, category-driven search experiences. Inspired by the Azure Portal's search paradigm, it provides a flexible UI layer that decouples data fetching, allowing developers to integrate sophisticated search functionalities with ease.

---

## Table of Contents

1.  [Core Features](#core-features)
2.  [Design Philosophy](#design-philosophy)
3.  [Installation](#installation)
4.  [Basic Usage](#basic-usage)
5.  [API Reference](#api-reference)
    *   [Component Selector](#component-selector)
    *   [Inputs](#inputs)
    *   [Outputs](#outputs)
6.  [Customization](#customization)
    *   [Custom Templates](#custom-templates)
    *   [Included Pipes](#included-pipes)
    *   [Styling & Theming](#styling--theming)
7.  [Development & Contribution](#development--contribution)
8.  [License](#license)

---

## Core Features

*   **Decoupled Data Fetching:** Emits debounced search terms (`searchRequested`), allowing the host application to manage data retrieval. Results are fed back via the `searchResults` input.
*   **Flexible Initial Data:** Accepts initial category context either as an array of data items (`T[]`) or a direct `Record<string, number>` of category counts via the `data` input.
*   **Dynamic Categorization:** Intelligently displays filter chiclets based on categories derived from initial data and live search results.
*   **Structured Result Presentation:** Organizes search results visually under collapsible category headers within the dropdown.
*   **Stateful Recent Searches:** Enhances user workflow with optional `localStorage`-backed persistence of recent search terms.
*   **Controlled Result Visibility:** Manages large category result sets gracefully with "Show more" links for progressive disclosure.
*   **Seamless Navigation Hooks:** Provides dedicated output events (`navigateToAll`, `navigateToCategory`) for integrating with application routing.
*   **"Search for {term}" Line:** Offers a configurable line to trigger a global search for the entered term, with support for basic HTML formatting in the display string.
*   **Enter Key Action:** Emits an `enterKeyPressed` event, allowing custom actions when the user presses Enter in the search input.
*   **Extensive UI Customization:** Offers `ng-template` outlets for nearly every UI element (results, chiclets, chiclet content, headers, header content, input adornments, loading/empty states).
*   **Fine-Grained Configuration:** A rich set of `@Input` properties allows precise tuning of behavior (debouncing, batching, initial state, feature toggles like chiclet container border) and localization (UI labels).
*   **Advanced Highlighting:** Includes `HighlightPipe` for single-term highlighting and `MultiWordHighlightPipe` for highlighting multiple words from the search query.
*   **Themeable Foundation:** Leverages CSS Custom Properties for straightforward styling and adaptation to various design systems.
*   **Modern Angular:** Built as a standalone component, promoting modularity and aligning with current Angular best practices.
*   **Type Safety:** Utilizes generics (`<T extends SearchDataItem>`) for enhanced type checking in consuming applications.

## Design Philosophy

*   **Separation of Concerns:** The component deliberately focuses on the *presentation* and *interaction* aspects of search, leaving data fetching and state management to the consuming application. This promotes flexibility and testability.
*   **Configurability over Opinion:** Provides numerous inputs and template hooks to adapt to diverse requirements rather than imposing rigid structures.
*   **Developer Experience:** Aims for a clear API surface and straightforward integration, leveraging standard Angular patterns.

## Installation

```bash
npm install @r-ko/ngx-category-search@^0.3.0
```

Or using yarn:

```bash
yarn add @r-ko/ngx-category-search@^0.3.0
```

**Peer Dependencies:**

Ensure your project includes compatible versions of these packages:

*   `@angular/common`: `^17.1.0 || ^18.0.0 || ^19.0.0`
*   `@angular/core`: `^17.1.0 || ^18.0.0 || ^19.0.0`
*   `@angular/forms`: `^17.1.0 || ^18.0.0 || ^19.0.0`
*   `@angular/platform-browser`: `^17.1.0 || ^18.0.0 || ^19.0.0` (Required for `DomSanitizer` used by `MultiWordHighlightPipe` and the "Search for {term}" feature)
*   `rxjs`: `~7.8.0`

## Basic Usage

1.  **Import `CategorySearchComponent` (and optionally `MultiWordHighlightPipe`) into your Angular component or module:**

    ```typescript
    // In your component.ts
    import { Component } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { CategorySearchComponent, MultiWordHighlightPipe, SearchDataItem } from '@r-ko/ngx-category-search';
    import { YourSearchService, YourDataType } from './your-search.service'; // Your application's service
    import { Observable, of } from 'rxjs';

    @Component({
      selector: 'app-my-search-feature',
      standalone: true,
      imports: [
        CommonModule,
        CategorySearchComponent,
        MultiWordHighlightPipe // If using custom templates with multi-word highlighting
      ],
      providers: [YourSearchService],
      templateUrl: './my-search-feature.component.html',
      // styleUrls: ['./my-search-feature.component.css']
    })
    export class MySearchFeatureComponent {
      initialCategoryData$: Observable<Record<string, number> | null>;
      searchResults$: Observable<YourDataType[] | null> = of(null);

      // Define required fields for your data type
      idField: keyof YourDataType = 'id'; // Replace 'id' with your actual ID field
      nameField: keyof YourDataType = 'name'; // Replace 'name' with your actual name field
      categoryField: keyof YourDataType = 'category'; // Replace 'category' with your actual category field

      constructor(private searchService: YourSearchService) {
        this.initialCategoryData$ = this.searchService.getInitialCategoryCounts();
      }

      onSearchRequested(term: string): void {
        if (term) {
          this.searchResults$ = this.searchService.fetchResults(term);
        } else {
          this.searchResults$ = of(null);
        }
      }

      onItemSelected(item: YourDataType): void {
        console.log('Item selected:', item);
        // Navigate or perform action
      }

      onEnterPressed(term: string): void {
        console.log('Enter pressed with term:', term);
        // Optionally trigger a global search or navigation
      }
       // ... other event handlers
    }
    ```

2.  **Add the component to your template:**

    ```html
    <!-- my-search-feature.component.html -->
    <div style="max-width: 700px; margin: 20px auto;">
      <ncs-category-search
        [data]="initialCategoryData$ | async"
        [searchResults]="searchResults$ | async"
        [trackByIdField]="idField"
        [nameField]="nameField"
        [categoryField]="categoryField"
        placeholder="Search for products, articles, users..."
        [enableRecentSearches]="true"
        [showSearchForTermLine]="true"
        [searchForTermFormat]="'Search all items for <b>{term}</b>'"
        (searchRequested)="onSearchRequested($event)"
        (itemSelected)="onItemSelected($event)"
        (enterKeyPressed)="onEnterPressed($event)"
        (navigateToAll)="handleNavigateToAll($event)"
        (navigateToCategory)="handleNavigateToCategory($event)">
        <!-- Optional: Add custom templates here -->
      </ncs-category-search>
    </div>
    ```

    *Your `YourSearchService` would handle API calls and data transformation.*
    *`YourDataType` should extend `SearchDataItem` (which is `Record<string, any>`) or be compatible.*

## API Reference

### Component Selector

`<ncs-category-search>`

### Inputs

| Input                         | Type                                                                                                               | Required   | Default Value                      | Description                                                                                                                               |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------------- | :--------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `data`                        | `T[] \| Record<CategoryKey, number> \| null`                                                                       | `false`    | `null`                             | Optional: Data for *initial* category chiclets. Can be an array of items (component calculates counts) or a direct map of category counts. |
| `searchResults`               | `T[] \| null`                                                                                                      | `false`    | `null`                             | **Core Input:** Results provided by the parent based on `searchRequested`. Should be an array of items.                                     |
| `trackByIdField`              | `keyof T`                                                                                                          | **`true`** | `undefined`                        | Property name of the unique identifier for each item (used for `trackBy`).                                                                |
| `nameField`                   | `keyof T`                                                                                                          | **`true`** | `undefined`                        | Property name of the primary display text for each item.                                                                                  |
| `categoryField`               | `keyof T`                                                                                                          | **`true`** | `undefined`                        | Property name used for grouping results into categories.                                                                                  |
| `friendlyIdField`             | `keyof T \| null`                                                                                                  | `false`    | `null`                             | Optional: Property name of a secondary identifier for display (e.g., a human-readable ID).                                                 |
| `placeholder`                 | `string`                                                                                                           | `false`    | `'Search...'`                      | Placeholder text for the input field.                                                                                                     |
| `debounceMs`                  | `number`                                                                                                           | `false`    | `300`                              | Delay (in milliseconds) before `searchRequested` is emitted after the user stops typing.                                                  |
| `resultsBatchSize`            | `number`                                                                                                           | `false`    | `5`                                | Initial number of items shown per category in the results list before a "Show more" link appears.                                         |
| `minSearchLength`             | `number`                                                                                                           | `false`    | `1`                                | Minimum number of characters required in the search term to trigger the `searchRequested` event.                                          |
| `initialDropdownState`        | `'closed' \| 'openOnFocus'`                                                                                        | `false`    | `'openOnFocus'`                    | Controls whether the dropdown opens automatically when the input field receives focus and is empty.                                       |
| `closeOnItemSelect`           | `boolean`                                                                                                          | `false`    | `true`                             | If `true`, the dropdown closes after an item is selected.                                                                                 |
| `closeOnNavigate`             | `boolean`                                                                                                          | `false`    | `true`                             | If `true`, the dropdown closes after a navigation link (e.g., "Show all", "Search for {term}") is clicked.                              |
| `enableRecentSearches`        | `boolean`                                                                                                          | `false`    | `true`                             | Toggles the display and `localStorage` persistence of recent search terms.                                                                |
| `maxRecentSearches`           | `number`                                                                                                           | `false`    | `5`                                | Maximum number of recent searches to store and display.                                                                                   |
| `recentSearchesKey`           | `string`                                                                                                           | `false`    | `'ngx_category_search_recent'`   | The `localStorage` key used for storing recent searches.                                                                                  |
| `showSearchForTermLine`       | `boolean`                                                                                                          | `false`    | `false`                            | If `true`, displays a line below chiclets (when a search term is active) to trigger a global search for the term.                          |
| `searchForTermFormat`         | `string`                                                                                                           | `false`    | `'Search for {term}'`            | Format string for the "Search for {term}" line. The library replaces `{term}` with the current search term. Can include `<b>{term}</b>`. |
| `allCategoryLabel`            | `string`                                                                                                           | `false`    | `'All'`                            | Label for the "All" category chiclet.                                                                                                     |
| `recentSearchesLabel`         | `string`                                                                                                           | `false`    | `'Recent Searches'`                | Section header text for recent searches.                                                                                                  |
| `noRecentSearchesLabel`       | `string`                                                                                                           | `false`    | `'No recent searches.'`            | Text displayed when no recent searches are available.                                                                                     |
| `noResultsLabel`              | `string`                                                                                                           | `false`    | `'No results found for'`           | Prefix for the message shown when no search results match the term. The term is appended.                                                 |
| `showAllResultsLabel`         | `string`                                                                                                           | `false`    | `'Show all'`                       | Prefix for the button at the bottom of the dropdown to navigate to all results. Counts and term are appended.                             |
| `showMoreLabel`               | `string`                                                                                                           | `false`    | `'Show more'`                      | Text for the "Show more" link within individual category result groups.                                                                   |
| `showAllCategoryLabel`        | `string`                                                                                                           | `false`    | `'Show all'`                       | Prefix for the link in category headers to navigate to all results for that specific category. Count is appended.                         |
| `showBottomShowAllButton`     | `boolean`                                                                                                          | `false`    | `true`                             | Toggles visibility of the main "Show all X results for 'term'" button at the bottom of the dropdown.                                      |
| `showCategoryShowAllLink`     | `boolean`                                                                                                          | `false`    | `true`                             | Toggles visibility of the "Show all [count]" link in category headers.                                                                    |
| `showCategoryShowMoreLink`    | `boolean`                                                                                                          | `false`    | `true`                             | Toggles visibility of the "Show more" link in category headers.                                                                           |
| `showInitialCategories`       | `boolean`                                                                                                          | `false`    | `true`                             | Toggles visibility of initial category chiclets (requires `data` input to be provided).                                                   |
| `showResultCategories`        | `boolean`                                                                                                          | `false`    | `true`                             | Toggles visibility of category chiclets when search results are displayed.                                                                |
| `hideAllChicletInitial`       | `boolean`                                                                                                          | `false`    | `true`                             | If `true`, hides the "All" chiclet in the initial view (when no search term is active).                                                   |
| `showChicletContainerBorder`  | `boolean`                                                                                                          | `false`    | `true`                             | Toggles visibility of the border below the chiclet container.                                                                             |
| `inputPrefixTemplate`         | `TemplateRef<any> \| null`                                                                                         | `false`    | `null`                             | Custom template to render content *before* the input field within the input group.                                                        |
| `inputSuffixTemplate`         | `TemplateRef<any> \| null`                                                                                         | `false`    | `null`                             | Custom template to render content *after* the input field (e.g., a custom clear button or search icon).                                   |
| `resultItemTemplate`          | `TemplateRef<{$implicit: T, term: string}> \| null`                                                                | `false`    | `null`                             | Custom template for rendering each individual result item in the list.                                                                    |
| `recentItemTemplate`          | `TemplateRef<{$implicit: string}> \| null`                                                                         | `false`    | `null`                             | Custom template for rendering each recent search term in the list.                                                                        |
| `chicletTemplate`             | `TemplateRef<{$implicit: {category: string, count: number, isActive: boolean, type: 'initial' \| 'results'}}> \| null` | `false`    | `null`                             | Custom template for the *entire* chiclet button. If provided, you are responsible for its appearance and click handling (via `selectCategory`). |
| `chicletContentTemplate`      | `TemplateRef<{$implicit: {category: string, count: number, isActive: boolean, type: 'initial' \| 'results'}}> \| null` | `false`    | `null`                             | Custom template for the *content inside* the default chiclet button structure.                                                            |
| `categoryHeaderTemplate`      | `TemplateRef<{$implicit: {category: string, count: number}, actions?: TemplateRef<any>}> \| null`                     | `false`    | `null`                             | Custom template for the *entire* category header row, including its title and action links area.                                          |
| `categoryHeaderContentTemplate`| `TemplateRef<{$implicit: {category: string, count: number}}> \| null`                                             | `false`    | `null`                             | Custom template for the *content inside* the default category header (specifically the name and count part).                              |
| `noResultsTemplate`           | `TemplateRef<{$implicit: string, isTermTooShort?: boolean, minSearchLengthVal?: number}> \| null`                   | `false`    | `null`                             | Custom template displayed when no results are found or if the term is too short. Context includes `isTermTooShort` and `minSearchLengthVal`. |
| `loadingTemplate`             | `TemplateRef<any> \| null`                                                                                         | `false`    | `null`                             | Custom template displayed while search results are being loaded (when `isLoading` is true).                                               |

*(`T` represents the generic type of your data items, which should be compatible with `Record<string, any>`. `CategoryKey` is an alias for `string`.)*

### Outputs

| Output                      | Payload Type                            | Description                                                                                                                                  |
| :-------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `searchRequested`           | `string`                                | **Core Output:** Emitted after `debounceMs` when the search term changes; signals the parent application to fetch data for the given term.      |
| `itemSelected`              | `T`                                     | Emitted when a search result item is selected from the list.                                                                                 |
| `recentSearchSelected`      | `string`                                | Emitted when a recent search term is selected. This also populates the input and triggers `searchRequested`.                                  |
| `categorySelected`          | `string`                                | Emitted when a category chiclet is selected (only in the results view, not the initial view). The library handles filtering by this category. |
| `showMoreClicked`           | `string` (CategoryKey)                  | Emitted when the "Show more" link is clicked within a category group, indicating the category for which to show more items.                    |
| `navigateToCategory`        | `{ term: string; category: string }`    | Emitted when the "Show all [count]" link in a category header is clicked. Useful for navigating to a dedicated page for that category's results. |
| `navigateToAll`             | `{ term: string }`                      | Emitted when the bottom "Show all results" button is clicked. Useful for navigating to a global search results page.                           |
| `searchCleared`             | `void`                                  | Emitted when the search input is cleared (e.g., via the clear button or by clicking outside if configured).                                    |
| `searchTermChanged`         | `string`                                | Emitted *immediately* whenever the search input value changes (no debounce).                                                                 |
| `dropdownVisibilityChanged` | `boolean`                               | Emitted when the dropdown's visibility state changes (`true` for open, `false` for closed).                                                  |
| `searchForTermClicked`      | `string`                                | Emitted when the "Search for {term}" line is clicked (if `showSearchForTermLine` is true). Provides the current search term.                  |
| `enterKeyPressed`           | `string`                                | Emitted when the Enter key is pressed while the search input is focused. Provides the current search term.                                   |

## Customization

### Custom Templates

You can extensively customize the look and feel of the component using `ng-template`. Pass your `TemplateRef` to the corresponding `@Input`.

**Available Template Contexts:**

*   **`resultItemTemplate`:**
    *   `$implicit: T` (The data item for the current result)
    *   `term: string` (The current search term)
*   **`recentItemTemplate`:**
    *   `$implicit: string` (The recent search term string)
*   **`chicletTemplate`:** (For the *entire* chiclet button)
    *   `$implicit: { category: string, count: number, isActive: boolean, type: 'initial' | 'results' }`
*   **`chicletContentTemplate`:** (For content *inside* the default chiclet button)
    *   `$implicit: { category: string, count: number, isActive: boolean, type: 'initial' | 'results' }`
*   **`categoryHeaderTemplate`:** (For the *entire* category header row)
    *   `$implicit: { category: string, count: number }`
    *   `actions?: TemplateRef<any>` (A template containing the default "Show more" / "Show all" links for that header, which you can choose to render)
*   **`categoryHeaderContentTemplate`:** (For content *inside* the default category header's title area)
    *   `$implicit: { category: string, count: number }`
*   **`noResultsTemplate`:**
    *   `$implicit: string` (The current search term)
    *   `isTermTooShort?: boolean` (True if the current term is shorter than `minSearchLength`)
    *   `minSearchLengthVal?: number` (The value of the `minSearchLength` input)
*   **`inputPrefixTemplate` / `inputSuffixTemplate` / `loadingTemplate`:**
    *   No specific context variables are passed by default.

**Example: Custom Result Item**
```html
<ng-template #customResult let-item let-term="term">
  <div class="my-custom-item">
    <img [src]="item.imageUrl" alt="" class="my-item-icon">
    <div>
      <strong [innerHTML]="item.productName | multiWordHighlight: term"></strong>
      <small>{{ item.sku }}</small>
    </div>
  </div>
</ng-template>

<ncs-category-search [resultItemTemplate]="customResult" ...></ncs-category-search>
```

### Included Pipes

The library exports two pipes for text highlighting, which you can use in your custom templates:

*   **`HighlightPipe`:**
    *   Name: `highlight`
    *   Usage: `[innerHTML]="textToHighlight | highlight: searchTerm"`
    *   Description: Highlights a single search term within a string by wrapping matches in `<b>` tags. Returns a `string`.
*   **`MultiWordHighlightPipe`:**
    *   Name: `multiWordHighlight`
    *   Usage: `[innerHTML]="textToHighlight | multiWordHighlight: searchTerm"`
    *   Description: Highlights multiple words from the search term (space-separated) within a string by wrapping matches in `<b>` tags. Returns `SafeHtml` (requires `DomSanitizer`).

    To use these, ensure `MultiWordHighlightPipe` (if used) and `CategorySearchComponent` are in the `imports` array of your standalone component or module.

### Styling & Theming

The component is styled with CSS Custom Properties (variables) for easy theming. Override these in your global stylesheet (e.g., `styles.css`) or a more specific parent selector.

**Key CSS Custom Properties:**

*   `--ncs-primary-color`: Primary theme color (e.g., for focus, active states).
*   `--ncs-focus-glow-color`: Color for the focus glow effect on the input.
*   `--ncs-border-color`: Default border color for input, dropdown.
*   `--ncs-dropdown-bg`: Background color of the dropdown.
*   `--ncs-hover-bg`: Background color for hover states on items.
*   `--ncs-chiclet-initial-bg`: Background for initial/disabled chiclets.
*   `--ncs-chiclet-search-bg`: Background for non-active chiclets in search results.
*   `--ncs-chiclet-active-bg`: Background for active/selected chiclets.
*   `--ncs-chiclet-search-hover-bg`: Hover background for non-active search chiclets.
*   `--ncs-chiclet-active-hover-bg`: Hover background for active chiclets.
*   `--ncs-chiclet-text-color`: Default text color for chiclets.
*   `--ncs-chiclet-search-text-color`: Text color for non-active search chiclets.
*   `--ncs-chiclet-active-text-color`: Text color for active chiclets.
*   `--ncs-text-muted`: Color for secondary or less important text.
*   `--ncs-match-text-color`: Text color for highlighted matches (used by pipes).
*   `--ncs-separator-color`: Color for separator lines within the dropdown.
*   `--ncs-error-color`: Color for error states or messages (not used by default).

**Example: Customizing Borders**
To remove the border below the chiclet container:
```html
<ncs-category-search [showChicletContainerBorder]="false" ...></ncs-category-search>
```

To remove other borders (e.g., around the main input, dropdown):
```css
/* In your consuming app's styles.css */
:root { /* Or a more specific selector wrapping your search component */
  --ncs-border-color: transparent; /* Affects main input and dropdown borders */
  --ncs-separator-color: transparent; /* Affects internal separator lines */
}

/* To remove borders specifically from the "Search for {term}" line */
.ncs-search-for-term-line { /* Target the specific class from library CSS */
  border-top: none !important;
  border-bottom: none !important;
}
```

## Development & Contribution

We welcome contributions! To get started:

1.  **Fork & Clone:** Fork the repository and clone it locally.
2.  **Setup:** Navigate to the workspace root (`ngx-category-search-workspace`) and run `npm install`.
3.  **Build Library:** `npm run build:lib` or `ng build ngx-category-search`. This builds the library into the `dist/ngx-category-search` folder.
4.  **Local Linking (for testing in another local project):**
    *   Navigate into the built library: `cd dist/ngx-category-search`
    *   Link it globally: `npm link`
    *   Navigate to your test application: `cd path/to/your/test-app`
    *   Link the library: `npm link @r-ko/ngx-category-search`
5.  **Serve Demo App (if available in workspace):** If a demo application exists within the workspace (e.g., under `projects/demo-app`), you can serve it using `ng serve demo-app` to test changes interactively after rebuilding the library.
6.  **Develop:** Make your changes in the `projects/ngx-category-search/src/lib` directory. Rebuild the library (`npm run build:lib`) to see changes reflected in linked projects or the demo app.
7.  **Test:** Ensure any relevant unit tests pass or are updated/added.
8.  **Pull Request:** Submit a PR detailing your changes, adhering to the Angular Style Guide.

## License

[MIT](LICENSE) &copy; 2025 Ram Kotagiri (rnrkotagiri@gmail.com)
````
