import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewEncapsulation,
  SimpleChanges,
  HostListener,
  ElementRef, // Import ViewEncapsulation
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { HighlightPipe } from '../../pipes/highlight.pipe'; // Adjust path as needed

// --- Types ---
export type SearchDataItem = Record<string, any>;
type CategoryKey = string; // Categories are identified by string values from the data
type GroupedResults<T> = { [key: CategoryKey]: T[] };
type CategoryCounts = { [key: CategoryKey]: number }; // Includes 'All' category label key
type VisibleCounts = { [key: CategoryKey]: number };

// Helper function (keep as is)// Helper function to escape regex characters (can be defined outside the class or inside if preferred)
function escapeRegex(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

@Component({
  selector: 'ncs-category-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HighlightPipe],
  templateUrl: './category-search.component.html',
  styleUrl: './category-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Use None encapsulation to allow easier global style overrides by consumers
  // Alternatively, use CSS custom properties extensively for customization points.
  // Using None is simpler but requires consumer care to avoid style collisions.
  // encapsulation: ViewEncapsulation.None,
})
export class CategorySearchComponent<T extends SearchDataItem>
  implements OnInit, OnDestroy
{
  constructor(private cdr: ChangeDetectorRef, private elementRef: ElementRef) {
    // Constructor logic if needed
  }

  // --- CORE INPUTS ---
  @Input() data: T[] = []; // Data source
  @Input({ required: true }) trackByIdField!: keyof T; // Unique identifier field
  @Input({ required: true }) nameField!: keyof T; // Primary display/search field
  @Input({ required: true }) categoryField!: keyof T; // Field to group/categorize by
  @Input() friendlyIdField: keyof T | null = null; // Optional secondary search field

  // --- CONFIGURATION INPUTS ---
  @Input() placeholder: string = 'Search...';
  @Input() debounceMs: number = 300;
  @Input() minFriendlyIdSearchLength: number = 3;
  @Input() resultsBatchSize: number = 5; // Initial items shown per category
  @Input() initialDropdownState: 'closed' | 'openOnFocus' = 'openOnFocus'; // Control initial visibility behavior
  @Input() closeOnItemSelect: boolean = true; // Close dropdown when an item is selected
  @Input() closeOnNavigate: boolean = true; // Close dropdown when navigation is triggered

  // --- RECENT SEARCH CONFIGURATION ---
  @Input() enableRecentSearches: boolean = true; // Feature toggle
  @Input() maxRecentSearches: number = 5;
  @Input() recentSearchesKey: string = 'ngx_category_search_recent';

  // --- UI LABEL INPUTS ---
  @Input() allCategoryLabel: string = 'All';
  @Input() recentSearchesLabel: string = 'Recent Searches';
  @Input() noRecentSearchesLabel: string = 'No recent searches.';
  @Input() noResultsLabel: string = 'No results found for';
  @Input() showAllResultsLabel: string = 'Show all'; // Prefix for bottom button
  @Input() showMoreLabel: string = 'Show more';
  @Input() showAllCategoryLabel: string = 'Show all'; // Prefix for category header link

  // --- FEATURE TOGGLE INPUTS ---
  @Input() showBottomShowAllButton: boolean = true; // Toggle bottom button visibility
  @Input() showCategoryShowAllLink: boolean = true; // Toggle category header "Show all" link
  @Input() showCategoryShowMoreLink: boolean = true; // Toggle category header "Show more" link
  @Input() showInitialCategories: boolean = true; // Toggle initial category chiclets
  @Input() showResultCategories: boolean = true; // Toggle result category chiclets
  @Input() hideAllChicletInitial: boolean = true; // Hide 'All' only on initial view

  // --- CUSTOM TEMPLATE INPUTS ---
  @Input() inputPrefixTemplate: TemplateRef<any> | null = null; // Before input field
  @Input() inputSuffixTemplate: TemplateRef<any> | null = null; // After input field (e.g., custom icons)
  @Input() resultItemTemplate: TemplateRef<{
    $implicit: T;
    term: string;
  }> | null = null; // Passes item and current term
  @Input() recentItemTemplate: TemplateRef<{ $implicit: string }> | null = null; // Passes recent search term string
  @Input() chicletTemplate: TemplateRef<{
    $implicit: {
      category: string;
      count: number;
      isActive: boolean;
      type: 'initial' | 'results';
    };
  }> | null = null; // Passes context
  @Input() categoryHeaderTemplate: TemplateRef<{
    $implicit: { category: string; count: number };
    actions?: TemplateRef<any>;
  }> | null = null; // Passes category, count, optional default actions template
  @Input() noResultsTemplate: TemplateRef<{ $implicit: string }> | null = null;
  @Input() loadingTemplate: TemplateRef<any> | null = null;

  // --- OUTPUTS (User Actions / Events) ---
  @Output() itemSelected = new EventEmitter<T>(); // User clicked/selected a result item
  @Output() recentSearchSelected = new EventEmitter<string>(); // User clicked a recent search term
  @Output() categorySelected = new EventEmitter<string>(); // User clicked a category chiclet (results view)
  @Output() showMoreClicked = new EventEmitter<string>(); // User clicked 'Show more' in a category header
  @Output() navigateToCategory = new EventEmitter<{
    term: string;
    category: string;
  }>(); // User clicked 'Show all [count]' in category header
  @Output() navigateToAll = new EventEmitter<{ term: string }>(); // User clicked the bottom 'Show all results' button
  @Output() searchCleared = new EventEmitter<void>(); // User clicked the clear ('x') button
  @Output() searchTermChanged = new EventEmitter<string>(); // Debounced search term emitted
  @Output() dropdownVisibilityChanged = new EventEmitter<boolean>(); // Emits true when opened, false when closed

  // --- Internal State Properties ---
  searchTerm = new FormControl('');
  isDropdownVisible = false;
  isLoading = false;
  activeCategory!: string;

  initialCategories: CategoryCounts = {};
  recentSearches: string[] = [];
  filteredResults: T[] = [];
  groupedResults: GroupedResults<T> = {};
  filteredCategories: CategoryCounts = {};
  visibleCounts: VisibleCounts = {};

  private searchSubscription: Subscription | null = null;
  blurTimeout: any;
  isInitial = true; // Flag for initial state logic

    /**
   * Prevents default mousedown behavior and clears the blur timeout.
   * To be called from (mousedown) handlers in the template.
   * @param event The DOM MouseEvent
   */
    public handleDropdownInteraction(event: MouseEvent): void {
      event.preventDefault(); // Prevent blur from triggering immediately on some elements
      clearTimeout(this.blurTimeout); // Clear any pending blur timeout
    }

  // --- Lifecycle Hooks ---
  ngOnInit(): void {
    this.isInitial = true; // Set initial flag
    this.activeCategory = this.allCategoryLabel;
    if (this.enableRecentSearches) {
      this.loadRecentSearches();
    }
    if (this.data && this.data.length > 0) {
      this.calculateInitialCategoryCounts();
    }
    this.setupSearchDebounce();
    if (this.initialDropdownState === 'closed') {
      this.isDropdownVisible = false;
    }
  }

  // Handle data changes from Input
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      // Recalculate initial state if data input changes after init
      this.calculateInitialCategoryCounts();
      // Optionally, re-run current search if term exists? Or just reset? Let's reset for simplicity.
      if (this.searchTerm.value) {
        this.performSearch(this.searchTerm.value);
      } else {
        this.resetToInitialState(false); // Don't reload recent searches again
      }
      this.cdr.markForCheck();
    }
    // Update activeCategory label if allCategoryLabel changes
    if (
      changes['allCategoryLabel'] &&
      this.activeCategory !== this.allCategoryLabel &&
      !this.searchTerm.value
    ) {
      this.activeCategory = this.allCategoryLabel;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    clearTimeout(this.blurTimeout);
  }

  // --- Internal Visibility Control ---
  private setDropdownVisibility(visible: boolean): void {
    if (this.isDropdownVisible !== visible) {
      this.isDropdownVisible = visible;
      this.dropdownVisibilityChanged.emit(visible); // Emit event
      this.cdr.markForCheck();
    }
  }

  // --- Event Handlers (Internal Dropdown Logic) ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      if (this.isDropdownVisible) {
        this.setDropdownVisibility(false); // Use setter
        if (this.searchTerm.value) {
          this.searchTerm.setValue(''); // Triggers reset via subscription
        }
      }
    }
  }

  onFocus(): void {
    clearTimeout(this.blurTimeout);
    // Only open on focus if configured or if results exist
    if (
      this.initialDropdownState === 'openOnFocus' ||
      this.filteredResults.length > 0 ||
      !this.searchTerm.value
    ) {
      if (!this.searchTerm.value && this.isInitial) {
        this.calculateInitialCategoryCounts(); // Ensure calculated on first focus
      }
      this.setDropdownVisibility(true); // Use setter
    }
    if (!this.searchTerm.value) {
      this.resetToInitialState();
    }
  }

  onBlur(): void {
    this.blurTimeout = setTimeout(() => {
      if (this.isDropdownVisible) {
        this.setDropdownVisibility(false); // Use setter
      }
    }, 150);
  }

  clearSearch(event?: MouseEvent): void {
    clearTimeout(this.blurTimeout); // <-- Add timeout clear
    if (event) {
       event.stopPropagation(); // Keep stopping propagation if needed
    }
    this.searchTerm.setValue('');
    this.searchCleared.emit();
    this.setDropdownVisibility(true); // Keep open
  }

  // --- Event Handlers (User Interaction -> Output Events) ---

  selectCategory(category: string, event?: MouseEvent): void {
    clearTimeout(this.blurTimeout);
    if (event) event.stopPropagation();

    if (this.activeCategory === category) return;

    this.activeCategory = category;
    // Emit only if category selected in results view (not initial)
    if (this.searchTerm.value) {
      this.categorySelected.emit(category);
    }

    if (category === this.allCategoryLabel) {
      this.resetVisibleCounts();
    }
    this.cdr.markForCheck();
  }

  selectRecentSearch(term: string, event?: Event): void {
    clearTimeout(this.blurTimeout);
    if (event) event.stopPropagation();
    this.searchTerm.setValue(term);
    this.recentSearchSelected.emit(term); // Emit recent selected event
    this.setDropdownVisibility(true);
    // Search happens via subscription
  }

  onItemSelected(item: T, event?: Event): void {
    clearTimeout(this.blurTimeout);
    if (event) event.stopPropagation();
    this.itemSelected.emit(item);
    if (this.closeOnItemSelect) {
      this.setDropdownVisibility(false);
    }
  }

  onShowMore(categoryKey: CategoryKey, event: MouseEvent): void {
    clearTimeout(this.blurTimeout);
    event.stopPropagation();
    const currentGroup = this.groupedResults[categoryKey];
    if (currentGroup) {
      this.visibleCounts[categoryKey] = currentGroup.length;
      if (this.activeCategory !== categoryKey) {
        this.activeCategory = categoryKey; // Activate category when showing all its items
        this.categorySelected.emit(categoryKey); // Emit selection
      }
      this.showMoreClicked.emit(categoryKey); // Emit show more event
      this.cdr.markForCheck();
    }
  }

  onNavigateToCategorySearch(
    categoryKey: CategoryKey,
    event: MouseEvent
  ): void {
    clearTimeout(this.blurTimeout);
    event.stopPropagation();
    const term = this.searchTerm.value || '';
    this.navigateToCategory.emit({ term, category: categoryKey });
    if (this.closeOnNavigate) {
      this.setDropdownVisibility(false);
    }
  }

  onNavigateToAllResultsPage(event: MouseEvent): void {
    clearTimeout(this.blurTimeout);
    event.stopPropagation();
    const term = this.searchTerm.value || '';
    this.navigateToAll.emit({ term });
    if (this.closeOnNavigate) {
      this.setDropdownVisibility(false);
    }
  }

  // --- Internal Data Processing Logic ---

  private setupSearchDebounce(): void {
    this.searchSubscription = this.searchTerm.valueChanges
      .pipe(
        debounceTime(this.debounceMs),
        distinctUntilChanged(),
        tap((term) => {
          this.isInitial = !term; // Update initial flag
          this.isLoading = !!term;
          this.searchTermChanged.emit(term ?? '');
          this.cdr.markForCheck();
        })
      )
      .subscribe((term) => {
        if (term) {
          // Only perform search if term is not empty
          this.performSearch(term);
        } else {
          // If term is empty, reset
          this.resetToInitialState();
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  private performSearch(term: string): void {
    const searchTermTrimmed = term.trim(); // Already checked not empty

    const escapedTerm = escapeRegex(searchTermTrimmed);
    const nameSearchRegex = new RegExp('\\b' + escapedTerm + '\\b', 'i');
    const idSearchRegex = new RegExp(escapedTerm, 'i');

    this.filteredResults = this.data.filter((item) => {
      const nameValue = (item[this.nameField] as string | undefined) ?? '';
      const nameMatches = nameSearchRegex.test(nameValue);
      let idMatches = false;
      if (
        this.friendlyIdField &&
        searchTermTrimmed.length >= this.minFriendlyIdSearchLength
      ) {
        const friendlyIdValue =
          (item[this.friendlyIdField] as string | undefined) ?? '';
        idMatches = idSearchRegex.test(friendlyIdValue);
      }
      return nameMatches || idMatches;
    });

    this.groupResults();
    this.calculateFilteredCategoryCounts();
    this.resetVisibleCounts();
    this.activeCategory = this.allCategoryLabel;
    this.setDropdownVisibility(true); // Ensure dropdown visible

    // Add to recent searches only if feature enabled
    if (this.enableRecentSearches && term) {
      this.addRecentSearch(term);
    }
  }

  private resetToInitialState(reloadRecent = true): void {
    this.filteredResults = [];
    this.groupedResults = {};
    this.filteredCategories = {};
    this.visibleCounts = {};
    this.activeCategory = this.allCategoryLabel;
    this.calculateInitialCategoryCounts();
    if (this.enableRecentSearches && reloadRecent) {
      this.loadRecentSearches();
    }
    this.isInitial = true; // Back to initial state
    // Visibility depends on focus state
  }

  private calculateInitialCategoryCounts(): void {
    if (!this.data || this.data.length === 0) {
      this.initialCategories = { [this.allCategoryLabel]: 0 };
      return;
    }
    const counts: CategoryCounts = {};
    let total = 0;
    for (const item of this.data) {
      const category =
        (item[this.categoryField] as CategoryKey | undefined) ??
        'Uncategorized';
      counts[category] = (counts[category] || 0) + 1;
      total++;
    }
    counts[this.allCategoryLabel] = total;
    this.initialCategories = counts;
  }

  private calculateFilteredCategoryCounts(): void {
    const counts: CategoryCounts = {};
    let total = 0;
    for (const item of this.filteredResults) {
      const category =
        (item[this.categoryField] as CategoryKey | undefined) ??
        'Uncategorized';
      counts[category] = (counts[category] || 0) + 1;
      total++;
    }
    counts[this.allCategoryLabel] = total;
    this.filteredCategories = counts;
  }

  private groupResults(): void {
    // Logic remains the same, relies on categoryField
    const groups: GroupedResults<T> = {};
    for (const item of this.filteredResults) {
      const category =
        (item[this.categoryField] as CategoryKey | undefined) ??
        'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    }
    this.groupedResults = groups;
  }

  private resetVisibleCounts(): void {
    const newCounts: VisibleCounts = {};
    Object.keys(this.groupedResults).forEach((categoryKey) => {
      newCounts[categoryKey] = this.resultsBatchSize;
    });
    this.visibleCounts = newCounts;
  }

  // --- Recent Searches (Internal logic uses config Inputs) ---
  /**
   * Loads recent search terms from localStorage using the configured key.
   * Handles potential errors during parsing.
   */
  private loadRecentSearches(): void {
    // Only execute if the feature is enabled
    if (!this.enableRecentSearches) {
      this.recentSearches = [];
      return;
    }
    try {
      // Use the configurable key from Input property
      const storedSearches = localStorage.getItem(this.recentSearchesKey);
      this.recentSearches = storedSearches ? JSON.parse(storedSearches) : [];
    } catch (e) {
      console.error(
        `Error loading recent searches from localStorage (key: ${this.recentSearchesKey}):`,
        e
      );
      this.recentSearches = []; // Reset to empty array on error
    }
  }
  /**
   * Saves the current list of recent searches to localStorage using the configured key.
   * Handles potential errors during stringification or storage limits.
   */
  private saveRecentSearches(): void {
    // Only execute if the feature is enabled
    if (!this.enableRecentSearches) {
      return;
    }
    try {
      // Use the configurable key from Input property
      localStorage.setItem(
        this.recentSearchesKey,
        JSON.stringify(this.recentSearches)
      );
    } catch (e) {
      console.error(
        `Error saving recent searches to localStorage (key: ${this.recentSearchesKey}):`,
        e
      );
      // Decide how to handle storage errors (e.g., quota exceeded) - logging might be sufficient
    }
  }
  /**
   * Adds a new search term to the beginning of the recent searches list.
   * Ensures uniqueness (case-insensitive) and trims whitespace.
   * Limits the list size based on the `maxRecentSearches` input.
   * Saves the updated list to localStorage.
   * @param term The search term to add.
   */
  private addRecentSearch(term: string): void {
    // Only execute if the feature is enabled
    if (!this.enableRecentSearches) {
      return;
    }

    const trimmedTerm = term.trim();
    if (!trimmedTerm) return; // Don't add empty terms

    // Remove existing instance (case-insensitive) to move it to the top
    this.recentSearches = this.recentSearches.filter(
      (s) => s.toLowerCase() !== trimmedTerm.toLowerCase()
    );

    // Add the new term to the beginning
    this.recentSearches.unshift(trimmedTerm);

    // Limit the number of recent searches using the configurable limit from Input
    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(
        0,
        this.maxRecentSearches
      ); // More robust slicing
    }

    // Save the updated list
    this.saveRecentSearches();
  }

  // --- Template Helpers (Adapted) ---
  /**
   * Gets the keys (category names) from the grouped results, sorted alphabetically.
   * Used for iterating through the result groups in the template.
   * @returns An array of sorted category key strings.
   */
  getGroupedResultKeys(): CategoryKey[] {
    // Sort keys alphabetically for consistent display order
    return Object.keys(this.groupedResults).sort((a, b) => a.localeCompare(b));
  }
  getCurrentCategories(): string[] {
    // ... logic adjusted slightly ...
    const categoriesToShow = this.isInitial
      ? this.initialCategories
      : this.filteredCategories;
    const keys = Object.keys(categoriesToShow).filter(
      (k) => k !== this.allCategoryLabel
    );
    keys.sort((a, b) => a.localeCompare(b));
    // Add 'All' based on current view (results or initial with hidden 'All')
    if (!this.isInitial || (this.isInitial && !this.hideAllChicletInitial)) {
      if (categoriesToShow[this.allCategoryLabel] > 0 || this.isInitial) {
        // Show 'All' if results exist or if initial (and not hidden)
        keys.unshift(this.allCategoryLabel);
      }
    }
    return keys;
  }
  getCategoryCount(category: string): number {
    const counts = this.isInitial
      ? this.initialCategories
      : this.filteredCategories;
    return counts[category] ?? 0;
  }
  /**
   * Returns a slice of results for a given category based on the current visible count.
   * Uses the `resultsBatchSize` input for the initial/default count.
   * @param categoryKey The category identifier string.
   * @returns An array of data items (type T) to be displayed for the category.
   */
  getVisibleResultsForCategory(categoryKey: CategoryKey): T[] {
    const results = this.groupedResults[categoryKey] ?? [];
    // Use the input 'resultsBatchSize' as the default/initial visible count
    const count = this.visibleCounts[categoryKey] ?? this.resultsBatchSize;
    return results.slice(0, count);
  }
  /**
   * Returns the total number of filtered results within a specific category.
   * @param categoryKey The category identifier string.
   * @returns The total count of items in that category group.
   */
  getTotalResultsForCategory(categoryKey: CategoryKey): number {
    return this.groupedResults[categoryKey]?.length ?? 0; // Use optional chaining and nullish coalescing
  }
  shouldShowMoreLink(categoryKey: CategoryKey): boolean {
    // Check feature toggle first
    if (!this.showCategoryShowMoreLink) return false;
    // Logic remains the same
    const total = this.getTotalResultsForCategory(categoryKey);
    const visible = this.visibleCounts[categoryKey] ?? this.resultsBatchSize;
    return total > visible;
  }
  shouldShowCategoryShowAllLink(categoryKey: CategoryKey): boolean {
    // Check feature toggle first
    if (!this.showCategoryShowAllLink) return false;
    // Logic remains the same
    return this.getTotalResultsForCategory(categoryKey) > this.resultsBatchSize;
  }

  // --- TrackBy Functions (Adapted) ---
  trackItemById(index: number, item: T): any {
    return item?.[this.trackByIdField];
  } // Add safe navigation
  trackByTerm(index: number, term: string): string {
    return term;
  }
  trackByCategory(index: number, category: string): string {
    return category;
  }
}
