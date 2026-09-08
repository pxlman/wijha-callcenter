export class PageMeta {
  total!: number;
  page!: number;
  limit!: number;
}

export class Paginated<T> {
  data!: T[];
  meta!: PageMeta;
}
