import chalk from 'chalk';

const SUPPORTED_TYPES = new Set([
  'ac-cloud-paas',
  'magento-os',
  'mage-os',
  'ac-on-prem',
  'ac-saas',
]);

/**
 * Returns an existing Commander command by name, or creates it if absent.
 * Needed because virtual commands from mage-remote-run.json are registered
 * before this plugin runs, so the amasty/* parent commands already exist.
 */
function getOrCreate(parent, name, description = '') {
  const existing = parent.commands.find((c) => c.name() === name);
  if (existing) return existing;
  return parent.command(name).description(description);
}

export default async function plugin(context) {
  const { program, profile, createClient, lib } = context;
  const {
    printTable,
    handleError,
    addFilterOption,
    addSortOption,
    addPaginationOptions,
    addFormatOption,
    buildSearchCriteria,
    formatOutput,
  } = lib.utils;

  if (!profile || !SUPPORTED_TYPES.has(profile.type)) {
    return;
  }

  const amasty = getOrCreate(program, 'amasty');

  // ─── amasty quote list ────────────────────────────────────────────────────

  const quoteCmd = getOrCreate(amasty, 'quote');
  const amquoteList = quoteCmd
    .command('list')
    .description('List Request for Quote (RFQ) records with filters and pagination');

  addFilterOption(amquoteList);
  addSortOption(amquoteList);
  addPaginationOptions(amquoteList);
  addFormatOption(amquoteList);

  amquoteList.action(async (options) => {
    try {
      const client = await createClient();
      const { params } = buildSearchCriteria(options);
      const result = await client.get('V1/amasty_quote/search', { params });

      if (formatOutput(options, result)) return;

      const items = result.items ?? [];
      if (items.length === 0) {
        console.log(chalk.gray('No quotes found.'));
        return;
      }

      printTable(
        ['ID', 'Status', 'Customer Email', 'Items', 'Created At'],
        items.map((q) => [
          q.entity_id ?? q.id ?? '',
          q.status ?? '',
          q.customer_email ?? '',
          q.items_count ?? '',
          q.created_at ?? '',
        ]),
      );

      if (result.total_count !== undefined) {
        console.log(chalk.gray(`Total: ${result.total_count}`));
      }
    } catch (error) {
      handleError(error);
    }
  });

  // ─── amasty quickorder search ─────────────────────────────────────────────

  const quickorderCmd = getOrCreate(amasty, 'quickorder');
  const quickorderSearch = quickorderCmd
    .command('search')
    .description('Search products by name or SKU for Quick Order (anonymous)')
    .requiredOption('--search-term <term>', 'Product name or SKU search term');

  addFormatOption(quickorderSearch);

  quickorderSearch.action(async (options) => {
    try {
      const client = await createClient();
      const result = await client.get('V1/amasty_quickorder/search', {
        params: { searchTerm: options.searchTerm },
      });

      if (formatOutput(options, result)) return;

      const items = Array.isArray(result) ? result : [];
      if (items.length === 0) {
        console.log(chalk.gray('No products found.'));
        return;
      }

      printTable(
        ['SKU', 'Name', 'Price', 'Qty'],
        items.map((p) => [p.sku ?? '', p.name ?? '', p.price ?? '', p.qty ?? '']),
      );
    } catch (error) {
      handleError(error);
    }
  });

  // ─── amasty storecredit balance ───────────────────────────────────────────

  const storecreditCmd = getOrCreate(amasty, 'storecredit');
  const storecreditBalance = storecreditCmd
    .command('balance')
    .description('Show store credit balance for the current authenticated customer');

  addFormatOption(storecreditBalance);

  storecreditBalance.action(async (options) => {
    try {
      const client = await createClient();
      const result = await client.get('V1/customers/me/amstorecredit');

      if (formatOutput(options, result)) return;

      if (result && typeof result === 'object') {
        printTable(
          ['Field', 'Value'],
          Object.entries(result).map(([k, v]) => [k, String(v ?? '')]),
        );
      } else {
        console.log(chalk.bold('Store Credit Balance:'), chalk.green(String(result)));
      }
    } catch (error) {
      handleError(error);
    }
  });

  // ─── amasty attachment list ───────────────────────────────────────────────

  const attachmentCmd = getOrCreate(amasty, 'attachment');
  const attachmentList = attachmentCmd
    .command('list')
    .description('List all product attachment files (admin)');

  addFilterOption(attachmentList);
  addSortOption(attachmentList);
  addPaginationOptions(attachmentList);
  addFormatOption(attachmentList);

  attachmentList.action(async (options) => {
    try {
      const client = await createClient();
      const { params } = buildSearchCriteria(options);
      const result = await client.get('V1/amasty_product_attachment/filemanage/files', { params });

      if (formatOutput(options, result)) return;

      const items = Array.isArray(result) ? result : (result.items ?? []);
      if (items.length === 0) {
        console.log(chalk.gray('No attachments found.'));
        return;
      }

      printTable(
        ['ID', 'Label', 'File Name', 'Type'],
        items.map((a) => [
          a.file_id ?? a.id ?? '',
          a.label ?? a.title ?? '',
          a.file_name ?? a.filename ?? '',
          a.file_type ?? a.type ?? '',
        ]),
      );
    } catch (error) {
      handleError(error);
    }
  });

  // ─── amasty wishlist all ──────────────────────────────────────────────────

  const wishlistCmd = getOrCreate(amasty, 'wishlist');
  const wishlistAll = wishlistCmd
    .command('all')
    .description('List all customer wishlists (admin)');

  addFormatOption(wishlistAll);

  wishlistAll.action(async (options) => {
    try {
      const client = await createClient();
      const result = await client.get('V1/amasty_mWishlist/wishlist/all');

      if (formatOutput(options, result)) return;

      const items = Array.isArray(result) ? result : (result.items ?? []);
      if (items.length === 0) {
        console.log(chalk.gray('No wishlists found.'));
        return;
      }

      printTable(
        ['ID', 'Name', 'Customer ID', 'Items Count'],
        items.map((w) => [
          w.wishlist_id ?? w.id ?? '',
          w.name ?? '',
          w.customer_id ?? '',
          w.items_count ?? '',
        ]),
      );
    } catch (error) {
      handleError(error);
    }
  });
}
