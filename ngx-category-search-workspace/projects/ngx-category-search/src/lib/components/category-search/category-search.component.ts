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
  ElementRef,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // Import DomSanitizer and SafeHtml
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { HighlightPipe } from '../../pipes/highlight.pipe'; // Adjust path as needed
import { MultiWordHighlightPipe } from '../../pipes/multi-word-highlight.pipe'; // Add this line

// --- Types ---
export type SearchDataItem = Record<string, any>;
type CategoryKey = string;
type GroupedResults<T> = { [key: CategoryKey]: T[] };
type CategoryCounts = { [key: CategoryKey]: number };
type VisibleCounts = { [key: CategoryKey]: number };

// Helper function (keep as is)
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Component({
  selector: 'ncs-category-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HighlightPipe, MultiWordHighlightPipe], // Add MultiWordHighlightPipe here
  templateUrl: './category-search.component.html',
  styleUrl: './category-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategorySearchComponent<T extends SearchDataItem>
  implements OnInit, OnDestroy
{
  constructor(private cdr: ChangeDetectorRef, private elementRef: ElementRef, private sanitizer: DomSanitizer) {} // Inject DomSanitizer

  // --- CORE INPUTS ---
  @Input() data: T[] | Record<CategoryKey, number> | null = null; // Modified type
  @Input() searchResults: T[] | null = null;
  @Input({ required: true }) trackByIdField!: keyof T;
  @Input({ required: true }) nameField!: keyof T;
  @Input({ required: true }) categoryField!: keyof T;
  @Input() friendlyIdField: keyof T | null = null;

  // --- CONFIGURATION INPUTS ---
  @Input() placeholder: string = 'Search...';
  @Input() debounceMs: number = 300;
  @Input() resultsBatchSize: number = 5;
  @Input() minSearchLength: number = 1; // New Input: Minimum characters to trigger search
  @Input() initialDropdownState: 'closed' | 'openOnFocus' = 'openOnFocus';
  @Input() closeOnItemSelect: boolean = true;
  @Input() closeOnNavigate: boolean = true;

  // --- RECENT SEARCH CONFIGURATION ---
  @Input() enableRecentSearches: boolean = true;
  @Input() maxRecentSearches: number = 5;
  @Input() recentSearchesKey: string = 'ngx_category_search_recent';

  // --- "SEARCH FOR TERM" LINE CONFIGURATION ---
  @Input() showSearchForTermLine: boolean = false;
  @Input() searchForTermFormat: string = 'Search for {term}';

  // --- UI LABEL INPUTS ---
  @Input() allCategoryLabel: string = 'All';
  @Input() recentSearchesLabel: string = 'Recent Searches';
  @Input() noRecentSearchesLabel: string = 'No recent searches.';
  @Input() noResultsLabel: string = 'No results found for';
  @Input() showAllResultsLabel: string = 'Show all';
  @Input() showMoreLabel: string = 'Show more';
  @Input() showAllCategoryLabel: string = 'Show all';

  // --- FEATURE TOGGLE INPUTS ---
  @Input() showBottomShowAllButton: boolean = true;
  @Input() showCategoryShowAllLink: boolean = true;
  @Input() showCategoryShowMoreLink: boolean = true;
  @Input() showInitialCategories: boolean = true;
  @Input() showResultCategories: boolean = true;
  @Input() hideAllChicletInitial: boolean = true;
  @Input() showChicletContainerBorder: boolean = true;

  // --- CUSTOM TEMPLATE INPUTS ---
  @Input() inputPrefixTemplate: TemplateRef<any> | null = null;
  @Input() inputSuffixTemplate: TemplateRef<any> | null = null;
  @Input() resultItemTemplate: TemplateRef<{
    $implicit: T;
    term: string;
  }> | null = null;
  @Input() recentItemTemplate: TemplateRef<{ $implicit: string }> | null = null;
  @Input() chicletTemplate: TemplateRef<{
    $implicit: {
      category: string;
      count: number;
      isActive: boolean;
      type: 'initial' | 'results';
    };
  }> | null = null;
  @Input() chicletContentTemplate: TemplateRef<{
    $implicit: {
      category: string;
      count: number;
      isActive: boolean;
      type: 'initial' | 'results';
    };
  }> | null = null;
  @Input() categoryHeaderTemplate: TemplateRef<{
    $implicit: { category: string; count: number };
    actions?: TemplateRef<any>;
  }> | null = null;
  @Input() categoryHeaderContentTemplate: TemplateRef<{
    $implicit: { category: string; count: number };
  }> | null = null;
  @Input() noResultsTemplate: TemplateRef<{ $implicit: string, isTermTooShort?: boolean, minSearchLengthVal?: number }> | null = null; // Updated type
  @Input() loadingTemplate: TemplateRef<any> | null = null;

  // --- OUTPUTS ---
  @Output() searchRequested = new EventEmitter<string>();
  @Output() itemSelected = new EventEmitter<T>();
  @Output() recentSearchSelected = new EventEmitter<string>();
  @Output() categorySelected = new EventEmitter<string>();
  @Output() showMoreClicked = new EventEmitter<string>();
  @Output() navigateToCategory = new EventEmitter<{
    term: string;
    category: string;
  }>();
  @Output() navigateToAll = new EventEmitter<{ term: string }>();
  @Output() searchCleared = new EventEmitter<void>();
  @Output() searchTermChanged = new EventEmitter<string>();
  @Output() dropdownVisibilityChanged = new EventEmitter<boolean>();
  @Output() searchForTermClicked = new EventEmitter<string>();
  @Output() enterKeyPressed = new EventEmitter<string>(); // New Output

  // --- Internal State Properties ---
  searchTerm = new FormControl('');
  isDropdownVisible = false;
  isLoading = false;
  activeCategory!: string;
  _isTermTooShort = false; // New internal flag

  initialCategories: CategoryCounts = {};
  recentSearches: string[] = [];

  filteredResults: T[] = [];
  groupedResults: GroupedResults<T> = {};
  filteredCategories: CategoryCounts = {};
  visibleCounts: VisibleCounts = {};

  private searchSubscription: Subscription | null = null;
  isInitial = true;

  // --- Lifecycle Hooks ---
  ngOnInit(): void {
    this.isInitial = true;
    this.activeCategory = this.allCategoryLabel;
    if (this.enableRecentSearches) {
      this.loadRecentSearches();
    }
    // Directly call calculateInitialCategoryCounts. It handles null/empty data.
    this.calculateInitialCategoryCounts();
    this.setupSearchDebounce();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.calculateInitialCategoryCounts(); // Recalculate if data input changes
      if (!this.searchTerm.value) {
        // If search term is empty, ensure we are in initial state.
        // resetToInitialState will call calculateInitialCategoryCounts again.
        this.resetToInitialState(false);
      }
      this.cdr.markForCheck();
    }

    if (changes['searchResults']) {
      this.isLoading = false;
      const newResults = changes['searchResults'].currentValue;

      if (newResults && newResults.length > 0) {
        this.filteredResults = newResults;
        this.groupResults();
        this.calculateFilteredCategoryCounts();
        this.resetVisibleCounts();
        this.isInitial = false;
        if (this.isDropdownVisible) {
          this.setDropdownVisibility(true);
        }
      } else {
        this.filteredResults = [];
        this.groupedResults = {};
        this.filteredCategories = { [this.allCategoryLabel]: 0 };
        this.visibleCounts = {};
        this.isInitial = !this.searchTerm.value;
        if (this.isDropdownVisible) {
          this.setDropdownVisibility(true);
        }
      }
      this.cdr.markForCheck();
    }

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
  }

  private setDropdownVisibility(visible: boolean): void {
    if (this.isDropdownVisible !== visible) {
      this.isDropdownVisible = visible;
      this.dropdownVisibilityChanged.emit(visible);
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      if (this.isDropdownVisible) {
        this.setDropdownVisibility(false);
      }
      // *** ADDED: Clear search term on outside click ***
      if (this.searchTerm.value) {
          this.searchTerm.setValue(''); // This triggers valueChanges -> resetToInitialState
          this.searchCleared.emit(); // Optionally emit clear event
      }
    }
  }

  onFocus(): void {
    this.setDropdownVisibility(true);
    if (!this.searchTerm.value) {
      this.resetToInitialState();
    }
    this.cdr.markForCheck();
  }

  onBlur(): void {}

  clearSearch(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.searchTerm.setValue('');
    this.searchCleared.emit();
    this.setDropdownVisibility(true);
    this.elementRef.nativeElement.querySelector('input')?.focus();
  }

  selectCategory(category: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.activeCategory === category) return;

    this.activeCategory = category;
    if (!this.isInitial) {
      this.categorySelected.emit(category);
    }
    if (category === this.allCategoryLabel) {
      this.resetVisibleCounts();
    }
    this.setDropdownVisibility(true);
    this.cdr.markForCheck();
  }

  selectRecentSearch(term: string, event?: Event): void {
    if (event) event.stopPropagation();

    this.searchTerm.setValue(term);
    this.recentSearchSelected.emit(term);
    this.setDropdownVisibility(true);
    this.elementRef.nativeElement.querySelector('input')?.focus();
  }

  onItemSelected(item: T, event?: Event): void {
    if (event) event.stopPropagation();
    this.itemSelected.emit(item);
    this.setDropdownVisibility(true);
    this.elementRef.nativeElement.querySelector('input')?.focus();
  }

  onShowMore(categoryKey: CategoryKey, event: MouseEvent): void {
    event.stopPropagation();
    const currentGroup = this.groupedResults[categoryKey];
    if (currentGroup) {
      this.visibleCounts[categoryKey] = currentGroup.length;
      if (this.activeCategory !== categoryKey) {
        this.activeCategory = categoryKey;
        this.categorySelected.emit(categoryKey);
      }
      this.showMoreClicked.emit(categoryKey);
      this.setDropdownVisibility(true);
      this.cdr.markForCheck();
    }
  }

  onNavigateToCategorySearch(categoryKey: CategoryKey, event: MouseEvent): void {
    event.stopPropagation();
    const term = this.searchTerm.value || '';
    this.navigateToCategory.emit({ term, category: categoryKey });
    this.setDropdownVisibility(true);
    this.elementRef.nativeElement.querySelector('input')?.focus();
  }

  onNavigateToAllResultsPage(event: MouseEvent): void {
    event.stopPropagation();
    const term = this.searchTerm.value || '';
    this.navigateToAll.emit({ term });
    this.setDropdownVisibility(true);
    this.elementRef.nativeElement.querySelector('input')?.focus();
  }

  // --- "SEARCH FOR TERM" LINE METHODS ---
  getFormattedSearchForTermText(): SafeHtml { // Return SafeHtml
    const term = this.searchTerm.value || '';
    // The format string might contain simple HTML like <b>{term}</b>
    // The term itself is plain text.
    const formattedString = this.searchForTermFormat.replace('{term}', term);
    return this.sanitizer.bypassSecurityTrustHtml(formattedString);
  }

  onSearchForTermLineClick(): void {
    const term = this.searchTerm.value || '';
    if (term) {
      this.searchForTermClicked.emit(term);
      // Optionally, you might want to close the dropdown or perform other actions here
      // For example, if you want to keep the dropdown open and input focused:
      // this.setDropdownVisibility(true);
      // this.elementRef.nativeElement.querySelector('input')?.focus();
    }
  }

  // Method to handle Enter key press on the input
  onInputEnterKey(event: Event): void { // Changed KeyboardEvent to Event
    event.preventDefault(); // Prevent default browser action for Enter key
    const term = this.searchTerm.value || '';
    this.enterKeyPressed.emit(term);
  }

  private setupSearchDebounce(): void {
    this.searchSubscription = this.searchTerm.valueChanges
      .pipe(
        tap((term) => {
          this.searchTermChanged.emit(term ?? '');
          if (term && !this.isDropdownVisible) {
            this.setDropdownVisibility(true);
          }
        }),
        debounceTime(this.debounceMs),
        distinctUntilChanged(),
        tap((term) => { // This tap is after debounce, before subscribe's main logic
          const trimmedTerm = term?.trim() ?? '';
          if (trimmedTerm && trimmedTerm.length >= this.minSearchLength) {
            this.isLoading = true;
            this.isInitial = false;
          } else {
            this.isLoading = false;
            this.isInitial = !trimmedTerm; // true if empty, false if present but too short
          }
          this.cdr.markForCheck();
        })
      )
      .subscribe((term) => {
        const trimmedTerm = term?.trim() ?? '';
        this._isTermTooShort = false; // Reset flag

        if (trimmedTerm && trimmedTerm.length >= this.minSearchLength) {
          if (this.enableRecentSearches) {
            this.addRecentSearch(trimmedTerm);
          }
          this.searchRequested.emit(trimmedTerm);
          // isLoading is already true from the tap operator
        } else if (trimmedTerm && trimmedTerm.length > 0 && trimmedTerm.length < this.minSearchLength) {
          // Term is present but too short.
          this._isTermTooShort = true;
          this.isLoading = false; // Ensure loading is off (already set in tap)
          this.filteredResults = []; // Clear results
          this.groupedResults = {};
          this.filteredCategories = {}; // Clear categories
          this.visibleCounts = {};
          // isInitial is false (set in tap), so noResultsTemplate will be shown
          this.cdr.markForCheck();
        } else { // Empty term
          // isLoading is false (set in tap)
          this.resetToInitialState(); // This sets isInitial = true
          if (
            document.activeElement ===
            this.elementRef.nativeElement.querySelector('input')
          ) {
            this.setDropdownVisibility(true);
          }
          this.cdr.markForCheck();
        }
      });
  }

  private resetToInitialState(reloadRecent = true): void {
    this.filteredResults = [];
    this.groupedResults = {};
    this.filteredCategories = {};
    this.visibleCounts = {};
    this.activeCategory = this.allCategoryLabel;
    this.isLoading = false;
    this._isTermTooShort = false; // Ensure flag is reset here too

    this.calculateInitialCategoryCounts(); // This will use the updated logic

    if (this.enableRecentSearches && reloadRecent) {
      this.loadRecentSearches();
    }
    this.isInitial = true;
    this.cdr.markForCheck();
  }

  private calculateInitialCategoryCounts(): void {
    if (!this.data) {
      this.initialCategories = { [this.allCategoryLabel]: 0 };
      this.cdr.markForCheck();
      return;
    }

    const counts: CategoryCounts = {};
    let total = 0;

    if (Array.isArray(this.data)) {
      // Logic for when data is T[]
      const dataArray = this.data as T[]; // Cast for type safety within this block
      if (dataArray.length === 0) {
        this.initialCategories = { [this.allCategoryLabel]: 0 };
        this.cdr.markForCheck();
        return;
      }
      for (const item of dataArray) {
        const category =
          (item[this.categoryField] as CategoryKey | undefined) ??
          'Uncategorized';
        counts[category] = (counts[category] || 0) + 1;
        total++;
      }
    } else if (typeof this.data === 'object' && this.data !== null) {
      // Logic for when data is Record<CategoryKey, number>
      const dataAsObject = this.data as Record<CategoryKey, number>; // Cast
      if (Object.keys(dataAsObject).length === 0) {
          this.initialCategories = { [this.allCategoryLabel]: 0 };
          this.cdr.markForCheck();
          return;
      }
      for (const [category, count] of Object.entries(dataAsObject)) {
        if (typeof count === 'number') {
          counts[category] = count;
          total += count;
        } else {
          // Handle cases where a value in the object is not a number, if necessary
          // For now, we'll ignore non-numeric counts for specific categories
          // but they won't contribute to the 'All' total unless explicitly handled.
        }
      }
    } else {
      // Should not happen if type is T[] | Record<CategoryKey, number> | null
      this.initialCategories = { [this.allCategoryLabel]: 0 };
      this.cdr.markForCheck();
      return;
    }

    counts[this.allCategoryLabel] = total;
    this.initialCategories = counts;
    this.cdr.markForCheck();
  }

  private calculateFilteredCategoryCounts(): void {
    const counts: CategoryCounts = {};
    let total = 0;
    if (!this.filteredResults) {
      this.filteredCategories = { [this.allCategoryLabel]: 0 };
      return;
    }
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
    const groups: GroupedResults<T> = {};
    if (!this.filteredResults) {
      this.groupedResults = {};
      return;
    }
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

  private loadRecentSearches(): void {
    if (!this.enableRecentSearches) {
      this.recentSearches = [];
      return;
    }
    try {
      const storedSearches = localStorage.getItem(this.recentSearchesKey);
      this.recentSearches = storedSearches ? JSON.parse(storedSearches) : [];
    } catch (e) {
      this.recentSearches = [];
    }
  }

  private saveRecentSearches(): void {
    if (!this.enableRecentSearches) return;
    try {
      const searchesToSave = JSON.stringify(this.recentSearches);
      localStorage.setItem(this.recentSearchesKey, searchesToSave);
    } catch (e) {}
  }

  private addRecentSearch(term: string): void {
    if (!this.enableRecentSearches) return;
    const trimmedTerm = term.trim();
    if (!trimmedTerm) return;

    const initialLength = this.recentSearches.length;
    this.recentSearches = this.recentSearches.filter(
      (s) => s.toLowerCase() !== trimmedTerm.toLowerCase()
    );

    this.recentSearches.unshift(trimmedTerm);

    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(0, this.maxRecentSearches);
    }

    this.saveRecentSearches();
    this.cdr.markForCheck();
  }

  getGroupedResultKeys(): CategoryKey[] {
    return Object.keys(this.groupedResults).sort((a, b) => a.localeCompare(b));
  }

  getCurrentCategories(): string[] {
    const categoriesToShow = this.isInitial
      ? this.initialCategories
      : this.filteredCategories;

    const keys = categoriesToShow
      ? Object.keys(categoriesToShow).filter(
          (k) => k !== this.allCategoryLabel
        )
      : [];

    keys.sort((a, b) => a.localeCompare(b));

    if (
      !this.isInitial ||
      (this.isInitial && !this.hideAllChicletInitial)
    ) {
      if (
        (categoriesToShow &&
          categoriesToShow[this.allCategoryLabel] > 0) ||
        this.isInitial
      ) {
        keys.unshift(this.allCategoryLabel);
      }
    }
    return keys;
  }

  getCategoryCount(category: string): number {
    const counts = this.isInitial
      ? this.initialCategories
      : this.filteredCategories;
    return counts?.[category] ?? 0;
  }

  getVisibleResultsForCategory(categoryKey: CategoryKey): T[] {
    const results = this.groupedResults[categoryKey] ?? [];
    const count = this.visibleCounts[categoryKey] ?? this.resultsBatchSize;
    return results.slice(0, count);
  }

  getTotalResultsForCategory(categoryKey: CategoryKey): number {
    return this.groupedResults[categoryKey]?.length ?? 0;
  }

  shouldShowMoreLink(categoryKey: CategoryKey): boolean {
    if (!this.showCategoryShowMoreLink) return false;
    const total = this.getTotalResultsForCategory(categoryKey);
    const visible = this.visibleCounts[categoryKey] ?? this.resultsBatchSize;
    return total > visible;
  }

  shouldShowCategoryShowAllLink(categoryKey: CategoryKey): boolean {
    if (!this.showCategoryShowAllLink) return false;
    return this.getTotalResultsForCategory(categoryKey) > this.resultsBatchSize;
  }

  trackItemById(index: number, item: T): any {
    return item?.[this.trackByIdField];
  }
  trackByTerm(index: number, term: string): string {
    return term;
  }
  trackByCategory(index: number, category: string): string {
    return category;
  }
}