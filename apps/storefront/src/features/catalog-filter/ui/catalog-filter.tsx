export function CatalogFilter() {
  return (
    <div className="flex flex-col gap-2 sm:max-w-xs">
      <label className="text-sm font-medium text-brand-heading" htmlFor="catalog-sort-placeholder">
        Фильтр
      </label>
      <div className="relative">
        <select
          id="catalog-sort-placeholder"
          className="h-9 w-full appearance-none rounded-md border border-white/20 bg-white/10 px-3 pr-10 text-sm text-brand-heading outline-none disabled:cursor-not-allowed disabled:opacity-70"
          defaultValue=""
          disabled
        >
          <option value="" disabled>
            Выберите фильтр
          </option>
          <option value="price">Фильтровать по цене</option>
          <option value="rating">Фильтровать по рейтингу</option>
        </select>
      </div>
    </div>
  );
}
