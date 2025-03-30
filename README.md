# ngx-category-search

<!--[![NPM Version](https://img.shields.io/npm/v/@your-npm-username/ngx-category-search.svg)](https://www.npmjs.com/package/@r-ko/ngx-category-search)-->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Add other badges if applicable: build status, coverage, etc. -->

**ngx-category-search** is a highly configurable Angular standalone component for creating category-based search dropdowns with filtering, suggestions, recent searches, and UI inspired by the Azure Portal experience.

<!-- Placeholder for GIF/Screenshot -->
<!--**(Demo GIF/Screenshot Placeholder)**-->

## Features

*   **Dynamic Search & Filtering:** Real-time filtering of provided data as the user types.
*   **Configurable Search Logic:** Supports searching across multiple fields (primary name, optional friendly ID) with configurable logic (whole word vs. substring, minimum length for ID search).
*   **Category Chiclets:** Displays categories as filter chiclets (pills) with item counts, both initially and based on search results.
*   **Grouped Results:** Search results are visually grouped by category.
*   **Recent Searches:** Optionally stores and displays recent searches using `localStorage`.
*   **Pagination/Show More:** Handles large result sets within categories using a "Show more" link (reveals all within the dropdown for that category).
*   **Navigation Integration:** Emits events to allow the consuming application to handle navigation to full search results pages (overall or category-specific).
*   **Highlighting:** Bolds the matched search term within result names.
*   **Customizable Templates:** Allows providing custom Angular templates (`ng-template`) for rendering result items, recent search items, chiclets, headers, and more.
*   **Configurable Behavior:** Numerous `@Input` properties to control behavior like debouncing, batch sizes, initial state, feature toggles, and UI labels.
*   **Theming:** Uses CSS Custom Properties for easy theming and style overrides.
*   **Standalone:** Built as an Angular standalone component for easy integration.
*   **Generic:** Works with generic data types (`Record<string, any>`).

## Installation

```bash
npm install @r-ko/ngx-category-search
```

Or using yarn:

```bash
yarn add @r-ko/ngx-category-search
```

**Peer Dependencies:**

This library requires the following peer dependencies to be installed in your project:

*   `@angular/common` (^17.1.0 || ^18.0.0)
*   `@angular/core` (^17.1.0 || ^18.0.0)
*   `@angular/forms` (^17.1.0 || ^18.0.0)
*   `rxjs` (~7.8.0)

## Usage

1.  **Import `CategorySearchComponent`:** Import the component into your Angular standalone component or module where you want to use it.

    ```typescript
    // Example in your component.ts
    import { Component } from '@angular/core';
    import { CategorySearchComponent, SearchDataItem } from '@r-ko/ngx-category-search'; // Import component and type
    import { HighlightPipe } from '@r-ko/ngx-category-search'; // Import pipe IF using custom templates that need it
    import { CommonModule } from '@angular/common'; // For *ngIf, *ngFor in your template

    // Define your application-specific data structure
    interface MyData extends SearchDataItem {
      uuid: string; // Using 'uuid' as the unique ID field
      resourceId: string; // Using 'resourceId' as the friendly ID
      resourceName: string; // Using 'resourceName' as the primary name
      resourceType: string; // Using 'resourceType' as the category
      region: string;
      status: 'active' | 'inactive';
    }

    @Component({
      selector: 'app-my-feature',
      standalone: true,
      imports: [
          CommonModule,
          CategorySearchComponent, // Import the library component
          // HighlightPipe // Only needed here if custom template uses it directly
      ],
      template: `
        <h2>My Application Search</h2>
        <ncs-category-search
            [data]="myData"
            trackByIdField="uuid"
            nameField="resourceName"
            categoryField="resourceType"
            friendlyIdField="resourceId"
            [placeholder]="'Search resources by name or ID...'"
            [resultsBatchSize]="8"
            [resultItemTemplate]="customItemTpl"
            (itemSelected)="onItemSelected($event)"
            (navigateToAll)="onNavigateAll($event)"
            (navigateToCategory)="onNavigateCategory($event)"
        >
        </ncs-category-search>

        <!-- Custom Template Definition -->
        <ng-template #customItemTpl let-item let-term="term">
           <span class="my-custom-icon">{{ getIcon(item.resourceType) }}</span>
           <span class="ncs-result-friendly-id">{{ item.resourceId }}</span>
           <div class="ncs-result-details">
              <span class="ncs-result-name" [innerHTML]="item.resourceName | highlight: term"></span>
              <span class="ncs-result-type">{{ item.resourceType }} - {{ item.region }}</span>
           </div>
           <span class="my-custom-status-indicator {{ item.status }}"></span>
        </ng-template>
      `
      // Add component styles if needed for .my-custom-icon etc.
    })
    export class MyFeatureComponent {
      myData: MyData[] = [ /* Your array of data objects */ ];

      onItemSelected(item: MyData) {
        console.log('Item selected in parent:', item);
        // Navigate or perform action
      }

      onNavigateAll(event: { term: string }) {
        console.log('Navigate all requested:', event);
        // Use Angular Router: this.router.navigate(['/search'], { queryParams: { q: event.term } });
      }

      onNavigateCategory(event: { term: string; category: string }) {
        console.log('Navigate category requested:', event);
        // Use Angular Router: this.router.navigate(['/search'], { queryParams: { q: event.term, category: event.category } });
      }

      // Helper for custom template
      getIcon(type: string): string {
         switch(type.toLowerCase()) {
             case 'app service': return '⚙️';
             case 'virtual machine': return '💻';
             default: return '📄';
         }
      }
    }
    ```

## API Reference

### Component Selector

`<ncs-category-search>`

### Inputs

| Input                     | Type                                                                                                               | Required | Default Value                      | Description                                                                                              |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------- | :------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `data`                    | `T[]` (where `T extends SearchDataItem`)                                                                           | `false`  | `[]`                               | The array of data objects to search through.                                                             |
| `trackByIdField`          | `keyof T`                                                                                                          | **`true`** | `undefined`                        | The name of the property on data items that serves as a unique identifier (for `*ngFor` trackBy).        |
| `nameField`               | `keyof T`                                                                                                          | **`true`** | `undefined`                        | The name of the property used for the primary display text and whole-word search matching.               |
| `categoryField`           | `keyof T`                                                                                                          | **`true`** | `undefined`                        | The name of the property used to group results into categories.                                          |
| `friendlyIdField`         | `keyof T \| null`                                                                                                  | `false`  | `null`                             | Optional: The name of the property used for secondary ID display and substring search (min length applies). |
| `placeholder`             | `string`                                                                                                           | `false`  | `'Search...'`                      | Placeholder text for the search input field.                                                             |
| `debounceMs`              | `number`                                                                                                           | `false`  | `300`                              | Debounce time in milliseconds before triggering a search after user stops typing.                      |
| `minFriendlyIdSearchLength` | `number`                                                                                                           | `false`  | `3`                                | Minimum length of the search term required to trigger searching against the `friendlyIdField`.           |
| `resultsBatchSize`        | `number`                                                                                                           | `false`  | `5`                                | Initial number of results shown per category before "Show more" is needed.                               |
| `initialDropdownState`    | `'closed' \| 'openOnFocus'`                                                                                        | `false`  | `'openOnFocus'`                    | Controls if the dropdown opens automatically when the input gains focus (before typing).                 |
| `closeOnItemSelect`       | `boolean`                                                                                                          | `false`  | `true`                             | Whether the dropdown should close automatically after an item is selected.                             |
| `closeOnNavigate`         | `boolean`                                                                                                          | `false`  | `true`                             | Whether the dropdown should close automatically after a navigation event (`navigateToAll`, `navigateToCategory`) is emitted. |
| `enableRecentSearches`    | `boolean`                                                                                                          | `false`  | `true`                             | Enables/disables the recent searches feature (uses `localStorage`).                                      |
| `maxRecentSearches`       | `number`                                                                                                           | `false`  | `5`                                | Maximum number of unique recent searches to store and display.                                         |
| `recentSearchesKey`       | `string`                                                                                                           | `false`  | `'ngx_category_search_recent'`   | The key used for storing recent searches in `localStorage`. Customize to avoid conflicts.                |
| `allCategoryLabel`        | `string`                                                                                                           | `false`  | `'All'`                            | Text label used for the "All" category chiclet.                                                          |
| `recentSearchesLabel`     | `string`                                                                                                           | `false`  | `'Recent Searches'`                | Heading text for the recent searches section.                                                          |
| `noRecentSearchesLabel`   | `string`                                                                                                           | `false`  | `'No recent searches.'`            | Text displayed when there are no recent searches.                                                        |
| `noResultsLabel`          | `string`                                                                                                           | `false`  | `'No results found for'`           | Prefix for the message displayed when no results match the search term (term is appended).             |
| `showAllResultsLabel`     | `string`                                                                                                           | `false`  | `'Show all'`                       | Prefix text for the bottom "Show all results" button (count and term are appended).                      |
| `showMoreLabel`           | `string`                                                                                                           | `false`  | `'Show more'`                      | Text for the "Show more" link in category headers.                                                       |
| `showAllCategoryLabel`    | `string`                                                                                                           | `false`  | `'Show all'`                       | Prefix text for the "Show all [count]" link in category headers (count is appended).                 |
| `showBottomShowAllButton` | `boolean`                                                                                                          | `false`  | `true`                             | Toggles the visibility of the main "Show all X results for 'Y'" button at the bottom of the dropdown.   |
| `showCategoryShowAllLink` | `boolean`                                                                                                          | `false`  | `true`                             | Toggles the visibility of the "Show all [count]" link within each category header.                     |
| `showCategoryShowMoreLink`| `boolean`                                                                                                          | `false`  | `true`                             | Toggles the visibility of the "Show more" link within each category header.                          |
| `showInitialCategories`   | `boolean`                                                                                                          | `false`  | `true`                             | Toggles the visibility of category chiclets in the initial (empty search) view.                        |
| `showResultCategories`    | `boolean`                                                                                                          | `false`  | `true`                             | Toggles the visibility of category chiclets in the search results view.                                |
| `hideAllChicletInitial`   | `boolean`                                                                                                          | `false`  | `true`                             | If `true`, the "All" category chiclet is hidden in the initial view (only shown in results view).        |
| `inputPrefixTemplate`     | `TemplateRef<any> \| null`                                                                                         | `false`  | `null`                             | Custom template to render before the input field (e.g., custom icon).                                  |
| `inputSuffixTemplate`     | `TemplateRef<any> \| null`                                                                                         | `false`  | `null`                             | Custom template to render after the input field (e.g., custom clear button).                             |
| `resultItemTemplate`      | `TemplateRef<{$implicit: T, term: string}> \| null`                                                                | `false`  | `null`                             | Custom template for rendering each result item. Context provides the data item (`$implicit`) and current search `term`. |
| `recentItemTemplate`      | `TemplateRef<{$implicit: string}> \| null`                                                                         | `false`  | `null`                             | Custom template for rendering each recent search item. Context provides the search term string (`$implicit`). |
| `chicletTemplate`         | `TemplateRef<{$implicit: {category: string, count: number, isActive: boolean, type: 'initial' \| 'results'}}> \| null` | `false`  | `null`                             | Custom template for rendering category chiclets. Context provides category name, count, active status, and type ('initial' or 'results'). |
| `categoryHeaderTemplate`  | `TemplateRef<{$implicit: {category: string, count: number}, actions?: TemplateRef<any>}> \| null`                     | `false`  | `null`                             | Custom template for category headers in results view. Context provides category name, count, and optionally the default actions template (`actions`). |
| `noResultsTemplate`       | `TemplateRef<{$implicit: string}> \| null`                                                                         | `false`  | `null`                             | Custom template displayed when no results are found. Context provides the search term (`$implicit`).   |
| `loadingTemplate`         | `TemplateRef<any> \| null`                                                                                         | `false`  | `null`                             | Custom template displayed while results are loading (after debounce).                                  |

*(`T` represents the generic type of your data items passed to the `data` input)*

### Outputs

| Output                      | Payload Type                            | Description                                                                                                |
| :-------------------------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `itemSelected`              | `T`                                     | Emitted when a user selects (clicks or keypresses Enter/Space on) a result item from the list. Payload is the full data item. |
| `recentSearchSelected`      | `string`                                | Emitted when a user selects a recent search term. Payload is the selected term string.                      |
| `categorySelected`          | `string`                                | Emitted when a user selects a category chiclet *in the search results view*. Payload is the category name.   |
| `showMoreClicked`           | `string`                                | Emitted when the user clicks the "Show more" link within a category header. Payload is the category name.   |
| `navigateToCategory`        | `{ term: string; category: string }`    | Emitted when the user clicks the "Show all [count]" link within a category header. Provides search term and category. |
| `navigateToAll`             | `{ term: string }`                      | Emitted when the user clicks the bottom "Show all results" button. Provides the search term.                 |
| `searchCleared`             | `void`                                  | Emitted when the user clicks the clear ('x') button in the search input.                                   |
| `searchTermChanged`         | `string`                                | Emitted after the specified `debounceMs` when the search term input value changes.                       |
| `dropdownVisibilityChanged` | `boolean`                               | Emitted when the dropdown opens (`true`) or closes (`false`).                                              |

### Custom Templates Context

*   **`resultItemTemplate`:**
    *   `$implicit: T`: The data item for the current row.
    *   `term: string`: The current search term value.
*   **`recentItemTemplate`:**
    *   `$implicit: string`: The recent search term string.
*   **`chicletTemplate`:**
    *   `$implicit: { category: string, count: number, isActive: boolean, type: 'initial' | 'results' }`: Context object for the chiclet.
*   **`categoryHeaderTemplate`:**
    *   `$implicit: { category: string, count: number }`: Context object for the header.
    *   `actions?: TemplateRef<any>`: An optional template reference to the default "Show more"/"Show all" links for that category. You can render this inside your custom header using `[ngTemplateOutlet]="actions"`.
*   **`noResultsTemplate`:**
    *   `$implicit: string`: The search term that yielded no results.

### Included Pipes

*   **`HighlightPipe`:** Can be imported from `@r-ko/ngx-category-search` if you need to apply bolding to matches within your custom `resultItemTemplate`.
    *   Usage: `[innerHTML]="item[nameField] | highlight: term"`

### Styling & Theming

The component uses CSS Custom Properties for easy theming. Override these variables in your global stylesheet or a parent component's stylesheet to change the appearance:

```css
/* Example overrides in your styles.css */
:root { /* Or target a specific container */
  --ncs-primary-color: #e83e8c; /* Change primary blue to pink */
  --ncs-chiclet-active-bg: #bf1d69; /* Darker pink for active chiclet */
  --ncs-match-text-color: #bf1d69;
  --ncs-font-family: 'Lato', sans-serif; /* Change font */
  /* ... override other variables as needed ... */
}

/* If library ViewEncapsulation is Emulated (Default): */
/* Use ::ng-deep carefully or rely on custom properties */
/*
:host ::ng-deep ncs-category-search .ncs-input {
    border-radius: 20px;
}
*/

/* If library ViewEncapsulation is None: */
/* Direct overrides work but risk conflicts */
/*
ncs-category-search .ncs-input {
    border-radius: 20px;
}
*/

```

**List of CSS Custom Properties:**

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

1.  Clone the repository: `git clone <YOUR REPO URL>`
2.  Navigate to workspace: `cd ngx-category-search-workspace`
3.  Install dependencies: `npm install`
4.  Build the library: `npm run build:lib` or `ng build ngx-category-search`
5.  Link for local testing:
    *   `cd dist/ngx-category-search`
    *   `npm link`
    *   `cd path/to/your/test-app`
    *   `npm link @r-ko/ngx-category-search`
6.  Run the test application: `ng serve`

Contributions are welcome! Please follow standard fork/pull request procedures. Ensure tests pass and code adheres to Angular style guidelines.

## License

[MIT](LICENSE) &copy; <Ram Kotagiri/rnrkotagiri@gmail.com>

```