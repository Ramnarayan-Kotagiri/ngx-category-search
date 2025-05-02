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
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { HighlightPipe } from '../../pipes/highlight.pipe'; // Adjust path as needed

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
  imports: [CommonModule, ReactiveFormsModule, HighlightPipe],
  templateUrl: './category-search.component.html',
  styleUrl: './category-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategorySearchComponent<T extends SearchDataItem>
  implements OnInit, OnDestroy
{
  constructor(private cdr: ChangeDetectorRef, private elementRef: ElementRef) {}

  // --- CORE INPUTS ---
  @Input() data: T[] = [];
  @Input() searchResults: T[] | null = null;
  @Input({ required: true }) trackByIdField!: keyof T;
  @Input({ required: true }) nameField!: keyof T;
  @Input({ required: true }) categoryField!: keyof T;
  @Input() friendlyIdField: keyof T | null = null;

  // --- CONFIGURATION INPUTS ---
  @Input() placeholder: string = 'Search...';
  @Input() debounceMs: number = 300;
  @Input() resultsBatchSize: number = 5;
  @Input() initialDropdownState: 'closed' | 'openOnFocus' = 'openOnFocus';
  @Input() closeOnItemSelect: boolean = true;
  @Input() closeOnNavigate: boolean = true;

  // --- RECENT SEARCH CONFIGURATION ---
  @Input() enableRecentSearches: boolean = true;
  @Input() maxRecentSearches: number = 5;
  @Input() recentSearchesKey: string = 'ngx_category_search_recent';

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
  @Input() categoryHeaderTemplate: TemplateRef<{
    $implicit: { category: string; count: number };
    actions?: TemplateRef<any>;
  }> | null = null;
  @Input() noResultsTemplate: TemplateRef<{ $implicit: string }> | null = null;
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
  isInitial = true;

  // --- Lifecycle Hooks ---
  ngOnInit(): void {
    this.isInitial = true;
    this.activeCategory = this.allCategoryLabel;
    if (this.enableRecentSearches) {
      this.loadRecentSearches();
    }
    if (this.data && this.data.length > 0) {
      this.calculateInitialCategoryCounts();
    } else {
      this.initialCategories = { [this.allCategoryLabel]: 0 };
    }
    this.setupSearchDebounce();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.calculateInitialCategoryCounts();
      if (!this.searchTerm.value) {
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
        tap((term) => {
          this.isLoading = !!term;
          this.isInitial = !term;
          this.cdr.markForCheck();
        })
      )
      .subscribe((term) => {
        const trimmedTerm = term?.trim() ?? '';
        if (trimmedTerm) {
          if (this.enableRecentSearches) {
            this.addRecentSearch(trimmedTerm);
          }
          this.searchRequested.emit(trimmedTerm);
        } else {
          this.isLoading = false;
          this.resetToInitialState();
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

    this.calculateInitialCategoryCounts();

    if (this.enableRecentSearches && reloadRecent) {
      this.loadRecentSearches();
    }
    this.isInitial = true;
    this.cdr.markForCheck();
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
      console.log(
        `[NCS] Loading recent searches from key "${this.recentSearchesKey}":`,
        storedSearches
      );
      this.recentSearches = storedSearches ? JSON.parse(storedSearches) : [];
      console.log(`[NCS] Parsed recent searches:`, this.recentSearches);
    } catch (e) {
      console.error(
        `[NCS] Error loading recent searches (key: ${this.recentSearchesKey}):`,
        e
      );
      this.recentSearches = [];
    }
  }

  private saveRecentSearches(): void {
    if (!this.enableRecentSearches) return;
    try {
      const searchesToSave = JSON.stringify(this.recentSearches);
      console.log(
        `[NCS] Saving recent searches to key "${this.recentSearchesKey}":`,
        searchesToSave
      );
      localStorage.setItem(this.recentSearchesKey, searchesToSave);
    } catch (e) {
      console.error(
        `[NCS] Error saving recent searches (key: ${this.recentSearchesKey}):`,
        e
      );
    }
  }

  private addRecentSearch(term: string): void {
    if (!this.enableRecentSearches) return;
    const trimmedTerm = term.trim();
    if (!trimmedTerm) return;

    console.log(`[NCS] Attempting to add recent search: "${trimmedTerm}"`);
    console.log(`[NCS] Current recent searches (before add):`, [
      ...this.recentSearches,
    ]);

    const initialLength = this.recentSearches.length;
    this.recentSearches = this.recentSearches.filter(
      (s) => s.toLowerCase() !== trimmedTerm.toLowerCase()
    );
    if (this.recentSearches.length < initialLength) {
      console.log(`[NCS] Removed existing instance of "${trimmedTerm}"`);
    }

    this.recentSearches.unshift(trimmedTerm);
    console.log(`[NCS] Added "${trimmedTerm}" to beginning`);

    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(0, this.maxRecentSearches);
      console.log(
        `[NCS] Trimmed recent searches to max length: ${this.maxRecentSearches}`
      );
    }
    console.log(`[NCS] Current recent searches (after add/trim):`, [
      ...this.recentSearches,
    ]);

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