# mage-remote-run-plugin-amasty-b2b

> **Experimental** — command coverage and API behaviour are based on the Amasty B2B Suite
> modules available at the time of writing. Endpoints and response shapes may differ across
> Amasty versions. Use with care in production environments.

A [`mage-remote-run`](https://mage-remote-run.muench.dev) plugin that exposes the Amasty B2B Suite REST API as native CLI commands.

## Covered modules

| Namespace | Module | Key operations |
|---|---|---|
| `amasty company` | Company Account | CRUD, credit, customer assignment, addresses |
| `amasty quote` | Request for Quote (RFQ) | List, approve, expire, notes, cart & item management, guest carts |
| `amasty quickorder` | Quick Order | Product search by name/SKU |
| `amasty storecredit` | Store Credit | Apply, cancel, balance |
| `amasty attachment` | Product Attachments | Get by product/category, admin CRUD |
| `amasty wishlist` | Multiple Wishlists | CRUD, add/remove items, move to/from cart |

## Installation

```bash
mage-remote-run plugin register /path/to/mage-remote-run-plugin-amasty-b2b
```

## Command reference

### Company Account

```bash
# Company CRUD
mage-remote-run amasty company get --company-id 42
mage-remote-run amasty company create
mage-remote-run amasty company update --company-id 42
mage-remote-run amasty company delete --company-id 42

# Credit
mage-remote-run amasty company credit get --company-id 42
mage-remote-run amasty company credit update --id 7

# Customer assignment
mage-remote-run amasty company customer assign --company-id 42
mage-remote-run amasty company customer remove --customer-id 99

# Addresses
mage-remote-run amasty company address list --company-id 42
mage-remote-run amasty company address list-mine
mage-remote-run amasty company address get-mine --address-id 5
mage-remote-run amasty company address create-mine
mage-remote-run amasty company address delete-mine --address-id 5
```

### Request for Quote

```bash
# List with filters (uses standard Magento search criteria)
mage-remote-run amasty quote list
mage-remote-run amasty quote list --filter "status=pending_admin" --size 20
mage-remote-run amasty quote list --format json

# Quote operations
mage-remote-run amasty quote get --quote-id 15
mage-remote-run amasty quote approve --quote-id 15
mage-remote-run amasty quote expire --quote-id 15
mage-remote-run amasty quote check-email --customer-email buyer@example.com

# Notes
mage-remote-run amasty quote note customer --quote-id 15
mage-remote-run amasty quote note admin --quote-id 15

# Quote cart (customer self-service)
mage-remote-run amasty quote cart get-mine
mage-remote-run amasty quote cart create-mine
mage-remote-run amasty quote cart submit-mine
mage-remote-run amasty quote cart clear-mine
mage-remote-run amasty quote cart items list-mine
mage-remote-run amasty quote cart items add-mine
mage-remote-run amasty quote cart items delete-mine --item-id 3

# Quote cart (admin)
mage-remote-run amasty quote cart get --quote-id 15
mage-remote-run amasty quote cart cancel --quote-id 15
mage-remote-run amasty quote cart move-to-cart --quote-id 15
mage-remote-run amasty quote cart items list --quote-id 15

# Guest quote cart
mage-remote-run amasty quote guest-cart create
mage-remote-run amasty quote guest-cart get --quote-mask-id abc123
mage-remote-run amasty quote guest-cart submit --quote-mask-id abc123
mage-remote-run amasty quote guest-cart items list --quote-mask-id abc123
```

### Quick Order

```bash
mage-remote-run amasty quickorder search --search-term "hydraulic pump"
mage-remote-run amasty quickorder search --search-term "SKU-1234" --format json
```

### Store Credit

```bash
mage-remote-run amasty storecredit balance
mage-remote-run amasty storecredit apply
mage-remote-run amasty storecredit cancel
```

### Product Attachments

```bash
# Frontend (anonymous)
mage-remote-run amasty attachment get-by-product --product-id 101
mage-remote-run amasty attachment get-by-category --category-id 5

# Admin
mage-remote-run amasty attachment list
mage-remote-run amasty attachment list --filter "is_visible=1"
mage-remote-run amasty attachment get --file-id 8
mage-remote-run amasty attachment delete --file-id 8
```

### Multiple Wishlists

```bash
mage-remote-run amasty wishlist get
mage-remote-run amasty wishlist all
mage-remote-run amasty wishlist create
mage-remote-run amasty wishlist update --wishlist-id 3
mage-remote-run amasty wishlist delete --wishlist-id 3
mage-remote-run amasty wishlist add-product --wishlist-id 3
mage-remote-run amasty wishlist remove-item --wishlist-id 3 --item-id 17
mage-remote-run amasty wishlist move-to-cart --item-id 17
mage-remote-run amasty wishlist move-from-cart --cart-item-id 22
```

## Known limitations

- **`amasty quote list`** and **`amasty attachment list`** require admin-level API credentials
  (`Amasty_RequestQuote::manage_quotes` and `Amasty_ProductAttachment` ACL resources respectively).
  Ensure these are enabled in Admin → System → Integrations → your integration → API.
- Endpoints that pass `searchCriteria[...]` query params may return `signature invalid` on OAuth1
  connections where the integration does not have the required ACL resources. Re-saving the
  integration in the Magento Admin regenerates the tokens and resets any clock-skew issues.
- Amasty's note endpoints use a non-standard URL pattern
  (`/V1/amasty_quote/quote/note/customer:quoteId`) where the quote ID is appended directly after
  the resource type keyword.
- There is no `amasty company list` command because the Company Account module does not expose a
  search/list REST endpoint.

## Implementation notes

- **`amasty quote list`**, **`amasty quickorder search`**, **`amasty storecredit balance`**,
  **`amasty attachment list`**, and **`amasty wishlist all`** are JavaScript commands with rich
  table output and `--format json/xml` support.
- All other commands are static virtual commands that map directly to the Magento REST endpoint.
- Commands marked `(admin)` require admin API credentials. Commands without that note use the
  `self` resource and require a customer token.
