# ngx-category-search

[![NPM Version](https://img.shields.io/npm/v/@r-ko/ngx-category-search.svg)](https://www.npmjs.com/package/@r-ko/ngx-category-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/r-k-o/ngx-category-search/main.yml?branch=main)](https://github.com/r-k-o/ngx-category-search/actions/workflows/main.yml) <!-- Placeholder - Update if you have CI -->
<!-- Add other badges: coverage, downloads, etc. -->

**Version:** 0.2.0

**`ngx-category-search`** provides a sophisticated, highly configurable Angular component for crafting intuitive, category-driven search experiences. Inspired by the Azure Portal's search paradigm, it offers a robust UI foundation while cleanly decoupling data fetching logic, empowering developers to integrate complex search functionalities with ease.

---

<!-- 🖼️ Placeholder for an engaging GIF showcasing the component in action -->
**[Demo GIF/Screenshot Placeholder - Replace this line]**

---

## Core Concepts & Features

`ngx-category-search` focuses on providing a flexible UI layer for search interactions:

*   **Decoupled Data Fetching:** Embraces a reactive pattern by emitting debounced search terms (`searchRequested`), allowing the host application to manage data retrieval via any backend or state management solution. Results are seamlessly fed back via the `searchResults` input.
*   **Dynamic Categorization:** Intelligently displays filter chiclets based on categories derived from initial data (`data` input for pre-search context) and live search results (`searchResults`).
*   **Structured Result Presentation:** Organizes search results visually under collapsible category headers within the dropdown.
*   **Stateful Recent Searches:** Enhances user workflow with optional `localStorage`-backed persistence of recent search terms.
*   **Controlled Result Visibility:** Manages large category result sets gracefully with "Show more" links for progressive disclosure within the dropdown.
*   **Seamless Navigation Hooks:** Provides dedicated output events (`navigateToAll`, `navigateToCategory`) for integrating with application routing, enabling transitions to dedicated search result views.
*   **Extensible UI Customization:** Offers extensive control over presentation through `ng-template` outlets for nearly every UI element (results, chiclets, headers, input adornments, loading/empty states).
*   **Fine-Grained Configuration:** A rich set of `@Input` properties allows precise tuning of behavior (debouncing, batching, initial state, feature toggles) and localization (UI labels).
*   **Themeable Foundation:** Leverages CSS Custom Properties for straightforward styling and adaptation to various design systems.
*   **Modern Angular:** Built as a standalone component, promoting modularity and aligning with current Angular best practices.
*   **Type Safety:** Utilizes generics (`<T extends SearchDataItem>`) for enhanced type checking in consuming applications.

## Design Philosophy

*   **Separation of Concerns:** The component deliberately focuses on the *presentation* and *interaction* aspects of search, leaving data fetching and state management to the consuming application. This promotes flexibility and testability.
*   **Configurability over Opinion:** Provides numerous inputs and template hooks to adapt to diverse requirements rather than imposing rigid structures.
*   **Developer Experience:** Aims for a clear API surface and straightforward integration, leveraging standard Angular patterns.

## Installation

```bash
npm install @r-ko/ngx-category-search@^0.2.0
```

Or using yarn:

```bash
yarn add @r-ko/ngx-category-search@^0.2.0
```

**Peer Dependencies:**

Ensure your project includes compatible versions of these packages:

*   `@angular/common` (^17.1.0 || ^18.0.0 || ^19.0.0)
*   `@angular/core` (^17.1.0 || ^18.0.0 || ^19.0.0)
*   `@angular/forms` (^17.1.0 || ^18.0.0 || ^19.0.0)
*   `rxjs` (~7.8.0)

## Usage Example

Integrate `ncs-category-search` into your component, connect it to your data fetching logic, and optionally provide custom templates.

```typescript
// 1. Import necessary modules and components
import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategorySearchComponent, SearchDataItem, HighlightPipe } from '@r-ko/ngx-category-search';
import { MySearchService, MyData } from './my-search.service'; // Your data service
import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'app-my-feature',
  standalone: true,
  imports: [ CommonModule, CategorySearchComponent, HighlightPipe ],
  providers: [MySearchService],
  template: `
    <div class="search-wrapper">
      <ncs-category-search
          [data]="initialCategoryData$ | async" <!-- Optional: Async pipe for initial data -->
          [searchResults]="searchData$ | async" <!-- Async pipe for search results -->
          trackByIdField="uuid"
          nameField="resourceName"
          categoryField="resourceType"
          [friendlyIdField]="'resourceId'"
          [placeholder]="'Search resources...'"
          [resultItemTemplate]="customItemTpl"
          (searchRequested)="onSearchRequested($event)"
          (itemSelected)="onItemSelected($event)"
          (navigateToAll)="onNavigateAll($event)"
          (navigateToCategory)="onNavigateCategory($event)"
          (searchCleared)="onSearchCleared()"
      />
    </div>

    <!-- Define Custom Templates -->
    <ng-template #customItemTpl let-item let-term="term">
       <!-- Your custom item rendering -->
       <span [innerHTML]="item.resourceName | highlight: term"></span>
       <!-- ... -->
    </ng-template>
  `,
  styles: [`.search-wrapper { max-width: 600px; margin: 2rem auto; }`],
  changeDetection: ChangeDetectionStrategy.OnPush // Recommended for performance
})
export class MyFeatureComponent implements OnInit, OnDestroy {
  private searchService = inject(MySearchService);
  private cdr = inject(ChangeDetectorRef); // Inject ChangeDetectorRef if needed
  private searchSub: Subscription | null = null;

  // Use Observables for reactive data binding
  searchData$: Observable<MyData[] | null> | null = null;
  initialCategoryData$: Observable<MyData[]> | null = null;

  ngOnInit() {
    // Fetch initial data for category counts (optional)
    this.initialCategoryData$ = this.searchService.getInitialData();
  }

  // 2. Handle search term emission
  onSearchRequested(term: string) {
    console.log('Parent: Search requested for:', term);
    if (!term) {
      this.searchData$ = null; // Clear results observable
    } else {
      // Trigger search via your service; assign the resulting Observable
      this.searchData$ = this.searchService.search(term);
    }
    // If not using async pipe directly on searchData$, manage subscription:
    // this.searchSub?.unsubscribe();
    // this.searchSub = this.searchService.search(term).subscribe(results => {
    //   this.searchData = results;
    //   this.cdr.markForCheck(); // Trigger change detection if needed
    // });
  }

  // 3. Implement action handlers
  onItemSelected(item: MyData) { /* ... handle selection ... */ }
  onNavigateAll(event: { term: string }) { /* ... handle navigation ... */ }
  onNavigateCategory(event: { term: string; category: string }) { /* ... handle navigation ... */ }
  onSearchCleared() { /* ... optional cleanup ... */ }

  ngOnDestroy() {
    // this.searchSub?.unsubscribe(); // Unsubscribe if managing manually
  }
}
```

## API Reference

### Component Selector

`<ncs-category-search>`

### Inputs

*(Detailed table follows - ensure accuracy based on the latest code)*

| Input                     | Type                                                                                                               | Required | Default Value                      | Description                                                                                              |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------- | :------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `data`                    | `T[]`                                                                                                              | `false`  | `[]`                               | Optional: Data source for *initial* category chiclet counts (pre-search).                                |
| `searchResults`           | `T[] \| null`                                                                                                      | `false`  | `null`                             | **Core Input:** Observable results provided by the parent based on `searchRequested`.                    |
| `trackByIdField`          | `keyof T`                                                                                                          | **`true`** | `undefined`                        | Unique identifier property name for `trackBy`.                                                           |
| `nameField`               | `keyof T`                                                                                                          | **`true`** | `undefined`                        | Primary display text property name.                                                                      |
| `categoryField`           | `keyof T`                                                                                                          | **`true`** | `undefined`                        | Property name used for grouping results into categories.                                                 |
| `friendlyIdField`         | `keyof T \| null`                                                                                                  | `false`  | `null`                             | Optional: Secondary identifier property name for display.                                                |
| `placeholder`             | `string`                                                                                                           | `false`  | `'Search...'`                      | Input field placeholder text.                                                                            |
| `debounceMs`              | `number`                                                                                                           | `false`  | `300`                              | Delay (ms) before `searchRequested` is emitted after typing stops.                                     |
| `resultsBatchSize`        | `number`                                                                                                           | `false`  | `5`                                | Initial number of items shown per category before "Show more".                                           |
| `initialDropdownState`    | `'closed' \| 'openOnFocus'`                                                                                        | `false`  | `'openOnFocus'`                    | Controls initial dropdown visibility on focus.                                                           |
| `enableRecentSearches`    | `boolean`                                                                                                          | `false`  | `true`                             | Toggle `localStorage`-based recent searches.                                                             |
| `maxRecentSearches`       | `number`                                                                                                           | `false`  | `5`                                | Maximum number of recent searches stored.                                                              |
| `recentSearchesKey`       | `string`                                                                                                           | `false`  | `'ngx_category_search_recent'`   | `localStorage` key for recent searches.                                                                  |
| `allCategoryLabel`        | `string`                                                                                                           | `false`  | `'All'`                            | Label for the "All" category chiclet.                                                                    |
| `recentSearchesLabel`     | `string`                                                                                                           | `false`  | `'Recent Searches'`                | Section header for recent searches.                                                                      |
| `noRecentSearchesLabel`   | `string`                                                                                                           | `false`  | `'No recent searches.'`            | Text shown when no recent searches exist.                                                                |
| `noResultsLabel`          | `string`                                                                                                           | `false`  | `'No results found for'`           | Prefix for the "no results" message.                                                                     |
| `showAllResultsLabel`     | `string`                                                                                                           | `false`  | `'Show all'`                       | Prefix for the bottom "Show all results" button.                                                         |
| `showMoreLabel`           | `string`                                                                                                           | `false`  | `'Show more'`                      | Text for the "Show more" link within categories.                                                         |
| `showAllCategoryLabel`    | `string`                                                                                                           | `false`  | `'Show all'`                       | Prefix for the "Show all [count]" link within categories.                                                |
| `showBottomShowAllButton` | `boolean`                                                                                                          | `false`  | `true`                             | Toggle visibility of the main "Show all X results" button.                                               |
| `showCategoryShowAllLink` | `boolean`                                                                                                          | `false`  | `true`                             | Toggle visibility of the "Show all [count]" link in category headers.                                    |
| `showCategoryShowMoreLink`| `boolean`                                                                                                          | `false`  | `true`                             | Toggle visibility of the "Show more" link in category headers.                                           |
| `showInitialCategories`   | `boolean`                                                                                                          | `false`  | `true`                             | Toggle visibility of initial category chiclets (requires `data` input).                                  |
| `showResultCategories`    | `boolean`                                                                                                          | `false`  | `true`                             | Toggle visibility of category chiclets during search results.                                            |
| `hideAllChicletInitial`   | `boolean`                                                                                                          | `false`  | `true`                             | Hide the "All" chiclet in the initial view.                                                              |
| `inputPrefixTemplate`     | `TemplateRef<any> \| null`                                                                                         | `false`  | `null`                             | Custom template before the input field.                                                                  |
| `inputSuffixTemplate`     | `TemplateRef<any> \| null`                                                                                         | `false`  | `null`                             | Custom template after the input field.                                                                   |
| `resultItemTemplate`      | `TemplateRef<{$implicit: T, term: string}> \| null`                                                                | `false`  | `null`                             | Custom template for each result item.                                                                    |
| `recentItemTemplate`      | `TemplateRef<{$implicit: string}> \| null`                                                                         | `false`  | `null`                             | Custom template for each recent search item.                                                             |
| `chicletTemplate`         | `TemplateRef<{$implicit: {category: string, count: number, isActive: boolean, type: 'initial' \| 'results'}}> \| null` | `false`  | `null`                             | Custom template for category chiclets.                                                                   |
| `categoryHeaderTemplate`  | `TemplateRef<{$implicit: {category: string, count: number}, actions?: TemplateRef<any>}> \| null`                     | `false`  | `null`                             | Custom template for category headers.                                                                    |
| `noResultsTemplate`       | `TemplateRef<{$implicit: string}> \| null`                                                                         | `false`  | `null`                             | Custom template for the "no results" message.                                                            |
| `loadingTemplate`         | `TemplateRef<any> \| null`                                                                                         | `false`  | `null`                             | Custom template for the loading state.                                                                   |
| ~~`closeOnItemSelect`~~   | `boolean`                                                                                                          | `false`  | `true`                             | **REMOVED/DEPRECATED:** Behavior changed in 0.2.0; dropdown stays open.                                  |
| ~~`closeOnNavigate`~~     | `boolean`                                                                                                          | `false`  | `true`                             | **REMOVED/DEPRECATED:** Behavior changed in 0.2.0; dropdown stays open.                                  |

*(`T` represents the generic type of your data items)*

### Outputs

*(Detailed table follows - ensure accuracy based on the latest code)*

| Output                      | Payload Type                            | Description                                                                                                |
| :-------------------------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `searchRequested`           | `string`                                | **Core Output:** Emitted after debounce; signals parent to fetch data for the given term.                    |
| `itemSelected`              | `T`                                     | Emitted on result item selection.                                                                          |
| `recentSearchSelected`      | `string`                                | Emitted on recent search selection (also triggers `searchRequested`).                                      |
| `categorySelected`          | `string`                                | Emitted on category chiclet selection (only in results view).                                              |
| `showMoreClicked`           | `string`                                | Emitted when "Show more" is clicked within a category.                                                     |
| `navigateToCategory`        | `{ term: string; category: string }`    | Emitted when "Show all [count]" is clicked in a category header.                                           |
| `navigateToAll`             | `{ term: string }`                      | Emitted when the bottom "Show all results" button is clicked.                                              |
| `searchCleared`             | `void`                                  | Emitted when search is cleared via button or external click.                                               |
| `searchTermChanged`         | `string`                                | Emitted *immediately* on input change (no debounce).                                                       |
| `dropdownVisibilityChanged` | `boolean`                               | Emitted when dropdown visibility changes.                                                                  |

### Custom Templates Context

*(Context details remain the same - ensure accuracy)*

*   **`resultItemTemplate`:** `$implicit: T`, `term: string`
*   **`recentItemTemplate`:** `$implicit: string`
*   **`chicletTemplate`:** `$implicit: { category: string, count: number, isActive: boolean, type: 'initial' | 'results' }` (Clicks handled internally)
*   **`categoryHeaderTemplate`:** `$implicit: { category: string, count: number }`, `actions?: TemplateRef<any>`
*   **`noResultsTemplate`:** `$implicit: string`

### Included Pipes

*   **`HighlightPipe`:** Import from `@r-ko/ngx-category-search` for use in custom templates: `[innerHTML]="item[nameField] | highlight: term"`

### Styling & Theming

Leverage CSS Custom Properties for seamless integration with your application's theme. Define overrides in a global scope (`:root` or a container element).

```css
/* Example: styles.css */
:root {
  --ncs-primary-color: #623cea; /* Example: Use a purple theme */
  --ncs-focus-glow-color: rgba(98, 58, 234, 0.3);
  --ncs-border-color: #d1d1d1;
  --ncs-dropdown-bg: #ffffff;
  --ncs-hover-bg: #f0f0f0;
  /* ... other overrides ... */
}
```

**(List of CSS Custom Properties remains the same)**

*   `--ncs-primary-color`
*   `--ncs-focus-glow-color`
*   `--ncs-border-color`
*   `--ncs-dropdown-bg`
*   `--ncs-hover-bg`
*   `--ncs-chiclet-initial-bg`
*   `--ncs-chiclet-search-bg`
*   `--ncs-chiclet-active-bg`
*   `--ncs-chiclet-search-hover-bg`
*   `--ncs-chiclet-active-hover-bg`
*   `--ncs-chiclet-text-color`
*   `--ncs-chiclet-search-text-color`
*   `--ncs-chiclet-active-text-color`
*   `--ncs-text-muted`
*   `--ncs-match-text-color`
*   `--ncs-separator-color`
*   `--ncs-error-color`

## Development & Contribution

We welcome contributions! To get started:

1.  **Fork & Clone:** Fork the repository and clone it locally.
2.  **Setup:** Navigate to the workspace (`ngx-category-search-workspace`) and run `npm install`.
3.  **Build Library:** `npm run build:lib` or `ng build ngx-category-search`.
4.  **Local Linking (Optional):**
    *   `cd dist/ngx-category-search` && `npm link`
    *   Navigate to your test application: `cd path/to/your/test-app` && `npm link @r-ko/ngx-category-search`
5.  **Serve Test App:** Run `ng serve` (assuming a demo app exists in the workspace) to test changes.
6.  **Develop:** Make your changes in the `projects/ngx-category-search/src/lib` directory.
7.  **Test:** Ensure any relevant tests pass or are updated.
8.  **Pull Request:** Submit a PR detailing your changes.

Please adhere to the Angular Style Guide and ensure your code is well-documented.

## License

[MIT](LICENSE) &copy; 2025 Ram Kotagiri (rnrkotagiri@gmail.com)